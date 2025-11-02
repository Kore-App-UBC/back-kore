import { Request, Response } from 'express';
import { SubmitVideoSchema } from '../types';
import prisma from '../utils/prisma';
import { uploadVideoToGCS } from '../services/videoService';
import { processVideoSubmission } from '../services/processingService';

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { patientProfile: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getExercises = async (req: Request, res: Response) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }
    const exercises = await prisma.prescribedExercise.findMany({
      where: { patientId: patientProfile.id },
      include: { exercise: true },
    });
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitVideo = async (req: Request, res: Response) => {
  try {
    const { exerciseId, patientComments } = SubmitVideoSchema.parse(req.body);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    const videoUrl = await uploadVideoToGCS(file);

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const submission = await prisma.videoSubmission.create({
      data: {
        patientId: patientProfile.id,
        exerciseId,
        videoUrl,
        patientComments: patientComments || null,
        status: 'PENDING',
      },
    });

    processVideoSubmission(submission.id);

    const response: Partial<typeof submission> = { ...submission };
    delete response.videoUrl;

    res.status(201).json({ message: 'Video submitted successfully', submission: response });
  } catch (error) {
    console.error('Error in submitVideo:', error);

    res.status(400).json({ error: 'Invalid input' });
  }
};

export const getSubmissionHistory = async (req: Request, res: Response) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }
    const submissions = await prisma.videoSubmission.findMany({
      where: { patientId: patientProfile.id },
      include: { report: true },
    });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};