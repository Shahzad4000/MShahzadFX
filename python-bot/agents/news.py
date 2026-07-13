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
