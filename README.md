# MotionIQ MVP

AI Fitness Trainer MVP for Squat and Deadlift analysis.

## Project Structure
- `backend/`: Python FastAPI backend with ML logic.
- `mobile-app/`: React Native (Expo) mobile application.
- `ML/` & `MotionIQ/`: Original source folders (kept for reference).

## Prerequisites
- Python 3.9+
- Node.js & npm
- Expo CLI (optional, for running mobile app)

## 1. Setup & Run Backend

1. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Run the server:
   ```bash
   python backend/main.py
   ```
   Server will run at `http://0.0.0.0:8000`.

## 2. Test with Web Client (Quickest Way)
1. Ensure backend is running.
2. Open `test_client.html` in your browser.
3. Allow camera access and click "Start Squat" or "Start Deadlift".

## 3. Run Mobile App

1. Navigate to mobile app folder:
   ```bash
   cd mobile-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update Server IP:
   Open `App.js` and change `SERVER_URL` to your computer's local IP address (e.g., `ws://192.168.1.5:8000/ws`).
4. Run Expo:
   ```bash
   npx expo start
   ```
5. Scan the QR code with your phone (using Expo Go app).

## Features
- **Squat Analysis**: Depth check, back angle check, ML classification.
- **Deadlift Analysis**: Lockout check, hyperextension check, ML classification.
