import cv2
import mediapipe as mp
import numpy as np
import time
import json
from typing import Dict, Any
from .advanced_analyzer import AdvancedAnalyzer

class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for numpy types"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

def create_safe_response(data: Dict[str, Any]) -> str:
    """Safe JSON response creation"""
    try:
        return json.dumps(data, cls=NumpyEncoder, ensure_ascii=False)
    except Exception as e:
        print(f"❌ JSON Serialization Error: {e}")
        # Print keys and types to identify culprit
        for k, v in data.items():
             print(f"Key: {k}, Type: {type(v)}")
        
        return json.dumps({
            "reps": 0,
            "feedback": "Ошибка анализа",
            "error": True
        })

class BaseAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1, 
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.reps = 0
        self.stage = "up"
        self.last_angle = 0

    def calculate_angle(self, a, b, c):
        """Calculate angle between three points (a-b-c) using atan2"""
        # Ensure input points are not None
        if not all([a, b, c]):
            return 180.0
            
        a = np.array([a.x, a.y])
        b = np.array([b.x, b.y])
        c = np.array([c.x, c.y])
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
            
        return angle

    def calculate_vertical_angle(self, a, b):
        """
        Calculates angle of segment a-b relative to vertical.
        a: top (shoulder), b: bottom (hip)
        Returns degrees (0=upright, 90=horizontal)
        """
        if not a or not b: return 0.0
        
        delta_x = a.x - b.x
        delta_y = a.y - b.y 
        
        # Vertical is (0, -1) [upwards in image coords]
        angle_rad = np.arctan2(np.abs(delta_x), np.abs(delta_y))
        return np.degrees(angle_rad)

    def process_frame(self, frame):
        # Optimization: Resize frame if too large (speeds up MediaPipe significantly)
        # MediaPipe works optimally with width around 640px
        h, w, _ = frame.shape
        if w > 640:
            scale = 640 / w
            new_h = int(h * scale)
            frame = cv2.resize(frame, (640, new_h))

        # Convert BGR -> RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = self.pose.process(image)
        image.flags.writeable = True
        
        # Draw landmarks for debugging visuals
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        if results.pose_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                image,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS
            )
            
        return results, image

