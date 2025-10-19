import express from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import {
  createPatient,
  createPhysiotherapist,
  assignPhysiotherapist,
  prescribeExercise,
  getMetrics,
  getPatients,
  updatePatient,
  updatePhysiotherapist,
} from '../controllers/managerController';

const router = express.Router();

router.use(authenticate);
router.use(authorize('MANAGER'));

router.post('/patients', createPatient);
router.put('/patients/:patientId', updatePatient);
router.get('/patients', getPatients);
router.post('/physiotherapists', createPhysiotherapist);
router.put('/physiotherapists/:physioId', updatePhysiotherapist);
router.post('/patients/:patientId/assign', assignPhysiotherapist);
router.post('/patients/:patientId/prescribe', prescribeExercise);
router.get('/metrics', getMetrics);

export default router;