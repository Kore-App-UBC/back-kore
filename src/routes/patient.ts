import express from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { upload } from '../utils/upload';
import {
  getMe,
  getExercises,
  submitVideo,
  getSubmissionHistory,
} from '../controllers/patientController';

const router = express.Router();

router.use(authenticate);
router.use(authorize('PATIENT'));

router.get('/me', getMe);
router.get('/exercises', getExercises);
router.post('/submissions', upload.single('videoFile'), submitVideo);
router.get('/submissions/history', getSubmissionHistory);

export default router;