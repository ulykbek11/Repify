"""Pose extraction from a video file with MediaPipe Pose."""

import logging
from typing import Dict, List

import cv2
import mediapipe as mp

logger = logging.getLogger(__name__)

TARGET_SIZE = (640, 480)


class VideoProcessor:
    """Runs MediaPipe Pose on sampled frames and returns normalised landmarks."""

    def extract_poses(
        self, video_path: str, target_fps: int = 30, max_frames: int = 3000
    ) -> List[Dict[str, Dict[str, float]]]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError("Could not open the video file")

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step = max(1, round(video_fps / target_fps))
        logger.info("Video: %.1f fps, sampling every %d frame(s)", video_fps, step)

        poses: List[Dict[str, Dict[str, float]]] = []
        index = 0
        with mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose:
            while len(poses) < max_frames:
                ok, frame = cap.read()
                if not ok:
                    break
                keep = index % step == 0
                index += 1
                if not keep:
                    continue
                image = cv2.cvtColor(cv2.resize(frame, TARGET_SIZE), cv2.COLOR_BGR2RGB)
                result = pose.process(image)
                if not result.pose_landmarks:
                    continue
                poses.append(
                    {
                        mp.solutions.pose.PoseLandmark(i).name.lower(): {
                            "x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility,
                        }
                        for i, lm in enumerate(result.pose_landmarks.landmark)
                    }
                )
        cap.release()
        logger.info("Extracted %d poses from %d frames", len(poses), index)
        return poses
