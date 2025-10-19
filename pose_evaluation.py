import cv2
import mediapipe as mp
import numpy as np
import math
import time

# Initialize MediaPipe Pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_pose = mp.solutions.pose

# --- Constants and Thresholds for Tuning ---

# Repetition Counting Thresholds (in degrees)
SHOULDER_ABD_UP_THRESH = 70
SHOULDER_ABD_DOWN_THRESH = 30
BICEP_CURL_UP_THRESH = 160
BICEP_CURL_DOWN_THRESH = 40
LATERAL_RAISE_UP_THRESH = 110 
LATERAL_RAISE_DOWN_THRESH = 150
KNEE_EXTENSION_UP_THRESH = 160
KNEE_EXTENSION_DOWN_THRESH = 90


# Inactivity reset timer (seconds)
INACTIVE_THRESH = 15.0

# --- Exercise Configuration ---
EXERCISES = ["Bicep Curls", "Shoulder Abduction", "Lateral Leg Raise", "Knee Extension"]
exercise_index = 0
active_exercise = EXERCISES[exercise_index]

# --- Repetition Counters and State Variables ---
rep_counts = {exercise: 0 for exercise in EXERCISES}
exercise_stages = {exercise: None for exercise in EXERCISES}

last_activity_time = time.time()
feedback_message = ""

def calculate_angle(a, b, c):
    """
    Calculates the angle between three points.
    Returns the angle in degrees.
    """
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle

def get_landmark_coordinates(landmarks, landmark_name):
    """
    Extracts 2D coordinates for a specific landmark and checks for visibility.
    Returns (x, y) tuple or None if not visible.
    """
    try:
        landmark_enum = mp_pose.PoseLandmark[landmark_name.upper()]
        landmark = landmarks.landmark[landmark_enum]
        
        if landmark.visibility < 0.5:
            return None
        
        return (landmark.x, landmark.y)
    except KeyError:
        print(f"Error: Landmark '{landmark_name}' not found.")
        return None

