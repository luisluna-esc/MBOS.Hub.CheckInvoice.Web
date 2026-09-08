export interface AppUser extends Record<string, unknown> {
  appUserId: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  isActive: boolean;
}

export interface AppUserRequest {
  appUserId: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password?: string | null;
  isActive: boolean;
}

export interface AppUserFilters {
  appUserId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}
