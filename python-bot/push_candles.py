"""Push 6 months of MT5 candles to the Lovable dashboard for backtesting.

Usage:
    python push_candles.py                       # pushes all AGENTS symbols, all TIMEFRAMES
    python push_candles.py EURUSD XAUUSD H1 M15  # explicit symbols + timeframes

Reads MT5 login/DASHBOARD from config.py. Run this once (or on schedule) so
the web Strategy Tester can test on real market history for those pairs.
"""
import sys
from datetime import datetime, timedelta

import requests
import MetaTrader5 as mt5

import config
import mt5_bridge as bridge

TF_MAP = {
    "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

PUSH_URL = config.DASHBOARD_URL.replace("/api/public/ingest", "/api/public/mt5-candles")
MONTHS = 6


def fetch_and_push(symbol: str, timeframe: str):
    tf = TF_MAP[timeframe]
    since = datetime.utcnow() - timedelta(days=MONTHS * 31)
    rates = mt5.copy_rates_range(symbol, tf, since, datetime.utcnow())
    if rates is None or len(rates) == 0:
        print(f"  {symbol} {timeframe}: no data")
        return
    candles = [{
        "time": datetime.utcfromtimestamp(int(r["time"])).isoformat() + "Z",
        "o": float(r["open"]), "h": float(r["high"]),
        "l": float(r["low"]),  "c": float(r["close"]),
        "v": float(r["tick_volume"]),
    } for r in rates]
    # push in chunks of 2000
    total = 0
    for i in range(0, len(candles), 2000):
        chunk = candles[i:i + 2000]
        r = requests.post(
            PUSH_URL,
            headers={"X-Bot-Token": config.DASHBOARD_TOKEN, "Content-Type": "application/json"},
            json={"symbol": symbol, "timeframe": timeframe, "candles": chunk},
            timeout=60,
        )
        r.raise_for_status()
        total += r.json().get("inserted", 0)
    print(f"  {symbol} {timeframe}: {total} candles pushed")


def main():
    args = [a.upper() for a in sys.argv[1:]]
    tfs = [a for a in args if a in TF_MAP] or ["M15", "H1", "H4"]
    symbols = [a for a in args if a not in TF_MAP]
    if not symbols:
        symbols = sum(config.AGENTS.values(), [])
    bridge.connect(config.MT5)
    print(f"Pushing {len(symbols)} symbols × {len(tfs)} timeframes ({MONTHS} months) → {PUSH_URL}")
    for s in symbols:
        for tf in tfs:
            try:
                fetch_and_push(s, tf)
            except Exception as exc:
                print(f"  {s} {tf}: FAILED {exc}")
    print("Done.")


if __name__ == "__main__":
    main()