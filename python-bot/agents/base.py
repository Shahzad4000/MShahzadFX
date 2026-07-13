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
