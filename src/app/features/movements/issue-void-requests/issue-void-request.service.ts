import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import {
  IssueVoidRequest,
  IssueVoidRequestCreate,
  IssueVoidRequestFilters,
  IssueVoidRequestReview,
} from './issue-void-request.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class IssueVoidRequestService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: IssueVoidRequestFilters): Promise<PagedResult<IssueVoidRequest>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<IssueVoidRequest> }>(`${environment.apiUrl}/IssueVoidRequests`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: IssueVoidRequestCreate): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/IssueVoidRequests`, request));
  }

  approve(id: number, review: IssueVoidRequestReview): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/IssueVoidRequests/${id}/approve`, review));
  }

  reject(id: number, review: IssueVoidRequestReview): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/IssueVoidRequests/${id}/reject`, review));
  }

  private cleanFilters(filters: IssueVoidRequestFilters): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value as string;
      }
    }
    return clean;
  }
}
