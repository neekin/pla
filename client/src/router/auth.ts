const AUTH_TOKEN_KEY = 'gp_auth_token';
const PERMISSIONS_KEY = 'gp_permissions';
const USER_KEY = 'gp_user';

export interface SessionUser {
  userId: string;
  username: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export function setAuthSession(options: {
  token: string;
  user?: SessionUser;
  permissions?: string[];
  remember?: boolean;
}) {
  const { token, user, permissions = [], remember = true } = options;
  const storage = remember ? localStorage : sessionStorage;

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(PERMISSIONS_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(PERMISSIONS_KEY);
  sessionStorage.removeItem(USER_KEY);

  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

  if (user) {
    storage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(PERMISSIONS_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(PERMISSIONS_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(
    localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY),
  );
}

export function getPermissions() {
  const raw =
    localStorage.getItem(PERMISSIONS_KEY) ||
    sessionStorage.getItem(PERMISSIONS_KEY) ||
    '[]';

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function getAccessToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthorizationHeader() {
  const token = getAccessToken();
  return token ? `Bearer ${token}` : undefined;
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: SessionUser) {
  if (localStorage.getItem(AUTH_TOKEN_KEY)) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(user.permissions));
    return;
  }

  if (sessionStorage.getItem(AUTH_TOKEN_KEY)) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(PERMISSIONS_KEY, JSON.stringify(user.permissions));
  }
}

export function hasPermissions(requiredPermissions: string[]) {
  if (!requiredPermissions.length) {
    return true;
  }

  const currentPermissions = getPermissions();
  return requiredPermissions.every((permission) =>
    currentPermissions.includes(permission),
  );
}
