import { useGetProtocolSummary, useListTransactions } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } = useGetProtocolSummary();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 20 });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Protocol Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="text-sm text-muted-foreground">Total TVL</div>
          {summaryLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-2xl font-mono font-bold">${summary?.totalTvl.toLocaleString()}</div>}
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-sm text-muted-foreground">24h Volume</div>
          {summaryLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-2xl font-mono font-bold">${summary?.totalVolume24h.toLocaleString()}</div>}
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-sm text-muted-foreground">24h Fees</div>
          {summaryLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-2xl font-mono font-bold">${summary?.totalFees24h.toLocaleString()}</div>}
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-sm text-muted-foreground">Total Pools</div>
          {summaryLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-2xl font-mono font-bold">{summary?.totalPools}</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border flex items-center justify-center min-h-[300px]">
          <span className="text-muted-foreground">TVL Chart (Coming Soon)</span>
        </Card>
        <Card className="p-6 bg-card border-border flex items-center justify-center min-h-[300px]">
          <span className="text-muted-foreground">Volume Chart (Coming Soon)</span>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold">Recent Transactions</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Value</th>
              <th className="px-4 py-2 text-left font-medium">Time</th>
              <th className="px-4 py-2 text-right font-medium">Tx Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {txLoading ? (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : (
              transactions?.map(tx => (
                <tr key={tx.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 capitalize">{tx.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-mono">${tx.valueUsd?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(tx.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{tx.txHash.substring(0, 8)}...</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
