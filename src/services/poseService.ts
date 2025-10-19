import WebSocket from 'ws';

// Constants and Thresholds for Tuning
const SHOULDER_ABD_UP_THRESH = 70;
const SHOULDER_ABD_DOWN_THRESH = 30;
const BICEP_CURL_UP_THRESH = 160;
const BICEP_CURL_DOWN_THRESH = 40;
const LATERAL_RAISE_UP_THRESH = 110;
const LATERAL_RAISE_DOWN_THRESH = 150;
const KNEE_EXTENSION_UP_THRESH = 160;
const KNEE_EXTENSION_DOWN_THRESH = 90;

// Inactivity reset timer (seconds)
const INACTIVE_THRESH = 15.0;

// Exercise Configuration
const EXERCISES: readonly string[] = ["Bicep Curls", "Shoulder Abduction", "Lateral Leg Raise", "Knee Extension"];
let exercise_index = 0;
let active_exercise: string = EXERCISES[exercise_index]!;

// Repetition Counters and State Variables
const rep_counts: Record<string, number> = {};
const exercise_stages: Record<string, string | null> = {};

for (const exercise of EXERCISES) {
  rep_counts[exercise] = 0;
  exercise_stages[exercise] = null;
}

let last_activity_time = Date.now();
let feedback_message = "";

// Types
interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface PoseLandmarks {
  [key: string]: Landmark;
}

interface PoseData {
  pose_landmarks: PoseLandmarks;
  exercise?: string;
}

// Utility functions
function calculate_angle(a: [number, number], b: [number, number], c: [number, number]): number {
  const radians = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(a[1] - b[1], a[0] - b[0]);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

function get_landmark_coordinates(landmarks: PoseLandmarks, landmark_name: string): [number, number] | null {
  const landmark = landmarks[landmark_name.toUpperCase()];
  if (!landmark || landmark.visibility < 0.5) {
    return null;
  }
  return [landmark.x, landmark.y];
}

// Exercise processing functions
function process_shoulder_abduction(landmarks: PoseLandmarks): string {
  const right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER');
  const right_elbow = get_landmark_coordinates(landmarks, 'RIGHT_ELBOW');
  const right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP');

  if (!right_shoulder || !right_elbow || !right_hip) {
    return "Ensure right arm and hip are visible.";
  }

  const angle = calculate_angle(right_hip, right_shoulder, right_elbow);

  if (angle > SHOULDER_ABD_UP_THRESH) {
    exercise_stages["Shoulder Abduction"] = "up";
  }
  if (angle < SHOULDER_ABD_DOWN_THRESH && exercise_stages["Shoulder Abduction"] === 'up') {
    exercise_stages["Shoulder Abduction"] = "down";
    rep_counts["Shoulder Abduction"]! += 1;
  }

  return "";
}

function process_bicep_curl(landmarks: PoseLandmarks): string {
  const right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER');
  const right_elbow = get_landmark_coordinates(landmarks, 'RIGHT_ELBOW');
  const right_wrist = get_landmark_coordinates(landmarks, 'RIGHT_WRIST');

  if (!right_shoulder || !right_elbow || !right_wrist) {
    return "Ensure right arm is fully visible.";
  }

  const angle = calculate_angle(right_shoulder, right_elbow, right_wrist);

  if (angle > BICEP_CURL_UP_THRESH) {
    exercise_stages["Bicep Curls"] = "down";
  }
  if (angle < BICEP_CURL_DOWN_THRESH && exercise_stages["Bicep Curls"] === 'down') {
    exercise_stages["Bicep Curls"] = "up";
    rep_counts["Bicep Curls"]! += 1;
  }

  return "";
}

function process_lateral_raise(landmarks: PoseLandmarks): string {
  const right_shoulder = get_landmark_coordinates(landmarks, 'RIGHT_SHOULDER');
  const right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP');
  const right_knee = get_landmark_coordinates(landmarks, 'RIGHT_KNEE');

  if (!right_shoulder || !right_hip || !right_knee) {
    return "Ensure right side is visible.";
  }

  const angle = calculate_angle(right_shoulder, right_hip, right_knee);

  if (angle < LATERAL_RAISE_UP_THRESH) {
    exercise_stages["Lateral Leg Raise"] = "up";
  }
  if (angle > LATERAL_RAISE_DOWN_THRESH && exercise_stages["Lateral Leg Raise"] === 'up') {
    exercise_stages["Lateral Leg Raise"] = "down";
    rep_counts["Lateral Leg Raise"]! += 1;
  }

  return "";
}

function process_knee_extension(landmarks: PoseLandmarks): string {
  const right_hip = get_landmark_coordinates(landmarks, 'RIGHT_HIP');
  const right_knee = get_landmark_coordinates(landmarks, 'RIGHT_KNEE');
  const right_ankle = get_landmark_coordinates(landmarks, 'RIGHT_ANKLE');

  if (!right_hip || !right_knee || !right_ankle) {
    return "Ensure right leg is visible.";
  }

  const angle = calculate_angle(right_hip, right_knee, right_ankle);

  if (angle > KNEE_EXTENSION_UP_THRESH) {
    exercise_stages["Knee Extension"] = "up";
  }
  if (angle < KNEE_EXTENSION_DOWN_THRESH && exercise_stages["Knee Extension"] === 'up') {
    exercise_stages["Knee Extension"] = "down";
    rep_counts["Knee Extension"]! += 1;
  }

  return "";
}

// Main processing function
function process_pose_data(pose_data: PoseData): {
  active_exercise: string;
  rep_counts: Record<string, number>;
  feedback_message: string;
} {
  const { pose_landmarks, exercise } = pose_data;

  // Update active exercise if specified
  if (exercise && EXERCISES.includes(exercise)) {
    active_exercise = exercise;
    exercise_index = EXERCISES.indexOf(exercise);
  }

  // Process pose landmarks
  if (pose_landmarks) {
    last_activity_time = Date.now();

    let feedback = "";
    if (active_exercise === "Shoulder Abduction") {
      feedback = process_shoulder_abduction(pose_landmarks);
    } else if (active_exercise === "Bicep Curls") {
      feedback = process_bicep_curl(pose_landmarks);
    } else if (active_exercise === "Lateral Leg Raise") {
      feedback = process_lateral_raise(pose_landmarks);
    } else if (active_exercise === "Knee Extension") {
      feedback = process_knee_extension(pose_landmarks);
    }

    feedback_message = feedback;
  } else {
    // Check for inactivity
    if ((Date.now() - last_activity_time) / 1000 > INACTIVE_THRESH) {
      for (const exercise of EXERCISES) {
        rep_counts[exercise] = 0;
      }
      feedback_message = "Counters reset due to inactivity.";
    }
  }

  return {
    active_exercise,
    rep_counts: { ...rep_counts },
    feedback_message,
  };
}

// WebSocket handler
export function handlePoseWebSocket(ws: WebSocket): void {
  ws.on('message', (data: Buffer) => {
    try {
      const poseData: PoseData = JSON.parse(data.toString());
      const result = process_pose_data(poseData);
      ws.send(JSON.stringify(result));
    } catch (error) {
      console.error('Error processing pose data:', error);
      ws.send(JSON.stringify({ error: 'Invalid pose data format' }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}