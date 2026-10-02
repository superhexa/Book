"""S3-compatible object storage wrapper.

The app only talks to our backend; storage credentials live in backend env only.

Configure via env (see config.py):
  S3_BUCKET, S3_REGION, S3_ENDPOINT_URL (optional, for R2/MinIO),
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
If S3_BUCKET is not set, files are stored on the local filesystem under
backend/uploads (LOCAL_UPLOADS_DIR).
"""
import os
from pathlib import Path

import config

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

_s3_client = None


def _use_s3() -> bool:
    return bool(config.S3_BUCKET)


def _s3():
    global _s3_client
    if _s3_client is not None:
        return _s3_client
    import boto3

    session_kwargs = {"region_name": config.S3_REGION}
    if config.AWS_ACCESS_KEY_ID and config.AWS_SECRET_ACCESS_KEY:
        session_kwargs["aws_access_key_id"] = config.AWS_ACCESS_KEY_ID
        session_kwargs["aws_secret_access_key"] = config.AWS_SECRET_ACCESS_KEY
    session = boto3.session.Session(**session_kwargs)
    client_kwargs = {}
    if config.S3_ENDPOINT_URL:
        client_kwargs["endpoint_url"] = config.S3_ENDPOINT_URL
    _s3_client = session.client("s3", **client_kwargs)
    return _s3_client


def _local_path(path: str) -> Path:
    base = Path(config.LOCAL_UPLOADS_DIR)
    # guard against path traversal
    safe = Path(path).as_posix().lstrip("/")
    target = (base / safe).resolve()
    if base.resolve() not in target.parents and target != base.resolve():
        raise ValueError("Invalid storage path")
    return target


def init_storage():
    """Validate storage config. Non-fatal: local fallback needs no init."""
    if _use_s3():
        s3 = _s3()
        # Head the bucket to fail fast on bad credentials; not fatal to app boot.
        s3.head_bucket(Bucket=config.S3_BUCKET)
        return True
    Path(config.LOCAL_UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
    return True


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if _use_s3():
        s3 = _s3()
        s3.put_object(Bucket=config.S3_BUCKET, Key=path, Body=data, ContentType=content_type)
        return {"path": path, "bucket": config.S3_BUCKET}
    target = _local_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"path": path, "local": str(target)}


def get_object(path: str):
    if _use_s3():
        s3 = _s3()
        resp = s3.get_object(Bucket=config.S3_BUCKET, Key=path)
        return resp["Body"].read(), resp.get("ContentType", "application/octet-stream")
    target = _local_path(path)
    if not target.is_file():
        raise FileNotFoundError(path)
    # Best-effort content type from extension when local
    import mimetypes

    ctype, _ = mimetypes.guess_type(target.name)
    return target.read_bytes(), ctype or "application/octet-stream"


def object_path(user_id: str, ext: str) -> str:
    import uuid

    return f"{config.APP_SLUG}/uploads/{user_id}/{uuid.uuid4().hex}.{ext}"


# ---------------------------------------------------------------------------
# Upload validation (spec §60). Call `validate_upload` in every upload route
# before `put_object`. Error messages are in Arabic for the client UI.
# ---------------------------------------------------------------------------

MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}


class UploadValidationError(ValueError):
    """Raised when an upload fails MIME/extension/size validation."""


def validate_upload(content: bytes, content_type: str) -> str:
    """Validate an upload's MIME type and size; return the safe file extension.

    Raises UploadValidationError (Arabic message) when:
      * the content is empty,
      * the MIME type is not one of ALLOWED_IMAGE_TYPES,
      * the size exceeds MAX_UPLOAD_BYTES (10 MB).

    Usage in a route:
        ext = validate_upload(data, content_type)
        path = object_path(user_id, ext)
        put_object(path, data, content_type)
    """
    if not content:
        raise UploadValidationError("الملف فارغ")
    normalized = (content_type or "").split(";")[0].strip().lower()
    if normalized not in ALLOWED_IMAGE_TYPES:
        raise UploadValidationError("نوع الملف غير مدعوم. الأنواع المسموحة: صور فقط")
    if len(content) > MAX_UPLOAD_BYTES:
        raise UploadValidationError("حجم الملف يتجاوز الحد الأقصى المسموح (10 ميجابايت)")
    return MIME_TO_EXT[normalized]
