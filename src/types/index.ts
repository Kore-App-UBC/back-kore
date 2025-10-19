import { z } from 'zod';

export const Role = z.enum(['PATIENT', 'PHYSIOTHERAPIST', 'MANAGER']);
export type Role = z.infer<typeof Role>;

export const SubmissionStatus = z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'REVIEWED']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const CreatePatientSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
});

export const CreatePhysiotherapistSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
});

export const AssignPhysiotherapistSchema = z.object({
  physiotherapistId: z.string().cuid(),
});

export const PrescribeExerciseSchema = z.object({
  exerciseId: z.string().cuid(),
});

export const SubmitVideoSchema = z.object({
  exerciseId: z.string().cuid(),
  patientComments: z.string().optional(),
});

export const FeedbackSchema = z.object({
  physioFeedback: z.string().min(1),
});

export const UpdatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
});

export const UpdatePhysiotherapistSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
});