class SquatAnalyzer(BaseAnalyzer):
    def __init__(self, model_path=None):
        super().__init__()
        # --- LAYER 1: Robust Counter Thresholds (Updated) ---
        self.DOWN_START_THRESHOLD = 140
        self.UP_THRESHOLD = 160
        self.DEPTH_CHECK_ANGLE = 100
        
        # --- LAYER 2: Biomechanical Constraints ---
        # Kept for feedback, but not for counting
        self.VALID_DEPTH_THRESHOLD = 110
        
        # Robust Logic Variables
        self.angle_history = [] # For smoothing
        self.robust_buffer = [] # For min angle tracking
        self.BUFFER_SIZE = 5 
        self.min_rep_time = 1.0 # 1.0s interval
        self.last_rep_time = 0
        
        # Stability Counters
        self.stable_up_frames = 0
        self.stable_down_frames = 0
        self.frames_in_down = 0
        
        # --- LAYERS 2 & 3: Advanced Analysis ---
        self.advanced_analyzer = AdvancedAnalyzer()
        
        # State Tracking
        self.depth_reached_in_rep = False
        self.min_angle_in_rep = 180
        self.current_rep_errors = set()
        self.session_errors = set()
        self.last_feedback = ""
        
        # Counters
        self.total_attempts = 0
        self.successful_reps = 0
        self.shallow_reps = 0
        self.heel_lift_reps = 0
        self.back_lean_reps = 0
        
        # Rep-specific flags
        self.heel_lift_in_current_rep = False
        self.back_lean_in_current_rep = False

    def reset(self):
        self.reps = 0
        self.stage = "up"
        self.min_angle_in_rep = 180
        self.current_rep_errors = set()
        self.session_errors = set()
        
        self.total_attempts = 0
        self.successful_reps = 0
        self.shallow_reps = 0
        self.heel_lift_reps = 0
        self.back_lean_reps = 0
        self.heel_lift_in_current_rep = False
        self.back_lean_in_current_rep = False
        self.angle_history = []
        self.robust_buffer = []
        self.last_rep_time = 0
        self.stable_up_frames = 0
        self.stable_down_frames = 0
        self.frames_in_down = 0
        
    def get_feedback(self):
        """Return list of session errors for video analysis endpoint"""
        if not self.session_errors:
            return []
        return list(self.session_errors)

    def _smooth_angle(self, angle):
        """Angle smoothing to prevent noise (Repo Logic)"""
        if angle is None:
            return None
            
        self.angle_history.append(angle)
        
        if len(self.angle_history) < 3:
            return angle
            
        # Limit history size
        if len(self.angle_history) > self.BUFFER_SIZE:
            self.angle_history.pop(0)
            
        # Use median filter to remove outliers, then average
        angles_array = np.array(self.angle_history)
        median_angle = np.median(angles_array)
        
        # Remove outliers (angles > 2 std devs from median)
        std_dev = np.std(angles_array)
        if std_dev > 0:
            filtered_angles = angles_array[np.abs(angles_array - median_angle) <= 2 * std_dev]
        else:
            filtered_angles = angles_array
        
        return np.mean(filtered_angles) if len(filtered_angles) > 0 else angle

    def _update_session_errors(self):
        """
        Deprecated: Hybrid logic is now applied per-frame in analyze()
        We just aggregate the flags set during the rep.
        """
        if self.heel_lift_in_current_rep:
            self.session_errors.add("Отрыв пяток")
        if self.back_lean_in_current_rep:
            self.session_errors.add("Чрезмерный наклон корпуса")
        if not self.depth_reached_in_rep:
            self.session_errors.add("Недостаточная глубина")

    def analyze(self, results, frame=None):
        if not results.pose_landmarks:
            return create_safe_response({
                "status": "Analyzed", 
                "reps": self.reps, 
                "feedback": "Встаньте в кадр" if self.reps == 0 else "", 
                "landmarks": [],
                "is_correct": True,
                "depth_reached": False,
                "silent_error": None
            })

        landmarks = results.pose_landmarks.landmark
        
        # Visibility check to choose side (for basic angle)
        l_vis = landmarks[23].visibility
        r_vis = landmarks[24].visibility
        
        # Keypoints: Hip(23/24), Knee(25/26), Ankle(27/28)
        if l_vis > r_vis:
            shoulder = landmarks[11]
            hip = landmarks[23]
            knee = landmarks[25]
            ankle = landmarks[27]
        else:
            shoulder = landmarks[12]
            hip = landmarks[24]
            knee = landmarks[26]
            ankle = landmarks[28]
            
        # Calculate Angles
        knee_angle = self.calculate_angle(hip, knee, ankle)
        hip_angle = self.calculate_angle(shoulder, hip, knee)
        back_angle = self.calculate_vertical_angle(shoulder, hip)
        
        # Apply Smoothing (Repo Logic)
        angle = self._smooth_angle(knee_angle)
        self.last_angle = int(angle)
        
        # LOGGING
        print(f"[FRAME] Stage: {self.stage}, Angles(K/H/B): {int(angle)}/{int(hip_angle)}/{int(back_angle)}")

        # --- LAYER 2: MATH DETECTOR (SUSPICION) ---
        # Note: detect_* methods now return float suspicion (0.0-1.0)
        math_shallow = self.advanced_analyzer.detect_shallow_squat(landmarks, knee_angle, self.stage)
        math_heel = self.advanced_analyzer.detect_heel_lift(landmarks, self.stage)
        math_lean = self.advanced_analyzer.detect_torso_lean(landmarks, self.stage)
        
        # --- PRIORITIZED FUSION LOGIC (3-TIER SYSTEM) ---
        # Priority 1: Math > 0.85 → ERROR MANDATORY (AI ignored)
        # Priority 2: Math 0.5-0.85 → Weighted combination (0.4*Math + 0.6*AI > 0.65)
        # Priority 3: Math < 0.5 → Ignored
        
        math_errors = []
        
        # Note: ml_analyzer may not exist, use safe defaults
        ai_error_prob = 0.0
        if hasattr(self, 'ml_analyzer') and self.ml_analyzer:
            try:
                ai_result = self.ml_analyzer.predict(landmarks)
                ai_error_prob = ai_result.get('error_prob', 0.0)
            except:
                ai_error_prob = 0.0
        
        # 1. Shallow Squat (Prioritized Logic)
        if math_shallow > 0.85:
            math_errors.append('shallow_squat')
        elif math_shallow > 0.5:
            combined = (math_shallow * 0.4) + (ai_error_prob * 0.6)
            if combined > 0.65:
                math_errors.append('shallow_squat')

        # 2. Heel Lift (Prioritized Logic)
        if math_heel > 0.85:
            math_errors.append('heel_lift')
        elif math_heel > 0.5:
            combined = (math_heel * 0.4) + (ai_error_prob * 0.6)
            if combined > 0.65:
                math_errors.append('heel_lift')
            
        # 3. Torso Lean (Prioritized Logic)
        if math_lean > 0.85:
            math_errors.append('torso_lean')
        elif math_lean > 0.5:
            combined = (math_lean * 0.4) + (ai_error_prob * 0.6)
            if combined > 0.65:
                math_errors.append('torso_lean')

        # Construct adv_res for compatibility
        adv_res = {
            "errors": math_errors,
            "heel_lift_detected": "heel_lift" in math_errors,
            "back_lean_detected": "torso_lean" in math_errors,
            "shallow_squat_detected": "shallow_squat" in math_errors,
            "knee_valgus_detected": False,
            "feedback": "",
            "math_details": {
                "shallow": math_shallow,
                "heel": math_heel,
                "lean": math_lean
            },
            "ai_confidence": ai_error_prob
        }
        
        # --- LAYER 1: ROBUST STATE MACHINE & COUNTER ---
        current_time = time.time()
        
        # Update Robust Buffer (Last 5 frames)
        self.robust_buffer.append(angle)
        if len(self.robust_buffer) > 5:
            self.robust_buffer.pop(0)
            
        if self.stage == "up":
            if angle < self.DOWN_START_THRESHOLD: # < 140
                self.stable_down_frames += 1
                if self.stable_down_frames >= 3: # Confirmation
                    print(f"📉 Descent Started. Entering DOWN stage.")
                    self.stage = "down"
                    self.depth_reached_in_rep = False
                    self.min_angle_in_rep = 180
                    self.frames_in_down = 0
                    # Reset error flags for new rep
                    self.heel_lift_in_current_rep = False
                    self.back_lean_in_current_rep = False
            else:
                self.stable_down_frames = 0
                
        elif self.stage == "down":
            self.frames_in_down += 1
            
            # Update min angle using buffer min
            current_buffer_min = min(self.robust_buffer) if self.robust_buffer else angle
            if current_buffer_min < self.min_angle_in_rep:
                self.min_angle_in_rep = current_buffer_min
            
            # Improved Depth Check:
            # PRIMARY: Angle <= 100 (reliable across camera angles)
            # SECONDARY: Hip >= Knee - 0.05 OR Angle < 90 (very deep squat overrides coordinate check)
            # Note: y increases downwards. Hip >= Knee means Hip is lower (or close).
            is_deep_enough_angle = (current_buffer_min <= self.DEPTH_CHECK_ANGLE)
            is_very_deep = (current_buffer_min < 90)  # Ultra-deep squat, ignore camera angle issues
            is_deep_enough_coords = (hip.y >= (knee.y - 0.05))
            
            if is_deep_enough_angle and (is_deep_enough_coords or is_very_deep):
                if not self.depth_reached_in_rep:
                    print(f"✅ Depth Reached! Angle: {current_buffer_min:.1f}, HipY: {hip.y:.2f}, KneeY: {knee.y:.2f}")
                self.depth_reached_in_rep = True
            
            # Accumulate Errors during DOWN phase
            if adv_res.get("heel_lift_detected", False):
                self.heel_lift_in_current_rep = True
            if adv_res.get("back_lean_detected", False):
                self.back_lean_in_current_rep = True
                
            # Check for Ascent
            if angle > self.UP_THRESHOLD: # > 160
                self.stable_up_frames += 1
                if self.stable_up_frames >= 3: # Confirmation
                    # Validation Logic
                    time_ok = (current_time - self.last_rep_time >= self.min_rep_time) # >= 1.0s
                    duration_ok = (self.frames_in_down >= 5) # >= 5 frames in down
                    
                    if self.depth_reached_in_rep and time_ok and duration_ok:
                        self.reps += 1
                        self.successful_reps += 1
                        self.last_rep_time = current_time
                        self.last_feedback = "Отлично!"
                        
                        # Process Errors accumulated during rep
                        if self.heel_lift_in_current_rep:
                            self.heel_lift_reps += 1
                            self.last_feedback = "Не отрывайте пятки"
                        if self.back_lean_in_current_rep:
                            self.back_lean_reps += 1
                            self.last_feedback = "Выпрямите спину"
                            
                        self._update_session_errors()
                        print(f"✅✅✅ COUNT! Reps: {self.reps}")
                        
                    elif not self.depth_reached_in_rep:
                         # Failed rep due to depth
                         print(f"❌ Shallow Rep. MinAngle: {self.min_angle_in_rep:.1f}")
                         self.last_feedback = "Ниже!"
                         self.shallow_reps += 1
                    elif not duration_ok:
                         print(f"❌ Too fast. Frames in down: {self.frames_in_down}")
                         self.last_feedback = "Не спешите"
                    
                    # Reset to UP
                    self.stage = "up"
                    self.stable_up_frames = 0
            else:
                self.stable_up_frames = 0

        # --- FEEDBACK ---
        feedback_text = adv_res.get("feedback", "")
        if not feedback_text or feedback_text == "Начинайте приседание":
             feedback_text = self.last_feedback
        
        # Priority to depth warning (only if strictly needed, but Repo logic counts at 110)
        # If user is at 115 and stage is UP, they are going down.
        if self.stage == "up" and angle < 120 and angle > self.DOWN_START_THRESHOLD:
             feedback_text = "Ниже!"
        
        back_ok = not adv_res.get("back_lean_detected", False)
        is_correct = back_ok and not adv_res.get("heel_lift_detected", False)
        
        silent_error = None
        if self.session_errors:
            silent_error = ", ".join(self.session_errors)

        return create_safe_response({
            "status": "Analyzed",
            "reps": self.reps,
            "feedback": feedback_text, 
            "is_correct": bool(is_correct),
            "depth_reached": bool(self.depth_reached_in_rep),
            "landmarks": [{"x": lm.x, "y": lm.y} for lm in landmarks],
            "silent_error": silent_error,
            "current_angle": int(angle),
            "advanced_analysis": adv_res
        })

