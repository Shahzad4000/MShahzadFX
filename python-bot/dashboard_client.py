"""Push live state to the Lovable web dashboard (/api/public/ingest)."""
import requests


def push(url, token, payload):
    """POST metrics + positions to the Nexus AI dashboard.

    url:   https://<your-app>.lovable.app/api/public/ingest
    token: value of BOT_INGEST_TOKEN secret from Lovable Cloud
    """
    try:
        requests.post(
            url,
            headers={
                "X-Bot-Token": token,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=5,
        )
    except Exception:
        pass
