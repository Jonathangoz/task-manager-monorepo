import { CreateUserData } from '@/core/interfaces/IUserRepository';
import { LoginCredentials, RegisterData } from '@/core/interfaces/IAuthService';

export const userFixtures = {
  validUser: {
    email: 'john.doe@example.com',
    username: 'johndoe',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe'
  } as CreateUserData,

  validUser2: {
    email: 'jane.smith@example.com',
    username: 'janesmith',
    password: 'AnotherPass456!',
    firstName: 'Jane',
    lastName: 'Smith'
  } as CreateUserData,

  invalidUsers: {
    invalidEmail: {
      email: 'invalid-email',
      username: 'testuser',
      password: 'Password123!'
    },
    shortPassword: {
      email: 'test@example.com',
      username: 'testuser',
      password: '123'
    },
    invalidUsername: {
      email: 'test@example.com',
      username: 'a',
      password: 'Password123!'
    }
  }
};

export const authFixtures = {
  validLogin: {
    email: 'john.doe@example.com',
    password: 'SecurePass123!'
  } as LoginCredentials,

  invalidLogin: {
    email: 'john.doe@example.com',
    password: 'wrongpassword'
  } as LoginCredentials,

  validRegister: {
    email: 'newuser@example.com',
    username: 'newuser',
    password: 'NewPassword123!',
    firstName: 'New',
    lastName: 'User'
  } as RegisterData
};

export const sessionFixtures = {
  validSessionInfo: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    device: 'desktop',
    location: 'Colombia'
  }
};

export const tokenFixtures = {
  validTokenPayload: {
    sub: 'user-id-123',
    email: 'test@example.com',
    username: 'testuser',
    sessionId: 'session-123'
  },
  
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid',
  
  invalidToken: 'invalid.token.here'
};