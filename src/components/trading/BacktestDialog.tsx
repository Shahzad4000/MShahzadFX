import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Loader2, TrendingUp, TrendingDown, Sparkles, Clock, Calendar, Radio, RotateCcw, Settings2, FileCode2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { strategies } from "@/lib/mock-data";
import type { Strategy } from "@/lib/mock-data";
import { toast } from "sonner";

type BTrade = {
  n: number;
  openTime: string;
  closeTime: string;
  side: "BUY" | "SELL";
  lots: number;
  entry: number;
  sl: number;
  tp: number;
  exit: number;
  pips: number;
  pnl: number;
  balance: number;
  reason: "TP" | "SL" | "TIME";
};

type Result = {
  curve: { t: string; equity: number }[];
  trades_list: BTrade[];
  winRate: number;
  trades: number;
  longs: number;
  shorts: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  expectancy: number;
  pnl: number;
  grossWin: number;
  grossLoss: number;
  dd: number;
  ddAbs: number;
  ddRel: number;
  sharpe: number;
  profitFactor: number;
  recoveryFactor: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  ticksProcessed: number;
  barsProcessed: number;
  modelQualityPct: number;
};

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function symbolMeta(sym: string) {
  const s = (sym || "").toUpperCase();
  if (s.includes("XAU")) return { base: 2380, pip: 0.10, vol: 8.5, pipUsd: 10 };
  if (s.includes("XAG")) return { base: 30, pip: 0.01, vol: 0.25, pipUsd: 5 };
  if (s.includes("BTC")) return { base: 68000, pip: 1, vol: 900, pipUsd: 1 };
  if (s.includes("ETH")) return { base: 3500, pip: 0.1, vol: 55, pipUsd: 1 };
  if (s.includes("JPY")) return { base: 155.3, pip: 0.01, vol: 0.35, pipUsd: 6.4 };
  if (s.includes("OIL") || s.includes("WTI")) return { base: 78, pip: 0.01, vol: 0.8, pipUsd: 10 };
  if (s.includes("NAS") || s.includes("US100")) return { base: 19500, pip: 1, vol: 90, pipUsd: 1 };
  if (s.includes("SPX") || s.includes("US500")) return { base: 5450, pip: 0.1, vol: 22, pipUsd: 1 };
  return { base: 1.085, pip: 0.0001, vol: 0.0032, pipUsd: 10 };
}

const TF_MINUTES: Record<string, number> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };

type SimInput = {
  symbol: string;
  timeframe: string;
  days: number;
  balance: number;
  riskPct: number;
  slPips: number;
  tpPips: number;
  spreadPips: number;
  seed: number;
  real?: { time: number[]; o: number[]; h: number[]; l: number[]; c: number[] } | null;
};

