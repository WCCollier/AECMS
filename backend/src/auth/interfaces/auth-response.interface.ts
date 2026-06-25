export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    emailVerified?: boolean;
  };
}

export interface AdminLoginResponse {
  requiresTwoFactor: boolean;
  twoFactorSetupRequired?: boolean;
  preAuthToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: AuthResponse['user'];
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
  scope?: string;         // 'pre_2fa' for pre-auth tokens
  session_type?: 'customer' | 'backstage';
}
