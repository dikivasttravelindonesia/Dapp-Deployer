import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, ShieldAlert, Droplets } from "lucide-react";
import { useWallet } from "@/contexts/wallet";
import { useToast } from "@/hooks/use-toast";
import { displayToStroops, stroopsToDisplay } from "@/lib/stellar";
import {
  buildAddLiquidityTransaction,
  buildRemoveLiquidityTransaction,
  submitSignedTransaction,
} from "@/lib/dlmm-client";
import {
  hasTestusdTrustline,
  buildEstablishTrustlineTransaction,
  submitSignedClassicTransaction,
} from "@/lib/trustline";
import { useRequestTestusdFaucet } from "@workspace/api-client-react";
import { DEFAULT_POOL_ID, TOKEN_Y } from "@/lib/contracts";

export type LiquidityStrategy = "spot" | "curve" | "bidask";

interface LiquidityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "remove";
  binId: number;
  tokenXSymbol: string;
  tokenYSymbol: string;
  /** Numeric pool_id inside the DLMM registry contract. Defaults to the seeded Standard Pool. */
  poolId?: number;
  initialStrategy?: LiquidityStrategy;
  onSuccess?: () => void;
}

const STRATEGIES: { id: LiquidityStrategy; label: string; description: string }[] = [
  { id: "spot", label: "Spot", description: "Even liquidity across the range above active bin" },
  { id: "curve", label: "Curve", description: "Concentrated near the active bin" },
  { id: "bidask", label: "Bid-Ask", description: "Concentrated at the far end of the range" },
];

function rawWeight(strategy: LiquidityStrategy, offset: number, radius: number): number {
  if (strategy === "spot") return 1;
  if (strategy === "curve") return radius + 1 - offset; // heavier near active bin
  return offset + 1; // bid-ask: heavier far from active bin
}

/**
 * Weights for single-sided X deposit: offsets 0..+radius only.
 * Bins at/above the active bin hold only token X (XLM), so we deposit
 * only there with amountY = 0.
 */
function xOnlyWeights(
  strategy: LiquidityStrategy,
  radius: number
): { offset: number; weight: number }[] {
  // offsets 0, 1, 2, … radius
  const offsets = Array.from({ length: radius + 1 }, (_, i) => i);
  const raw = offsets.map((o) => rawWeight(strategy, o, radius));
  const sum = raw.reduce((a, b) => a + b, 0);
  return offsets.map((o, i) => ({ offset: o, weight: sum > 0 ? raw[i] / sum : 1 / offsets.length }));
}

