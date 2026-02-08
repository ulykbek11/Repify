import asyncio
import websockets
import json
import base64
import numpy as np
import cv2

async def test_squat_endpoint():
    uri = "ws://localhost:8000/ws/squat"
    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket")
        
        # Create a black image (no person)
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        _, buffer = cv2.imencode('.jpg', img)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        # Send
        await websocket.send(img_str)
        print("Sent black image")
        
        # Receive
        response = await websocket.recv()
        data = json.loads(response)
        
        print("Received response:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Verify keys
        required_keys = ["status", "feedback", "landmarks", "reps", "depth_reached"]
        missing_keys = [key for key in required_keys if key not in data]
        
        if missing_keys:
            print(f"FAILED: Missing keys: {missing_keys}")
        else:
            print("SUCCESS: All keys present.")
            
        if data["status"] == "No Pose" and data["landmarks"] == []:
            print("SUCCESS: Correctly handled no-person image.")
        else:
             print(f"WARNING: Unexpected status for black image: {data['status']}")

async def test_deadlift_endpoint():
    uri = "ws://localhost:8000/ws/deadlift"
    async with websockets.connect(uri) as websocket:
        print("\nConnected to Deadlift WebSocket")
        
        # Create a black image (no person)
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        _, buffer = cv2.imencode('.jpg', img)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        # Send
        await websocket.send(img_str)
        print("Sent black image")
        
        # Receive
        response = await websocket.recv()
        data = json.loads(response)
        
        print("Received response:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Verify keys - Deadlift might have different keys, but we added landmarks
        required_keys = ["status", "feedback", "landmarks"] 
        missing_keys = [key for key in required_keys if key not in data]
        
        if missing_keys:
            print(f"FAILED: Missing keys: {missing_keys}")
        else:
            print("SUCCESS: All keys present.")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_squat_endpoint())
    loop.run_until_complete(test_deadlift_endpoint())
