import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AuthResponse, LoginRequest } from './auth.models';

const STORAGE_KEY = 'auth';
const ACTIVE_ROLE_STORAGE_KEY = 'activeRole';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly session = signal<AuthResponse | null>(this.readStoredSession());
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly permissions = computed(() => this.session()?.permissions ?? []);
  readonly roles = computed(() => this.session()?.roles ?? []);

  /** Rol "activo" elegido por el usuario para esta sesión de UI (no afecta la autorización real del backend). */
  readonly activeRole = signal<string | null>(this.resolveActiveRole(this.session()?.roles ?? []));

  /** Permisos únicamente del rol activo — usado para filtrar el menú, no para autorización real. */
  readonly activeRolePermissions = computed(() => {
    const session = this.session();
    const role = this.activeRole();
    if (!session || !role) {
      return [];
    }
    return session.rolePermissions[role] ?? [];
  });

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/Auth/login`, request).pipe(
      map((response) => response.data),
      tap((session) => this.setSession(session))
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.session()?.refreshToken;
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/Auth/refresh`, { refreshToken })
      .pipe(
        map((response) => response.data),
        tap((session) => this.setSession(session))
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.session()?.refreshToken;
    this.clearSession();

    if (!refreshToken) {
      return of(undefined);
    }

    return this.http
      .post<void>(`${environment.apiUrl}/Auth/logout`, { refreshToken })
      .pipe(map(() => undefined));
  }

  getAccessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  hasPermission(code: string): boolean {
    return this.permissions().includes(code);
  }

  /** Para gating de UI (menú, botones) que debe respetar el rol activo, no todos los permisos combinados. */
  hasActiveRolePermission(code: string): boolean {
    return this.activeRolePermissions().includes(code);
  }

  setActiveRole(role: string): void {
    if (!this.roles().includes(role)) {
      return;
    }
    this.activeRole.set(role);
    sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
  }

  setSession(session: AuthResponse): void {
    this.session.set(session);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    const role = this.resolveActiveRole(session.roles);
    this.activeRole.set(role);
    if (role) {
      sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
    } else {
      sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    }
  }

  clearSession(): void {
    this.session.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    this.activeRole.set(null);
    sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  }

  private readStoredSession(): AuthResponse | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  }

  private resolveActiveRole(roles: string[]): string | null {
    const stored = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
    if (stored && roles.includes(stored)) {
      return stored;
    }
    return roles[0] ?? null;
  }
}
