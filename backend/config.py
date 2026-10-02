import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-insecure-secret")
JWT_ALG = "HS256"
ACCESS_MINUTES = int(os.environ.get("ACCESS_MINUTES", "30"))
REFRESH_DAYS = int(os.environ.get("REFRESH_DAYS", "30"))

SUPER_ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "admin@turfbook.com").lower()
SUPER_ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD", "Admin@12345")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# Object storage (S3-compatible). Set S3_BUCKET to use S3/R2/MinIO,
# otherwise uploads fall back to local filesystem under backend/uploads.
S3_BUCKET = os.environ.get("S3_BUCKET", "").strip()
S3_REGION = os.environ.get("S3_REGION", "us-east-1").strip() or "us-east-1"
S3_ENDPOINT_URL = (os.environ.get("S3_ENDPOINT_URL") or "").strip() or None
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
LOCAL_UPLOADS_DIR = (os.environ.get("LOCAL_UPLOADS_DIR") or "").strip() or str(ROOT_DIR / "uploads")
# Jordan platform defaults (Arabic-first). Env overrides allowed.
DEFAULT_LOCALE = os.environ.get("DEFAULT_LOCALE", "ar-JO")
DEFAULT_CURRENCY = os.environ.get("DEFAULT_CURRENCY", "JOD")
DEFAULT_TIMEZONE = os.environ.get("DEFAULT_TIMEZONE", "Asia/Amman")

APP_SLUG = "turfbook"
