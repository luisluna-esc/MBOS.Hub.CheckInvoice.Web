import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Role } from '../roles/role.models';
import { AppUser, AppUserFilters, AppUserRequest } from './app-user.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class AppUserService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: AppUserFilters): Promise<PagedResult<AppUser>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<AppUser> }>(`${environment.apiUrl}/AppUsers`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: AppUserRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/AppUsers`, request));
  }

  update(appUserId: number, request: AppUserRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/AppUsers/${appUserId}`, request));
  }

  delete(appUserId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/AppUsers/${appUserId}`));
  }

  async getRoles(appUserId: number): Promise<Role[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: Role[] }>(`${environment.apiUrl}/AppUsers/${appUserId}/roles`)
    );
    return response.data;
  }

  assignRole(appUserId: number, roleId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.post<WriteResponse>(`${environment.apiUrl}/AppUsers/${appUserId}/roles/${roleId}`, {})
    );
  }

  removeRole(appUserId: number, roleId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.delete<WriteResponse>(`${environment.apiUrl}/AppUsers/${appUserId}/roles/${roleId}`)
    );
  }

  private cleanFilters(filters: AppUserFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
