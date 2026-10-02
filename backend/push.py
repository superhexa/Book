"""Web Push (VAPID) delivery.

Environment (never commit values; set in the backend hosting env, e.g. Vercel):
  VAPID_PUBLIC_KEY   - URL-safe base64 public key (also exposed to the web app
                       as EXPO_PUBLIC_VAPID_PUBLIC_KEY)
  VAPID_PRIVATE_KEY  - URL-safe base64 private key
  VAPID_SUBJECT      - contact for VAPID claims, e.g. "mailto:support@turfbook.app"

Requires the `pywebpush` package (add to backend/requirements.txt).

Dead subscriptions (HTTP 410 Gone / 404 Not Found from the push service) are
removed from the `push_subscriptions` collection automatically.
"""
import json
import logging
import os

from db import db

log = logging.getLogger(__name__)


def vapid_config() -> tuple:
    """Return (public_key, private_key, subject) from env. No secrets are logged."""
    return (
        os.environ.get("VAPID_PUBLIC_KEY"),
        os.environ.get("VAPID_PRIVATE_KEY"),
        os.environ.get("VAPID_SUBJECT", "mailto:support@turfbook.app"),
    )


def vapid_public_key() -> str | None:
    return vapid_config()[0]


def push_configured() -> bool:
    public_key, private_key, _ = vapid_config()
    return bool(public_key and private_key)


async def send_push(subscription: dict, payload: dict) -> bool:
    """Send one Web Push message.

    `subscription` is a document shaped like:
      {"endpoint": str, "keys": {"p256dh": str, "auth": str}}
    `payload` is JSON-serializable, e.g. {"title": ..., "body": ..., "data": {...}}.

    Returns True if the push was accepted. On HTTP 410/404 the subscription is
    deleted from `push_subscriptions` so we stop hitting dead endpoints.
    """
    if not push_configured():
        log.warning("web push not configured (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY missing)")
        return False
    try:
        from pywebpush import webpush
    except ImportError:
        log.error("pywebpush is not installed; add it to backend/requirements.txt")
        return False

    public_key, private_key, subject = vapid_config()
    endpoint = (subscription or {}).get("endpoint")
    keys = (subscription or {}).get("keys") or {}
    if not endpoint or not keys.get("p256dh"):
        log.warning("refusing to push to malformed subscription")
        return False

    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": keys},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
        )
        return True
    except Exception as exc:  # pywebpush.WebPushException
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            await db.push_subscriptions.delete_one({"endpoint": endpoint})
            log.info("removed dead push subscription (HTTP %s)", status)
        else:
            log.warning("push delivery failed: %s", exc)
        return False


async def push_to_user(user_id: str, payload: dict) -> int:
    """Send `payload` to every push subscription of `user_id`.

    Dead subscriptions are pruned by `send_push`. Returns the number of
    accepted deliveries.
    """
    if not user_id:
        return 0
    sent = 0
    async for sub in db.push_subscriptions.find({"user_id": user_id}):
        if await send_push(sub, payload):
            sent += 1
    return sent
