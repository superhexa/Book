import logging

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.cors import CORSMiddleware

import config
from db import db
from ratelimit import limiter
from rbac import DEFAULT_ROLES
from security import hash_password

# route modules
import routes_admin
import routes_notifications
import routes_auth
import routes_bookings
import routes_catalog
import routes_disputes
import routes_engagement
import routes_facilities
import routes_geo
import routes_leagues
import routes_matches
import routes_news
import routes_owner
import routes_teams
import routes_tournaments
import routes_payments
import routes_reviews

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("book")

app = FastAPI(title="Book API", version="1.0.0")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "Book API", "status": "ok", "db_configured": db is not None}


@api_router.get("/health")
async def health():
    if db is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_configured",
                "message": "Backend is running but MONGO_URL/DB_NAME are not set.",
            },
        )
    if getattr(app.state, "db_error", None):
        return JSONResponse(
            status_code=503,
            content={"status": "db_error", "message": app.state.db_error},
        )
    try:
        await db.command("ping")
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "db_error", "message": f"{type(e).__name__}: {e}"},
        )
    return {"status": "healthy"}


api_router.include_router(routes_auth.router)
api_router.include_router(routes_catalog.router)
api_router.include_router(routes_facilities.router)
api_router.include_router(routes_geo.router)
api_router.include_router(routes_bookings.router)
api_router.include_router(routes_engagement.router)
api_router.include_router(routes_owner.router)
api_router.include_router(routes_payments.router)
api_router.include_router(routes_reviews.router)
api_router.include_router(routes_admin.router)
api_router.include_router(routes_notifications.router)
api_router.include_router(routes_teams.router)
api_router.include_router(routes_leagues.router)
api_router.include_router(routes_matches.router)
api_router.include_router(routes_tournaments.router)
api_router.include_router(routes_disputes.router)
api_router.include_router(routes_news.router)

app.include_router(api_router)

allow_origins = ["*"] if config.CORS_ORIGINS == "*" else [o.strip() for o in config.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down."})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred"})


@app.on_event("startup")
async def startup():
    app.state.db_error = None
    if db is None:
        app.state.db_error = "MONGO_URL/DB_NAME not set"
        logger.warning("MONGO_URL/DB_NAME not set - skipping DB indexes, migrations and seeding")
        return
    try:
        await _init_db()
    except Exception as e:
        app.state.db_error = f"{type(e).__name__}: {e}"
        logger.exception("DB startup failed - API running in degraded mode: %s", e)


async def _init_db():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.sessions.create_index("refresh_hash", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.one_time_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.slot_reservations.create_index([("pitch_id", 1), ("date", 1), ("slot_min", 1)], unique=True)
    await db.slot_reservations.create_index("booking_id")
    await db.facilities.create_index([("status", 1), ("city", 1)])
    await db.facilities.create_index("owner_id")
    await db.facilities.create_index([("rating_avg", -1)])
    await db.pitches.create_index("facility_id")
    await db.bookings.create_index([("customer_id", 1), ("date", -1)])
    await db.bookings.create_index([("facility_id", 1), ("status", 1)])
    await db.bookings.create_index("ref", unique=True)
    await db.reviews.create_index("facility_id")
    await db.reviews.create_index("booking_id", unique=True)
    await db.favorites.create_index([("user_id", 1), ("facility_id", 1)], unique=True)
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.audit_logs.create_index([("created_at", -1)])

    # Phase-2 (Jordanian football platform) collections: indexes/migrations.
    # Non-fatal so boot never crashes if the DB is unreachable.
    try:
        from migrations import run_migrations
        await run_migrations()
        logger.info("Phase-2 migrations complete")
    except Exception as e:
        logger.warning("Phase-2 migrations deferred: %s", e)

    # seed roles (insert only when missing so admin edits persist)
    for role in DEFAULT_ROLES:
        existing = await db.roles.find_one({"_id": role["key"]})
        if not existing:
            await db.roles.insert_one({"_id": role["key"], **role})

    # seed super admin
    existing_admin = await db.users.find_one({"email": config.SUPER_ADMIN_EMAIL})
    if not existing_admin:
        from db import new_id, now
        await db.users.insert_one({
            "_id": new_id(), "name": "Super Admin", "email": config.SUPER_ADMIN_EMAIL,
            "phone": None, "password_hash": hash_password(config.SUPER_ADMIN_PASSWORD),
            "roles": ["super_admin"], "permissions": [], "is_active": True, "is_verified": True,
            "password_version": 0, "failed_attempts": 0, "locked_until": None,
            "deleted_at": None, "created_at": now(), "updated_at": now(),
        })
        logger.info("Seeded super admin: %s", config.SUPER_ADMIN_EMAIL)

    # init object storage (non-fatal)
    try:
        import storage_service
        from fastapi.concurrency import run_in_threadpool
        await run_in_threadpool(storage_service.init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning("Object storage init deferred: %s", e)


@app.on_event("shutdown")
async def shutdown():
    from db import client
    if client is not None:
        client.close()