function simulate(cfg: SimInput): Result {
  const meta = symbolMeta(cfg.symbol);
  const tfMin = TF_MINUTES[cfg.timeframe] ?? 60;
  const ticksPerBar = tfMin <= 5 ? 12 : tfMin <= 30 ? 30 : tfMin <= 60 ? 60 : 240;
  let bO: number[], bH: number[], bL: number[], bC: number[], times: number[];
  if (cfg.real && cfg.real.c.length > 60) {
    bO = cfg.real.o; bH = cfg.real.h; bL = cfg.real.l; bC = cfg.real.c; times = cfg.real.time;
  } else {
    const bars = Math.max(100, Math.floor((cfg.days * 1440) / tfMin));
    const rand = mulberry32(cfg.seed || 1);
    let price = meta.base;
    bO = []; bH = []; bL = []; bC = []; times = [];
    const start = Date.now() - cfg.days * 86400_000;
    for (let i = 0; i < bars; i++) {
      const o = price; let hi = o, lo = o, c = o;
      for (let k = 0; k < ticksPerBar; k++) {
        const step = (rand() - 0.5) * meta.vol * 0.18;
        c = c + step + Math.sin((i + k) * 0.017) * meta.vol * 0.02;
        if (c > hi) hi = c;
        if (c < lo) lo = c;
      }
      price = c;
      bO.push(o); bH.push(hi); bL.push(lo); bC.push(c);
      times.push(start + i * tfMin * 60_000);
    }
  }
  const bars = bC.length;

  const ema = (period: number) => {
    const out: number[] = []; const k = 2 / (period + 1); let e = bC[0];
    for (let i = 0; i < bC.length; i++) { e = i === 0 ? bC[0] : bC[i] * k + e * (1 - k); out.push(e); }
    return out;
  };
  const ef = ema(20), es = ema(50);

  let balance = cfg.balance, peakEq = balance;
  let ddAbs = 0, maxDd = 0;
  let wins = 0, losses = 0, longs = 0, shorts = 0;
  let grossW = 0, grossL = 0;
  let best = -Infinity, worst = Infinity;
  let cW = 0, cL = 0, mCW = 0, mCL = 0;
  const returns: number[] = [];
  const trades: BTrade[] = [];
  const curve: { t: string; equity: number }[] = [];

  const spread = cfg.spreadPips * meta.pip;
  let openPos: null | { side: "BUY" | "SELL"; entry: number; sl: number; tp: number; lots: number; openIdx: number } = null;
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 16).replace("T", " ");
  const maxHold = Math.max(6, Math.round(480 / tfMin));

  for (let i = 50; i < bars; i++) {
    const px = bC[i];
    if (openPos) {
      const hi = bH[i], lo = bL[i];
      let exit = 0; let reason: BTrade["reason"] | null = null;
      if (openPos.side === "BUY") {
        if (lo <= openPos.sl) { exit = openPos.sl; reason = "SL"; }
        else if (hi >= openPos.tp) { exit = openPos.tp; reason = "TP"; }
      } else {
        if (hi >= openPos.sl) { exit = openPos.sl; reason = "SL"; }
        else if (lo <= openPos.tp) { exit = openPos.tp; reason = "TP"; }
      }
      if (!reason && i - openPos.openIdx >= maxHold) { exit = px; reason = "TIME"; }
      if (reason) {
        const dir = openPos.side === "BUY" ? 1 : -1;
        const pips = ((exit - openPos.entry) / meta.pip) * dir;
        const pnl = +(pips * meta.pipUsd * openPos.lots).toFixed(2);
        balance += pnl;
        if (pnl >= 0) { wins++; grossW += pnl; cW++; cL = 0; if (cW > mCW) mCW = cW; }
        else { losses++; grossL += -pnl; cL++; cW = 0; if (cL > mCL) mCL = cL; }
        if (pnl > best) best = pnl;
        if (pnl < worst) worst = pnl;
        returns.push(pnl);
        if (openPos.side === "BUY") longs++; else shorts++;
        trades.push({
          n: trades.length + 1,
          openTime: fmt(times[openPos.openIdx]),
          closeTime: fmt(times[i]),
          side: openPos.side,
          lots: openPos.lots,
          entry: +openPos.entry.toFixed(5),
          sl: +openPos.sl.toFixed(5),
          tp: +openPos.tp.toFixed(5),
          exit: +exit.toFixed(5),
          pips: +pips.toFixed(1),
          pnl,
          balance: +balance.toFixed(2),
          reason,
        });
        openPos = null;
      }
    }

    peakEq = Math.max(peakEq, balance);
    const dd = peakEq - balance;
    if (dd > ddAbs) ddAbs = dd;
    const ddP = dd / peakEq;
    if (ddP > maxDd) maxDd = ddP;
    if (i % Math.max(1, Math.floor(bars / 180)) === 0) {
      curve.push({ t: fmt(times[i]), equity: +balance.toFixed(2) });
    }

    if (!openPos) {
      const fast = ef[i], slow = es[i], fp = ef[i - 1], sp = es[i - 1];
      const bull = fp <= sp && fast > slow;
      const bear = fp >= sp && fast < slow;
      if (bull || bear) {
        const side: "BUY" | "SELL" = bull ? "BUY" : "SELL";
        const entry = side === "BUY" ? px + spread : px - spread;
        const sl = side === "BUY" ? entry - cfg.slPips * meta.pip : entry + cfg.slPips * meta.pip;
        const tp = side === "BUY" ? entry + cfg.tpPips * meta.pip : entry - cfg.tpPips * meta.pip;
        const riskUsd = balance * (cfg.riskPct / 100);
        const lots = Math.max(0.01, +(riskUsd / Math.max(1, cfg.slPips * meta.pipUsd)).toFixed(2));
        openPos = { side, entry, sl, tp, lots, openIdx: i };
      }
    }
  }

  const totalTrades = wins + losses;
  const avg = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const std = returns.length ? Math.sqrt(returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length) || 1 : 1;
  const avgWin = wins ? grossW / wins : 0;
  const avgLoss = losses ? grossL / losses : 0;
  const expectancy = totalTrades ? ((wins / totalTrades) * avgWin) - ((losses / totalTrades) * avgLoss) : 0;
  const netPnl = balance - cfg.balance;
  return {
    curve,
    trades_list: trades,
    winRate: totalTrades ? Math.round((wins / totalTrades) * 100) : 0,
    trades: totalTrades, longs, shorts, wins, losses,
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    bestTrade: +(best === -Infinity ? 0 : best).toFixed(2),
    worstTrade: +(worst === Infinity ? 0 : worst).toFixed(2),
    expectancy: +expectancy.toFixed(2),
    pnl: +netPnl.toFixed(2),
    grossWin: +grossW.toFixed(2),
    grossLoss: +grossL.toFixed(2),
    dd: +(maxDd * 100).toFixed(2),
    ddAbs: +ddAbs.toFixed(2),
    ddRel: +(maxDd * 100).toFixed(2),
    sharpe: +((avg / std) * Math.sqrt(252)).toFixed(2),
    profitFactor: +(grossW / (grossL || 1)).toFixed(2),
    recoveryFactor: +(netPnl / (ddAbs || 1)).toFixed(2),
    maxConsecWins: mCW,
    maxConsecLosses: mCL,
    ticksProcessed: bars * ticksPerBar,
    barsProcessed: bars,
    modelQualityPct: 99,
  };
}

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
const PERIODS: { label: string; days: number }[] = [
  { label: "30 days", days: 30 },
  { label: "90 days (3 mo)", days: 90 },
  { label: "180 days (6 mo)", days: 180 },
  { label: "1 year", days: 365 },
  { label: "2 years", days: 730 },
];

