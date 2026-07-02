import { useState } from "react";
import { useGetSwapQuote, useListTokens, useGetSwapRoute, useListTransactions } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownUp, Settings, Route as RouteIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SwapPage() {
  const { data: tokens = [], isLoading: tokensLoading } = useListTokens();
  const [tokenInId, setTokenInId] = useState<string>("");
  const [tokenOutId, setTokenOutId] = useState<string>("");
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  const { data: transactions, isLoading: txLoading } = useListTransactions({ type: "swap", limit: 5 });

  const swapQuoteMutation = useGetSwapQuote();
  const handleSwap = () => {
    if (!tokenInId || !tokenOutId || !amountIn) return;
    swapQuoteMutation.mutate({
      data: {
        tokenInAddress: tokenInId,
        tokenOutAddress: tokenOutId,
        amountIn: parseFloat(amountIn),
        slippageTolerance: parseFloat(slippage)
      }
    });
  };

  const handleFlip = () => {
    setTokenInId(tokenOutId);
    setTokenOutId(tokenInId);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Swap</h1>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <Card className="p-4 space-y-4 border-border bg-card">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">You pay</label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="0.00" 
              className="text-2xl font-mono bg-transparent border-none shadow-none focus-visible:ring-0 px-0 h-12"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
            <select 
              className="bg-secondary border border-border rounded-md px-3 py-2 font-medium"
              value={tokenInId}
              onChange={(e) => setTokenInId(e.target.value)}
            >
              <option value="">Select Token</option>
              {tokens.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <Button variant="secondary" size="icon" className="rounded-full h-10 w-10 border-4 border-card" onClick={handleFlip}>
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">You receive</label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="0.00" 
              readOnly
              className="text-2xl font-mono bg-transparent border-none shadow-none focus-visible:ring-0 px-0 h-12"
              value={swapQuoteMutation.data?.amountOut || ""}
            />
            <select 
              className="bg-secondary border border-border rounded-md px-3 py-2 font-medium"
              value={tokenOutId}
              onChange={(e) => setTokenOutId(e.target.value)}
            >
              <option value="">Select Token</option>
              {tokens.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {swapQuoteMutation.data && (
          <div className="p-3 bg-secondary/50 rounded-md text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={swapQuoteMutation.data.priceImpact > 1 ? "text-destructive" : "text-green-500"}>
                {swapQuoteMutation.data.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Received</span>
              <span className="font-mono">{swapQuoteMutation.data.minimumReceived}</span>
            </div>
          </div>
        )}

        <Button 
          className="w-full h-12 text-lg font-medium" 
          onClick={handleSwap}
          disabled={!tokenInId || !tokenOutId || !amountIn || swapQuoteMutation.isPending}
        >
          {swapQuoteMutation.isPending ? "Quoting..." : "Swap"}
        </Button>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Recent Transactions</h3>
        {txLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {transactions?.map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 rounded-md bg-card border border-border text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{tx.txHash.substring(0, 8)}...</span>
                  <span className="text-muted-foreground">Swap</span>
                </div>
                <span className="font-mono text-green-500">+${tx.valueUsd?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
