import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Issue, IssueDetail, IssueEdit, IssueEditRequest, IssueFilters, IssueRequest, IssueSummary, IssueBatchRequest } from './issue.models';

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

  async getSummary(issueId: number): Promise<IssueSummary> {
    const response = await firstValueFrom(
      this.http.get<{ data: IssueSummary }>(`${environment.apiUrl}/Issues/${issueId}/summary`)
    );
    return response.data;
  }

  /** Solicita la corrección de una salida (la aprueba o rechaza el Contador). */
  requestEdit(request: IssueEditRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/IssueEdits`, request));
  }

  async listEdits(status?: string): Promise<IssueEdit[]> {
    const params: Record<string, string> = status ? { status } : {};
    const response = await firstValueFrom(
      this.http.get<{ data: IssueEdit[] }>(`${environment.apiUrl}/IssueEdits`, { params })
    );
    return response.data;
  }

  reviewEdit(changeRequestId: number, decision: 'approve' | 'reject', reviewNotes: string | null): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${environment.apiUrl}/IssueEdits/${changeRequestId}/${decision}`, { reviewNotes })
    );
  }

  create(request: IssueRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Issues`, request));
  }

  /** Salida por lote: devuelve el id del lote. */
  createBatch(request: IssueBatchRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/IssueBatches`, request));
  }

  /** Hoja de firmas de una salida por lote: una fila por pastor y la columna Firma para firmar a mano. */
  getBatchPdf(issueBatchId: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/issue-batch/${issueBatchId}/pdf`, { responseType: 'blob' })
    );
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
