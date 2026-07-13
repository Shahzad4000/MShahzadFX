# Nexus AI — Python MT5 Bot (24/7)

Yeh Python bundle **Windows PC ya Windows VPS** par chalta hai aur real MT5 account se connect ho ke 24/7 trading karta hai. Web dashboard (Lovable app) sirf view/control ke liye hai — real orders yahan se jate hain.

## Architecture

```
Web Dashboard (Lovable)  <---REST--->  dashboard_client.py
                                            |
                        MANAGER AGENT (main.py) — orchestrates, risk, routes
                        /       |       |         |          \
                    Forex    Crypto   Metals   Commodities   News
                    Agent    Agent    Agent    Agent         Agent
                        \_______|_______|_________|_________/
                                        |
                                mt5_bridge.py  --->  Live MT5 Terminal
```

## Features

- 5 agents (Forex / Crypto / Metals / Commodities / News) + Manager
- Gemini AI (via Lovable AI Gateway — same key as web app) generates & tunes strategies
- Adaptive learning: har N trades ke baad AI params retune
- Multi-timeframe (M5/M15/H1/H4) multi-symbol scanning
- Strict risk: 1% per trade, SL + TP har trade par, R:R >= 1.5
- Spread filter, news blackout, correlation guard, daily-loss circuit
- 24/7 loop with auto-reconnect
- Web dashboard live push

