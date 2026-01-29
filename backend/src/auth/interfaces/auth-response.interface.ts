import { UserRole } from '@prisma/client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}
