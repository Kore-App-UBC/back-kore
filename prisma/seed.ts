import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hash passwords
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Example Clinic',
    },
  });

  // Create users with different roles
  const patient = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'patient@example.com',
      password: hashedPassword,
      role: 'PATIENT',
    },
  });

  const physiotherapist = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'physio@example.com',
      password: hashedPassword,
      role: 'PHYSIOTHERAPIST',
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Bob Johnson',
      email: 'manager@example.com',
      password: hashedPassword,
      role: 'MANAGER',
      clinicId: clinic.id,
    },
  });

  console.log('Clinic and users created:', { clinic, patient, physiotherapist, manager });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });