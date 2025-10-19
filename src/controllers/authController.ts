import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { LoginSchema } from '../types';
import prisma from '../utils/prisma';

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

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
};