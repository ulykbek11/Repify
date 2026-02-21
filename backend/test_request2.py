import urllib.request
import json

try:
    req = urllib.request.Request("http://localhost:8002/health")
    with urllib.request.urlopen(req) as response:
        body = response.read().decode()
        print("STATUS:", response.status)
        print("BODY:", body)
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.reason)
    body = e.read().decode(errors='replace')
    print("BODY:", body)
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
