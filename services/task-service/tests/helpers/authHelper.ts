import { sign } from 'jose';
import { TextEncoder } from 'util';

export class AuthTestHelper {
  private static secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'test-jwt-secret',
  );

  static async createValidToken(
    userId: string,
    email: string,
  ): Promise<string> {
    const payload = {
      sub: userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    };

    return await new sign(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(this.secret);
  }

  static async createExpiredToken(
    userId: string,
    email: string,
  ): Promise<string> {
    const payload = {
      sub: userId,
      email,
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 horas atrás
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hora atrás (expirado)
    };

    return await new sign(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(this.secret);
  }

  static createInvalidToken(): string {
    return 'invalid.jwt.token';
  }

  // Mock para el Auth Service
  static mockAuthServiceResponse(userId: string, email: string) {
    return {
      success: true,
      data: {
        user: {
          id: userId,
          email,
          firstName: 'Test',
          lastName: 'User',
          isActive: true,
        },
      },
    };
  }
}
