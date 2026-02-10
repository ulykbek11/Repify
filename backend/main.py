from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import numpy as np
import base64
import json
import os
import shutil
import tempfile

from core.analyzer import SquatAnalyzer, DeadliftAnalyzer
from core.calibration import CalibrationAnalyzer, ValidationError

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Analyzers
# Models are no longer used, purely rule-based
squat_analyzer = SquatAnalyzer()
deadlift_analyzer = DeadliftAnalyzer()

@app.get("/")
def read_root():
    return {"status": "Repify Backend Running"}

@app.post("/analyze_video")
async def analyze_video_endpoint(
    file: UploadFile = File(...),
    exercise: str = Form(...)
):
    print(f"📥 Received video upload: {file.filename} for {exercise}")
    
    # Save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    print(f"💾 Saved temp video to: {tmp_path}")
    
    cap = None
    try:
        # Process video
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            print("❌ Error: Could not open video file")
            return {"error": "Could not open video file"}

        # Select Analyzer
        if exercise.lower() == "squat":
            analyzer = SquatAnalyzer()
        else:
            analyzer = DeadliftAnalyzer()
            
        analyzer.reset()
        
        frame_count = 0
        debug_log = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            # Process every frame for accuracy
            results, _ = analyzer.process_frame(frame)
            analysis_res = analyzer.analyze(results, frame)
            
            # Collect Debug Data if analysis succeeded
            try:
                if isinstance(analysis_res, str):
                    data = json.loads(analysis_res)
                else:
                    data = analysis_res
                    
                adv_res = data.get("advanced_analysis", {})
                
                # Check if heel lift was detected in this frame (by Math logic)
                math_heel = adv_res.get("heel_lift_detected", False)
                
                if math_heel:
                    debug_log.append({
                        'frame': frame_count,
                        'knee_angle': data.get('current_angle', 0),
                        'detection_conf': 0.85 # Assume high conf if flagged
                    })
            except:
                pass

        # Final Feedback Generation
        final_feedback = analyzer.get_feedback()
        reps = analyzer.reps
        
        # Prepare response
        # Ensure errors is a list of objects with feedback
        errors = []
        if isinstance(final_feedback, list):
             for f in final_feedback:
                 errors.append({"feedback": f})
        elif isinstance(final_feedback, str):
             errors.append({"feedback": final_feedback})

        response_data = {
            "status": "completed",
            "reps": reps,
            "errors": errors,
            "debug_log": debug_log
        }
        
        print(f"✅ Analysis complete: {reps} reps, {len(errors)} errors")
        return response_data

    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")
        return {"error": str(e)}
        
    finally:
        if cap:
            cap.release()
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/calibrate_user")
async def calibrate_user_endpoint(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Калибровка пользователя: анализ 5 приседаний для определения
    анатомических пропорций и генерации персональных порогов.
    """
    print(f"\n{'='*60}")
    print(f"📐 [CALIBRATION REQUEST] User ID: {user_id}")
    print(f"   Filename: {file.filename}")
    print(f"   Content-Type: {file.content_type}")
    print(f"{'='*60}\n")
    
    # Save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    # Check file size
    file_size = os.path.getsize(tmp_path)
    print(f"💾 [FILE SAVED] Path: {tmp_path}, Size: {file_size / 1024:.2f} KB")
    
    if file_size == 0:
        print(f"❌ [ERROR] Video file is empty!")
        return {
            "status": "error",
            "error_type": "validation",
            "message": "Видео файл пустой. Пожалуйста, запишите видео заново."
        }
    
    try:
        print(f"\n🔍 [STARTING ANALYSIS] Initializing CalibrationAnalyzer...")
        analyzer = CalibrationAnalyzer()
        
        print(f"📹 [ANALYZING VIDEO] Processing {tmp_path}...")
        result = analyzer.analyze_video(tmp_path)
        
        print(f"\n{'='*60}")
        print(f"✅ [SUCCESS] Calibration complete for user {user_id}")
        print(f"   Results: {result}")
        print(f"{'='*60}\n")
        
        response = {
            "status": "success",
            "user_id": user_id,
            **result
        }
        
        print(f"📤 [SENDING RESPONSE] {response}")
        return response
        
    except ValidationError as e:
        print(f"\n{'='*60}")
        print(f"⚠️ [VALIDATION ERROR] {str(e)}")
        print(f"{'='*60}\n")
        return {
            "status": "error",
            "error_type": "validation",
            "message": str(e)
        }
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ [INTERNAL ERROR] {str(e)}")
        import traceback
        print(f"   Traceback:")
        traceback.print_exc()
        print(f"{'='*60}\n")
        return {
            "status": "error",
            "error_type": "internal",
            "message": str(e)
        }
        
    finally:
        if os.path.exists(tmp_path):
            print(f"🗑️ [CLEANUP] Deleting temp file: {tmp_path}")
            os.unlink(tmp_path)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
