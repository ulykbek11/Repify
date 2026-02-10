import cv2
import json
import sys
import os
import time

# Ensure backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from core.analyzer import SquatAnalyzer

def analyze_video(video_path):
    print(f"🎬 Starting analysis for: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"❌ Video file not found: {video_path}")
        return

    # Initialize Analyzer
    analyzer = SquatAnalyzer()
    print("✅ Analyzer initialized (Layer 2: Math Only)")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Could not open video: {video_path}")
        return

    frame_count = 0
    down_phase_frames = 0
    
    # Storage for max suspicion scores
    max_scores = {
        "math_shallow": 0.0,
        "math_heel": 0.0,
        "math_lean": 0.0,
        "ai_conf": 0.0
    }
    
    detected_errors = set()

    print("\n🔍 Processing frames (Showing DOWN phase only)...")
    print(f"{'Frame':<6} | {'Phase':<5} | {'L2 Shallow':<10} | {'L2 Heel':<10} | {'L2 Lean':<10} | {'Hybrid Result'}")
    print("-" * 105)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        
        # Process frame
        results, image = analyzer.process_frame(frame)
        
        # Run analysis (Layer 2 & 3 inside)
        response_json = analyzer.analyze(results, frame)
        data = json.loads(response_json)
        
        # Extract internal state
        adv_res = data.get("advanced_analysis", {})
        math_details = adv_res.get("math_details", {})
        
        # Get scores
        math_shallow = math_details.get("shallow", 0.0)
        math_heel = math_details.get("heel", 0.0)
        math_lean = math_details.get("lean", 0.0)
        ai_conf = adv_res.get("ai_confidence", 0.0)
        
        # Update max scores (global)
        max_scores["math_shallow"] = max(max_scores["math_shallow"], math_shallow)
        max_scores["math_heel"] = max(max_scores["math_heel"], math_heel)
        max_scores["math_lean"] = max(max_scores["math_lean"], math_lean)
        max_scores["ai_conf"] = max(max_scores["ai_conf"], ai_conf)
        
        # Current errors
        current_errors = adv_res.get("errors", [])
        for err in current_errors:
            detected_errors.add(err)

        # Print details only during DOWN phase
        phase = analyzer.stage
        
        if phase == "down":
            down_phase_frames += 1
            # Print row
            err_str = ", ".join(current_errors) if current_errors else "OK"
            print(f"{frame_count:<6} | {phase:<5} | {math_shallow:<10.2f} | {math_heel:<10.2f} | {math_lean:<10.2f} | {err_str}")

    cap.release()
    
    print("\n" + "="*50)
    print("📊 ANALYSIS REPORT")
    print("="*50)
    print(f"Total Frames: {frame_count}")
    print(f"Reps Counted: {analyzer.reps}")
    print("-" * 30)
    print("⚠️  Max Suspicion Scores (0.0 - 1.0):")
    print(f"   • Layer 2 (Math) - Shallow Squat: {max_scores['math_shallow']:.2f}  (>0.5 is Suspicious)")
    print(f"   • Layer 2 (Math) - Heel Lift:     {max_scores['math_heel']:.2f}  (>0.5 is Suspicious)")
    print(f"   • Layer 2 (Math) - Torso Lean:    {max_scores['math_lean']:.2f}  (>0.5 is Suspicious)")
    print(f"   • Layer 3 (AI)   - Error Prob:    {max_scores['ai_conf']:.2f}  (>0.65 is High Confidence)")
    print("-" * 30)
    print("🚨 Confirmed Errors (Hybrid Logic):")
    if detected_errors:
        for err in detected_errors:
            print(f"   ❌ {err}")
    else:
        print("   ✅ No errors detected.")
    print("="*50)

if __name__ == "__main__":
    # Path provided by user
    video_file = r"c:\Users\bekmy\OneDrive\Desktop\APP\video5469824087645785313.mp4"
    analyze_video(video_file)
