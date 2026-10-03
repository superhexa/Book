"""Vercel serverless entrypoint for the Book FastAPI backend.

Vercel runs this file as the ASGI application. The FastAPI app lives in
backend/server.py, so we add the backend directory to sys.path.

If the main app fails to import for any reason, we expose a minimal debug
ASGI app (lifespan-aware) so Vercel returns a useful error instead of a
generic FUNCTION_INVOCATION_FAILED with no details.
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
except BaseException:
    err_text = traceback.format_exc()

    async def app(scope, receive, send):  # noqa: F811
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
            return
        body = ("Book backend failed to start.\n\n" + err_text).encode("utf-8", "replace")
        await send(
            {
                "type": "http.response.start",
                "status": 500,
                "headers": [(b"content-type", b"text/plain; charset=utf-8")],
            }
        )
        await send({"type": "http.response.body", "body": body})

__all__ = ["app"]
