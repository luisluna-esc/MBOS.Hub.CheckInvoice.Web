export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  appUserId: number;
  username: string;
  email: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  roles: string[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
}

export interface ApiMessage {
  type: 'Success' | 'Error' | 'Warning';
  description: string;
}

export interface ApiResponse<T> {
  data: T;
  messages: ApiMessage[];
}
