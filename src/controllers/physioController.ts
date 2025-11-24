import { Request, Response } from 'express';
import { FeedbackSchema, PrescribeExerciseSchema } from '../types';
import prisma from '../utils/prisma';
import { getSignedUrlForVideo } from '../services/videoService';

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { physiotherapistProfile: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
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
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getSubmissionQueue = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const submissions = await prisma.videoSubmission.findMany({
      where: {
        patient: { physiotherapist: { userId: req.user.id } },
        status: 'PROCESSED',
      },
      include: { report: true, patient: { include: { user: true } }, exercise: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getSubmissionDetails = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'ID da submissão é obrigatório' });
    }

    const submission = await prisma.videoSubmission.findUnique({
      where: { id: submissionId },
      include: { report: true, patient: { include: { user: true } }, exercise: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submissão não encontrada' });
    }

    if (submission.videoUrl) {
      const publicVideoUrl = await getSignedUrlForVideo(submission.videoUrl);
      submission.videoUrl = publicVideoUrl;
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { physioFeedback } = FeedbackSchema.parse(req.body);

    if (!submissionId) {
      return res.status(400).json({ error: 'ID da submissão é obrigatório' });
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

    res.json({ message: 'Feedback enviado com sucesso' });
  } catch (error) {
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const prescribeExercise = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { exerciseId } = PrescribeExerciseSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    // Verify the physiotherapist is assigned to this patient
    const physiotherapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true }
    });

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { physiotherapistId: true }
    });

    if (!patient || patient.physiotherapistId !== physiotherapistProfile!.id) {
      return res.status(403).json({ error: 'Você não está atribuído a este paciente' });
    }

    // Check if exercise is already prescribed
    const existingPrescription = await prisma.prescribedExercise.findUnique({
      where: {
        patientId_exerciseId: {
          patientId,
          exerciseId,
        },
      },
    });

    if (existingPrescription) {
      return res.status(400).json({ error: 'Exercício já prescrito para este paciente' });
    }

    // Create the prescription
    const prescription = await prisma.prescribedExercise.create({
      data: {
        patientId,
        exerciseId,
      },
      include: {
        exercise: true,
        patient: {
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Exercício prescrito com sucesso',
      prescription
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getPrescribedExercises = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    // Verify the physiotherapist is assigned to this patient
    const physiotherapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true }
    });

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { physiotherapistId: true }
    });

    if (!patient || patient.physiotherapistId !== physiotherapistProfile!.id) {
      return res.status(403).json({ error: 'Você não está atribuído a este paciente' });
    }

    const prescriptions = await prisma.prescribedExercise.findMany({
      where: { patientId },
      include: {
        exercise: true,
      },
      orderBy: { prescribedAt: 'desc' }
    });

    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const removePrescribedExercise = async (req: Request, res: Response) => {
  try {
    const { patientId, exerciseId } = req.params;

    if (!patientId || !exerciseId) {
      return res.status(400).json({ error: 'ID do paciente e ID do exercício são obrigatórios' });
    }

    // Verify the physiotherapist is assigned to this patient
    const physiotherapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true }
    });

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { physiotherapistId: true }
    });

    if (!patient || patient.physiotherapistId !== physiotherapistProfile!.id) {
      return res.status(403).json({ error: 'Você não está atribuído a este paciente' });
    }

    await prisma.prescribedExercise.delete({
      where: {
        patientId_exerciseId: {
          patientId,
          exerciseId,
        },
      },
    });

    res.json({ message: 'Prescrição de exercício removida com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getAvailableExercises = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    // Verify the physiotherapist is assigned to this patient
    const physiotherapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true }
    });

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { physiotherapistId: true }
    });

    if (!patient || patient.physiotherapistId !== physiotherapistProfile!.id) {
      return res.status(403).json({ error: 'Você não está atribuído a este paciente' });
    }

    // Get all exercises
    const allExercises = await prisma.exercise.findMany({
      orderBy: { name: 'asc' },
    });

    // Get already prescribed exercises for this patient
    const prescribedExercises = await prisma.prescribedExercise.findMany({
      where: { patientId },
      select: { exerciseId: true },
    });

    const prescribedExerciseIds = new Set(prescribedExercises.map(p => p.exerciseId));

    // Filter out already prescribed exercises and add availability status
    const availableExercises = allExercises.map(exercise => ({
      ...exercise,
      isPrescribed: prescribedExerciseIds.has(exercise.id),
    }));

    res.json(availableExercises);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};