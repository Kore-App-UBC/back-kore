import WebSocket from 'ws';
import prisma from '../utils/prisma';

const INACTIVE_THRESH = 15.0;

interface ClassificationData {
  thresholds: {
    up: number;
    down: number;
  };
  landmarks: string[];
  evaluationType: 'high_to_low' | 'low_to_high' | 'custom';
}

interface AnimationData {
  basePoints: Record<string, [number, number, number]>;
  animation: string;
}

interface ExerciseData {
  id: string;
  name: string;
  description: string;
  instructionsUrl: string;
  classificationData: ClassificationData | null;
  animationData: AnimationData | null;
  createdAt: Date;
  updatedAt: Date;
}

let exercises: ExerciseData[] = [];
let active_exercise: ExerciseData | null = null;
const rep_counts: Record<string, number> = {};
const exercise_stages: Record<string, string | null> = {};
let last_activity_time = Date.now();
let feedback_message = "";

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

async function loadExercises(): Promise<void> {
  try {
    const dbExercises = await prisma.exercise.findMany({
      orderBy: { createdAt: 'asc' },
    });

    exercises = dbExercises.map(ex => ({
      ...ex,
      classificationData: ex.classificationData as ClassificationData | null,
      animationData: ex.animationData as AnimationData | null,
    }));

    for (const exercise of exercises) {
      rep_counts[exercise.name] = 0;
      exercise_stages[exercise.name] = null;
    }

    active_exercise = exercises[0] || null;
  } catch (error) {
    console.error('Error loading exercises:', error);
  }
}

function processExercise(landmarks: PoseLandmarks, exercise: ExerciseData): string {
  if (!exercise.classificationData) {
    return "Exercise classification data not available.";
  }

  const { thresholds, landmarks: requiredLandmarks, evaluationType } = exercise.classificationData;

  const landmarkCoords = requiredLandmarks.map(name => get_landmark_coordinates(landmarks, name));

  if (landmarkCoords.some(coord => coord === null)) {
    return `Ensure all required landmarks are visible for ${exercise.name}.`;
  }

  const [pointA, pointB, pointC] = landmarkCoords as [[number, number], [number, number], [number, number]];
  const angle = calculate_angle(pointA, pointB, pointC);

  const exerciseName = exercise.name;

  if (evaluationType === 'high_to_low') {
    // Exercises that start high and go low (like shoulder abduction, knee extension)
    if (angle > thresholds.up) {
      exercise_stages[exerciseName] = "up";
    }

    if (angle < thresholds.down && exercise_stages[exerciseName] === 'up') {
      exercise_stages[exerciseName] = "down";
      rep_counts[exerciseName]! += 1;
    }
  } else if (evaluationType === 'low_to_high') {
    if (angle > thresholds.up) {
      exercise_stages[exerciseName] = "up";
    }

    if (angle < thresholds.down && exercise_stages[exerciseName] === 'up') {
      exercise_stages[exerciseName] = "down";
      rep_counts[exerciseName]! += 1;
    }
  } else if (evaluationType === 'custom') {
    return "Custom evaluation not yet implemented.";
  }

  return "";
}

function process_pose_data(pose_data: PoseData): {
  active_exercise: string;
  rep_counts: Record<string, number>;
  feedback_message: string;
} {
  const { pose_landmarks, exercise: exerciseName } = pose_data;

  if (exerciseName) {
    const foundExercise = exercises.find(ex => ex.name === exerciseName);

    if (foundExercise) {
      active_exercise = foundExercise;
    }
  }

  // Process pose landmarks
  if (pose_landmarks && active_exercise) {
    last_activity_time = Date.now();

    feedback_message = processExercise(pose_landmarks, active_exercise);
  } else {
    if ((Date.now() - last_activity_time) / 1000 > INACTIVE_THRESH) {
      for (const exercise of exercises) {
        rep_counts[exercise.name] = 0;
      }

      feedback_message = "Counters reset due to inactivity.";
    }
  }

  return {
    active_exercise: active_exercise?.name || "",
    rep_counts: { ...rep_counts },
    feedback_message,
  };
}

loadExercises();

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

export async function reloadExercises(): Promise<void> {
  await loadExercises();
}