import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to the database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from the database
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up database after each test
  await prisma.report.deleteMany();
  await prisma.videoSubmission.deleteMany();
  await prisma.prescribedExercise.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.physiotherapistProfile.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.user.deleteMany();
});