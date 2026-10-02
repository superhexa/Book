"""Background jobs. All jobs are idempotent and safe to re-run.

Jobs:
  expire_pending_bookings  - PENDING bookings past their hold expiry -> EXPIRED
  send_booking_reminders   - remind users 24h before a CONFIRMED booking
  send_match_reminders     - remind followers 24h before a match
  cleanup_expired_sessions - delete expired rows from `sessions`
  aggregate_daily_analytics - roll yesterday's counters into `daily_analytics`

Idempotency guards:
  * expire_pending_bookings: the update filter includes status == "PENDING",
    so a booking transitions PENDING -> EXPIRED exactly once (atomic update).
  * reminders: each candidate row is claimed with an atomic find_one_and_update
    that sets reminder_sent=True only if not already set; the notifier then
    fires at most once per row.
  * analytics: upsert keyed on the calendar date, so re-runs overwrite the
    same document instead of duplicating it.

Scheduling (pick one):
  1. cron (recommended on a VPS):
       0 * * * *  cd /app/backend && /usr/bin/python3 jobs.py expire_pending_bookings >> /var/log/turfbook-jobs.log 2>&1
       */15 * * * * cd /app/backend && /usr/bin/python3 jobs.py send_booking_reminders >> /var/log/turfbook-jobs.log 2>&1
       */30 * * * * cd /app/backend && /usr/bin/python3 jobs.py send_match_reminders >> /var/log/turfbook-jobs.log 2>&1
       0 3 * * *  cd /app/backend && /usr/bin/python3 jobs.py cleanup_expired_sessions >> /var/log/turfbook-jobs.log 2>&1
       5 0 * * *  cd /app/backend && /usr/bin/python3 jobs.py aggregate_daily_analytics >> /var/log/turfbook-jobs.log 2>&1
  2. APScheduler inside the FastAPI process (server.py), e.g.:
       from apscheduler.schedulers.asyncio import AsyncIOScheduler
       from jobs import JOB_REGISTRY
       scheduler = AsyncIOScheduler()
       scheduler.add_job(JOB_REGISTRY["expire_pending_bookings"], "interval", minutes=10)
       scheduler.add_job(JOB_REGISTRY["send_booking_reminders"], "interval", minutes=15)
       scheduler.start()

Schema assumptions (kept generic; adjust field names if the collections differ):
  bookings: {_id, user_id, status, starts_at, expires_at, reminder_sent}
  matches:  {_id, title, starts_at, match_reminder_sent}
  match_follows: {match_id, user_id}  (users following a match)
  sessions: {_id, expires_at}
  users/notifications/bookings for analytics counters.
"""
import asyncio
import logging
import sys
from datetime import timedelta

from db import db, new_id, now
from notify import notify
from push import push_to_user

log = logging.getLogger(__name__)

REMINDER_WINDOW = timedelta(hours=24)


async def expire_pending_bookings() -> int:
    """Expire PENDING bookings whose hold expired. Atomic; each booking flips once."""
    cutoff = now()
    result = await db.bookings.update_many(
        {"status": "PENDING", "expires_at": {"$lt": cutoff}},
        {
            "$set": {
                "status": "EXPIRED",
                "expired_at": cutoff,
                "updated_at": cutoff,
            }
        },
    )
    if result.modified_count:
        log.info("expired %d pending bookings", result.modified_count)
    return result.modified_count


async def send_booking_reminders() -> int:
    """Remind users of CONFIRMED bookings starting within the next 24h (once each)."""
    current = now()
    window_end = current + REMINDER_WINDOW
    sent = 0
    cursor = db.bookings.find(
        {
            "status": "CONFIRMED",
            "starts_at": {"$gte": current, "$lte": window_end},
            "reminder_sent": {"$ne": True},
        }
    )
    async for booking in cursor:
        # Atomic claim: only the first worker to flip the flag sends the reminder.
        claimed = await db.bookings.find_one_and_update(
            {"_id": booking["_id"], "reminder_sent": {"$ne": True}},
            {"$set": {"reminder_sent": True, "reminder_sent_at": now()}},
        )
        if not claimed:
            continue
        user_id = booking.get("user_id")
        title = "تذكير بالحجز"
        body = "لديك حجز خلال ٢٤ ساعة. لا تنسَ الحضور مبكراً!"
        data = {"type": "booking_reminder", "booking_id": str(booking["_id"])}
        await notify(user_id, "booking_reminder", title, body, data)
        await push_to_user(user_id, {"title": title, "body": body, "data": data})
        sent += 1
    log.info("sent %d booking reminders", sent)
    return sent


