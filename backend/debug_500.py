from fastapi.testclient import TestClient
from app.main import app
import traceback

# Raise exceptions to catch them here
client = TestClient(app, raise_server_exceptions=True)

try:
    print("Testing /api/profile/test_user/exists")
    response = client.get("/api/profile/test_user/exists")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception:
    traceback.print_exc()