def draw_avatar(image, exercise_name):
    """
    Draws an animated full-body 3D stick-figure avatar demonstrating the exercise.
    """
    # --- Avatar Bounding Box ---
    avatar_panel_x, avatar_panel_y, avatar_panel_w, avatar_panel_h = image.shape[1] - 270, 90, 250, 300
    cv2.rectangle(image, (avatar_panel_x, avatar_panel_y), (avatar_panel_x + avatar_panel_w, avatar_panel_y + avatar_panel_h), (24, 24, 24), -1)
    cv2.putText(image, "DEMO", (avatar_panel_x + 5, avatar_panel_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 191, 0), 1, cv2.LINE_AA)

    # --- 3D Setup ---
    FOV = 400
    rotation_speed = 0.5
    offset_x = avatar_panel_x + avatar_panel_w // 2
    offset_y = avatar_panel_y + avatar_panel_h // 2 - 40
    angle_y = (time.time() * rotation_speed) % (2 * math.pi)

    rot_y = np.array([
        [math.cos(angle_y), 0, math.sin(angle_y)],
        [0, 1, 0],
        [-math.sin(angle_y), 0, math.cos(angle_y)]])

    # --- Base 3D model ---
    base_points_3d = {
        'head': np.array([0, -95, 0]), 'neck': np.array([0, -80, 0]),
        'mid_hip': np.array([0, 0, 0]), 'left_shoulder': np.array([-30, -70, 0]),
        'right_shoulder': np.array([30, -70, 0]), 'left_hip': np.array([-20, 0, 0]),
        'right_hip': np.array([20, 0, 0]), 'left_elbow': np.array([-30, -30, 0]),
        'right_elbow': np.array([30, -30, 0]), 'left_wrist': np.array([-30, 10, 0]),
        'right_wrist': np.array([30, 10, 0]), 'left_knee': np.array([-20, 50, 0]),
        'right_knee': np.array([20, 50, 0]), 'left_ankle': np.array([-20, 100, 0]),
        'right_ankle': np.array([20, 100, 0]),
    }

    # --- Animate the model ---
    t = time.time() % 2
    animated_points_3d = base_points_3d.copy()
    
    progress = (1 - math.cos(t * math.pi * 2)) / 2 # Smooth 0->1->0 cycle

    if exercise_name == "Bicep Curls":
        rs = animated_points_3d['right_shoulder']
        animated_points_3d['right_elbow'] = rs + np.array([0, 40, 10])
        re = animated_points_3d['right_elbow']
        curl_progress = (1 - math.cos(t * math.pi)) / 2
        rot_angle = (1 - curl_progress) * math.radians(160)
        rot_x_curl = np.array([[1, 0, 0], [0, math.cos(rot_angle), -math.sin(rot_angle)], [0, math.sin(rot_angle), math.cos(rot_angle)]])
        animated_points_3d['right_wrist'] = re + rot_x_curl.dot(np.array([0, 40, 0]))

    elif exercise_name == "Shoulder Abduction":
        current_angle_rad = progress * math.radians(SHOULDER_ABD_UP_THRESH)
        rot_x_abd = np.array([[1, 0, 0], [0, math.cos(-current_angle_rad), -math.sin(-current_angle_rad)], [0, math.sin(-current_angle_rad), math.cos(-current_angle_rad)]])
        rs = animated_points_3d['right_shoulder']
        animated_points_3d['right_elbow'] = rs + rot_x_abd.dot(np.array([0, 40, 0]))
        animated_points_3d['right_wrist'] = rs + rot_x_abd.dot(np.array([0, 80, 0]))

    elif exercise_name == "Lateral Leg Raise":
        # Corrected animation for lateral raise (side movement)
        current_angle_rad = progress * math.radians(45) # Max 45 degree raise
        # Negative angle rotates the leg to the right (positive X direction)
        rot_angle = -current_angle_rad
        rot_z_leg = np.array([[math.cos(rot_angle), -math.sin(rot_angle), 0], 
                              [math.sin(rot_angle), math.cos(rot_angle), 0], 
                              [0, 0, 1]])
        rh = animated_points_3d['right_hip']
        animated_points_3d['right_knee'] = rh + rot_z_leg.dot(np.array([0, 50, 0]))
        animated_points_3d['right_ankle'] = rh + rot_z_leg.dot(np.array([0, 100, 0]))
    
    elif exercise_name == "Knee Extension":
        # Base seated pose
        for side in ['left', 'right']:
            hip = animated_points_3d[f'{side}_hip']
            animated_points_3d[f'{side}_knee'] = hip + np.array([0, 50, 20])
            animated_points_3d[f'{side}_ankle'] = hip + np.array([0, 100, 0])
        
        # Animate right leg extension
        knee_progress = (1 - math.cos(t * math.pi)) / 2 # 0->1->0
        max_rot_angle = math.radians(80)
        rot_angle = knee_progress * -max_rot_angle
        rot_x_knee = np.array([[1, 0, 0], [0, math.cos(rot_angle), -math.sin(rot_angle)], [0, math.sin(rot_angle), math.cos(rot_angle)]])
        rk = animated_points_3d['right_knee']
        animated_points_3d['right_ankle'] = rk + rot_x_knee.dot(np.array([0, 50, -20]))


    # --- Project and Draw ---
    projected_points = {}
    for name, point_3d in animated_points_3d.items():
        rotated_point = rot_y.dot(point_3d)
        z = rotated_point[2]
        if FOV - z == 0: z += 0.1
        perspective = FOV / (FOV - z)
        x_2d = int(rotated_point[0] * perspective + offset_x)
        y_2d = int(rotated_point[1] * perspective + offset_y)
        projected_points[name] = (x_2d, y_2d, z)

    connections = [
        ('neck', 'mid_hip'), ('neck', 'left_shoulder'), ('left_shoulder', 'left_elbow'), ('left_elbow', 'left_wrist'),
        ('neck', 'right_shoulder'), ('right_shoulder', 'right_elbow'), ('right_elbow', 'right_wrist'),
        ('mid_hip', 'left_hip'), ('left_hip', 'left_knee'), ('left_knee', 'left_ankle'),
        ('mid_hip', 'right_hip'), ('right_hip', 'right_knee'), ('right_knee', 'right_ankle')]

    head_point = projected_points['head']
    cv2.circle(image, head_point[:2], max(1, int(15 * (FOV / (FOV - head_point[2])))), (255, 255, 255), -1)

    for p1_name, p2_name in connections:
        p1 = projected_points[p1_name]
        p2 = projected_points[p2_name]
        avg_z = (p1[2] + p2[2]) / 2
        thickness = max(1, int(4 * (FOV / (FOV - avg_z))))
        intensity = max(50, 255 * ((FOV - avg_z * 1.5) / FOV))
        color = (int(intensity),)*3
        moving_parts = []
        if 'Bicep' in exercise_name or 'Shoulder' in exercise_name: moving_parts = ['right_shoulder', 'right_elbow', 'right_wrist']
        if 'Lateral' in exercise_name or 'Knee' in exercise_name: moving_parts = ['right_hip', 'right_knee', 'right_ankle']
        if p1_name in moving_parts and p2_name in moving_parts:
            color = (int(intensity), int(intensity * 0.75), 0)
        cv2.line(image, p1[:2], p2[:2], color, thickness)

def process_shoulder_abduction(landmarks):
    """Analyzes shoulder abduction and counts reps."""
    global exercise_stages, rep_counts
    right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER')
    right_elbow = get_landmark_coordinates(landmarks, 'RIGHT_ELBOW')
    right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP')
    if not all([right_shoulder, right_elbow, right_hip]): return "Ensure right arm and hip are visible."
    angle = calculate_angle(right_hip, right_shoulder, right_elbow)
    if angle > SHOULDER_ABD_UP_THRESH: exercise_stages["Shoulder Abduction"] = "up"
    if angle < SHOULDER_ABD_DOWN_THRESH and exercise_stages["Shoulder Abduction"] == 'up':
        exercise_stages["Shoulder Abduction"] = "down"
        rep_counts["Shoulder Abduction"] += 1
    return ""

