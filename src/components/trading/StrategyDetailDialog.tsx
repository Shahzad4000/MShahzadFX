import { useState } from "react";
import { Info, AlertTriangle, Target, Shield, Clock, TrendingUp, DollarSign, Building2, BadgeCheck, Cpu, MessageCircle, Phone, Hash, Activity, LineChart, Layers, Bot, Wallet, Percent, CalendarRange, Timer, Gauge, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Strategy } from "@/lib/mock-data";
import { BacktestDialog } from "@/components/trading/BacktestDialog";

export function StrategyDetailDialog({ strategy: s }: { strategy: Strategy }) {
  const [open, setOpen] = useState(false);
  const netPerTrade = (s.avgWinUsd ?? 0) * (s.winRate / 100) - (s.avgLossUsd ?? 0) * ((100 - s.winRate) / 100);
  const expectancy = netPerTrade.toFixed(2);
  const monthlyTradeIncome = s.avgTradesPerMonth ? Math.round(netPerTrade * s.avgTradesPerMonth) : null;
  const holdLabel = s.avgHoldMinutes
    ? s.avgHoldMinutes >= 1440
      ? `${Math.round(s.avgHoldMinutes / 1440)}d`
      : s.avgHoldMinutes >= 60
        ? `${Math.round(s.avgHoldMinutes / 60)}h`
        : `${s.avgHoldMinutes}m`
    : "—";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2">
          <Info className="h-3.5 w-3.5" /> Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {s.name}
            <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
            <Badge variant="secondary" className="text-[10px]">ID {s.id}</Badge>
            <Badge className="text-[10px]" variant={s.status === "LIVE" ? "default" : "outline"}>{s.status}</Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{s.pair}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.timeframe}</span>
            <span>Session: {s.session}</span>
            <span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" />{s.agent}</span>
          </DialogDescription>
        </DialogHeader>

        {(s.brandHeader || s.magicNumber || s.telegram || s.whatsapp) && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-[11px]">
            {s.brandHeader && <Badge className="bg-primary text-primary-foreground">{s.brandHeader}</Badge>}
            {s.magicNumber !== undefined && (
              <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />Magic <b>{s.magicNumber}</b></span>
            )}
            {s.telegram && (
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-primary" />{s.telegram}</span>
            )}
            {s.whatsapp && (
              <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-primary" />{s.whatsapp}</span>
            )}
          </div>
        )}

        {s.warning && (
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="text-destructive/90"><b>Warning:</b> {s.warning}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <BacktestDialog
            strategy={s}
            trigger={
              <Button size="sm" className="gap-1 h-7 px-2">
                <Play className="h-3.5 w-3.5" /> Live Test (MT5 Strategy Tester)
              </Button>
            }
          />
          <span className="text-[10px] text-muted-foreground self-center">Auto-loads {s.pair} · {s.timeframe} · 6 months · risk {s.riskPct}% · SL {s.slPips}p · TP {s.tpPips}p — override manually inside.</span>
        </div>

        <SectionTitle icon={<Layers className="h-3.5 w-3.5" />}>Trade Setup</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Stat label="Pair" value={s.pair} />
          <Stat label="Timeframe" value={s.timeframe} />
          <Stat label="Session" value={s.session} />
          <Stat label="Agent" value={s.agent} />
          <Stat label="SL" value={`${s.slPips} pips`} />
          <Stat label="TP" value={`${s.tpPips} pips`} />
          <Stat label="R:R" value={`1 : ${s.rr}`} accent />
          <Stat label="Risk / trade" value={`${s.riskPct}%`} accent={s.riskPct <= 1} danger={s.riskPct > 2} />
          <Stat label="Max daily loss" value={`${s.maxDailyLossPct}%`} />
          <Stat label="Max concurrent" value={String(s.maxConcurrent)} />
          <Stat label="Avg hold" value={holdLabel} />
        </div>

        <SectionTitle icon={<LineChart className="h-3.5 w-3.5" />}>Performance</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Stat label="Win rate" value={`${s.winRate}%`} accent={s.winRate >= 60} />
          <Stat label="Sharpe" value={s.sharpe.toFixed(2)} accent={s.sharpe >= 1.5} />
          <Stat label="Profit factor" value={s.profitFactor ? s.profitFactor.toFixed(2) : "—"} accent={(s.profitFactor ?? 0) >= 1.5} />
          <Stat label="Max drawdown" value={`-${s.dd}%`} danger />
          <Stat label="Total trades" value={s.trades.toLocaleString()} />
          <Stat label="Backtest P&L" value={`+$${s.pnl.toLocaleString()}`} accent={s.pnl > 0} danger={s.pnl < 0} />
          <Stat label="Monthly avg" value={s.monthlyAvg} accent />
          <Stat label="Trades / month" value={s.avgTradesPerMonth ? String(s.avgTradesPerMonth) : "—"} />
          <Stat label="Avg win $" value={s.avgWinUsd ? `+$${s.avgWinUsd.toLocaleString()}` : "—"} accent />
          <Stat label="Avg loss $" value={s.avgLossUsd ? `-$${s.avgLossUsd.toLocaleString()}` : "—"} danger />
          <Stat label="Best month" value={s.bestMonthPct !== undefined ? `+${s.bestMonthPct}%` : "—"} accent />
          <Stat label="Worst month" value={s.worstMonthPct !== undefined ? `${s.worstMonthPct}%` : "—"} danger />
          <Stat label="Expectancy / trade" value={`$${expectancy}`} accent={netPerTrade > 0} danger={netPerTrade < 0} />
          {monthlyTradeIncome !== null && (
            <Stat label="Est. $/month" value={`${monthlyTradeIncome >= 0 ? "+" : ""}$${monthlyTradeIncome.toLocaleString()}`} accent={monthlyTradeIncome > 0} danger={monthlyTradeIncome < 0} />
          )}
        </div>

        <SectionTitle icon={<Wallet className="h-3.5 w-3.5" />}>Capital &amp; Broker</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Stat label="Min deposit" value={s.minDepositUsd ? `$${s.minDepositUsd.toLocaleString()}` : "—"} accent />
          <Stat label="Max deposit" value={s.maxDepositUsd ? `$${s.maxDepositUsd.toLocaleString()}` : "—"} />
          <Stat label="Leverage" value={s.recommendedLeverage ?? "—"} />
          <Stat label="Broker" value={s.brokerType ?? "—"} />
          <Stat label="Price" value={s.priceUsd ?? "—"} />
          <Stat label="Vendor" value={s.vendor ?? "—"} />
          <Stat label="Released" value={s.yearReleased ? String(s.yearReleased) : "—"} />
          <Stat label="Verified" value={s.verifiedSource ?? "—"} />
          <Stat label="Legality" value={s.legality ?? "Legal"} danger={s.legality && s.legality !== "Legal"} accent={s.legality === "Legal"} />
        </div>

        <div className="grid gap-3 text-xs md:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="mb-1 flex items-center gap-1 font-semibold"><Target className="h-3.5 w-3.5 text-primary" /> Entry Rules</div>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {s.entryRules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-1 flex items-center gap-1 font-semibold"><Shield className="h-3.5 w-3.5 text-primary" /> Exit / Risk</div>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {s.exitRules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>

        <SectionTitle icon={<Activity className="h-3.5 w-3.5" />}>Indicators</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {s.indicators.map((i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-normal">{i}</Badge>
          ))}
        </div>

        <SectionTitle icon={<Gauge className="h-3.5 w-3.5" />}>Features &amp; Flags</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {s.vpsRequired && <Flag icon={<Cpu className="h-3 w-3" />}>VPS required</Flag>}
          {s.newsFilter && <Flag>News filter</Flag>}
          {s.martingale && <Flag danger>Martingale</Flag>}
          {s.grid && <Flag danger>Grid</Flag>}
          {s.hedging && <Flag>Hedging</Flag>}
          {!s.vpsRequired && !s.newsFilter && !s.martingale && !s.grid && !s.hedging && (
            <span className="text-[11px] text-muted-foreground">Standard EA — no special flags.</span>
          )}
        </div>

        {s.description && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> Description</div>
            {s.description}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 border-b pb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
      {icon} {children}
    </div>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`truncate text-sm font-semibold tabular-nums ${danger ? "text-destructive" : accent ? "text-primary" : ""}`} title={value}>{value}</div>
    </div>
  );
}

function Flag({ children, icon, danger }: { children: React.ReactNode; icon?: React.ReactNode; danger?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${danger ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/10 text-primary"}`}>
      {icon} {children}
    </span>
  );
}