import app from './app';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { handlePoseWebSocket } from './services/poseService';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// WebSocket server for pose evaluation
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, request: IncomingMessage) => {
  console.log('New WebSocket connection established');

  handlePoseWebSocket(ws);
});