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
