import numpy as np

def get_coords(landmark):
    """
    Extracts (x, y) coordinates from a landmark.
    """
    if isinstance(landmark, dict):
        return np.array([landmark['x'], landmark['y']])
    if hasattr(landmark, 'x'):
        return np.array([landmark.x, landmark.y])
    return np.array([landmark[0], landmark[1]])

def calculate_angle(a, b, c):
    """
    Calculates the angle at point b formed by points a, b, c.
    Returns angle in degrees (0-180).
    """
    a = get_coords(a)
    b = get_coords(b)
    c = get_coords(c)
    
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle

def calculate_vertical_angle(a, b):
    """
    Calculates the angle of segment a-b relative to the vertical axis (Y-axis).
    Useful for measuring back inclination.
    Point a: top (shoulder), Point b: bottom (hip)
    Returns angle in degrees (0 = upright, 90 = horizontal).
    """
    a = get_coords(a)
    b = get_coords(b)
    
    # Vector b->a (hip to shoulder)
    delta_x = a[0] - b[0]
    delta_y = a[1] - b[1] 
    
    angle_rad = np.arctan2(np.abs(delta_x), np.abs(delta_y))
    angle_deg = np.degrees(angle_rad)
    
    return angle_deg

def get_view_ratio(landmarks):
    """
    Calculates the ratio of (average shoulder & hip width) to torso height.
    Lower ratio means more "side view".
    """
    try:
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]
        left_hip = landmarks[23]
        right_hip = landmarks[24]
        
        ls = get_coords(left_shoulder)
        rs = get_coords(right_shoulder)
        lh = get_coords(left_hip)
        rh = get_coords(right_hip)

        shoulder_width = np.linalg.norm(ls - rs)
        hip_width = np.linalg.norm(lh - rh)
        
        # Average width
        width = (shoulder_width + hip_width) / 2
        
        # Torso height (mid shoulder to mid hip)
        mid_shoulder = (ls + rs) / 2
        mid_hip = (lh + rh) / 2
        height = np.linalg.norm(mid_shoulder - mid_hip)
        
        if height == 0: return 999.0
        
        ratio = width / height
        return ratio
    except Exception as e:
        print(f"Error calculating view ratio: {e}")
        return 999.0

def is_side_view(landmarks, threshold=0.28):
    """
    Determines if the landmarks represent a side view based on width/height ratio.
    """
    ratio = get_view_ratio(landmarks)
    return ratio < threshold
