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
