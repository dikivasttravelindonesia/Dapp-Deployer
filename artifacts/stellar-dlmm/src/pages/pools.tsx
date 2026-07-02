import { useState } from "react";
import { useListPools, useGetProtocolSummary, getListPoolsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PoolsPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"tvl" | "volume24h" | "apr" | "fees24h">("tvl");

  const { data: summary, isLoading: summaryLoading } = useGetProtocolSummary();
  const { data: pools, isLoading: poolsLoading } = useListPools({ search, sortBy }, { query: { queryKey: getListPoolsQueryKey({ search, sortBy }) } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Liquidity Pools</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total Value Locked</div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-3xl font-mono font-bold">${summary?.totalTvl.toLocaleString()}</div>}
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-sm font-medium text-muted-foreground mb-1">24h Volume</div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-3xl font-mono font-bold">${summary?.totalVolume24h.toLocaleString()}</div>}
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-sm font-medium text-muted-foreground mb-1">24h Fees</div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-3xl font-mono font-bold">${summary?.totalFees24h.toLocaleString()}</div>}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search pools..." 
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {(["tvl", "volume24h", "apr"] as const).map(sortOption => (
              <Button 
                key={sortOption}
                variant={sortBy === sortOption ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(sortOption)}
              >
                Sort by {sortOption.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Pool</th>
                <th className="px-4 py-3 text-right font-medium">TVL</th>
                <th className="px-4 py-3 text-right font-medium">24h Vol</th>
                <th className="px-4 py-3 text-right font-medium">APR</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {poolsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-32" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-20 ml-auto" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-20 ml-auto" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-16 ml-auto" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                pools?.map(pool => (
                  <tr key={pool.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <img src={pool.tokenX.logoUrl} alt={pool.tokenX.symbol} className="w-6 h-6 rounded-full border border-card bg-secondary" />
                          <img src={pool.tokenY.logoUrl} alt={pool.tokenY.symbol} className="w-6 h-6 rounded-full border border-card bg-secondary" />
                        </div>
                        <span className="font-bold">{pool.tokenX.symbol}-{pool.tokenY.symbol}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{pool.fee}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono">${pool.tvl.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-mono">${pool.volume24h.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-mono text-green-500">{pool.apr.toFixed(2)}%</td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/pools/${pool.id}`}>
                        <Button size="sm">Manage</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
