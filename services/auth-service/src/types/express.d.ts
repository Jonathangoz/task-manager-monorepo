// src/types/express.d.ts
import { TokenPayload } from '@/core/domain/interfaces/IAuthService';

declare global {
  namespace Express {
    export interface Request {
      auth: TokenPayload; // O el tipo que corresponda a tu payload
    }
  }
}