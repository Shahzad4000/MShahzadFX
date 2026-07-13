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
        log("MT5 connected")
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
            log(f"Daily loss limit ({daily_pct:.2f}%). Pausing.")
            return False
        dd_pct = (acc["equity"] - self.start_balance) / self.start_balance * 100
        if dd_pct <= -config.RISK["max_drawdown_pct"]:
            log(f"Max drawdown ({dd_pct:.2f}%). Halting.")
            return False
        if len(bridge.open_positions()) >= config.RISK["max_concurrent"]:
            return False
        if bridge.spread_points(sig.symbol) > config.RISK["max_spread_points"]:
            return False
        rr = abs(sig.tp - sig.entry) / max(abs(sig.entry - sig.sl), 1e-9)
        if rr < config.RISK["min_rr"]:
            return False
        if self.news.is_blackout():
            log(f"News blackout - skipping {sig.symbol}")
            return False
        return True

    def execute(self, sig):
        acc = bridge.account_info()
        sl_points = abs(sig.entry - sig.sl) / bridge.point(sig.symbol)
        lot = bridge.calc_lot(sig.symbol, acc["balance"], config.RISK["per_trade_pct"], sl_points)
        res = bridge.market_order(sig.symbol, sig.side, lot, sig.sl, sig.tp,
                                  comment=f"nexus-{sig.reason[:20]}")
        mark = "OK" if res["ok"] else "FAIL"
        log(f"{mark} {sig.side} {sig.symbol} {lot} @ {res.get('price')} - {res.get('comment')}")

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
    log("Nexus AI running 24/7 - Ctrl+C to stop.")
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
