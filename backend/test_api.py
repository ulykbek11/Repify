import requests
import time
import os
import io

print("Testing backend connection...")

API_URL = "http://127.0.0.1:8000"

try:
    resp = requests.get(f"{API_URL}/health")
    print("Health check:", resp.status_code, resp.json())
except Exception as e:
    print("Health check failed:", e)

print("\nTesting /api/extract-poses...")

# Create a dummy tiny mp4 file (just an empty file) to see if it reaches the endpoint
with open("test.mp4", "wb") as f:
    f.write(b"fake video content")

try:
    with open("test.mp4", "rb") as f:
        files = {'video': ('test.mp4', f, 'video/mp4')}
        start_time = time.time()
        print("Sending POST request...")
        resp = requests.post(f"{API_URL}/api/extract-poses", files=files, timeout=30)
        end_time = time.time()
        
        print(f"Time taken: {end_time - start_time:.2f}s")
        print("Status Code:", resp.status_code)
        if resp.status_code != 200:
            print("Response:", resp.text)
        else:
            data = resp.json()
            print("Response contains sequences:", len(data.get("pose_sequence", [])))
except requests.exceptions.Timeout:
    print("Request TIMED OUT!")
except Exception as e:
    print("Request failed:", e)
finally:
    if os.path.exists("test.mp4"):
        os.remove("test.mp4")
