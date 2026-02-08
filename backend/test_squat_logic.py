import unittest
from core.analyzer import SquatAnalyzer
from types import SimpleNamespace
import json
from unittest.mock import MagicMock

class MockLandmark:
    def __init__(self, x, y, visibility=1.0):
        self.x = x
        self.y = y
        self.visibility = visibility

class MockResults:
    def __init__(self, landmarks):
        self.pose_landmarks = SimpleNamespace(landmark=landmarks)

class TestSquatAnalyzer(unittest.TestCase):
    def setUp(self):
        self.analyzer = SquatAnalyzer()
        # Create a fresh mock
        mock_adv = MagicMock()
        # Configure returns - now using floats (suspicion 0.0-1.0)
        mock_adv.detect_shallow_squat.return_value = 0.0
        mock_adv.detect_heel_lift.return_value = 0.0
        mock_adv.detect_torso_lean.return_value = 0.0
        
        # Assign to analyzer
        self.analyzer.advanced_analyzer = mock_adv
        
        self.analyzer.ml_analyzer = MagicMock()
        self.analyzer.ml_analyzer.predict.return_value = {"error_prob": 0.0}

    def analyze_and_parse(self, results):
        res_str = self.analyzer.analyze(results)
        return json.loads(res_str)

    def test_nedosed_logic(self):
        # We will override calculate_angle for easier testing of state machine
        original_calc = self.analyzer.calculate_angle
        self.analyzer.calculate_angle = lambda h, k, a: self.current_angle
        
        # 1. Start Standing
        self.current_angle = 170
        res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        self.assertEqual(self.analyzer.stage, "up")
        
        # 2. Descend to 110 (Not deep enough, Threshold is 100)
        self.current_angle = 110
        # Needs 5 frames to confirm transition to DOWN and stabilize smoothing
        for _ in range(10):
            res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        self.assertEqual(self.analyzer.stage, "down")
        
        # 3. Go back up
        # Step the angle to avoid outlier filtering (smoothing is robust)
        self.current_angle = 140
        for _ in range(5):
             res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
             
        self.current_angle = 170
        # Needs many frames to overcome smoothing buffer (median filter) and stable_up_frames
        for _ in range(20):
             res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        self.assertEqual(self.analyzer.stage, "up")
        
        # SHOULD BE ERROR "Nedosed" (Shallow Rep)
        # Reps should be 0 because depth was not reached
        self.assertEqual(self.analyzer.reps, 0, "Should not count shallow squat")
        self.assertIn("Ниже", res['feedback'])
        
        # 4. Descend to 80 (Deep enough)
        self.current_angle = 80
        # Need to satisfy coordinate condition too: HipY >= KneeY - Offset
        # MockLandmark(0,0) means HipY=0, KneeY=0. 0 >= 0 - 0.05. Correct.
        for _ in range(10):
            res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        
        # 4b. Stay at 80
        res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        
        # 5. Go back up
        self.current_angle = 170
        for _ in range(5):
            res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        res = self.analyze_and_parse(MockResults([MockLandmark(0,0)]*33))
        
        # SHOULD BE GOOD REP
        self.assertEqual(self.analyzer.reps, 1, "Should count deep squat")
        self.assertEqual(res['feedback'], "Отлично!")

    def test_heel_lift_trigger(self):
        """Test the double confirmation logic for heel lift"""
        # Scenario 1: Math High, AI High -> ERROR
        self.analyzer.advanced_analyzer.detect_heel_lift = lambda *args: 0.9
        self.analyzer.ml_analyzer.predict.return_value = {"error_prob": 0.8}
        
        self.analyzer.calculate_angle = lambda h, k, a: 80 # Deep squat
        self.analyzer.stage = "down" 
        
        landmarks = [MockLandmark(0,0)]*33
        res = self.analyze_and_parse(MockResults(landmarks))
        
        # Check if error flagged
        self.assertTrue(self.analyzer.heel_lift_in_current_rep, "Should trigger when Math=0.9, AI=0.8")

    def test_heel_lift_negative(self):
        """Test negative cases - now with prioritized logic"""
        # Scenario 2: Math High (0.9), AI Low (0.2)
        # NEW LOGIC: Math > 0.85 -> Trigger immediately (no AI veto)
        self.analyzer.advanced_analyzer.detect_heel_lift = lambda *args: 0.9
        self.analyzer.ml_analyzer.predict.return_value = {"error_prob": 0.2}
        
        self.analyzer.calculate_angle = lambda h, k, a: 80
        self.analyzer.stage = "down"
        
        landmarks = [MockLandmark(0,0)]*33
        res = self.analyze_and_parse(MockResults(landmarks))
        
        # NEW BEHAVIOR: Should trigger because math_heel (0.9) > 0.85
        self.assertTrue(self.analyzer.heel_lift_in_current_rep, "Should trigger when Math=0.9 (even if AI=0.2)")

    def test_heel_lift_weak_confirmation(self):
        """Test weak but sufficient confirmation with new weights"""
        # Scenario 3: Math=0.6, AI=0.75
        # NEW FORMULA: Combined = (0.6 * 0.4) + (0.75 * 0.6) = 0.24 + 0.45 = 0.69 > 0.65 -> ERROR
        
        self.analyzer.advanced_analyzer.detect_heel_lift = lambda *args: 0.6
        self.analyzer.ml_analyzer.predict.return_value = {"error_prob": 0.75}
        
        self.analyzer.calculate_angle = lambda h, k, a: 80
        self.analyzer.stage = "down"
        
        landmarks = [MockLandmark(0,0)]*33
        res = self.analyze_and_parse(MockResults(landmarks))
        
        # Combined = 0.24 + 0.45 = 0.69 > 0.65 -> Should trigger
        self.assertTrue(self.analyzer.heel_lift_in_current_rep, "Should trigger if combined score (0.69) > 0.65")
        
        # Test borderline case: Math=0.55, AI=0.6
        # Combined = (0.55 * 0.4) + (0.6 * 0.6) = 0.22 + 0.36 = 0.58 < 0.65 -> NO ERROR
        self.analyzer.heel_lift_in_current_rep = False  # Reset
        self.analyzer.advanced_analyzer.detect_heel_lift = lambda *args: 0.55
        self.analyzer.ml_analyzer.predict.return_value = {"error_prob": 0.6}
        
        res = self.analyze_and_parse(MockResults(landmarks))
        self.assertFalse(self.analyzer.heel_lift_in_current_rep, "Should NOT trigger if combined score (0.58) < 0.65")

if __name__ == '__main__':
    unittest.main()
