import type { Role } from "./types/index";

declare global {
  namespace Express {
    interface Request {
      user?: {
          id: string;
          role: Role;
      };
    }
  }
}