class DeadliftAnalyzer(BaseAnalyzer):
    def __init__(self, model_path=None):
        super().__init__()
        # Deadlift Logic (Standard Hip Hinge)
        # Down: < 100 (Bent over)
        # Up: > 160 (Standing)
        self.DOWN_THRESHOLD = 100
        self.UP_THRESHOLD = 160
        self.stage = "up"
        
        # Add smoothing and stability (similar to SquatAnalyzer)
        self.angle_history = []
        self.BUFFER_SIZE = 5
        self.stable_up_frames = 0
        self.stable_down_frames = 0
        self.min_rep_time = 0.8  # Minimum 0.8s between reps
        self.last_rep_time = 0

    def reset(self):
        self.reps = 0
        self.stage = "up"
        self.angle_history = []
        self.stable_up_frames = 0
        self.stable_down_frames = 0
        self.last_rep_time = 0
        
    def get_feedback(self):
        """Return empty list for deadlift (no error tracking yet)"""
        return []

    def analyze(self, results, frame=None):
        if not results.pose_landmarks:
            return create_safe_response({
                "status": "Analyzed", 
                "reps": self.reps, 
                "feedback": "Встаньте в кадр", 
                "landmarks": [],
                "is_correct": True,
                "depth_reached": False
            })

        landmarks = results.pose_landmarks.landmark
        
        # Visibility check
        l_vis = landmarks[23].visibility
        r_vis = landmarks[24].visibility
        
        # Keypoints: Shoulder(11/12), Hip(23/24), Knee(25/26)
        if l_vis > r_vis:
            shoulder = landmarks[11]
            hip = landmarks[23]
            knee = landmarks[25]
        else:
            shoulder = landmarks[12]
            hip = landmarks[24]
            knee = landmarks[26]

        # Hip Angle (Shoulder-Hip-Knee)
        raw_angle = self.calculate_angle(shoulder, hip, knee)
        
        # Apply smoothing (same as squat)
        self.angle_history.append(raw_angle)
        if len(self.angle_history) > self.BUFFER_SIZE:
            self.angle_history.pop(0)
        
        if len(self.angle_history) >= 3:
            angles_array = np.array(self.angle_history)
            median_angle = np.median(angles_array)
            std_dev = np.std(angles_array)
            if std_dev > 0:
                filtered_angles = angles_array[np.abs(angles_array - median_angle) <= 2 * std_dev]
            else:
                filtered_angles = angles_array
            angle = np.mean(filtered_angles) if len(filtered_angles) > 0 else raw_angle
        else:
            angle = raw_angle
            
        self.last_angle = int(angle)
        
        # Robust State Machine with stability checks
        current_time = time.time()
        
        if self.stage == "up":
            if angle < self.DOWN_THRESHOLD:  # < 100
                self.stable_down_frames += 1
                if self.stable_down_frames >= 3:  # Confirmation: 3 frames
                    self.stage = "down"
                    self.stable_down_frames = 0
                    print(f"📉 Deadlift Down: {angle:.1f}")
            else:
                self.stable_down_frames = 0
        
        elif self.stage == "down":
            if angle > self.UP_THRESHOLD:  # > 160
                self.stable_up_frames += 1
                if self.stable_up_frames >= 3:  # Confirmation: 3 frames
                    # Check minimum time between reps
                    time_ok = (current_time - self.last_rep_time >= self.min_rep_time)
                    if time_ok:
                        self.stage = "up"
                        self.reps += 1
                        self.last_rep_time = current_time
                        self.stable_up_frames = 0
                        print(f"✅ Deadlift Rep! Reps: {self.reps}, Angle: {angle:.1f}")
                    else:
                        print(f"⚠️ Too fast! Ignoring potential double count.")
            else:
                self.stable_up_frames = 0

        return create_safe_response({
            "status": "Analyzed",
            "reps": self.reps,
            "feedback": f"Угол: {int(angle)}",
            "is_correct": True,
            "depth_reached": self.stage == "down",
            "landmarks": [{"x": lm.x, "y": lm.y} for lm in landmarks]
        })
