import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Issue, IssueDetail, IssueFilters, IssueRequest } from './issue.models';

interface CreateResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class IssueService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: IssueFilters): Promise<PagedResult<Issue>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Issue> }>(`${environment.apiUrl}/Issues`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  async getDetails(issueId: number): Promise<IssueDetail[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: IssueDetail[] }>(`${environment.apiUrl}/Issues/${issueId}/details`)
    );
    return response.data;
  }

  create(request: IssueRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Issues`, request));
  }

  private cleanFilters(filters: IssueFilters): Record<string, string | number> {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
