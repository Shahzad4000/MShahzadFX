import type { Strategy } from "@/lib/mock-data";

/**
 * Generate a self-contained MQL5 Expert Advisor from a Strategy.
 * Runs standalone in MetaTrader 5:
 *  - Lot size = 1% of account balance per trade (auto)
 *  - SL/TP via ATR multiples
 *  - Trailing SL as price moves in profit
 *  - Entry logic auto-picked from strategy indicators
 *
 * NOTE: TrustWallet / on-chain wallets are NOT reachable from MT5
 * (MT5 is broker-side). Connect TrustWallet inside the Nexus dashboard;
 * this EA handles the MT5 side (Exness / XM / any MT5 broker).
 */
export function generateEA(s: Strategy): string {
  const safeName = s.name.replace(/[^A-Za-z0-9]+/g, "_");
  const indicators = (s.indicators || []).join(", ");
  const primary = detectEntry(s.indicators || []);
  const magic = s.magicNumber ?? (20260713 + Math.abs(hash(s.name)) % 9999);
  const header   = s.brandHeader ?? "MShahzad-FX";
  const telegram = s.telegram    ?? "@MShahzadFX";
  const whatsapp = s.whatsapp    ?? "03254000712";
  const inc = "#include <Trade\\Trade.mqh>";

  return `//+------------------------------------------------------------------+
//|                        ${header}
//|  ${s.name}
//|  Magic #: ${magic}
//|  Telegram: ${telegram}   WhatsApp: ${whatsapp}
//|  Agent: ${s.agent}   Indicators: ${indicators}
//|  Entry: ${primary.label}
//|  Risk: 1% of balance/trade | SL/TP: ATR-based | Trailing SL: ON
//+------------------------------------------------------------------+
#property copyright "${header} — Telegram ${telegram} — WhatsApp ${whatsapp}"
#property link      "https://t.me/MShahzadFX"
#property version   "1.00"
#property strict

${inc}
CTrade trade;

input double  RiskPercent      = 1.0;
input double  SL_ATR_Mult      = 1.5;
input double  TP_ATR_Mult      = 2.5;
input double  TrailStart_ATR   = 1.0;
input double  TrailStep_ATR    = 0.8;
input int     ATR_Period       = 14;
input int     MagicNumber      = ${magic};
input int     MaxSpreadPoints  = 30;
input int     MaxConcurrent    = 1;
input bool    UseTrailingStop  = true;

int atrHandle;
${primary.handles}

int OnInit()
  {
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetTypeFillingBySymbol(_Symbol);
   atrHandle = iATR(_Symbol, PERIOD_CURRENT, ATR_Period);
${primary.init}
   if(atrHandle == INVALID_HANDLE) return(INIT_FAILED);
   Print("Nexus EA [${safeName}] init on ", _Symbol);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason) { }

double CalcLot(double slPoints)
  {
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = balance * RiskPercent / 100.0;
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tickValue <= 0 || slPoints <= 0) return(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN));
   double lot  = riskMoney / (slPoints * tickValue);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   lot = MathFloor(lot / step) * step;
   lot = MathMax(vmin, MathMin(vmax, lot));
   return(NormalizeDouble(lot, 2));
  }

int CountMyPositions()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber &&
            PositionGetString(POSITION_SYMBOL) == _Symbol) n++;
     }
   return(n);
  }

void ManageTrailing(double atr)
  {
   if(!UseTrailingStop) return;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      long   type = PositionGetInteger(POSITION_TYPE);
      double open = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl   = PositionGetDouble(POSITION_SL);
      double tp   = PositionGetDouble(POSITION_TP);
      double bid  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask  = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double trail = atr * TrailStep_ATR;
      double start = atr * TrailStart_ATR;
      if(type == POSITION_TYPE_BUY && (bid - open) > start)
        {
         double newSL = NormalizeDouble(bid - trail, _Digits);
         if(newSL > sl) trade.PositionModify(ticket, newSL, tp);
        }
      else if(type == POSITION_TYPE_SELL && (open - ask) > start)
        {
         double newSL = NormalizeDouble(ask + trail, _Digits);
         if(sl == 0 || newSL < sl) trade.PositionModify(ticket, newSL, tp);
        }
     }
  }

int Signal()
  {
${primary.signal}
  }

datetime lastBar = 0;
void OnTick()
  {
   double atrBuf[]; if(CopyBuffer(atrHandle, 0, 0, 2, atrBuf) < 2) return;
   double atr = atrBuf[0];
   ManageTrailing(atr);
   datetime t = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(t == lastBar) return;
   lastBar = t;
   if(CountMyPositions() >= MaxConcurrent) return;
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(spread > MaxSpreadPoints) return;
   int sig = Signal();
   if(sig == 0) return;
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double slDist = atr * SL_ATR_Mult;
   double tpDist = atr * TP_ATR_Mult;
   double slPts  = slDist / point;
   double lot    = CalcLot(slPts);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(sig > 0)
     {
      double sl = NormalizeDouble(ask - slDist, _Digits);
      double tp = NormalizeDouble(ask + tpDist, _Digits);
      trade.Buy(lot, _Symbol, ask, sl, tp, "Nexus ${safeName}");
     }
   else
     {
      double sl = NormalizeDouble(bid + slDist, _Digits);
      double tp = NormalizeDouble(bid - tpDist, _Digits);
      trade.Sell(lot, _Symbol, bid, sl, tp, "Nexus ${safeName}");
     }
  }
`;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

type EntryBlock = { label: string; handles: string; init: string; signal: string };

function detectEntry(inds: string[]): EntryBlock {
  const j = inds.join(" ").toLowerCase();

  if (j.includes("supertrend") || j.includes("adx")) {
    return {
      label: "EMA(20/50) trend + ADX filter",
      handles: `int emaFastH, emaSlowH, adxH;`,
      init: `   emaFastH = iMA(_Symbol, PERIOD_CURRENT, 20, 0, MODE_EMA, PRICE_CLOSE);
   emaSlowH = iMA(_Symbol, PERIOD_CURRENT, 50, 0, MODE_EMA, PRICE_CLOSE);
   adxH     = iADX(_Symbol, PERIOD_CURRENT, 14);`,
      signal: `   double f[], s[], a[];
   if(CopyBuffer(emaFastH,0,0,2,f)<2) return 0;
   if(CopyBuffer(emaSlowH,0,0,2,s)<2) return 0;
   if(CopyBuffer(adxH,0,0,2,a)<2) return 0;
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(a[0] < 20) return 0;
   if(f[0] > s[0] && price > f[0]) return 1;
   if(f[0] < s[0] && price < f[0]) return -1;
   return 0;`,
    };
  }
  if (j.includes("bollinger")) {
    return {
      label: "Bollinger fade + RSI filter",
      handles: `int bbH, rsiH;`,
      init: `   bbH  = iBands(_Symbol, PERIOD_CURRENT, 20, 0, 2.0, PRICE_CLOSE);
   rsiH = iRSI  (_Symbol, PERIOD_CURRENT, 14, PRICE_CLOSE);`,
      signal: `   double up[], lo[], r[];
   if(CopyBuffer(bbH,1,0,2,up)<2) return 0;
   if(CopyBuffer(bbH,2,0,2,lo)<2) return 0;
   if(CopyBuffer(rsiH,0,0,2,r)<2) return 0;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(bid <= lo[0] && r[0] < 30) return 1;
   if(bid >= up[0] && r[0] > 70) return -1;
   return 0;`,
    };
  }
  if (j.includes("rsi")) {
    return {
      label: "RSI reversal + EMA200 bias",
      handles: `int rsiH, ema200H;`,
      init: `   rsiH    = iRSI(_Symbol, PERIOD_CURRENT, 14, PRICE_CLOSE);
   ema200H = iMA (_Symbol, PERIOD_CURRENT, 200, 0, MODE_EMA, PRICE_CLOSE);`,
      signal: `   double r[], e[];
   if(CopyBuffer(rsiH,0,0,3,r)<3) return 0;
   if(CopyBuffer(ema200H,0,0,2,e)<2) return 0;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(r[1] < 30 && r[0] > 30 && bid > e[0]) return 1;
   if(r[1] > 70 && r[0] < 70 && bid < e[0]) return -1;
   return 0;`,
    };
  }
  if (j.includes("macd")) {
    return {
      label: "MACD zero-line cross",
      handles: `int macdH;`,
      init: `   macdH = iMACD(_Symbol, PERIOD_CURRENT, 12, 26, 9, PRICE_CLOSE);`,
      signal: `   double m[]; if(CopyBuffer(macdH,0,0,3,m)<3) return 0;
   if(m[1] < 0 && m[0] > 0) return 1;
   if(m[1] > 0 && m[0] < 0) return -1;
   return 0;`,
    };
  }
  if (j.includes("donchian") || j.includes("breakout") || j.includes("range")) {
    return {
      label: "Donchian 20 breakout",
      handles: `// no extra handles`,
      init: `   // Donchian computed inline`,
      signal: `   int N = 20;
   double hh = iHigh(_Symbol, PERIOD_CURRENT, iHighest(_Symbol, PERIOD_CURRENT, MODE_HIGH, N, 1));
   double ll = iLow (_Symbol, PERIOD_CURRENT, iLowest (_Symbol, PERIOD_CURRENT, MODE_LOW , N, 1));
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(bid > hh) return 1;
   if(bid < ll) return -1;
   return 0;`,
    };
  }
  return {
    label: "EMA(20/50) trend",
    handles: `int emaFastH, emaSlowH;`,
    init: `   emaFastH = iMA(_Symbol, PERIOD_CURRENT, 20, 0, MODE_EMA, PRICE_CLOSE);
   emaSlowH = iMA(_Symbol, PERIOD_CURRENT, 50, 0, MODE_EMA, PRICE_CLOSE);`,
    signal: `   double f[], s[];
   if(CopyBuffer(emaFastH,0,0,2,f)<2) return 0;
   if(CopyBuffer(emaSlowH,0,0,2,s)<2) return 0;
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(f[0] > s[0] && price > f[0]) return 1;
   if(f[0] < s[0] && price < f[0]) return -1;
   return 0;`,
  };
}
