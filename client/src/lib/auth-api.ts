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
  };
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
    throw new Error('LOGIN_FAILED');
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
