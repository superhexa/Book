"""Vercel serverless entrypoint for TurfBook FastAPI backend.

Vercel runs this file as the ASGI application. The FastAPI app lives in
backend/server.py, so we add the backend directory to sys.path.

If the main app fails to import (e.g., missing env vars), we expose a
minimal debug app so Vercel returns a useful error instead of
FUNCTION_INVOCATION_FAILED with no details.
"""
import sys
import traceback
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from server import app as fastapi_app

    app = fastapi_app
except Exception:
    err_text = traceback.format_exc()
    print("FATAL: Failed to import FastAPI app:", flush=True)
    print(err_text, flush=True)

    # Minimal fallback ASGI app that surfaces the import error over HTTP
    # instead of crashing the Python process (which Vercel reports as
    # FUNCTION_INVOCATION_FAILED with no details).
    async def app(scope, receive, send):  # noqa: F811
        body = (
            "TurfBook backend failed to start.\n\nImport error:\n" + err_text
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 500,
                "headers": [(b"content-type", b"text/plain")],
            }
        )
        await send({"type": "http.response.body", "body": body})

__all__ = ["app"]
