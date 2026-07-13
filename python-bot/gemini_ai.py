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
    system = 'Reply ONLY as JSON: {"approve": bool, "confidence": 0..1, "reason": str}.'
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
