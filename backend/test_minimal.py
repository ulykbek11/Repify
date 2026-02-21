"""Minimal test server to isolate the issue."""
import sys
import traceback

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"EXCEPTION: {exc}")
    print(tb)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": tb}
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        print(f"\n[REQUEST] {request.method} {request.url}")
        sys.stdout.flush()
    except Exception as e:
        print(f"PRINT ERROR: {type(e).__name__}: {e}", file=sys.stderr)
    
    try:
        response = await call_next(request)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"MIDDLEWARE EXCEPTION: {e}")
        print(tb)
        return JSONResponse(status_code=500, content={"middleware_error": str(e), "traceback": tb})
    
    elapsed = (time.time() - start) * 1000
    print(f"[RESPONSE] {response.status_code} ({elapsed:.0f}ms)")
    return response

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
