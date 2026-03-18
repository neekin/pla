import { getAuthorizationHeader, type SessionUser } from '../router/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: {
    userId: string;
    username: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    requiresPasswordReset: boolean;
  };
}

export interface ResetPasswordPayload {
  newPassword: string;
}

export interface SelfServiceResetPasswordPayload {
  username: string;
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
  user: SessionUser;
}

export interface ProfileResponse {
  user: SessionUser;
  platform: {
    mode: string;
    message: string;
  };
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function requireAuthHeader() {
  const authorization = getAuthorizationHeader();

  if (!authorization) {
    throw new Error('UNAUTHORIZED');
  }

  return authorization;
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const normalizedMessage = Array.isArray(err.message)
      ? err.message[0]
      : err.message;

    throw new Error(normalizedMessage ?? 'LOGIN_FAILED');
  }

  return response.json() as Promise<LoginResponse>;
}

export async function profileRequest(): Promise<ProfileResponse> {
  const authorization = requireAuthHeader();

  const response = await fetch(buildUrl('/auth/profile'), {
    method: 'GET',
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error('PROFILE_FAILED');
  }

  return response.json() as Promise<ProfileResponse>;
}

export async function resetPasswordRequest(
  payload: ResetPasswordPayload,
): Promise<ResetPasswordResponse> {
  const response = await fetch(buildUrl('/auth/password-reset'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'RESET_PASSWORD_FAILED');
  }

  return response.json() as Promise<ResetPasswordResponse>;
}

export async function resetPasswordSelfServiceRequest(
  payload: SelfServiceResetPasswordPayload,
): Promise<ResetPasswordResponse> {
  const response = await fetch(buildUrl('/auth/password-reset/self-service'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const normalizedMessage = Array.isArray(err.message) ? err.message[0] : err.message;
    throw new Error(normalizedMessage ?? 'RESET_PASSWORD_FAILED');
  }

  return response.json() as Promise<ResetPasswordResponse>;
}
