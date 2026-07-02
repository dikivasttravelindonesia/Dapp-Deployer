import { useGetUserPositions, getGetUserPositionsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";

export default function PositionsPage() {
  const mockAddress = "GTEST1234567890XLM";
  const { data: positions, isLoading } = useGetUserPositions(mockAddress, { query: { queryKey: getGetUserPositionsQueryKey(mockAddress) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Your Positions</h1>
        <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md text-sm font-mono border border-border">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          {mockAddress.substring(0,6)}...{mockAddress.substring(mockAddress.length-4)}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : positions?.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center bg-card border-dashed">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No active positions</h3>
          <p className="text-muted-foreground mb-6">Provide liquidity to earn fees on Stellar DLMM.</p>
          <Button>Explore Pools</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positions?.map(pos => (
            <Card key={pos.id} className="p-6 bg-card border-border flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <img src={pos.pool?.tokenX.logoUrl} alt="TokenX" className="w-8 h-8 rounded-full border-2 border-background bg-secondary" />
                    <img src={pos.pool?.tokenY.logoUrl} alt="TokenY" className="w-8 h-8 rounded-full border-2 border-background bg-secondary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{pos.pool?.tokenX.symbol}-{pos.pool?.tokenY.symbol}</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-sm font-medium uppercase tracking-wider">{pos.strategy}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-mono font-bold">${pos.valueUsd.toLocaleString()}</div>
                  <div className="text-sm text-green-500 font-mono">+${pos.unrealizedFees.toLocaleString()} fees</div>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border flex gap-3">
                <Button className="flex-1" variant="outline">Remove</Button>
                <Button className="flex-1">Claim Fees</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
