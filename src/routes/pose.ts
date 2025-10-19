import express from 'express';

const router = express.Router();

// WebSocket endpoint information
router.get('/', (req, res) => {
  res.json({
    message: 'Pose evaluation WebSocket endpoint',
    websocket_url: `ws://${req.headers.host}/pose`,
    description: 'Connect to this WebSocket URL to send pose data and receive evaluation results',
    data_format: {
      pose_landmarks: {
        RIGHT_SHOULDER: { x: 0.5, y: 0.3, z: 0.0, visibility: 0.9 },
        RIGHT_ELBOW: { x: 0.6, y: 0.4, z: 0.0, visibility: 0.8 },
        // ... other landmarks
      },
      exercise: 'Bicep Curls' // optional, to switch exercises
    },
    response_format: {
      active_exercise: 'Bicep Curls',
      rep_counts: {
        'Bicep Curls': 5,
        'Shoulder Abduction': 0,
        'Lateral Leg Raise': 0,
        'Knee Extension': 0
      },
      feedback_message: ''
    }
  });
});

export default router;