import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { LoginSchema } from '../types';
import prisma from '../utils/prisma';

const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_TTL_DAYS = 30;

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

    // create refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    res.json({ token, refreshToken });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

    const tokenRecord = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!tokenRecord) return res.status(401).json({ error: 'Invalid refresh token' });
    if (tokenRecord.revoked) return res.status(401).json({ error: 'Refresh token revoked' });
    if (tokenRecord.expiresAt < new Date()) return res.status(401).json({ error: 'Refresh token expired' });

    const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
    if (!user) return res.status(401).json({ error: 'User not found for token' });

    // issue new access token
    const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

    // rotate refresh token: create a new one and revoke the old
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id, expiresAt: newExpiresAt } });
    await prisma.refreshToken.update({ where: { id: tokenRecord.id }, data: { revoked: true, replacedBy: newRefreshToken } });

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
};