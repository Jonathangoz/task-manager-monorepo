// src/core/domain/interfaces/IAuthService.ts
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
  sessionId: string;
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  username: string;
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface IAuthService {
  // Autenticación
  login(credentials: LoginCredentials, sessionInfo: SessionInfo): Promise<AuthResult>;
  register(data: RegisterData): Promise<User>;
  logout(userId: string, sessionId: string): Promise<void>;
  
  // Tokens
  refreshToken(refreshToken: string, sessionInfo: SessionInfo): Promise<AuthTokens>;
  validateAccessToken(token: string): Promise<TokenPayload>;
  revokeRefreshToken(tokenId: string): Promise<void>;
  revokeAllTokens(userId: string): Promise<void>;
  
  // Sesiones
  createSession(userId: string, sessionInfo: SessionInfo): Promise<string>;
  validateSession(sessionId: string): Promise<boolean>;
  terminateSession(sessionId: string): Promise<void>;
  terminateAllSessions(userId: string): Promise<void>;
  
  // Utilidades
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
}