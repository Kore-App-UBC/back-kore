import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs/promises';
import { loadGCSCredentialsJson } from '../utils/tools';

const bucketName = process.env.GCS_BUCKET_NAME;
const storage = new Storage({ credentials: loadGCSCredentialsJson() });

export const uploadVideoToGCS = async (file: Express.Multer.File): Promise<string> => {
  if (!bucketName) {
    throw new Error('No bucket configured. Set GCS_BUCKET_NAME in env.');
  }

  // Destination filename in GCS
  const destination = `${Date.now()}_${path.basename(file.path || file.originalname || 'video.mp4')}`;
  const bucket = storage.bucket(bucketName);

  // If multer stored the file to disk, use the path. Otherwise handle memory buffer.
  const filePath = file.path;
  if (filePath) {
    await bucket.upload(filePath, {
      destination,
      metadata: { contentType: file.mimetype || 'video/mp4' },
    });

    // remove local temporary file
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // ignore unlink errors
    }
  } else if (file.buffer) {
    // write to a temp file and upload
    const tmpPath = path.join('/tmp', destination);
    await fs.writeFile(tmpPath, file.buffer);
    await bucket.upload(tmpPath, {
      destination,
      metadata: { contentType: file.mimetype || 'video/mp4' },
    });
    try {
      await fs.unlink(tmpPath);
    } catch (err) {}
  } else {
    throw new Error('Uploaded file has no path or buffer');
  }

  return destination;
};

export const analyzeVideoWithAI = async (videoUrl: string): Promise<any> => {
  // TODO: Call IA service
  return {
    accuracy: 85,
    corrections: ['Improve posture', 'Extend range of motion'],
  };
};

export const getSignedUrlForVideo = async (
  destination: string,
  expiresInMs = 15 * 60 * 1000,
): Promise<string> => {
  if (!bucketName) {
    throw new Error('No bucket configured. Set GCS_BUCKET_NAME in env.');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destination);

  // getSignedUrl may return a string or an array depending on client version; handle both.
  const urlOrArray = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMs,
  } as any);

  if (Array.isArray(urlOrArray)) {
    return urlOrArray[0];
  }

  return urlOrArray as string;
};

export const getUploadUrlForFrontend = async (
  originalName = 'video.mp4',
  contentType = 'video/mp4',
  expiresInMs = 15 * 60 * 1000,
): Promise<{ url: string; destination: string }> => {
  if (!bucketName) {
    throw new Error('No bucket configured. Set GCS_BUCKET_NAME in env.');
  }

  const destination = `${Date.now()}_${path.basename(originalName || 'video.mp4')}`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destination);

  const urlOrArray = await file.getSignedUrl({
    action: 'write',
    expires: Date.now() + expiresInMs,
    contentType,
  });

  const url = Array.isArray(urlOrArray) ? urlOrArray[0] : (urlOrArray as unknown as string);

  return { url, destination };
};