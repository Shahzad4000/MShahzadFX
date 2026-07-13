import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, Flame, Newspaper, Search, Sparkles, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { news, strategies, strategyCategories, BRAND, type StrategyCategory } from "@/lib/mock-data";
import { AIChat } from "@/components/trading/AIChat";
import { BacktestDialog } from "@/components/trading/BacktestDialog";
import { EADialog } from "@/components/trading/EADialog";
import { StrategyDetailDialog } from "@/components/trading/StrategyDetailDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus Strategy Maker — 300+ MT5 Strategies & Global EA Marketplace" },
      { name: "description", content: "300+ ready-made forex, gold, crypto, indices, options, arb, HFT, prop firm and marketplace EAs — 200+ famous global MT4/MT5 Expert Advisors with vendor, price, min/max deposit, avg win/loss $, profit factor, best/worst month, broker type, leverage, VPS/news-filter flags and legality." },
      { property: "og:title", content: "Nexus Strategy Maker" },
      { property: "og:description", content: "200+ trading strategies + global EA marketplace (120+ famous MT4/MT5 EAs) with proper risk management + one-click MT5 EA generator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StrategyMaker,
});

function StrategyMaker() {
  const [tab, setTab] = useState("strategies");
  const [category, setCategory] = useState<StrategyCategory | "All">("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 48;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strategies.filter((s) => {
      if (category !== "All" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.pair.toLowerCase().includes(q) ||
        s.timeframe.toLowerCase().includes(q) ||
        s.indicators.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  // reset to first page whenever filters change
  useEffect(() => { setPage(0); }, [category, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-sidebar/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-none">{BRAND.header} · Global EA Marketplace</h1>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              100,000+ EAs · every EA branded {BRAND.header} · magic # · Telegram {BRAND.telegram} · WhatsApp {BRAND.whatsapp}
            </div>
          </div>
          <div className="ml-auto hidden gap-1.5 md:flex">
            <Badge variant="outline" className="gap-1.5"><MessageCircle className="h-3 w-3 text-primary" />{BRAND.telegram}</Badge>
            <Badge variant="outline" className="gap-1.5"><Phone className="h-3 w-3 text-primary" />{BRAND.whatsapp}</Badge>
            <Badge variant="outline" className="gap-1.5"><Brain className="h-3 w-3 text-primary" /> Gemini AI</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="strategies"><Flame className="mr-1.5 h-3.5 w-3.5" />Strategies</TabsTrigger>
            <TabsTrigger value="generate"><Sparkles className="mr-1.5 h-3.5 w-3.5" />AI Generate</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="mr-1.5 h-3.5 w-3.5" />News</TabsTrigger>
          </TabsList>

          <TabsContent value="strategies" className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <MiniStat label="Total strategies" value={String(strategies.length)} />
              <MiniStat label="Categories" value={String(strategyCategories.length)} />
              <MiniStat label="Live" value={String(strategies.filter((s) => s.status === "LIVE").length)} accent />
              <MiniStat
                label="Avg win rate"
                value={`${Math.round(strategies.reduce((a, s) => a + s.winRate, 0) / strategies.length)}%`}
                accent
              />
            </div>

            <Card>
              <CardContent className="space-y-3 p-3 md:p-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search: XAUUSD, EMA, London, breakout…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <CatChip label="All" active={category === "All"} onClick={() => setCategory("All")} />
                  {strategyCategories.map((c) => (
                    <CatChip
                      key={c}
                      label={c}
                      active={category === c}
                      danger={c === "Degen 60Cr+"}
                      onClick={() => setCategory(c)}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{filtered.length.toLocaleString()} matching EAs · page {page + 1} / {pageCount.toLocaleString()}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Prev</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next ›</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {category === "Degen 60Cr+" && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <div className="text-destructive/90">
                  <b>Warning — "60 crore monthly" marketing claims:</b> ye strategies extreme leverage,
                  martingale, ya grid recovery use karti hain. Real accounts pe ek bad streak me pura
                  balance zero ho sakta hai. Sirf demo ya bahut chhoti test capital pe try karo.
                </div>
              </div>
            )}

            {category === "Grey / Illegal (Educational)" && (
              <div className="flex gap-2 rounded-md border border-destructive bg-destructive/15 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <div className="text-destructive/90">
                  <b>⚠ ILLEGAL — Educational Awareness Only:</b> ye strategies (insider trading, spoofing,
                  front-running, pump &amp; dump, wash trading, quote stuffing, cornering, tape painting)
                  duniya bhar me criminal offences hain — SEC, CFTC, FCA, SEBI, DOJ prosecute karti hain
                  (jail + full disgorgement + lifetime bans). Nexus in ke liye EA / signals generate NAHI
                  karega. Sirf isliye listed hain taake aap pehchan sakein aur bachein.
                </div>
              </div>
            )}

            {category === "EA Marketplace" && (
              <div className="flex gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <div className="text-foreground/90">
                  <b>Global EA Marketplace (200+ EAs):</b> duniya bhar ke sab famous MT4/MT5 EAs ek jagah — har EA ke saath <b>vendor · release year · price · min/max deposit · avg win $ · avg loss $ · profit factor · trades / month · avg hold · best/worst month · recommended leverage · broker type · VPS/news-filter/martingale/grid flags · legality</b> — "Details" button dabao aur pura profile dekho.
                  Forex Fury, Waka Waka, Perceptrader AI, Golden Pickaxe, GoldPulse AI, Aura Gold, XRayGold,
                  Night Hunter Pro, Night Owl, Advanced Scalper, The Reaper, PZ Day / Goldfinch / Grid / Trend,
                  Ilan / Cauldron, Blessing 3, Snowball, Big Bang, FX Charger / Stabilizer, Forex Diamond,
                  Forex Combo, Forex Truck, Real Profit, R Factor, PipFinite, Happy Gold / Frequency,
                  Zeus, Pass King, FTMO Auto Challenger, MyForexFunds Bot, The5ers, Funded Trader — prop firm passers,
                  Gerchik LMT, Dragon Expert, Bonnitta, Quantum Emperor / Trade, Boring Pips, Gold Reaper,
                  Gold Trade Pro, Gold Excel, Gold Miner Pro, XAU Master, GoldenBot, SuperTrend Gold,
                  Silver Sniper, Oil Trend, TrendMaster, Alise, Diamond Titan, AI Meta EA, Vader,
                  NAS100 / US30 Sniper, SPX Momentum, DAX Opening, FTSE Reversal, Nikkei Gap, HK50 Momentum,
                  BTC Trend, ETH Scalper, SOL Momentum, Crypto Grid, Funding Rate Harvester,
                  Latency Arb, Pairs Trading, Stat Arb, Market Maker, News Sentry, Sentiment Reversal,
                  COT, Seasonal, S/R, Fibonacci, Elliott Wave, Harmonic, SMC/ICT, Silver Bullet, Order Block Hunter,
                  Liquidity Sweep, Supply/Demand, Wyckoff, Turtle Trader, CTA Trend, Copy Trader, Zulu / Myfxbook,
                  MQL5 Signals, Trailing / BE / News / Correlation / Equity utility EAs, Renko / Range Bar /
                  Heiken Ashi / Multi-TF Confluence — sab ka pair, TF, session, entry/exit, SL/TP, risk % aur
                  claimed monthly return listed. Ek-click MT5 <code>.mq5</code> generator har entry pe available.
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((s) => (
                <Card key={s.id} className={s.category === "Degen 60Cr+" ? "border-destructive/40" : ""}>
                  <CardContent className="space-y-2.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.name}</div>
                        <div className="mt-0.5 text-[9px] font-medium text-primary/80">{s.brandHeader} · magic #{s.magicNumber}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                          <span>{s.pair}</span>
                          <span>·</span>
                          <span>{s.timeframe}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          s.status === "LIVE"
                            ? "bg-primary/15 text-primary text-[10px]"
                            : s.status === "PAPER"
                              ? "bg-accent/15 text-accent text-[10px]"
                              : "text-[10px]"
                        }
                      >
                        {s.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <MicroStat label="Win" value={`${s.winRate}%`} accent={s.winRate >= 60} />
                      <MicroStat label="R:R" value={`1:${s.rr}`} />
                      <MicroStat label="Risk" value={`${s.riskPct}%`} danger={s.riskPct > 2} />
                      <MicroStat label="DD" value={`${s.dd}%`} danger={s.dd > 20} />
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      SL {s.slPips}p · TP {s.tpPips}p · Sharpe {s.sharpe.toFixed(2)} · Monthly avg{" "}
                      <b className="text-foreground">{s.monthlyAvg}</b>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <StrategyDetailDialog strategy={s} />
                      <EADialog strategy={s} />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pageItems.length === 0 && (
                <div className="col-span-full rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Koi strategy match nahi — filter change karo
                </div>
              )}
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(0)}>« First</Button>
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Prev</Button>
                <span className="text-xs text-muted-foreground">Page {page + 1} / {pageCount.toLocaleString()}</span>
                <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next ›</Button>
                <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Last »</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Strategy Generator
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Gemini se naya custom strategy generate karo — pair, timeframe, indicators, SL/TP, entry/exit rules sab AI banayega.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button className="gap-2" size="sm">
                  <Sparkles className="h-4 w-4" /> Generate New (Gemini)
                </Button>
                <BacktestDialog />
              </CardContent>
            </Card>
            <AIChat />
          </TabsContent>

          <TabsContent value="news" className="space-y-3">
            {news.map((n, i) => (
              <Card key={i}>
                <CardContent className="flex gap-3 p-3">
                  <div className="w-14 shrink-0 text-center">
                    <Badge variant={n.impact === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">
                      {n.impact}
                    </Badge>
                    <div className="mt-1 text-[10px] text-muted-foreground">{n.time}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{n.tag}</Badge>
                      <span className="text-sm">{n.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">Sentiment</span>
                      <span className={n.sentiment >= 0 ? "text-primary" : "text-destructive"}>
                        {n.sentiment >= 0 ? "+" : ""}
                        {n.sentiment.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <footer className="mt-8 border-t pt-4 text-center text-[11px] text-muted-foreground">
          Nexus Strategy Maker · research + EA export only. Trade karna hai to apna MT5 par khud EA attach karo.
        </footer>
      </main>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-0.5 text-lg font-bold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MicroStat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="rounded bg-muted/40 py-1">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold tabular-nums ${danger ? "text-destructive" : accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function CatChip({ label, active, danger, onClick }: { label: string; active: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? danger
            ? "border-destructive bg-destructive/15 text-destructive"
            : "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
