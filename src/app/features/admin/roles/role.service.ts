import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Menu, Permission, Role, RoleFilters, RoleRequest } from './role.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: RoleFilters): Promise<PagedResult<Role>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Role> }>(`${environment.apiUrl}/Roles`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: RoleRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Roles`, request));
  }

  update(roleId: number, request: RoleRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}`, request));
  }

  delete(roleId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}`));
  }

  async listAllPermissions(): Promise<Permission[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Permission> }>(`${environment.apiUrl}/Permissions`, {
        params: { pageNumber: 1, pageSize: 500 },
      })
    );
    return response.data.items;
  }

  async getPermissions(roleId: number): Promise<Permission[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: Permission[] }>(`${environment.apiUrl}/Roles/${roleId}/permissions`)
    );
    return response.data;
  }

  assignPermission(roleId: number, permissionId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.post<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}/permissions/${permissionId}`, {})
    );
  }

  removePermission(roleId: number, permissionId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.delete<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}/permissions/${permissionId}`)
    );
  }

  async listAllMenus(): Promise<Menu[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Menu> }>(`${environment.apiUrl}/Menus`, {
        params: { pageNumber: 1, pageSize: 500 },
      })
    );
    return response.data.items;
  }

  async getMenus(roleId: number): Promise<Menu[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: Menu[] }>(`${environment.apiUrl}/Roles/${roleId}/menus`)
    );
    return response.data;
  }

  assignMenu(roleId: number, menuId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.post<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}/menus/${menuId}`, {})
    );
  }

  removeMenu(roleId: number, menuId: number): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.delete<WriteResponse>(`${environment.apiUrl}/Roles/${roleId}/menus/${menuId}`)
    );
  }

  private cleanFilters(filters: RoleFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
