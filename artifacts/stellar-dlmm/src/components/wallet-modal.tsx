/**
 * WalletModal — wallet selection dialog + connected state display
 *
 * Shows two connection options:
 *   • Freighter (browser extension)
 *   • Albedo (web-based non-custodial)
 *
 * When connected, shows address, XLM balance, token balances, and
 * a disconnect button.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, ExternalLink, LogOut, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWallet, type WalletType } from "@/contexts/wallet";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Wallet option descriptors
// ---------------------------------------------------------------------------

const WALLETS: {
  id: WalletType;
  name: string;
  description: string;
  icon: string;
  installUrl?: string;
}[] = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension — best for frequent traders",
    icon: "🚀",
    installUrl: "https://www.freighter.app/",
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web wallet — no install required",
    icon: "🌐",
  },
];

// ---------------------------------------------------------------------------
// WalletModal
// ---------------------------------------------------------------------------

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const wallet = useWallet();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  async function handleConnect(walletType: WalletType) {
    await wallet.connect(walletType);
    if (!wallet.error) {
      onOpenChange(false);
      toast({ title: "Wallet connected", description: wallet.shortAddress ?? "" });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await wallet.refreshBalance();
    setRefreshing(false);
  }

  function handleCopy() {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address).then(() => {
      toast({ title: "Address copied" });
    });
  }

  function handleDisconnect() {
    wallet.disconnect();
    onOpenChange(false);
    toast({ title: "Wallet disconnected" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border" data-testid="wallet-modal">
        {wallet.connected ? (
          <ConnectedView
            wallet={wallet}
            refreshing={refreshing}
            onCopy={handleCopy}
            onRefresh={handleRefresh}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <SelectWalletView wallet={wallet} onConnect={handleConnect} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Connected view
// ---------------------------------------------------------------------------

function ConnectedView({
  wallet,
  refreshing,
  onCopy,
  onRefresh,
  onDisconnect,
}: {
  wallet: ReturnType<typeof useWallet>;
  refreshing: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const explorerUrl =
    wallet.network === "testnet"
      ? `https://stellar.expert/explorer/testnet/account/${wallet.address}`
      : `https://stellar.expert/explorer/public/account/${wallet.address}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          Connected
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Address card */}
        <div className="bg-secondary/60 rounded-lg p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Address</p>
          <div className="flex items-center gap-2 font-mono text-sm break-all">
            <span data-testid="text-wallet-address">{wallet.address}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={onCopy}
              data-testid="button-copy-address"
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-sm hover:bg-muted transition-colors"
              data-testid="link-explorer"
            >
              <ExternalLink className="w-3 h-3" /> Explorer
            </a>
            <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-sm font-medium capitalize">
              {wallet.walletType}
            </span>
            <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-sm font-medium">
              {wallet.network}
            </span>
          </div>
        </div>

        {/* Balances */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Balances</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={onRefresh}
              disabled={refreshing}
              data-testid="button-refresh-balance"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div
            className="bg-secondary/60 rounded-lg divide-y divide-border"
            data-testid="wallet-balances"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs">★</div>
                <span className="font-medium">XLM</span>
              </div>
              <span className="font-mono tabular-nums" data-testid="text-xlm-balance">
                {wallet.xlmBalance ?? "—"}
              </span>
            </div>

            {wallet.tokenBalances.map((tb) => (
              <div key={tb.asset} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                    {tb.asset[0]}
                  </div>
                  <span className="font-medium">{tb.asset}</span>
                </div>
                <span className="font-mono tabular-nums">{tb.balance}</span>
              </div>
            ))}

            {wallet.tokenBalances.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                No custom asset balances found on this account.
              </div>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onDisconnect}
          data-testid="button-disconnect"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Select wallet view
// ---------------------------------------------------------------------------

function SelectWalletView({
  wallet,
  onConnect,
}: {
  wallet: ReturnType<typeof useWallet>;
  onConnect: (w: WalletType) => void;
}) {
  const [selected, setSelected] = useState<WalletType | null>(null);
  const freighterInstalled =
    typeof window !== "undefined" && !!window.freighter;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Connect Wallet
        </DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Connect a Stellar wallet to swap, add liquidity, and manage positions.
        </p>
      </DialogHeader>

      {wallet.error && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 text-sm mt-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{wallet.error}</span>
        </div>
      )}

      <div className="space-y-3 mt-2">
        {WALLETS.map((w) => {
          const isFreighter = w.id === "freighter";
          const notInstalled = isFreighter && !freighterInstalled;
          const isLoading = wallet.connecting && selected === w.id;

          return (
            <button
              key={w.id}
              data-testid={`button-connect-${w.id}`}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left
                ${notInstalled
                  ? "border-border opacity-60 cursor-default"
                  : "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                }`}
              onClick={() => {
                if (notInstalled) return;
                setSelected(w.id);
                onConnect(w.id);
              }}
              disabled={wallet.connecting || notInstalled}
            >
              <span className="text-2xl w-8 text-center">{w.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{w.name}</span>
                  {isFreighter && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
                        freighterInstalled
                          ? "bg-green-500/15 text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {freighterInstalled ? "Detected" : "Not installed"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                {notInstalled && w.installUrl && (
                  <a
                    href={w.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Install Freighter <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border group-hover:border-primary" />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-1">
        Connected to Stellar <span className="text-yellow-400 font-medium">Testnet</span>.
        Your private keys never leave your device.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar wallet button — standalone export for use in App.tsx sidebar
// ---------------------------------------------------------------------------

export function SidebarWalletButton({ onOpen }: { onOpen: () => void }) {
  const { connected, shortAddress, xlmBalance, connecting } = useWallet();

  if (connecting) {
    return (
      <button className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-2.5 rounded-md font-medium transition-colors opacity-70">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting…
      </button>
    );
  }

  if (connected) {
    return (
      <button
        onClick={onOpen}
        className="w-full flex flex-col items-start gap-0.5 bg-secondary/60 hover:bg-secondary border border-border px-3 py-2.5 rounded-md transition-colors"
        data-testid="button-wallet-connected"
      >
        <div className="flex items-center gap-2 w-full">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="font-mono text-sm font-medium truncate">{shortAddress}</span>
        </div>
        {xlmBalance !== null && (
          <span className="text-xs text-muted-foreground font-mono pl-4">
            {xlmBalance} XLM
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-2.5 rounded-md font-medium transition-colors"
      data-testid="button-connect-wallet"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
