import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import managerRoutes from './routes/manager';
import patientRoutes from './routes/patient';
import physioRoutes from './routes/physio';
import poseRoutes from './routes/pose';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/manager', managerRoutes);
app.use('/patient', patientRoutes);
app.use('/physio', physioRoutes);
app.use('/pose', poseRoutes);

app.use(errorHandler);

export default app;