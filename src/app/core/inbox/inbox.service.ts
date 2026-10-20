import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../i18n/language.service';
import { ToastService } from '../toast/toast.service';
import { PagedResult } from '../http/paged-result';
import { ReviewDocumentType } from '../review/document-review';

/** pending: lo que hay que hacer; answers: respuestas a lo que pedí o digité; signed: lo que firmé. */
export type InboxTab = 'pending' | 'answers' | 'signed';

export type InboxKind =
  | 'toVerify'
  | 'toApprove'
  | 'voidRequest'
  | 'receiptEdit'
  | 'issueEdit'
  | 'reviewApproved'
  | 'reviewRejected'
  | 'reviewSigned';

export interface InboxRow extends Record<string, unknown> {
  kind: InboxKind;
  documentType: ReviewDocumentType;
  documentId: number;
  number: string;
  detail: string | null;
  /** Respuestas: approved / rejected. Lo que firmé: verificado, aprobado, rechazado, reabierto, approved o rejected. */
  status: string | null;
  at: string;
  notificationKey: string | null;
  seen: boolean;
}

export interface InboxCounts {
  pending: number;
  unread: number;
  seen: number;
  signed: number;
  byKind: Partial<Record<InboxKind, number>>;
  canVerify: boolean;
  canApprove: boolean;
}

export interface InboxQuery {
  tab: InboxTab;
  kind?: string | null;
  documentType?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  pageNumber: number;
  pageSize: number;
}

/**
 * Roles con buzón: el Contador y el Tesorero firman; el Contador además autoriza; el Auxiliar
 * Contador recibe el resultado de sus anulaciones y correcciones.
 */
export const INBOX_ROLES = ['Auxiliar Contador', 'Contador', 'Tesorero', 'M-BOS'];

const REFRESH_MS = 30_000;

/**
 * Buzón: el contador del menú (pendientes + sin leer) se refresca cada 30 segundos. Cuando llegan
 * respuestas nuevas (una anulación o corrección aprobada o rechazada, un documento aprobado o
 * rechazado), avisa con un toast para que la persona revise su Buzón.
 */
@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  /** Respuestas sin leer en la última consulta (null = todavía no se consultó en esta sesión). */
  private lastUnread: number | null = null;

  readonly counts = signal<InboxCounts | null>(null);
  readonly actionCount = computed(() => (this.counts()?.pending ?? 0) + (this.counts()?.unread ?? 0));
  /** Con el rol activo (el buzón cambia al cambiar de rol). */
  readonly enabled = computed(() => INBOX_ROLES.includes(this.authService.activeRole() ?? ''));

  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) {
      return;
    }
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  async refresh(): Promise<InboxCounts | null> {
    if (!this.authService.isAuthenticated() || !this.enabled()) {
      this.counts.set(null);
      this.lastUnread = null;
      return null;
    }
    try {
      const response = await firstValueFrom(this.http.get<{ data: InboxCounts }>(`${environment.apiUrl}/Inbox/counts`));
      this.counts.set(response.data);
      this.notifyNewAnswers(response.data.unread);
      return response.data;
    } catch {
      return this.counts();
    }
  }

  /** Toast al entrar con respuestas sin leer, y cada vez que llegan respuestas nuevas. */
  private notifyNewAnswers(unread: number): void {
    const previous = this.lastUnread;
    this.lastUnread = unread;
    if (unread > 0 && (previous === null || unread > previous)) {
      const count = previous === null ? unread : unread - previous;
      this.toastService.info(
        this.languageService.t(previous === null ? 'inbox.toast.unread' : 'inbox.toast.new', { count }),
        this.languageService.t('inbox.toast.hint'),
        8000
      );
    }
  }

  async list(query: InboxQuery): Promise<PagedResult<InboxRow>> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = value as string | number;
      }
    }
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<InboxRow> }>(`${environment.apiUrl}/Inbox`, { params })
    );
    return response.data;
  }

  /** Marca notificaciones como vistas (sin claves: todas las sin leer). */
  async markSeen(keys?: string[]): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/Inbox/seen`, { keys: keys ?? null }));
    await this.refresh();
  }
}