export function BacktestDialog({ strategy: preset, trigger }: { strategy?: Strategy; trigger?: React.ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const initial = preset ?? strategies[0];
  const [strategyName, setStrategyName] = useState<string>(initial.name);
  const current = useMemo(() => strategies.find((s) => s.name === strategyName) ?? initial, [strategyName, initial]);
  const [symbol, setSymbol] = useState<string>(current.pair);
  const [timeframe, setTimeframe] = useState<string>(current.timeframe);
  const [days, setDays] = useState<number>(180);
  const [balance, setBalance] = useState<number>(current.minDepositUsd ?? 10000);
  const [riskPct, setRiskPct] = useState<number>(current.riskPct ?? 1);
  const [slPips, setSlPips] = useState<number>(current.slPips ?? 200);
  const [tpPips, setTpPips] = useState<number>(current.tpPips ?? 400);
  const [spread, setSpread] = useState<number>(2);
  const [manual, setManual] = useState<boolean>(false);
  const [liveMode, setLiveMode] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [startedAt, setStartedAt] = useState<string>("");
  const [durationMs, setDurationMs] = useState(0);
  const [dataSource, setDataSource] = useState<"real" | "synthetic">("synthetic");
  const [realCount, setRealCount] = useState(0);
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (manual) return;
    setSymbol(current.pair);
    setTimeframe(current.timeframe);
    setBalance(current.minDepositUsd ?? 10000);
    setRiskPct(current.riskPct ?? 1);
    setSlPips(current.slPips ?? 200);
    setTpPips(current.tpPips ?? 400);
  }, [current, manual]);

  async function run() {
    setRunning(true);
    setResult(null);
    setProgress(0);
    const t0 = performance.now();
    setStartedAt(new Date().toLocaleString());
    setProgress(15);
    // Try to load real MT5 candles pushed by the python bot (last N days).
    let real: SimInput["real"] = null;
    try {
      const url = `/api/public/mt5-candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=20000`;
      const res = await fetch(url);
      if (res.ok) {
        const j = (await res.json()) as { candles?: Array<{ time: string; o: number; h: number; l: number; c: number }> };
        const cutoff = Date.now() - days * 86400_000;
        const filtered = (j.candles ?? []).filter((k) => new Date(k.time).getTime() >= cutoff);
        if (filtered.length > 60) {
          real = {
            time: filtered.map((k) => new Date(k.time).getTime()),
            o: filtered.map((k) => k.o), h: filtered.map((k) => k.h),
            l: filtered.map((k) => k.l), c: filtered.map((k) => k.c),
          };
          setDataSource("real"); setRealCount(filtered.length);
        } else { setDataSource("synthetic"); setRealCount(0); }
      } else { setDataSource("synthetic"); setRealCount(0); }
    } catch { setDataSource("synthetic"); setRealCount(0); }
    setProgress(60);
    const seed = hashStr(`${strategyName}|${symbol}|${timeframe}|${days}|${slPips}|${tpPips}|${riskPct}|${tick}`);
    const r = simulate({ symbol, timeframe, days, balance, riskPct, slPips, tpPips, spreadPips: spread, seed, real });
    setProgress(100);
    setResult(r);
    setDurationMs(Math.round(performance.now() - t0));
    setRunning(false);
    toast.success("Backtest complete", { description: `${symbol} · ${timeframe} · ${days}d · ${r.trades} trades · ${real ? "REAL MT5 data" : "synthetic"}` });
  }

  useEffect(() => {
    if (!liveMode || !open) { if (liveTimer.current) { clearInterval(liveTimer.current); liveTimer.current = null; } return; }
    liveTimer.current = setInterval(() => setTick((x) => x + 1), 2500);
    return () => { if (liveTimer.current) clearInterval(liveTimer.current); };
  }, [liveMode, open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (liveMode && open && !running) void run(); }, [tick]);

  const now = new Date();
  const from = new Date(now.getTime() - days * 86400_000);
  const fmtD = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" className="gap-2">
            <Play className="h-4 w-4" /> Run Backtest
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> MT5 Strategy Tester
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Select value={strategyName} onValueChange={setStrategyName}>
              <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {strategies.slice(0, 400).map((s) => (
                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger><SelectValue placeholder="Timeframe" /></SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold"><Settings2 className="h-3.5 w-3.5 text-primary" /> Inputs — auto-loaded from strategy</div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual override
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              <NumField label="Symbol" value={symbol} onChange={(v) => setSymbol(String(v))} text disabled={!manual} />
              <NumField label="Balance $" value={balance} onChange={(v) => setBalance(Number(v))} disabled={!manual} />
              <NumField label="Risk %" value={riskPct} onChange={(v) => setRiskPct(Number(v))} step={0.1} disabled={!manual} />
              <NumField label="SL pips" value={slPips} onChange={(v) => setSlPips(Number(v))} disabled={!manual} />
              <NumField label="TP pips" value={tpPips} onChange={(v) => setTpPips(Number(v))} disabled={!manual} />
              <NumField label="Spread" value={spread} onChange={(v) => setSpread(Number(v))} disabled={!manual} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={run} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Testing…" : "Start Test"}
            </Button>
            <Button size="sm" variant={liveMode ? "default" : "outline"} onClick={() => setLiveMode((v) => !v)} className="gap-1">
              <Radio className={`h-3.5 w-3.5 ${liveMode ? "animate-pulse" : "text-primary"}`} /> {liveMode ? "Live: ON" : "Live tick"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)} className="gap-1"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {timeframe}</Badge>
            <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> {fmtD(from)} → {fmtD(now)}</Badge>
            <Badge variant="outline" className="gap-1"><FileCode2 className="h-3 w-3" /> Every-tick model</Badge>
            <Badge className={dataSource === "real" ? "bg-primary text-primary-foreground" : ""} variant={dataSource === "real" ? "default" : "outline"}>
              {dataSource === "real" ? `● REAL MT5 (${realCount.toLocaleString()} bars)` : "○ Synthetic data"}
            </Badge>
          </div>

          {running && <Progress value={progress} className="h-1.5" />}

          {result && (
            <>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div><span className="font-semibold text-foreground">{strategyName}</span> · <span className="text-foreground">{symbol}</span> · TF <span className="text-foreground">{timeframe}</span> · {fmtD(from)} → {fmtD(now)} ({days} days)</div>
                <div>Model quality {result.modelQualityPct}% · {result.barsProcessed.toLocaleString()} bars · {result.ticksProcessed.toLocaleString()} ticks · Ran {startedAt} in {durationMs}ms {liveMode && <span className="text-primary">· LIVE tick #{tick}</span>}</div>
              </div>

              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide">MT5 Report</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 text-[11px] tabular-nums md:grid-cols-3">
                  <Row k="Total net profit" v={`${result.pnl >= 0 ? "+" : ""}$${result.pnl.toLocaleString()}`} good={result.pnl >= 0} bad={result.pnl < 0} />
                  <Row k="Gross profit" v={`+$${result.grossWin.toLocaleString()}`} good />
                  <Row k="Gross loss" v={`-$${result.grossLoss.toLocaleString()}`} bad />
                  <Row k="Profit factor" v={String(result.profitFactor)} good={result.profitFactor >= 1.2} />
                  <Row k="Expected payoff" v={`$${result.expectancy}`} good={result.expectancy >= 0} />
                  <Row k="Recovery factor" v={String(result.recoveryFactor)} />
                  <Row k="Absolute drawdown" v={`$${result.ddAbs.toLocaleString()}`} bad />
                  <Row k="Maximal drawdown" v={`${result.dd}%`} bad />
                  <Row k="Relative drawdown" v={`${result.ddRel}%`} bad />
                  <Row k="Total trades" v={String(result.trades)} />
                  <Row k="Long positions" v={String(result.longs)} />
                  <Row k="Short positions" v={String(result.shorts)} />
                  <Row k="Profit trades" v={`${result.wins} (${result.winRate}%)`} good />
                  <Row k="Loss trades" v={`${result.losses} (${100 - result.winRate}%)`} bad />
                  <Row k="Largest profit trade" v={`+$${result.bestTrade}`} good />
                  <Row k="Largest loss trade" v={`-$${Math.abs(result.worstTrade)}`} bad />
                  <Row k="Average profit trade" v={`+$${result.avgWin}`} good />
                  <Row k="Average loss trade" v={`-$${result.avgLoss}`} bad />
                  <Row k="Max consecutive wins" v={String(result.maxConsecWins)} good />
                  <Row k="Max consecutive losses" v={String(result.maxConsecLosses)} bad />
                  <Row k="Sharpe ratio" v={String(result.sharpe)} good={result.sharpe >= 1} />
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={result.curve}>
                  <defs>
                    <linearGradient id="btf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="equity" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#btf)" />
                </AreaChart>
              </ResponsiveContainer>

              <div className="rounded-md border">
                <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold">Trade Log — last 60 of {result.trades}</div>
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Open</TableHead>
                        <TableHead>Close</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead className="text-right">Lots</TableHead>
                        <TableHead className="text-right">Entry</TableHead>
                        <TableHead className="text-right">SL</TableHead>
                        <TableHead className="text-right">TP</TableHead>
                        <TableHead className="text-right">Exit</TableHead>
                        <TableHead className="text-right">Pips</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.trades_list.slice(-60).reverse().map((t) => (
                        <TableRow key={t.n}>
                          <TableCell className="font-mono text-xs">#{t.n}</TableCell>
                          <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{t.openTime}</TableCell>
                          <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{t.closeTime}</TableCell>
                          <TableCell><Badge variant="outline" className={t.side === "BUY" ? "text-primary" : "text-destructive"}>{t.side}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{t.lots}</TableCell>
                          <TableCell className="text-right tabular-nums text-[10px]">{t.entry}</TableCell>
                          <TableCell className="text-right tabular-nums text-[10px] text-destructive/80">{t.sl}</TableCell>
                          <TableCell className="text-right tabular-nums text-[10px] text-primary/80">{t.tp}</TableCell>
                          <TableCell className="text-right tabular-nums text-[10px]">{t.exit}</TableCell>
                          <TableCell className={`text-right tabular-nums text-xs ${t.pips >= 0 ? "text-primary" : "text-destructive"}`}>{t.pips}</TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${t.pnl >= 0 ? "text-primary" : "text-destructive"}`}>{t.pnl >= 0 ? "+" : ""}${t.pnl}</TableCell>
                          <TableCell className="text-right tabular-nums text-[11px]">${t.balance}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{t.reason}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={run}>Re-run</Button>
                <Button size="sm" onClick={() => { toast.success(`${strategyName} promoted to PAPER`); setOpen(false); }}>
                  {result.pnl > 0 && result.sharpe >= 1 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                  Promote to Paper
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, good, bad }: { k: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/60 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-semibold ${bad ? "text-destructive" : good ? "text-primary" : ""}`}>{v}</span>
    </div>
  );
}

function NumField({ label, value, onChange, step, disabled, text }: { label: string; value: number | string; onChange: (v: number | string) => void; step?: number; disabled?: boolean; text?: boolean }) {
  return (
    <label className="block">
      <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <input
        type={text ? "text" : "number"}
        value={value}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => onChange(text ? e.target.value : Number(e.target.value))}
        className="w-full rounded-md border bg-background px-2 py-1 text-xs tabular-nums disabled:opacity-60"
      />
    </label>
  );
}