export function LiquidityModal({
  open,
  onOpenChange,
  mode,
  binId,
  tokenXSymbol,
  tokenYSymbol,
  poolId = DEFAULT_POOL_ID,
  initialStrategy = "spot",
  onSuccess,
}: LiquidityModalProps) {
  const wallet = useWallet();
  const { toast } = useToast();
  const faucet = useRequestTestusdFaucet();

  const [amountX, setAmountX] = useState("");
  const [strategy, setStrategy] = useState<LiquidityStrategy>(initialStrategy);
  const [radius, setRadius] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const involvesTestusd = tokenXSymbol === TOKEN_Y.symbol || tokenYSymbol === TOKEN_Y.symbol;
  const [trustlineChecked, setTrustlineChecked] = useState(false);
  const [hasTrustline, setHasTrustline] = useState(true);
  const [establishingTrustline, setEstablishingTrustline] = useState(false);
  const [requestingFaucet, setRequestingFaucet] = useState(false);

  useEffect(() => {
    if (!open) {
      setTrustlineChecked(false);
      setStrategy(initialStrategy);
      setAmountX("");
      return;
    }
    // Single-sided XLM deposit: we don't need to check TESTUSD trustline for adding
    // (we're only depositing XLM). Keep check only for edge cases where tokenX is TESTUSD.
    if (mode !== "add" || !involvesTestusd || !wallet.address) {
      setTrustlineChecked(true);
      setHasTrustline(true);
      return;
    }
    // If tokenX is TESTUSD (user added liquidity to a TESTUSD/X pool), check trustline
    if (tokenXSymbol !== TOKEN_Y.symbol) {
      // tokenX is XLM, single-sided XLM deposit — no trustline needed
      setTrustlineChecked(true);
      setHasTrustline(true);
      return;
    }
    setTrustlineChecked(false);
    hasTestusdTrustline(wallet.address).then((ok) => {
      setHasTrustline(ok);
      setTrustlineChecked(true);
    });
  }, [open, mode, involvesTestusd, wallet.address, initialStrategy, tokenXSymbol]);

  async function handleEstablishTrustline() {
    if (!wallet.address) return;
    setEstablishingTrustline(true);
    try {
      const tx = await buildEstablishTrustlineTransaction(wallet.address);
      const signedXdr = await wallet.signTransaction(tx.toXDR());
      await submitSignedClassicTransaction(signedXdr);
      toast({ title: "TESTUSD trustline established" });
      setHasTrustline(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to establish trustline",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setEstablishingTrustline(false);
    }
  }

  async function handleFaucet() {
    if (!wallet.address) return;
    setRequestingFaucet(true);
    try {
      await faucet.mutateAsync({ data: { address: wallet.address } });
      toast({ title: "500 TESTUSD sent to your wallet" });
      await wallet.refreshBalance();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Faucet request failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRequestingFaucet(false);
    }
  }

  async function handleSubmit() {
    if (!wallet.connected || !wallet.address) {
      toast({ variant: "destructive", title: "Connect a wallet first" });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "add") {
        if (!amountX || parseFloat(amountX) <= 0) {
          throw new Error(`Enter an ${tokenXSymbol} amount to deposit`);
        }
        const splits = xOnlyWeights(strategy, radius);
        const totalX = displayToStroops(amountX);

        setProgress({ done: 0, total: splits.length });
        for (let i = 0; i < splits.length; i++) {
          const { offset, weight } = splits[i];
          const amtX = BigInt(Math.floor(Number(totalX) * weight));
          if (amtX <= 0n) {
            setProgress({ done: i + 1, total: splits.length });
            continue;
          }
          const prepared = await buildAddLiquidityTransaction(
            wallet.address,
            binId + offset,
            amtX,
            0n, // single-sided: no tokenY deposited
            poolId
          );
          const signedXdr = await wallet.signTransaction(prepared.toXDR());
          await submitSignedTransaction(signedXdr);
          setProgress({ done: i + 1, total: splits.length });
        }
      } else {
        const prepared = await buildRemoveLiquidityTransaction(wallet.address, binId, poolId);
        const signedXdr = await wallet.signTransaction(prepared.toXDR());
        await submitSignedTransaction(signedXdr);
      }

      toast({
        title: mode === "add" ? "Liquidity added on-chain" : "Liquidity removed on-chain",
        description:
          mode === "add"
            ? `Deposited ${amountX} ${tokenXSymbol} across ${radius + 1} bins using the ${strategy} strategy.`
            : "Transaction confirmed on Stellar testnet.",
      });
      setAmountX("");
      await wallet.refreshBalance();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: mode === "add" ? "Add liquidity failed" : "Remove liquidity failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  const needsTrustlineGate =
    mode === "add" && involvesTestusd && trustlineChecked && !hasTrustline;

  // Preview weights for bar chart (x-only bins)
  const previewWeights = xOnlyWeights(strategy, radius);
  const totalXNum = parseFloat(amountX || "0");
  const binCount = radius + 1; // only bins at/above active bin

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-liquidity">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Liquidity" : "Remove Liquidity"} (active bin {binId})
          </DialogTitle>
        </DialogHeader>

        {mode === "add" && involvesTestusd && !trustlineChecked && (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {needsTrustlineGate ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-amber-300">TESTUSD trustline required</p>
                <p className="text-muted-foreground text-xs">
                  {TOKEN_Y.symbol} is a classic-asset-backed token. Your wallet needs a one-time
                  trustline before it can hold or receive it.
                </p>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleEstablishTrustline}
              disabled={establishingTrustline}
              data-testid="button-establish-trustline"
            >
              {establishingTrustline ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Waiting for signature…
                </>
              ) : (
                "Establish TESTUSD trustline"
              )}
            </Button>
          </div>
        ) : mode === "add" && trustlineChecked ? (
          <div className="space-y-4 py-2">
            {involvesTestusd && tokenXSymbol === TOKEN_Y.symbol && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleFaucet}
                disabled={requestingFaucet || faucet.isPending}
                data-testid="button-faucet-testusd"
              >
                {requestingFaucet ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Requesting…
                  </>
                ) : (
                  <>
                    <Droplets className="w-4 h-4 mr-2" />
                    Get 500 TESTUSD (testnet faucet)
                  </>
                )}
              </Button>
            )}

            {/* Single-sided deposit notice */}
            <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Single-sided deposit</span> — you only
              need to provide <span className="font-medium text-primary">{tokenXSymbol}</span>.
              Funds are deposited into bins at and above the active bin, where only{" "}
              {tokenXSymbol} is held.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Strategy
              </label>
              <ToggleGroup
                type="single"
                value={strategy}
                onValueChange={(v) => v && setStrategy(v as LiquidityStrategy)}
                className="grid grid-cols-3 gap-2"
              >
                {STRATEGIES.map((s) => (
                  <ToggleGroupItem
                    key={s.id}
                    value={s.id}
                    className="flex-col h-auto py-2 gap-0.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    data-testid={`strategy-${s.id}`}
                  >
                    <span className="text-sm font-semibold">{s.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-[11px] text-muted-foreground">
                {STRATEGIES.find((s) => s.id === strategy)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bin range
                </label>
                <span className="text-xs font-mono">
                  {binCount} bin{binCount !== 1 ? "s" : ""} (active +{radius})
                </span>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[radius]}
                onValueChange={([v]) => setRadius(v)}
                data-testid="slider-bin-range"
              />
              {/* Bar chart — only positive-side bins (offset 0..+radius) */}
              <div className="flex h-6 items-end gap-[2px]" data-testid="bin-distribution-preview">
                {previewWeights.map(({ offset, weight }) => (
                  <div
                    key={offset}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${Math.max(8, weight * previewWeights.length * 40)}%` }}
                    title={`bin ${binId + offset}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>active ({binId})</span>
                <span>+{radius} ({binId + radius})</span>
              </div>
            </div>

            {/* Single amount input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amount to deposit
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountX}
                  onChange={(e) => setAmountX(e.target.value)}
                  className="pr-16"
                  data-testid="input-liquidity-amount-x"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">
                  {tokenXSymbol}
                </span>
              </div>
            </div>

            {totalXNum > 0 && (
              <div className="rounded-md bg-secondary/30 border border-border p-2.5 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Deposit breakdown</p>
                {previewWeights.map(({ offset, weight }) => {
                  const amt = (totalXNum * weight).toFixed(4);
                  return (
                    <div key={offset} className="flex justify-between">
                      <span>
                        Bin {binId + offset}
                        {offset === 0 && (
                          <span className="ml-1 text-primary font-medium">(active)</span>
                        )}
                      </span>
                      <span className="font-mono">
                        {amt} {tokenXSymbol}
                      </span>
                    </div>
                  );
                })}
                <p className="pt-1 border-t border-border/50">
                  {binCount} transaction{binCount !== 1 ? "s" : ""} to sign (one per bin).
                </p>
              </div>
            )}
          </div>
        ) : mode === "remove" ? (
          <p className="text-sm text-muted-foreground py-2">
            This withdraws your entire position from bin {binId} back to your wallet.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !wallet.connected ||
              (mode === "add" && (needsTrustlineGate || !trustlineChecked))
            }
            data-testid="button-confirm-liquidity"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress
                  ? `Confirming bin ${progress.done}/${progress.total}…`
                  : "Waiting for signature…"}
              </>
            ) : !wallet.connected ? (
              "Connect wallet to continue"
            ) : mode === "add" ? (
              `Add ${tokenXSymbol} to ${binCount} bin${binCount !== 1 ? "s" : ""}`
            ) : (
              "Confirm Remove Liquidity"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export for display helpers used elsewhere (e.g. estimated per-bin amounts).
export { stroopsToDisplay };
