// src/core/domain/interfaces/ITokenService.ts
export interface SessionInfo {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
}

export interface TokenOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

export interface ITokenService {
  // Access Tokens
  generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>, options?: TokenOptions): Promise<string>;
  validateAccessToken(token: string): Promise<TokenPayload>;
  
  // Refresh Tokens
  generateRefreshToken(userId: string, sessionId: string, options?: TokenOptions): Promise<{
    token: string;
    tokenId: string;
    expiresAt: Date;
  }>;
  validateRefreshToken(token: string): Promise<RefreshTokenPayload>;
  
  // JWE (Encrypted tokens)
  encryptToken(token: string): Promise<string>;
  decryptToken(encryptedToken: string): Promise<string>;
  
  // Utilidades
  extractTokenFromHeader(authHeader: string): string | null;
  isTokenExpired(token: string): boolean;
  getTokenExpirationTime(expiresIn: string): number;
}