import prisma from '../utils/prisma';
import { analyzeVideoWithAI } from './videoService';

export const processVideoSubmission = async (submissionId: string) => {
  try {
    // Update status to PROCESSING
    await prisma.videoSubmission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSING' },
    });

    // Get submission details
    const submission = await prisma.videoSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) return;

    // Simulate IA analysis
    const iaAnalysis = await analyzeVideoWithAI(submission.videoUrl);

    // Create report
    await prisma.report.create({
      data: {
        submissionId: submissionId,
        iaAnalysis,
      },
    });

    // Update status to PROCESSED
    await prisma.videoSubmission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSED' },
    });

    // TODO: Send notification to physiotherapist
    console.log(`Video ${submissionId} processed successfully`);
  } catch (error) {
    console.error('Error processing video:', error);
    // Update status to error state if needed
  }
};