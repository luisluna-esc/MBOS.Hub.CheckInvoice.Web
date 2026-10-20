import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Documentos de almacén que pasan por revisión y firma digital. */
export type ReviewDocumentType = 'receipt' | 'issue' | 'transfer';

/** digitado -> verificado -> aprobado; rechazar o reabrir vuelve a digitado con una versión nueva. */
/** "anterior": registrado antes de la firma digital (no entra al buzón, se puede verificar). */
export type ReviewStatus = 'digitado' | 'verificado' | 'aprobado' | 'anterior';

/** Aprueban, rechazan o reabren (igual que las anulaciones). */
export const APPROVER_ROLES = ['Contador', 'M-BOS'];

/** Verifican y firman: el Contador y el Tesorero (el Auxiliar Contador no). */
export const VERIFIER_ROLES = ['Contador', 'Tesorero', 'M-BOS'];

export interface DocumentReviewEntry {
  version: number;
  action: 'digitado' | 'verificado' | 'aprobado' | 'rechazado' | 'reabierto' | 'corregido';
  userName: string | null;
  userEmail: string | null;
  at: string;
  reason: string | null;
  /** Código de la firma digital (null en "digitado"). */
  signatureCode: string | null;
  /** Firmas de la versión vigente: false si el documento cambió después de firmado. */
  signatureValid: boolean | null;
}

export interface DocumentReview {
  status: ReviewStatus;
  version: number;
  isVoided: boolean;
  entries: DocumentReviewEntry[];
}

export type SignAction = 'verify' | 'approve' | 'reject' | 'reopen';

@Injectable({ providedIn: 'root' })
export class DocumentReviewService {
  private readonly http = inject(HttpClient);

  private url(type: ReviewDocumentType, id: number): string {
    return `${environment.apiUrl}/DocumentReviews/${type}/${id}`;
  }

  async get(type: ReviewDocumentType, id: number): Promise<DocumentReview> {
    const response = await firstValueFrom(this.http.get<{ data: DocumentReview }>(this.url(type, id)));
    return response.data;
  }

  /** Firma un paso con la contraseña de quien firma (motivo obligatorio al rechazar o reabrir). */
  sign(type: ReviewDocumentType, id: number, action: SignAction, password: string, reason?: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url(type, id)}/${action}`, { password, reason: reason || null }));
  }
}
