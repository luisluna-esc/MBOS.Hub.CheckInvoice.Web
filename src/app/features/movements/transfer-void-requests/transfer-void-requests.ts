import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { CatalogService, VoidReasonItem } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { APPROVER_ROLES } from '../../../core/review/document-review';
import { ToastService } from '../../../core/toast/toast.service';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LoadingSkeleton } from '../../../shared/components/loading-skeleton/loading-skeleton';

export interface TransferVoidRequest {
  transferVoidRequestId: number;
  transferId: number;
  transferDate: string;
  sourceWarehouseName: string | null;
  destinationWarehouseName: string | null;
  total: number;
  voidReasonName: string | null;
  detail: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requestedByName: string | null;
  requestedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

@Injectable({ providedIn: 'root' })
export class TransferVoidRequestService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/TransferVoidRequests`;

  async list(status?: string): Promise<TransferVoidRequest[]> {
    const params: Record<string, string> = status ? { status } : {};
    const response = await firstValueFrom(this.http.get<{ data: TransferVoidRequest[] }>(this.url, { params }));
    return response.data;
  }

  create(request: { transferId: number; voidReasonId: number; detail: string | null }): Promise<unknown> {
    return firstValueFrom(this.http.post(this.url, request));
  }

  review(id: number, decision: 'approve' | 'reject', reviewNotes: string | null): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.url}/${id}/${decision}`, { reviewNotes }));
  }
}

export interface TransferVoidRequestDialogData {
  transferId: number;
}

/** Pedir la anulación de una transferencia: motivo y detalle (la aprueba el Contador). */
@Component({
  selector: 'app-transfer-void-request-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, TranslatePipe],
  template: `
    <app-dialog
      [title]="'transferVoids.dialog.title' | translate"
      [saveDisabled]="saving()"
      (save)="onSave()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">{{ 'transferVoids.dialog.hint' | translate }}</p>
        <app-select
          formControlName="voidReasonId"
          [label]="'receiptVoidRequests.dialog.reason' | translate"
          [options]="voidReasonOptions()"
          [required]="true"
        />
        <app-input formControlName="detail" [label]="'receiptVoidRequests.dialog.detail' | translate" [maxLength]="255" />
      </form>
    </app-dialog>
  `,
})
export class TransferVoidRequestDialog {
  private readonly data = inject<TransferVoidRequestDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, TransferVoidRequestDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly service = inject(TransferVoidRequestService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  private readonly voidReasons = signal<VoidReasonItem[]>([]);
  protected readonly voidReasonOptions = computed<SelectOption[]>(() =>
    this.voidReasons().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly form = new FormGroup({
    voidReasonId: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    void this.catalogService.getVoidReasons().then((items) => this.voidReasons.set(items));
  }

  protected async onSave(): Promise<void> {
    if (!this.form.controls.voidReasonId.value) {
      this.toastService.warning(this.languageService.t('receiptVoidRequests.dialog.reasonRequired'));
      return;
    }
    this.saving.set(true);
    try {
      await this.service.create({
        transferId: this.data.transferId,
        voidReasonId: Number(this.form.controls.voidReasonId.value),
        detail: this.form.controls.detail.value || null,
      });
      this.toastService.success(this.languageService.t('transferVoids.dialog.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('transferVoids.error'), message);
    } finally {
      this.saving.set(false);
    }
  }
}

/** Anulaciones de Transferencias (Autorizaciones): el Contador aprueba o rechaza. */
@Component({
  selector: 'app-transfer-void-requests',
  imports: [LoadingSkeleton, FormsModule, Select, TranslatePipe, DecimalPipe],
  templateUrl: './transfer-void-requests.html',
})
export class TransferVoidRequests {
  private readonly service = inject(TransferVoidRequestService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly status = signal<string | null>('pending');
  protected readonly requests = signal<TransferVoidRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly working = signal<number | null>(null);
  protected readonly notes = signal<Record<number, string | undefined>>({});

  protected readonly canReview = computed(() => APPROVER_ROLES.includes(this.authService.activeRole() ?? ''));
  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: 'pending', label: this.languageService.t('receiptEdits.status.pending') },
    { value: 'approved', label: this.languageService.t('receiptEdits.status.approved') },
    { value: 'rejected', label: this.languageService.t('receiptEdits.status.rejected') },
  ]);

  constructor() {
    void this.load();
  }

  protected onStatusChange(value: string | null): void {
    this.status.set(value);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.requests.set(await this.service.list(this.status() ?? undefined));
    } finally {
      this.loading.set(false);
    }
  }

  protected setNotes(id: number, value: string): void {
    this.notes.update((current) => ({ ...current, [id]: value }));
  }

  protected formatInstant(value: string | null): string {
    return value ? new Date(value).toLocaleString() : '—';
  }

  protected number(id: number): string {
    return String(id).padStart(5, '0');
  }

  protected async review(request: TransferVoidRequest, decision: 'approve' | 'reject'): Promise<void> {
    const notes = (this.notes()[request.transferVoidRequestId] ?? '').trim();
    if (decision === 'reject' && !notes) {
      this.toastService.warning(this.languageService.t('receiptEdits.notesRequired'));
      return;
    }
    this.working.set(request.transferVoidRequestId);
    try {
      await this.service.review(request.transferVoidRequestId, decision, notes || null);
      this.toastService.success(this.languageService.t(decision === 'approve' ? 'transferVoids.approved' : 'transferVoids.rejected'));
      await this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('transferVoids.error'), message);
    } finally {
      this.working.set(null);
    }
  }
}