async def send_match_reminders() -> int:
    """Remind followers of matches starting within the next 24h (once per match)."""
    current = now()
    window_end = current + REMINDER_WINDOW
    sent = 0
    cursor = db.matches.find(
        {
            "starts_at": {"$gte": current, "$lte": window_end},
            "match_reminder_sent": {"$ne": True},
        }
    )
    async for match in cursor:
        claimed = await db.matches.find_one_and_update(
            {"_id": match["_id"], "match_reminder_sent": {"$ne": True}},
            {"$set": {"match_reminder_sent": True, "match_reminder_sent_at": now()}},
        )
        if not claimed:
            continue
        title = "تذكير بالمباراة"
        match_title = match.get("title") or "مباراة"
        body = f"مباراة «{match_title}» ستبدأ خلال ٢٤ ساعة!"
        data = {"type": "match_reminder", "match_id": str(match["_id"])}
        async for follow in db.match_follows.find({"match_id": match["_id"]}):
            user_id = follow.get("user_id")
            await notify(user_id, "match_reminder", title, body, data)
            await push_to_user(user_id, {"title": title, "body": body, "data": data})
            sent += 1
    log.info("sent %d match reminders", sent)
    return sent


async def cleanup_expired_sessions() -> int:
    """Delete expired session rows. Deletion is naturally idempotent."""
    result = await db.sessions.delete_many({"expires_at": {"$lt": now()}})
    if result.deleted_count:
        log.info("cleaned up %d expired sessions", result.deleted_count)
    return result.deleted_count


async def aggregate_daily_analytics() -> dict:
    """Roll yesterday's counters into `daily_analytics` (upsert by date)."""
    day = now() - timedelta(days=1)
    date_key = day.strftime("%Y-%m-%d")
    day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    window = {"$gte": day_start, "$lt": day_end}

    stats = {
        "_id": new_id(),
        "date": date_key,
        "new_users": await db.users.count_documents({"created_at": window}),
        "bookings_created": await db.bookings.count_documents({"created_at": window}),
        "bookings_confirmed": await db.bookings.count_documents(
            {"created_at": window, "status": "CONFIRMED"}
        ),
        "bookings_expired": await db.bookings.count_documents(
            {"created_at": window, "status": "EXPIRED"}
        ),
        "notifications_sent": await db.notifications.count_documents({"created_at": window}),
        "computed_at": now(),
    }
    await db.daily_analytics.update_one(
        {"date": date_key}, {"$set": stats}, upsert=True
    )
    log.info("aggregated analytics for %s", date_key)
    return stats


JOB_REGISTRY = {
    "expire_pending_bookings": expire_pending_bookings,
    "send_booking_reminders": send_booking_reminders,
    "send_match_reminders": send_match_reminders,
    "cleanup_expired_sessions": cleanup_expired_sessions,
    "aggregate_daily_analytics": aggregate_daily_analytics,
}


async def run_job(name: str):
    """Entrypoint: run a single registered job by name."""
    job = JOB_REGISTRY.get(name)
    if job is None:
        raise ValueError(f"unknown job: {name!r} (available: {', '.join(JOB_REGISTRY)})")
    log.info("running job %s", name)
    result = await job()
    log.info("job %s finished: %r", name, result)
    return result


def main(argv: list) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if len(argv) != 2 or argv[1] not in JOB_REGISTRY:
        print(f"usage: python jobs.py <{'|'.join(JOB_REGISTRY)}>")
        return 2
    asyncio.run(run_job(argv[1]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
