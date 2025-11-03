import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
    role?: string;
    tenantId?: string;
    [key: string]: unknown;
  };
}
