import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { AccountReceivable, AccountReceivableFilters, Payment, PaymentCreate } from './account-receivable.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class AccountReceivableService {
  private readonly http = inject(HttpClient);

  async list(
    pageNumber: number,
    pageSize: number,
    filters: AccountReceivableFilters
  ): Promise<PagedResult<AccountReceivable>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<AccountReceivable> }>(`${environment.apiUrl}/AccountReceivables`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  async listPayments(accountReceivableId: number): Promise<Payment[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Payment> }>(`${environment.apiUrl}/Payments`, {
        params: { pageNumber: 1, pageSize: 100, accountReceivableId },
      })
    );
    return response.data.items;
  }

  createPayment(payment: PaymentCreate): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Payments`, payment));
  }

  private cleanFilters(filters: AccountReceivableFilters): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value as string;
      }
    }
    return clean;
  }
}
