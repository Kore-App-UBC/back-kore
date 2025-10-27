import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { CreatePatientSchema, CreatePhysiotherapistSchema, AssignPhysiotherapistSchema, PrescribeExerciseSchema, UpdatePatientSchema, UpdatePhysiotherapistSchema, CreateExerciseSchema, UpdateExerciseSchema } from '../types';
import prisma from '../utils/prisma';

export const createPatient = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = CreatePatientSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Invalid user" });
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

    res.status(201).json({ message: 'Patient created successfully' });
  } catch (error) {
    console.error(error);

    res.status(400).json({ error: 'Invalid input' });
  }
};

export const createPhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = CreatePhysiotherapistSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Invalid user" });
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

    res.status(201).json({ message: 'Physiotherapist created successfully' });
  } catch (error) {
    console.error(error);

    res.status(400).json({ error: 'Invalid input' });
  }
};

export const assignPhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { physiotherapistId } = AssignPhysiotherapistSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    console.log(patientId, physiotherapistId);

    await prisma.patientProfile.update({
      where: { id: patientId },
      data: { physiotherapistId },
    });

    res.json({ message: 'Physiotherapist assigned successfully' });
  } catch (error) {
    console.error(error);

    res.status(400).json({ error: 'Invalid input' });
  }
};

export const prescribeExercise = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { exerciseId } = PrescribeExerciseSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    await prisma.prescribedExercise.create({
      data: {
        patientId,
        exerciseId,
      },
    });

    res.status(201).json({ message: 'Exercise prescribed successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
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
      return res.status(400).json({ error: 'Manager not associated with a clinic' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMetrics = async (req: Request, res: Response) => {
  // Placeholder for metrics logic
  res.json({ message: 'Metrics endpoint - placeholder' });
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const updateData = UpdatePatientSchema.parse(req.body);

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const managerId = req.user!.id;
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { clinicId: true },
    });

    if (!manager || !manager.clinicId) {
      return res.status(400).json({ error: 'Manager not associated with a clinic' });
    }

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { clinicId: true, role: true },
    });

    if (!patient || patient.role !== 'PATIENT' || patient.clinicId !== manager.clinicId) {
      return res.status(404).json({ error: 'Patient not found or not in your clinic' });
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

    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid input' });
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
      return res.status(400).json({ error: 'Manager not associated with a clinic' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePhysiotherapist = async (req: Request, res: Response) => {
  try {
    const { physioId } = req.params;
    const updateData = UpdatePhysiotherapistSchema.parse(req.body);

    if (!physioId) {
      return res.status(400).json({ error: 'Physiotherapist ID is required' });
    }

    const physiotherapist = await prisma.user.findUnique({
      where: { id: physioId },
      select: { role: true },
    });

    if (!physiotherapist || physiotherapist.role !== 'PHYSIOTHERAPIST') {
      return res.status(404).json({ error: 'Physiotherapist not found' });
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

    res.json({ message: 'Physiotherapist updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid input' });
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
      return res.status(400).json({ error: 'Manager not associated with a clinic' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createExercise = async (req: Request, res: Response) => {
  try {
    const { name, description, instructionsUrl, classificationData, animationData } = CreateExerciseSchema.parse(req.body);

    if (req?.user?.role !== "MANAGER") {
      return res.status(400).json({ error: "Invalid user" });
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

    res.status(201).json({ message: 'Exercise created successfully', exercise });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid input' });
  }
};

export const updateExercise = async (req: Request, res: Response) => {
  try {
    const { exerciseId } = req.params;
    const updateData = UpdateExerciseSchema.parse(req.body);

    if (!exerciseId) {
      return res.status(400).json({ error: 'Exercise ID is required' });
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

    res.json({ message: 'Exercise updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid input' });
  }
};

export const deleteExercise = async (req: Request, res: Response) => {
  try {
    const { exerciseId } = req.params;

    if (!exerciseId) {
      return res.status(400).json({ error: 'Exercise ID is required' });
    }

    await prisma.exercise.delete({
      where: { id: exerciseId },
    });

    // Reload exercises in pose service after deletion
    const { reloadExercises } = await import('../services/poseService');
    await reloadExercises();

    res.json({ message: 'Exercise deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid input' });
  }
};

export const getExercises = async (req: Request, res: Response) => {
  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};