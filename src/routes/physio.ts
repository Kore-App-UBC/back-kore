import express from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import {
  getMe,
  getPatients,
  getSubmissionQueue,
  getSubmissionDetails,
  submitFeedback,
} from '../controllers/physioController';

const router = express.Router();

router.use(authenticate);
router.use(authorize('PHYSIOTHERAPIST'));

router.get('/me', getMe);
router.get('/patients', getPatients);
router.get('/submissions/queue', getSubmissionQueue);
router.get('/submissions/:submissionId', getSubmissionDetails);
router.post('/submissions/:submissionId/feedback', submitFeedback);

export default router;