import { useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Activity, BarChart3, LayoutDashboard, ArrowLeftRight } from "lucide-react";
import NotFound from "@/pages/not-found";
import SwapPage from "@/pages/swap";
import PoolsPage from "@/pages/pools";
import PoolDetailPage from "@/pages/pool-detail";
import PositionsPage from "@/pages/positions";
import AnalyticsPage from "@/pages/analytics";
import { WalletProvider } from "@/contexts/wallet";
import { WalletModal, SidebarWalletButton } from "@/components/wallet-modal";

const queryClient = new QueryClient();

function Sidebar() {
  const [location] = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);

  const navItems = [
    { href: "/swap", label: "Swap", icon: ArrowLeftRight },
    { href: "/pools", label: "Pools", icon: LayoutDashboard },
    { href: "/positions", label: "Positions", icon: Activity },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <>
      <div className="w-64 border-r border-border bg-card flex flex-col h-[100dvh] sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">Stellar DLMM</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <SidebarWalletButton onOpen={() => setWalletOpen(true)} />
        </div>
      </div>

      <WalletModal open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => {
          const [, setLocation] = useLocation();
          setLocation("/swap");
          return null;
        }} />
        <Route path="/swap" component={SwapPage} />
        <Route path="/pools" component={PoolsPage} />
        <Route path="/pools/:poolId" component={PoolDetailPage} />
        <Route path="/positions" component={PositionsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
