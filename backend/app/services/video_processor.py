import cv2
import mediapipe as mp
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class VideoProcessor:
    """
    Класс для обработки видео и извлечения поз с помощью MediaPipe.
    Поддерживает выборочный анализ кадров (sampling) и сжатие перед обработкой.
    """
    TARGET_WIDTH = 640
    TARGET_HEIGHT = 480

    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def extract_poses(
        self,
        video_path: str,
        target_frames: int = 3000,
        limit_frames: Optional[int] = None,
        target_fps: Optional[int] = None,
    ) -> List[Dict[str, Dict[str, float]]]:
        """
        Извлекает позы из видео с выборкой кадров и сжатием.

        Args:
            video_path: Путь к видео-файлу.
            target_frames: Желаемое количество кадров для анализа (по умолчанию 3000).
            limit_frames: (deprecated) Жёсткий лимит обработки первых N кадров.
            target_fps: Если указан, игнорирует target_frames и пытается извлечь кадры с заданной частотой.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Cannot open video: {video_path}")
            raise ValueError(f"Не удалось открыть видео: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        print(f">>> [PROCESSOR] Video: {total_frames} frames, {video_fps:.1f} fps")

        # Вычисляем шаг выборки
        if limit_frames:
            # Старый режим: обрабатываем первые N кадров подряд
            step = 1
            max_to_process = limit_frames
        elif target_fps:
            # Режим FPS: пытаемся сохранить target_fps
            step = max(1, int(video_fps / target_fps))
            max_to_process = total_frames // step
        else:
            # Режим фиксированного количества кадров
            # Если видео короткое, берем все кадры (step=1)
            if total_frames <= target_frames:
                step = 1
                max_to_process = total_frames
            else:
                step = max(1, total_frames // target_frames)
                max_to_process = target_frames

        print(f">>> [PROCESSOR] Sampling: step={step}, target_count={max_to_process}")

        frames_landmarks = []
        frame_idx = 0
        processed = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Обрабатываем только каждый step-й кадр
            if frame_idx % step != 0:
                frame_idx += 1
                continue

            if processed >= max_to_process:
                break

            frame_idx += 1
            processed += 1

            # Сжимаем кадр до 640×480 перед MediaPipe
            frame = cv2.resize(frame, (self.TARGET_WIDTH, self.TARGET_HEIGHT))

            # MediaPipe requires RGB images
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False

            try:
                results = self.pose.process(image)

                if results.pose_landmarks:
                    landmarks = {}
                    for idx, lm in enumerate(results.pose_landmarks.landmark):
                        name = self.mp_pose.PoseLandmark(idx).name.lower()
                        landmarks[name] = {
                            "x": lm.x,
                            "y": lm.y,
                            "z": lm.z,
                            "visibility": lm.visibility,
                        }
                    frames_landmarks.append(landmarks)
            except Exception as e:
                logger.warning(f"Ошибка при обработке кадра {frame_idx}: {e}")

        cap.release()
        print(f">>> [PROCESSOR] Done: {len(frames_landmarks)} poses extracted from {processed} processed frames")
        return frames_landmarks
