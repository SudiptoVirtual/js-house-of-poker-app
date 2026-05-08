import { apiRequest } from './client';

export type AuthUser = {
  avatar?: string;
  chips: number;
  email: string;
  id: string;
  isOnline?: boolean;
  lastLoginAt?: string | null;
  name: string;
  phone: string;
  status: string;
  walletBalance: number;
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

type LoginUserInput = {
  email: string;
  password: string;
};

type RegisterUserInput = {
  email: string;
  name: string;
  password: string;
  phone: string;
};

export async function loginUser({ email, password }: LoginUserInput) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    body: {
      email: email.trim(),
      password,
    },
    method: 'POST',
  });
}

export async function registerUser({ email, name, password, phone }: RegisterUserInput) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    body: {
      email: email.trim(),
      name: name.trim(),
      password,
      phone: phone.trim(),
    },
    method: 'POST',
  });
}

export async function authenticateWithGoogle(idToken: string) {
  return apiRequest<AuthResponse>('/api/auth/google', {
    body: { idToken },
    method: 'POST',
  });
}
