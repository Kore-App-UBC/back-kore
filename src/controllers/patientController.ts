import { Request, Response } from 'express';
import { SubmitVideoSchema } from '../types';
import prisma from '../utils/prisma';
import { getUploadUrlForFrontend, uploadVideoToGCS } from '../services/videoService';
import { processVideoSubmission } from '../services/processingService';

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { patientProfile: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getExercises = async (req: Request, res: Response) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!patientProfile) {
      return res.status(404).json({ error: 'Perfil do paciente não encontrado' });
    }
    const exercises = await prisma.prescribedExercise.findMany({
      where: { patientId: patientProfile.id },
      include: { exercise: true },
    });
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const submitVideo = async (req: Request, res: Response) => {
  try {
    const { exerciseId, patientComments } = SubmitVideoSchema.parse(req.body);
    const { url: uploadUrl, destination } = await getUploadUrlForFrontend();

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!patientProfile) {
      return res.status(404).json({ error: 'Perfil do paciente não encontrado' });
    }

    const submission = await prisma.videoSubmission.create({
      data: {
        patientId: patientProfile.id,
        exerciseId,
        videoUrl: destination,
        patientComments: patientComments || null,
        status: 'PENDING',
      },
    });

    processVideoSubmission(submission.id);

    const response: Partial<typeof submission> = { ...submission };
    delete response.videoUrl;

    res.status(201).json({ message: 'Vídeo enviado com sucesso', submission: response, uploadUrl });
  } catch (error) {
    console.error('Error in submitVideo:', error);

    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getSubmissionHistory = async (req: Request, res: Response) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!patientProfile) {
      return res.status(404).json({ error: 'Perfil do paciente não encontrado' });
    }
    const submissions = await prisma.videoSubmission.findMany({
      where: { patientId: patientProfile.id },
      include: { report: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};