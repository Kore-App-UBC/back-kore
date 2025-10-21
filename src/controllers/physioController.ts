import { Request, Response } from 'express';
import { FeedbackSchema } from '../types';
import prisma from '../utils/prisma';

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { physiotherapistProfile: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPatients = async (req: Request, res: Response) => {
  try {
    const physiotherapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true }
    });

    const patients = await prisma.patientProfile.findMany({
      where: { physiotherapistId: physiotherapistProfile!.id },
      include: { user: true },
    });

    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubmissionQueue = async (req: Request, res: Response) => {
  try {
    const submissions = await prisma.videoSubmission.findMany({
      where: {
        patient: { physiotherapistId: req.user!.id },
        status: 'PROCESSED',
      },
      include: { report: true, patient: { include: { user: true } }, exercise: true },
    });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubmissionDetails = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }

    const submission = await prisma.videoSubmission.findUnique({
      where: { id: submissionId },
      include: { report: true, patient: { include: { user: true } }, exercise: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { physioFeedback } = FeedbackSchema.parse(req.body);

    if (!submissionId) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }

    await prisma.report.update({
      where: { submissionId },
      data: {
        physioFeedback,
        finalizedAt: new Date(),
      },
    });

    await prisma.videoSubmission.update({
      where: { id: submissionId },
      data: { status: 'REVIEWED' },
    });

    res.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
};