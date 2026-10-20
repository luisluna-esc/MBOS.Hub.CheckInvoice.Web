import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import {
  Receipt,
  ReceiptDetail,
  ReceiptEdit,
  ReceiptEditRequest,
  ReceiptFilters,
  ReceiptRequest,
  ReceiptReturnRequest,
  ReceiptSummary,
  ReturnableIssueLine,
} from './receipt.models';

interface CreateResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: ReceiptFilters): Promise<PagedResult<Receipt>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Receipt> }>(`${environment.apiUrl}/Receipts`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  async getDetails(receiptId: number): Promise<ReceiptDetail[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: ReceiptDetail[] }>(`${environment.apiUrl}/Receipts/${receiptId}/details`)
    );
    return response.data;
  }

  async getSummary(receiptId: number): Promise<ReceiptSummary> {
    const response = await firstValueFrom(
      this.http.get<{ data: ReceiptSummary }>(`${environment.apiUrl}/Receipts/${receiptId}/summary`)
    );
    return response.data;
  }

  /** Solicita la corrección de una entrada (la aprueba o rechaza el Contador). */
  requestEdit(request: ReceiptEditRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/ReceiptEdits`, request));
  }

  async listEdits(status?: string): Promise<ReceiptEdit[]> {
    const params: Record<string, string> = status ? { status } : {};
    const response = await firstValueFrom(
      this.http.get<{ data: ReceiptEdit[] }>(`${environment.apiUrl}/ReceiptEdits`, { params })
    );
    return response.data;
  }

  reviewEdit(changeRequestId: number, decision: 'approve' | 'reject', reviewNotes: string | null): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${environment.apiUrl}/ReceiptEdits/${changeRequestId}/${decision}`, { reviewNotes })
    );
  }

  create(request: ReceiptRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Receipts`, request));
  }

  async getReturnableLines(issueId: number): Promise<ReturnableIssueLine[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: ReturnableIssueLine[] }>(`${environment.apiUrl}/Receipts/returnable-lines/${issueId}`)
    );
    return response.data;
  }

  createReturn(request: ReceiptReturnRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Receipts/returns`, request));
  }

  private cleanFilters(filters: ReceiptFilters): Record<string, string | number> {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
