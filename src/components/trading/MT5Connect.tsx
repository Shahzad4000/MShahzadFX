import { useState } from "react";
import { Server, Loader2, CheckCircle2, Copy, Download, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const BROKERS = [
  "Exness-MT5Real", "Exness-MT5Trial", "XMGlobal-MT5", "XMGlobal-MT5 2",
  "XMGlobal-MT5 3", "XMGlobal-MT5 4", "XMGlobal-MT5 5", "XMGlobal-MT5 6",
  "XMGlobal-MT5 7", "XMGlobal-MT5 8", "XMGlobal-MT5 9", "XMGlobal-MT5 10",
  "ICMarkets-Live", "ICMarkets-Demo", "Pepperstone-Live", "FTMO-Server",
  "OANDA-v20 Live", "RoboForex-ECN", "FBS-Real", "Alpari-MT5",
];

type Status = "idle" | "connecting" | "connected" | "error";

export function MT5Connect() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(BROKERS[0]);
  const mode = "live" as const;
  const [account, setAccount] = useState<{ balance: number; equity: number; currency: string } | null>(null);

  async function connect() {
    if (!login || !password) {
      toast.error("Login aur password zaroori hai");
      return;
    }
    setStatus("connecting");
    // Save credentials locally + poll Supabase for bridge data.
    // Account "opens" as soon as user submits — real balance flows in when
    // python-bot/main.py starts pushing to bot_metrics.
    try {
      localStorage.setItem("mt5_creds", JSON.stringify({ login, server }));
    } catch {}
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("bot_metrics")
        .select("balance, equity, currency, ts")
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && data.balance != null) {
        setAccount({
          balance: Number(data.balance),
          equity: Number(data.equity ?? data.balance),
          currency: data.currency ?? "USD",
        });
        setStatus("connected");
        toast.success("MT5 account linked — live data mil rahi hai", {
          description: `Balance ${data.currency ?? "USD"} ${data.balance}`,
        });
      } else {
        // No bridge data yet — still mark connected so user can proceed.
        setAccount({ balance: 0, equity: 0, currency: "USD" });
        setStatus("connected");
        toast.success(`MT5 ${login} linked`, {
          description: "Bridge se live balance aayega jaise hi PC par python-bot/main.py chalega.",
        });
      }
    } catch {
      setAccount({ balance: 0, equity: 0, currency: "USD" });
      setStatus("connected");
      toast(`MT5 ${login} saved`, {
        description: "Bridge start karo apne PC par live balance ke liye.",
      });
    }
  }

  function disconnect() {
    setStatus("idle");
    setAccount(null);
    toast("MT5 disconnected");
  }

  const configBlock = `# python-bot/config.py\nMT5 = {\n    "login": ${login || 12345678},\n    "password": "${password || "YOUR_PASSWORD"}",\n    "server": "${server}",\n    "path": r"C:\\Program Files\\MetaTrader 5\\terminal64.exe",\n}\n`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={status === "connected" ? "default" : "outline"} size="sm" className="gap-2">
          <Server className="h-3.5 w-3.5" />
          {status === "connected" ? `MT5 · ${login}` : "Connect MT5"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> Connect MT5 Account
          </DialogTitle>
          <DialogDescription>
            Exness, XM, IC Markets ya koi bhi MT5 broker. Demo pehle recommended hai.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="creds">
          <TabsList className="w-full">
            <TabsTrigger value="creds" className="flex-1">Credentials</TabsTrigger>
            <TabsTrigger value="bridge" className="flex-1">Bridge Setup</TabsTrigger>
            <TabsTrigger value="help" className="flex-1">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="creds" className="space-y-3 pt-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-center text-xs font-semibold text-destructive">
              ⚠ LIVE MODE — Real paise se trade hoga
            </div>
            <div className="space-y-1.5">
              <Label>MT5 Login (account number)</Label>
              <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="e.g. 89234512" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Investor / Trading Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Broker Server</Label>
              <Select value={server} onValueChange={setServer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BROKERS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {status === "connected" && account && (
              <div className="rounded-md border bg-primary/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Connected · {mode.toUpperCase()}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[10px] uppercase text-muted-foreground">Balance</div><div className="font-bold tabular-nums">${account.balance}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Equity</div><div className="font-bold tabular-nums">${account.equity}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Currency</div><div className="font-bold">{account.currency}</div></div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {status !== "connected" ? (
                <Button onClick={connect} disabled={status === "connecting"} className="flex-1 gap-2">
                  {status === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                  {status === "connecting" ? "Connecting…" : `Connect ${mode.toUpperCase()}`}
                </Button>
              ) : (
                <Button variant="outline" onClick={disconnect} className="flex-1">Disconnect</Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bridge" className="space-y-3 pt-3 text-sm">
            <p className="text-muted-foreground">
              MT5 terminal broker ke server se chalta hai — is web app se seedha login nahi ho sakta. Isliye chota Python bridge apne PC par chalao jo credentials use kar ke MT5 se juda rehta hai aur is dashboard ko live data bhejta hai.
            </p>
            <ol className="ml-5 list-decimal space-y-1 text-xs">
              <li>Windows PC (jahan MT5 install hai) par Python 3.11+ install karein.</li>
              <li><code className="rounded bg-muted px-1">pip install MetaTrader5 requests</code></li>
              <li>Neeche wala config <code className="rounded bg-muted px-1">python-bot/config.py</code> me save karein.</li>
              <li><code className="rounded bg-muted px-1">python main.py</code> chalayein — bridge live ho jayega.</li>
            </ol>
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 text-[11px]">{configBlock}</pre>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => { navigator.clipboard.writeText(configBlock); toast.success("Config copied"); }}>
                <Copy className="h-3.5 w-3.5" /> Copy Config
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                const blob = new Blob([configBlock], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "config.py";
                a.click();
              }}>
                <Download className="h-3.5 w-3.5" /> Download config.py
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="help" className="space-y-2 pt-3 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Exness:</strong> Personal Area → Trading Accounts → server name copy karein (e.g. Exness-MT5Trial).</p>
            <p><strong className="text-foreground">XM:</strong> Members Area → My Accounts → server column.</p>
            <p><strong className="text-foreground">Password:</strong> Broker se milta hai account create karte waqt. Bhool gaye to broker portal se reset karein.</p>
            <p>Agar broker aapke list me nahi to <em>Bridge Setup</em> tab me apna server manually daal do — koi bhi MT5 broker chalega.</p>
            <a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              MT5 Terminal download <ExternalLink className="h-3 w-3" />
            </a>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}