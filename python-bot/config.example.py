"""Copy this file to config.py and fill in your values."""

MT5 = {
    "login": 12345678,
    "password": "YOUR_MT5_PASSWORD",
    "server": "YourBroker-Demo",
    "path": r"C:\Program Files\MetaTrader 5\terminal64.exe",
}

LOVABLE_API_KEY = "YOUR_LOVABLE_API_KEY_HERE"

# Published Lovable app URL + ingest path
DASHBOARD_URL = "https://your-lovable-app.lovable.app/api/public/ingest"
# Paste the BOT_INGEST_TOKEN value shown in Lovable Cloud > Secrets
DASHBOARD_TOKEN = "PASTE_BOT_INGEST_TOKEN_HERE"

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