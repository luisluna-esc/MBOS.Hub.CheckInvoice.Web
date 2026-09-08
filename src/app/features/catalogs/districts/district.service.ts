import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { District, DistrictFilters, DistrictRequest } from './district.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class DistrictService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: DistrictFilters): Promise<PagedResult<District>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<District> }>(`${environment.apiUrl}/Districts`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: DistrictRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Districts`, request));
  }

  update(districtId: number, request: DistrictRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/Districts/${districtId}`, request));
  }

  delete(districtId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/Districts/${districtId}`));
  }

  private cleanFilters(filters: DistrictFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
