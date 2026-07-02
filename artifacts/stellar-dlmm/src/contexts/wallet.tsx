/**
 * WalletContext — Stellar wallet connection layer
 *
 * Supports two wallets without any npm packages beyond @stellar/stellar-sdk:
 *
 *  1. Freighter  — browser extension; uses window.freighter API injected by the
 *                  extension (https://www.freighter.app)
 *  2. Albedo     — web-based non-custodial wallet; popup + postMessage protocol
 *                  (https://albedo.link)
 *
 * Balances are fetched from Stellar Horizon (Testnet by default).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Freighter window type shim
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    freighter?: {
      isConnected(): Promise<boolean>;
      getPublicKey(): Promise<string>;
      signTransaction(
        xdr: string,
        opts?: { networkPassphrase?: string; network?: string }
      ): Promise<string>;
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletType = "freighter" | "albedo";

export interface TokenBalance {
  asset: string;
  balance: string;
}

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  shortAddress: string | null;
  walletType: WalletType | null;
  xlmBalance: string | null;
  tokenBalances: TokenBalance[];
  network: "testnet" | "mainnet";
  error: string | null;
}

export interface WalletContextValue extends WalletState {
  connect: (wallet: WalletType) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Horizon balance fetch
// ---------------------------------------------------------------------------

const HORIZON = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

async function fetchBalances(
  address: string,
  network: "testnet" | "mainnet"
): Promise<{ xlm: string; tokens: TokenBalance[] }> {
  try {
    const resp = await fetch(`${HORIZON[network]}/accounts/${address}`);
    if (!resp.ok) return { xlm: "0.0000000", tokens: [] };
    const data = await resp.json();
    const balances: Array<{ asset_type: string; asset_code?: string; balance: string }> =
      data.balances ?? [];
    const nativeBal = balances.find((b) => b.asset_type === "native");
    const xlm = nativeBal ? parseFloat(nativeBal.balance).toFixed(4) : "0.0000";
    const tokens: TokenBalance[] = balances
      .filter((b) => b.asset_type !== "native")
      .map((b) => ({ asset: b.asset_code ?? "UNKNOWN", balance: b.balance }));
    return { xlm, tokens };
  } catch {
    return { xlm: "—", tokens: [] };
  }
}

function shorten(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Albedo popup protocol
// ---------------------------------------------------------------------------

const ALBEDO_ORIGIN = "https://albedo.link";

function openAlbedoPublicKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${ALBEDO_ORIGIN}/intent/public_key?callback=postmessage`,
      "albedo",
      "width=600,height=700,left=200,top=100"
    );
    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("Albedo connection timed out."));
      window.removeEventListener("message", handler);
    }, 120_000);

    function handler(event: MessageEvent) {
      if (event.origin !== ALBEDO_ORIGIN) return;
      if (event.data?.intent !== "public_key") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      popup?.close();
      if (event.data.pubkey) {
        resolve(event.data.pubkey as string);
      } else {
        reject(new Error(event.data.error ?? "Albedo: no public key returned"));
      }
    }
    window.addEventListener("message", handler);
  });
}

function albedoSignTransaction(xdr: string, network: "testnet" | "mainnet"): Promise<string> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      xdr,
      network: network === "testnet" ? "testnet" : "public",
      callback: "postmessage",
    });
    const popup = window.open(
      `${ALBEDO_ORIGIN}/intent/tx?${params.toString()}`,
      "albedo-sign",
      "width=600,height=700,left=200,top=100"
    );
    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("Albedo signing timed out."));
      window.removeEventListener("message", handler);
    }, 120_000);

    function handler(event: MessageEvent) {
      if (event.origin !== ALBEDO_ORIGIN) return;
      if (event.data?.intent !== "tx") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      popup?.close();
      if (event.data.signed_envelope_xdr) {
        resolve(event.data.signed_envelope_xdr as string);
      } else {
        reject(new Error(event.data.error ?? "Albedo: signing failed"));
      }
    }
    window.addEventListener("message", handler);
  });
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "stellar_dlmm_wallet";

interface PersistedWallet {
  address: string;
  walletType: WalletType;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
    address: null,
    shortAddress: null,
    walletType: null,
    xlmBalance: null,
    tokenBalances: [],
    network: "testnet",
    error: null,
  });

  const networkRef = useRef<"testnet" | "mainnet">("testnet");
  const walletTypeRef = useRef<WalletType | null>(null);

  const applyConnected = useCallback(
    async (address: string, walletType: WalletType) => {
      walletTypeRef.current = walletType;
      const { xlm, tokens } = await fetchBalances(address, networkRef.current);
      setState((s) => ({
        ...s,
        connected: true,
        connecting: false,
        address,
        shortAddress: shorten(address),
        walletType,
        xlmBalance: xlm,
        tokenBalances: tokens,
        error: null,
      }));
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ address, walletType } satisfies PersistedWallet)
        );
      } catch {}
    },
    []
  );

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { address, walletType } = JSON.parse(raw) as PersistedWallet;
      if (!address || !walletType) return;

      // For Freighter, verify the extension is still connected before restoring.
      if (walletType === "freighter") {
        window.freighter?.isConnected().then((yes) => {
          if (yes) applyConnected(address, walletType);
        });
      } else {
        applyConnected(address, walletType);
      }
    } catch {}
  }, [applyConnected]);

  const connect = useCallback(
    async (walletType: WalletType) => {
      setState((s) => ({ ...s, connecting: true, error: null }));
      try {
        let address: string;
        if (walletType === "freighter") {
          if (!window.freighter) {
            throw new Error(
              "Freighter extension not found. Install it from freighter.app"
            );
          }
          address = await window.freighter.getPublicKey();
        } else {
          address = await openAlbedoPublicKey();
        }
        await applyConnected(address, walletType);
      } catch (err) {
        setState((s) => ({
          ...s,
          connecting: false,
          error: err instanceof Error ? err.message : "Connection failed",
        }));
      }
    },
    [applyConnected]
  );

  const disconnect = useCallback(() => {
    walletTypeRef.current = null;
    setState({
      connected: false,
      connecting: false,
      address: null,
      shortAddress: null,
      walletType: null,
      xlmBalance: null,
      tokenBalances: [],
      network: "testnet",
      error: null,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const { address, walletType } = state;
    if (!address || !walletType) throw new Error("Wallet not connected");

    if (walletType === "freighter") {
      if (!window.freighter) throw new Error("Freighter extension not found");
      return window.freighter.signTransaction(xdr, {
        networkPassphrase:
          networkRef.current === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
      });
    } else {
      return albedoSignTransaction(xdr, networkRef.current);
    }
  }, [state]);

  const refreshBalance = useCallback(async () => {
    if (!state.address) return;
    const { xlm, tokens } = await fetchBalances(state.address, networkRef.current);
    setState((s) => ({ ...s, xlmBalance: xlm, tokenBalances: tokens }));
  }, [state.address]);

  return (
    <WalletContext.Provider
      value={{ ...state, connect, disconnect, signTransaction, refreshBalance }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