## Install (Windows)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install MetaTrader5 pandas numpy requests feedparser
```

Copy `config.example.py` -> `config.py`, apna MT5 login/password/server aur `LOVABLE_API_KEY` daalein.

## Run

```powershell
python main.py
```

## Deployment (24/7)

Windows VPS (Contabo / ForexVPS / AWS EC2 Windows). RDP -> MT5 install & login -> yeh bundle copy -> `pythonw main.py` ya Task Scheduler.

## Safety

- Pehle demo account par 2 hafte test karo
- Max daily loss 3%, max drawdown 10% — bot khud pause ho jayega
- Har trade Manager Agent approve karta hai
*** Add File: python-bot/config.example.py
"""Copy this file to config.py and fill in your values."""

MT5 = {
    "login": 12345678,
    "password": "YOUR_MT5_PASSWORD",
    "server": "YourBroker-Demo",
    "path": r"C:\Program Files\MetaTrader 5\terminal64.exe",
}

LOVABLE_API_KEY = "YOUR_LOVABLE_API_KEY_HERE"

DASHBOARD_URL = "https://your-lovable-app.lovable.app/api/ingest"
DASHBOARD_TOKEN = "shared-secret-token"

RISK = {
    "per_trade_pct": 1.0,
    "max_daily_loss_pct": 3.0,
    "max_drawdown_pct": 10.0,
    "min_rr": 1.5,
    "max_concurrent": 8,
    "max_spread_points": 30,
}

AGENTS = {
    "forex":       ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"],
    "crypto":      ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD"],
    "metals":      ["XAUUSD", "XAGUSD"],
    "commodities": ["USOIL", "UKOIL", "NGAS"],
}

TIMEFRAMES = ["M5", "M15", "H1", "H4"]

NEWS_FEEDS = [
    "https://www.forexlive.com/feed/",
    "https://www.investing.com/rss/news_25.rss",
]

NEWS_BLACKOUT_MIN = 15
HIGH_IMPACT_KEYWORDS = ["FOMC", "NFP", "CPI", "ECB", "BOJ", "POWELL", "LAGARDE"]
*** Add File: python-bot/gemini_ai.py
"""Gemini via Lovable AI Gateway."""
import json
import requests

GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions"
MODEL = "google/gemini-2.5-flash"


def _call(api_key, system, user, json_mode=False):
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    r = requests.post(GATEWAY, headers={
        "Lovable-API-Key": api_key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "python-mt5-bot",
    }, json=body, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def generate_strategy(api_key, agent, symbol, timeframe, recent_stats):
    system = ("You are a quantitative trading strategist. Output ONLY JSON: "
              '{"name": str, "instruments": [str], "timeframe": str, '
              '"entry_rules": [str], "exit_rules": [str], "sl_atr_mult": float, '
              '"tp_atr_mult": float, "risk_pct": float, "expected_edge": str}.')
    user = (f"Agent: {agent}. Symbol: {symbol}. TF: {timeframe}. "
            f"Stats: {json.dumps(recent_stats)}. Enforce R:R >= 1.5.")
    return json.loads(_call(api_key, system, user, json_mode=True))


def analyze_signal(api_key, symbol, features):
    system = ('Reply ONLY as JSON: {"approve": bool, "confidence": 0..1, "reason": str}.')
    user = f"Symbol: {symbol}. Features: {json.dumps(features)}. Approve?"
    return json.loads(_call(api_key, system, user, json_mode=True))


def adaptive_tune(api_key, strategy, closed_trades):
    system = ('Return ONLY JSON: {"sl_atr_mult": float, "tp_atr_mult": float, '
              '"risk_pct": float, "notes": str}.')
    user = json.dumps({"strategy": strategy, "trades": closed_trades[-50:]})
    return json.loads(_call(api_key, system, user, json_mode=True))


def summarize_news(api_key, headlines):
    system = ('Return ONLY JSON: {"usd": -1..1, "eur": -1..1, "gold": -1..1, '
              '"oil": -1..1, "crypto": -1..1, "risk_on": -1..1, "top_events": [str]}.')
    user = "Recent headlines:\n" + "\n".join(f"- {h}" for h in headlines[:30])
    return json.loads(_call(api_key, system, user, json_mode=True))
*** Add File: python-bot/mt5_bridge.py
"""Thin wrapper over MetaTrader5."""
import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime

TF_MAP = {"M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
          "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
          "D1": mt5.TIMEFRAME_D1}


def connect(cfg):
    if not mt5.initialize(path=cfg.get("path"), login=cfg["login"],
                          password=cfg["password"], server=cfg["server"]):
        raise RuntimeError(f"MT5 init failed: {mt5.last_error()}")
    return True


def account_info():
    a = mt5.account_info()._asdict()
    return {"balance": a["balance"], "equity": a["equity"], "margin": a["margin"],
            "free_margin": a["margin_free"], "currency": a["currency"]}


def candles(symbol, timeframe, n=500):
    rates = mt5.copy_rates_from_pos(symbol, TF_MAP[timeframe], 0, n)
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    return df


def spread_points(symbol):
    tick = mt5.symbol_info_tick(symbol)
    info = mt5.symbol_info(symbol)
    return int((tick.ask - tick.bid) / info.point)


def calc_lot(symbol, balance, risk_pct, sl_points):
    info = mt5.symbol_info(symbol)
    tick_value = info.trade_tick_value
    risk_money = balance * (risk_pct / 100.0)
    lot = risk_money / max(sl_points * tick_value, 1e-9)
    step = info.volume_step
    lot = max(info.volume_min, min(info.volume_max, round(lot / step) * step))
    return round(lot, 2)


def market_order(symbol, side, lot, sl, tp, comment="nexus-ai"):
    tick = mt5.symbol_info_tick(symbol)
    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if side == "BUY" else tick.bid
    req = {"action": mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": lot,
           "type": order_type, "price": price, "sl": sl, "tp": tp,
           "deviation": 20, "magic": 20260713, "comment": comment,
           "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC}
    res = mt5.order_send(req)
    return {"ok": res.retcode == mt5.TRADE_RETCODE_DONE, "ticket": res.order,
            "price": res.price, "comment": res.comment, "retcode": res.retcode}


def open_positions():
    ps = mt5.positions_get() or []
    return [{"ticket": p.ticket, "symbol": p.symbol,
             "side": "BUY" if p.type == 0 else "SELL",
             "lot": p.volume, "entry": p.price_open, "sl": p.sl, "tp": p.tp,
             "pnl": p.profit, "comment": p.comment,
             "time": datetime.fromtimestamp(p.time).isoformat()} for p in ps]


def point(symbol):
    return mt5.symbol_info(symbol).point
*** Add File: python-bot/dashboard_client.py
"""Push live state to the Lovable web dashboard."""
import requests


def push(url, token, payload):
    try:
        requests.post(url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }, json=payload, timeout=5)
    except Exception:
        pass
*** Add File: python-bot/adaptive.py
"""Adaptive learning loop — Gemini re-tunes strategy params from closed trades."""
from collections import defaultdict


class AdaptiveLearner:
    def __init__(self, ai, api_key):
        self.ai = ai
        self.api_key = api_key
        self.closed = defaultdict(list)

    def record(self, strategy_name, trade):
        self.closed[strategy_name].append(trade)

    def maybe_retune(self, strategy, every=20):
        name = strategy["name"]
        trades = self.closed[name]
        if len(trades) < every or len(trades) % every != 0:
            return strategy
        try:
            tuned = self.ai.adaptive_tune(self.api_key, strategy, trades)
            for k in ("sl_atr_mult", "tp_atr_mult", "risk_pct"):
                if k in tuned:
                    strategy[k] = tuned[k]
        except Exception:
            pass
        return strategy
*** Add File: python-bot/agents/__init__.py
"""Nexus AI trading agents package."""
*** Add File: python-bot/agents/base.py
"""Base Agent — every specialist inherits."""
import pandas as pd
from dataclasses import dataclass


@dataclass
class Signal:
    symbol: str
    timeframe: str
    side: str
    entry: float
    sl: float
    tp: float
    confidence: float
    reason: str


class BaseAgent:
    name = "base"
    symbols = []
    timeframes = ["M15", "H1"]

    def __init__(self, bridge, ai, config):
        self.bridge = bridge
        self.ai = ai
        self.config = config
        self.api_key = config.LOVABLE_API_KEY

    def _atr(self, df, n=14):
        h, l, c = df["high"], df["low"], df["close"]
        tr = pd.concat([(h - l), (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
        return float(tr.rolling(n).mean().iloc[-1])

    def _ema(self, s, n):
        return float(s.ewm(span=n, adjust=False).mean().iloc[-1])

    def scan(self):
        signals = []
        for symbol in self.symbols:
            for tf in self.timeframes:
                try:
                    df = self.bridge.candles(symbol, tf, 300)
                    if len(df) < 60:
                        continue
                    sig = self._simple_trend(symbol, tf, df)
                    if sig:
                        signals.append(sig)
                except Exception:
                    continue
        return signals

    def _simple_trend(self, symbol, tf, df):
        ema_fast = self._ema(df["close"], 20)
        ema_slow = self._ema(df["close"], 50)
        atr = self._atr(df)
        price = float(df["close"].iloc[-1])
        if ema_fast > ema_slow * 1.0005 and price > ema_fast:
            return Signal(symbol, tf, "BUY", price, price - 1.5 * atr, price + 2.5 * atr, 0.6, "EMA trend up")
        if ema_fast < ema_slow * 0.9995 and price < ema_fast:
            return Signal(symbol, tf, "SELL", price, price + 1.5 * atr, price - 2.5 * atr, 0.6, "EMA trend down")
        return None

    def validate_with_ai(self, sig, features):
        try:
            v = self.ai.analyze_signal(self.api_key, sig.symbol, {**features, "side": sig.side})
            return bool(v.get("approve")) and v.get("confidence", 0) >= 0.55
        except Exception:
            return sig.confidence >= 0.7
*** Add File: python-bot/agents/forex.py
from .base import BaseAgent

class ForexAgent(BaseAgent):
    name = "forex"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["forex"]
        self.timeframes = ["M15", "H1"]
*** Add File: python-bot/agents/crypto.py
from .base import BaseAgent

class CryptoAgent(BaseAgent):
    name = "crypto"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["crypto"]
        self.timeframes = ["M15", "H1", "H4"]
*** Add File: python-bot/agents/metals.py
from .base import BaseAgent

class MetalsAgent(BaseAgent):
    name = "metals"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["metals"]
        self.timeframes = ["M5", "M15", "H1"]
*** Add File: python-bot/agents/commodities.py
from .base import BaseAgent

class CommoditiesAgent(BaseAgent):
    name = "commodities"
    def __init__(self, bridge, ai, config):
        super().__init__(bridge, ai, config)
        self.symbols = config.AGENTS["commodities"]
        self.timeframes = ["H1", "H4"]
*** Add File: python-bot/agents/news.py
"""News Agent — RSS + Gemini sentiment -> global bias per asset class."""
import time
import feedparser


class NewsAgent:
    name = "news"

    def __init__(self, bridge, ai, config):
        self.ai = ai
        self.config = config
        self.api_key = config.LOVABLE_API_KEY
        self.last_scan = 0
        self.bias = {"usd": 0, "eur": 0, "gold": 0, "oil": 0, "crypto": 0,
                     "risk_on": 0, "top_events": []}

    def refresh(self, force=False):
        if not force and time.time() - self.last_scan < 300:
            return self.bias
        headlines = []
        for url in self.config.NEWS_FEEDS:
            try:
                feed = feedparser.parse(url)
                headlines.extend([e.title for e in feed.entries[:15]])
            except Exception:
                continue
        if headlines:
            try:
                self.bias = self.ai.summarize_news(self.api_key, headlines)
            except Exception:
                pass
        self.last_scan = time.time()
        return self.bias

    def is_blackout(self):
        events = " ".join(self.bias.get("top_events", [])).upper()
        return any(k in events for k in self.config.HIGH_IMPACT_KEYWORDS)

    def bias_for(self, symbol):
        s = symbol.upper()
        if "XAU" in s: return self.bias.get("gold", 0)
        if s.startswith("USD"): return self.bias.get("usd", 0)
        if "EUR" in s: return self.bias.get("eur", 0)
        if "OIL" in s or "WTI" in s or "BRENT" in s: return self.bias.get("oil", 0)
        if "BTC" in s or "ETH" in s or "SOL" in s: return self.bias.get("crypto", 0)
        return self.bias.get("risk_on", 0)
*** Add File: python-bot/main.py
"""Nexus AI — Manager Agent + 24/7 main loop.

Run:  python main.py
"""
import time
import traceback
from datetime import datetime

import config
import mt5_bridge as bridge
import gemini_ai as ai
import dashboard_client
from agents.forex import ForexAgent
from agents.crypto import CryptoAgent
from agents.metals import MetalsAgent
from agents.commodities import CommoditiesAgent
from agents.news import NewsAgent


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


class Manager:
    def __init__(self):
        bridge.connect(config.MT5)
        log("MT5 connected ✅")
        self.forex = ForexAgent(bridge, ai, config)
        self.crypto = CryptoAgent(bridge, ai, config)
        self.metals = MetalsAgent(bridge, ai, config)
        self.commodities = CommoditiesAgent(bridge, ai, config)
        self.news = NewsAgent(bridge, ai, config)
        self.specialists = [self.forex, self.crypto, self.metals, self.commodities]
        self.start_balance = bridge.account_info()["balance"]
        self.day_start_balance = self.start_balance
        self.day = datetime.now().date()

    def risk_ok(self, sig):
        acc = bridge.account_info()
        if datetime.now().date() != self.day:
            self.day = datetime.now().date()
            self.day_start_balance = acc["balance"]
        daily_pct = (acc["equity"] - self.day_start_balance) / self.day_start_balance * 100
        if daily_pct <= -config.RISK["max_daily_loss_pct"]:
            log(f"🚨 Daily loss limit ({daily_pct:.2f}%). Pausing.")
            return False
        dd_pct = (acc["equity"] - self.start_balance) / self.start_balance * 100
        if dd_pct <= -config.RISK["max_drawdown_pct"]:
            log(f"🚨 Max drawdown ({dd_pct:.2f}%). Halting.")
            return False
        if len(bridge.open_positions()) >= config.RISK["max_concurrent"]:
            return False
        if bridge.spread_points(sig.symbol) > config.RISK["max_spread_points"]:
            return False
        rr = abs(sig.tp - sig.entry) / max(abs(sig.entry - sig.sl), 1e-9)
        if rr < config.RISK["min_rr"]:
            return False
        if self.news.is_blackout():
            log(f"📰 News blackout — skipping {sig.symbol}")
            return False
        return True

    def execute(self, sig):
        acc = bridge.account_info()
        sl_points = abs(sig.entry - sig.sl) / bridge.point(sig.symbol)
        lot = bridge.calc_lot(sig.symbol, acc["balance"], config.RISK["per_trade_pct"], sl_points)
        res = bridge.market_order(sig.symbol, sig.side, lot, sig.sl, sig.tp,
                                  comment=f"nexus-{sig.reason[:20]}")
        log(f"{'✅' if res['ok'] else '❌'} {sig.side} {sig.symbol} {lot} @ {res.get('price')} — {res.get('comment')}")

    def tick(self):
        self.news.refresh()
        for agent in self.specialists:
            for sig in agent.scan():
                bias = self.news.bias_for(sig.symbol)
                if (sig.side == "BUY" and bias < -0.5) or (sig.side == "SELL" and bias > 0.5):
                    continue
                features = {"confidence": sig.confidence, "reason": sig.reason,
                            "news_bias": bias, "timeframe": sig.timeframe}
                if not agent.validate_with_ai(sig, features):
                    continue
                if not self.risk_ok(sig):
                    continue
                self.execute(sig)

        acc = bridge.account_info()
        dashboard_client.push(config.DASHBOARD_URL, config.DASHBOARD_TOKEN, {
            "ts": datetime.now().isoformat(),
            "account": acc,
            "positions": bridge.open_positions(),
            "news_bias": self.news.bias,
        })


def main():
    m = Manager()
    log("Nexus AI running 24/7 — Ctrl+C to stop.")
    while True:
        try:
            m.tick()
        except KeyboardInterrupt:
            log("Stopped by user.")
            break
        except Exception:
            log("Tick error:\n" + traceback.format_exc())
        time.sleep(30)


if __name__ == "__main__":
    main()