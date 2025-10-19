import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/utils/prisma';
import * as jwt from 'jsonwebtoken';

describe('Patient Routes', () => {
  let patientToken: string;
  let userId: string;
  let patientProfileId: string;

  beforeAll(async () => {
    // Create a test patient
    const patient = await prisma.user.create({
      data: {
        name: 'Test Patient',
        email: 'patient@test.com',
        password: 'hashedpassword',
        role: 'PATIENT',
      },
      include: { patientProfile: true },
    });
    userId = patient.id;

    // Create patient profile separately
    const patientProfile = await prisma.patientProfile.create({
      data: {
        userId: userId,
      },
    });
    patientProfileId = patientProfile.id;

    // Generate JWT token
    patientToken = jwt.sign(
      { id: userId, role: 'PATIENT' },
      process.env.JWT_SECRET || 'testsecret'
    );
  });

  afterAll(async () => {
    // Clean up
    await prisma.report.deleteMany({ where: { submission: { patientId: patientProfileId } } });
    await prisma.videoSubmission.deleteMany({ where: { patientId: patientProfileId } });
    await prisma.prescribedExercise.deleteMany({ where: { patientId: patientProfileId } });
    await prisma.patientProfile.deleteMany({ where: { id: patientProfileId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  describe('GET /patient/me', () => {
    it('should return patient profile when authenticated', async () => {
      const response = await request(app)
        .get('/patient/me')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('name', 'Test Patient');
      expect(response.body).toHaveProperty('patientProfile');
    });

    it('should return 401 when no token provided', async () => {
      const response = await request(app).get('/patient/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access denied. No token provided.');
    });

    it('should return 403 when wrong role', async () => {
      const wrongToken = jwt.sign(
        { id: 'someid', role: 'PHYSIOTHERAPIST' },
        process.env.JWT_SECRET || 'testsecret'
      );

      const response = await request(app)
        .get('/patient/me')
        .set('Authorization', `Bearer ${wrongToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied. Insufficient permissions.');
    });
  });

  describe('GET /patient/exercises', () => {
    let exerciseId: string;

    beforeAll(async () => {
      // Create a test exercise
      const exercise = await prisma.exercise.create({
        data: {
          name: 'Test Exercise',
          description: 'A test exercise',
          instructionsUrl: 'https://example.com/instructions',
        },
      });
      exerciseId = exercise.id;

      // Prescribe exercise to patient
      await prisma.prescribedExercise.create({
        data: {
          patientId: patientProfileId,
          exerciseId,
        },
      });
    });

    afterAll(async () => {
      await prisma.prescribedExercise.deleteMany({ where: { patientId: patientProfileId } });
      await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    });

    it('should return prescribed exercises', async () => {
      const response = await request(app)
        .get('/patient/exercises')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('exercise');
      expect(response.body[0].exercise).toHaveProperty('name', 'Test Exercise');
    });

  });

  describe('POST /patient/submissions', () => {
    let exerciseId: string;

    beforeAll(async () => {
      // Create a test exercise
      const exercise = await prisma.exercise.create({
        data: {
          name: 'Submission Test Exercise',
          description: 'For testing submissions',
          instructionsUrl: 'https://example.com/instructions',
        },
      });
      exerciseId = exercise.id;
    });

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { submission: { patientId: patientProfileId } } });
      await prisma.videoSubmission.deleteMany({ where: { patientId: patientProfileId } });
      await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    });

    it('should create a video submission', async () => {
      const response = await request(app)
        .post('/patient/submissions')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('exerciseId', exerciseId)
        .field('patientComments', 'Test comment')
        .attach('videoFile', Buffer.from('fake video content'), 'test.mp4');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Video submitted successfully');
      expect(response.body).toHaveProperty('submission');
      expect(response.body.submission).toHaveProperty('patientId', patientProfileId);
      expect(response.body.submission).toHaveProperty('exerciseId', exerciseId);
      expect(response.body.submission).toHaveProperty('status', 'PENDING');
    });

    it('should return 400 when no file provided', async () => {
      const response = await request(app)
        .post('/patient/submissions')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('exerciseId', exerciseId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Video file is required');
    });
  });

  describe('GET /patient/submissions/history', () => {
    let submissionId: string;
    let exerciseId: string;

    beforeAll(async () => {
      // Create a test exercise
      const exercise = await prisma.exercise.create({
        data: {
          name: 'History Test Exercise',
          description: 'For testing history',
          instructionsUrl: 'https://example.com/instructions',
        },
      });
      exerciseId = exercise.id;

      // Create a test submission
      const submission = await prisma.videoSubmission.create({
        data: {
          patientId: patientProfileId,
          exerciseId,
          videoUrl: 'https://example.com/test.mp4',
          status: 'PENDING',
        },
      });
      submissionId = submission.id;
    });

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { submissionId } });
      await prisma.videoSubmission.deleteMany({ where: { id: submissionId } });
      await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    });

    it('should return submission history', async () => {
      const response = await request(app)
        .get('/patient/submissions/history')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id', submissionId);
      expect(response.body[0]).toHaveProperty('patientId', patientProfileId);
    });
  });
});