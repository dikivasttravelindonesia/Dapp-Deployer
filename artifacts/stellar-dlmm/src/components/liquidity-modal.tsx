import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/wallet";
import { useToast } from "@/hooks/use-toast";
import { displayToStroops } from "@/lib/stellar";
import {
  buildAddLiquidityTransaction,
  buildRemoveLiquidityTransaction,
  submitSignedTransaction,
} from "@/lib/dlmm-client";
import { DEFAULT_POOL_ID } from "@/lib/contracts";

interface LiquidityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "remove";
  binId: number;
  tokenXSymbol: string;
  tokenYSymbol: string;
  /** Numeric pool_id inside the DLMM registry contract. Defaults to the seeded Standard Pool. */
  poolId?: number;
  onSuccess?: () => void;
}

export function LiquidityModal({
  open,
  onOpenChange,
  mode,
  binId,
  tokenXSymbol,
  tokenYSymbol,
  poolId = DEFAULT_POOL_ID,
  onSuccess,
}: LiquidityModalProps) {
  const wallet = useWallet();
  const { toast } = useToast();
  const [amountX, setAmountX] = useState("");
  const [amountY, setAmountY] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!wallet.connected || !wallet.address) {
      toast({ variant: "destructive", title: "Connect a wallet first" });
      return;
    }
    setSubmitting(true);
    try {
      let prepared;
      if (mode === "add") {
        if (!amountX || !amountY || parseFloat(amountX) <= 0 || parseFloat(amountY) <= 0) {
          throw new Error(`Enter both ${tokenXSymbol} and ${tokenYSymbol} amounts`);
        }
        prepared = await buildAddLiquidityTransaction(
          wallet.address,
          binId,
          displayToStroops(amountX),
          displayToStroops(amountY),
          poolId
        );
      } else {
        prepared = await buildRemoveLiquidityTransaction(wallet.address, binId, poolId);
      }

      const signedXdr = await wallet.signTransaction(prepared.toXDR());
      await submitSignedTransaction(signedXdr);

      toast({
        title: mode === "add" ? "Liquidity added on-chain" : "Liquidity removed on-chain",
        description: "Transaction confirmed on Stellar testnet.",
      });
      setAmountX("");
      setAmountY("");
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-liquidity">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Liquidity" : "Remove Liquidity"} (bin {binId})
          </DialogTitle>
        </DialogHeader>

        {mode === "add" ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tokenXSymbol} amount
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={amountX}
                onChange={(e) => setAmountX(e.target.value)}
                data-testid="input-liquidity-amount-x"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tokenYSymbol} amount
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={amountY}
                onChange={(e) => setAmountY(e.target.value)}
                data-testid="input-liquidity-amount-y"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            This withdraws your entire position from bin {binId} back to your wallet.
          </p>
        )}

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !wallet.connected}
            data-testid="button-confirm-liquidity"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Waiting for signature…</>
            ) : !wallet.connected ? (
              "Connect wallet to continue"
            ) : mode === "add" ? (
              "Confirm Add Liquidity"
            ) : (
              "Confirm Remove Liquidity"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
