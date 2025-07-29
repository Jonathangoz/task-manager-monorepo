// src/core/domain/interfaces/ITokenService.ts
import { TokenPayload, RefreshTokenPayload } from '@/core/interfaces/IAuthService';

export interface TokenOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

export interface RefreshTokenData {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export interface ITokenService {
  // Access Tokens
  generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>, options?: TokenOptions): Promise<string>;
  validateAccessToken(token: string): Promise<TokenPayload>;
  
  // Refresh Tokens
  generateRefreshToken(userId: string, sessionId: string, options?: TokenOptions): Promise<RefreshTokenData>;
  validateRefreshToken(token: string): Promise<RefreshTokenPayload>;
  
  // JWE (Encrypted tokens)
  encryptToken(token: string): Promise<string>;
  decryptToken(encryptedToken: string): Promise<string>;
  
  // Utilidades
  extractTokenFromHeader(authHeader: string): string | null;
  isTokenExpired(token: string): boolean;
  getTokenExpirationTime(expiresIn: string): number;
}

export default ITokenService;