import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { CreatePatientSchema, CreatePhysiotherapistSchema, AssignPhysiotherapistSchema, PrescribeExerciseSchema, UpdatePatientSchema, UpdatePhysiotherapistSchema, CreateExerciseSchema, UpdateExerciseSchema } from '../types';
import prisma from '../utils/prisma';

export const createPatient = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = CreatePatientSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Usuário inválido" });
    }

    const userId = req?.user?.id;
    const manager = await prisma.user.findUnique({ where: { id: userId } });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        clinicId: manager?.clinicId || null,
        password: hashedPassword,
        role: 'PATIENT',
      },
    });

    await prisma.patientProfile.create({
      data: { userId: user.id },
    });

    res.status(201).json({ message: 'Paciente criado com sucesso' });
  } catch (error) {
    console.error(error);

    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const createPhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = CreatePhysiotherapistSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Usuário inválido" });
    }

    const userId = req?.user?.id;
    const manager = await prisma.user.findUnique({ where: { id: userId } });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        clinicId: manager?.clinicId || null,
        password: hashedPassword,
        role: 'PHYSIOTHERAPIST',
      },
    });

    await prisma.physiotherapistProfile.create({
      data: { userId: user.id },
    });

    res.status(201).json({ message: 'Fisioterapeuta criado com sucesso' });
  } catch (error) {
    console.error(error);

    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const assignPhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { physiotherapistId } = AssignPhysiotherapistSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    console.log(patientId, physiotherapistId);

    await prisma.patientProfile.update({
      where: { id: patientId },
      data: { physiotherapistId },
    });

    res.json({ message: 'Fisioterapeuta atribuído com sucesso' });
  } catch (error) {
    console.error(error);

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

    await prisma.prescribedExercise.create({
      data: {
        patientId,
        exerciseId,
      },
    });

    res.status(201).json({ message: 'Exercício prescrito com sucesso' });
  } catch (error) {
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getPatients = async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.id;

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Gerente não associado a uma clínica' });
    }

    const patients = await prisma.patientProfile.findMany({
      where: {
        user: {
          clinicId: manager.clinicId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        physiotherapist: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getMetrics = async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.id;

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Gerente não associado a uma clínica' });
    }

    const clinicId = manager.clinicId;

    // Total patients and physiotherapists in the manager's clinic
    const [totalPatients, totalPhysiotherapists] = await Promise.all([
      prisma.user.count({ where: { role: 'PATIENT', clinicId } }),
      prisma.user.count({ where: { role: 'PHYSIOTHERAPIST', clinicId } }),
    ]);

    // Total exercises in the system
    const totalExercises = await prisma.exercise.count();

    // Prescribed exercises grouped by exercise (for this clinic)
    const prescribedGroups = await prisma.prescribedExercise.groupBy({
      by: ['exerciseId'],
      where: {
        patient: {
          user: {
            clinicId,
          },
        },
      },
      _count: {
        exerciseId: true,
      },
    });

    // Attach exercise names to groups
    const exerciseIds = prescribedGroups.map(g => g.exerciseId);
    const exercises = exerciseIds.length
      ? await prisma.exercise.findMany({ where: { id: { in: exerciseIds } }, select: { id: true, name: true } })
      : [];

    const exercisesByPrescription = prescribedGroups.map(g => ({
      exerciseId: g.exerciseId,
      exerciseName: exercises.find(e => e.id === g.exerciseId)?.name || null,
      prescribedCount: g._count.exerciseId,
    }));

    // Active submissions that were not reviewed (pending/processing/processed)
    const activeSubmissionsNotReviewed = await prisma.videoSubmission.count({
      where: {
        status: { not: 'REVIEWED' },
        patient: { user: { clinicId } },
      },
    });

    // Complete sessions already reviewed
    const completeSessionsReviewed = await prisma.videoSubmission.count({
      where: {
        status: 'REVIEWED',
        patient: { user: { clinicId } },
      },
    });

    return res.json({
      totalPatients,
      totalPhysiotherapists,
      totalExercises,
      exercisesByPrescription,
      activeSubmissionsNotReviewed,
      completeSessionsReviewed,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const updateData = UpdatePatientSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    const managerId = req.user!.id;
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Gerente não associado a uma clínica' });
    }

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { clinicId: true, role: true },
    });

    if (!patient || patient.role !== 'PATIENT' || patient.clinicId !== manager.clinicId) {
      return res.status(404).json({ error: 'Paciente não encontrado ou não pertence à sua clínica' });
    }

    const dataToUpdate: any = {};
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    await prisma.user.update({
      where: { id: patientId },
      data: dataToUpdate,
    });

    res.json({ message: 'Paciente atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getPhysiotherapists = async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.id;
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Gerente não associado a uma clínica' });
    }

    const physiotherapists = await prisma.physiotherapistProfile.findMany({
      where: {
        user: {
          clinicId: manager.clinicId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(physiotherapists);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const updatePhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { physioId } = req.params;
    const updateData = UpdatePhysiotherapistSchema.parse(req.body);

    if (!physioId) {
      return res.status(400).json({ error: 'ID do fisioterapeuta é obrigatório' });
    }

    const physiotherapist = await prisma.user.findUnique({
      where: { id: physioId },
      select: { role: true },
    });

    if (!physiotherapist || physiotherapist.role !== 'PHYSIOTHERAPIST') {
      return res.status(404).json({ error: 'Fisioterapeuta não encontrado' });
    }

    const dataToUpdate: any = {};
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    await prisma.user.update({
      where: { id: physioId },
      data: dataToUpdate,
    });

    res.json({ message: 'Fisioterapeuta atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getPhysiotherapistsProfileDropdown = async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.id;
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Gerente não associado a uma clínica' });
    }

    const physiotherapistsProfile = await prisma.physiotherapistProfile.findMany({
      where: {
        user: {
          clinicId: manager.clinicId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const dropdown = physiotherapistsProfile.map(profile => ({
      label: profile.user.name,
      value: profile.id,
    }));

    res.json(dropdown);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const createExercise = async (req: Request, res: Response) => {
  try {
    const { name, description, instructionsUrl, classificationData, animationData } = CreateExerciseSchema.parse(req.body);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Usuário inválido" });
    }

    const exercise = await prisma.exercise.create({
      data: {
        name,
        description,
        instructionsUrl,
        classificationData,
        animationData,
      },
    });

    // Reload exercises in pose service after creation
    const { reloadExercises } = await import('../services/poseService');
    await reloadExercises();

    res.status(201).json({ message: 'Exercício criado com sucesso', exercise });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const updateExercise = async (req: Request, res: Response) => {
  try {
    const { exerciseId } = req.params;
    const updateData = UpdateExerciseSchema.parse(req.body);

    if (!exerciseId) {
      return res.status(400).json({ error: 'ID do exercício é obrigatório' });
    }

    const dataToUpdate: any = {};
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.description) dataToUpdate.description = updateData.description;
    if (updateData.instructionsUrl) dataToUpdate.instructionsUrl = updateData.instructionsUrl;
    if (updateData.classificationData !== undefined) dataToUpdate.classificationData = updateData.classificationData;
    if (updateData.animationData !== undefined) dataToUpdate.animationData = updateData.animationData;

    await prisma.exercise.update({
      where: { id: exerciseId },
      data: dataToUpdate,
    });

    // Reload exercises in pose service after update
    const { reloadExercises } = await import('../services/poseService');
    await reloadExercises();

    res.json({ message: 'Exercício atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const deleteExercise = async (req: Request, res: Response) => {
  try {
    const { exerciseId } = req.params;

    if (!exerciseId) {
      return res.status(400).json({ error: 'ID do exercício é obrigatório' });
    }

    await prisma.exercise.delete({
      where: { id: exerciseId },
    });

    // Reload exercises in pose service after deletion
    const { reloadExercises } = await import('../services/poseService');
    await reloadExercises();

    res.json({ message: 'Exercício excluído com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Entrada inválida' });
  }
};

export const getExercises = async (req: Request, res: Response) => {
  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};