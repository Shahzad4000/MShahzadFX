import { useEffect, useState } from "react";
import { Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isTrust?: boolean;
    };
  }
}

const CHAINS: Record<string, string> = {
  "0x1": "Ethereum",
  "0x38": "BSC",
  "0x89": "Polygon",
  "0xa4b1": "Arbitrum",
  "0xa": "Optimism",
};

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.request) return;
    eth.request({ method: "eth_accounts" }).then((accs) => {
      const a = (accs as string[])[0];
      if (a) setAddress(a);
    }).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setChainId(c as string)).catch(() => {});
    const onAccs = (accs: unknown) => {
      const a = (accs as string[])[0];
      setAddress(a ?? null);
    };
    const onChain = (c: unknown) => setChainId(c as string);
    eth.on?.("accountsChanged", onAccs);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccs);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    const eth = window.ethereum;
    if (!eth?.request) {
      toast.error("Koi wallet nahi mila", {
        description: "MetaMask ya Trust Wallet install karo (browser extension ya mobile app).",
      });
      return;
    }
    setConnecting(true);
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setAddress(accs[0]);
      setChainId(cid);
      toast.success("Wallet connected", {
        description: `${accs[0].slice(0, 6)}…${accs[0].slice(-4)} on ${CHAINS[cid] ?? cid}`,
      });
    } catch (e) {
      toast.error("Connection cancelled");
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setAddress(null);
    toast.info("Wallet disconnected (session only)");
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
          <Wallet className="h-3 w-3" />
          {address.slice(0, 6)}…{address.slice(-4)}
          {chainId && <span className="ml-1 text-[10px] text-muted-foreground">· {CHAINS[chainId] ?? chainId}</span>}
        </Badge>
        <Button size="icon" variant="ghost" onClick={disconnect} title="Disconnect">
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" className="gap-2" onClick={connect} disabled={connecting}>
      <Wallet className="h-3.5 w-3.5" />
      {connecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}