def process_bicep_curl(landmarks):
    """Analyzes bicep curls and counts reps."""
    global exercise_stages, rep_counts
    right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER')
    right_elbow = get_landmark_coordinates(landmarks, 'RIGHT_ELBOW')
    right_wrist = get_landmark_coordinates(landmarks, 'RIGHT_WRIST')
    if not all([right_shoulder, right_elbow, right_wrist]): return "Ensure right arm is fully visible."
    angle = calculate_angle(right_shoulder, right_elbow, right_wrist)
    if angle > BICEP_CURL_UP_THRESH: exercise_stages["Bicep Curls"] = "down"
    if angle < BICEP_CURL_DOWN_THRESH and exercise_stages["Bicep Curls"] == 'down':
        exercise_stages["Bicep Curls"] = "up"
        rep_counts["Bicep Curls"] += 1
    return ""

def process_lateral_raise(landmarks):
    """Analyzes lateral leg raises and counts reps."""
    global exercise_stages, rep_counts
    right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER')
    right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP')
    right_knee = get_landmark_coordinates(landmarks, 'RIGHT_KNEE')
    if not all([right_shoulder, right_hip, right_knee]): return "Ensure right side is visible."
    # Angle is calculated on the frontal plane, so it decreases as the leg goes up
    angle = calculate_angle(right_shoulder, right_hip, right_knee)
    if angle < LATERAL_RAISE_UP_THRESH: exercise_stages["Lateral Leg Raise"] = "up"
    if angle > LATERAL_RAISE_DOWN_THRESH and exercise_stages["Lateral Leg Raise"] == 'up':
        exercise_stages["Lateral Leg Raise"] = "down"
        rep_counts["Lateral Leg Raise"] += 1
    return ""

def process_knee_extension(landmarks):
    """Analyzes seated knee extensions and counts reps."""
    global exercise_stages, rep_counts
    right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP')
    right_knee = get_landmark_coordinates(landmarks, 'RIGHT_KNEE')
    right_ankle = get_landmark_coordinates(landmarks, 'RIGHT_ANKLE')
    if not all([right_hip, right_knee, right_ankle]): return "Ensure right leg is visible."
    angle = calculate_angle(right_hip, right_knee, right_ankle)
    if angle > KNEE_EXTENSION_UP_THRESH: exercise_stages["Knee Extension"] = "up"
    if angle < KNEE_EXTENSION_DOWN_THRESH and exercise_stages["Knee Extension"] == 'up':
        exercise_stages["Knee Extension"] = "down"
        rep_counts["Knee Extension"] += 1
    return ""

# --- Main Application Logic ---
def main():
    global last_activity_time, feedback_message, active_exercise, exercise_index
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open video stream.")
        return

    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            success, image = cap.read()
            if not success: continue
            
            image = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            results = pose.process(image)
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            if results.pose_landmarks:
                last_activity_time = time.time()
                
                if active_exercise == "Shoulder Abduction": feedback_message = process_shoulder_abduction(results.pose_landmarks)
                elif active_exercise == "Bicep Curls": feedback_message = process_bicep_curl(results.pose_landmarks)
                elif active_exercise == "Lateral Leg Raise": feedback_message = process_lateral_raise(results.pose_landmarks)
                elif active_exercise == "Knee Extension": feedback_message = process_knee_extension(results.pose_landmarks)

                mp_drawing.draw_landmarks(
                    image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                    landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style())
            
            else:
                if time.time() - last_activity_time > INACTIVE_THRESH:
                    for exercise in EXERCISES: rep_counts[exercise] = 0
                    feedback_message = "Counters reset due to inactivity."
            
            # --- UI Display ---
            cv2.rectangle(image, (0,0), (image.shape[1], 80), (24, 24, 24), -1)
            cv2.putText(image, 'ACTIVE EXERCISE', (15, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(image, active_exercise, (15, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 191, 0), 2, cv2.LINE_AA)
            cv2.putText(image, 'REPS', (image.shape[1] - 150, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(image, str(rep_counts[active_exercise]), (image.shape[1] - 150, 65), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 2, cv2.LINE_AA)
            draw_avatar(image, active_exercise)
            cv2.putText(image, feedback_message, (50, image.shape[0] - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)

            cv2.imshow('Physiotherapy AI Coach', image)
            
            key = cv2.waitKey(5) & 0xFF
            if key == ord('q'): break
            elif key == ord('s'):
                exercise_index = (exercise_index + 1) % len(EXERCISES)
                active_exercise = EXERCISES[exercise_index]
                feedback_message = ""

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()

