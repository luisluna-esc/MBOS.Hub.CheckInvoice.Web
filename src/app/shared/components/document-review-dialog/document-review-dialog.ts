import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  APPROVER_ROLES,
  VERIFIER_ROLES,
  DocumentReview,
  DocumentReviewService,
  ReviewDocumentType,
  SignAction,
} from '../../../core/review/document-review';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Dialog } from '../dialog/dialog';
import { Input as AppInput } from '../input/input';
import { LoadingSkeleton } from '../loading-skeleton/loading-skeleton';

export interface DocumentReviewDialogData {
  type: ReviewDocumentType;
  id: number;
  /** Cómo se llama el documento en pantalla (ej. "N° de Nota I 15-10-26"). */
  title: string;
}

/**
 * Revisión y firma digital de un documento, como el "Historial de Actualizaciones" de los
 * asientos contables. Igual que las anulaciones: quien trabaja en almacén verifica; el Contador
 * aprueba, rechaza o reabre. Cada firma pide la contraseña (reemplaza la firma en papel).
 * Devuelve true si cambió algo.
 */
@Component({
  selector: 'app-document-review-dialog',
  imports: [LoadingSkeleton, Dialog, AppInput, ReactiveFormsModule, TranslatePipe],
  templateUrl: './document-review-dialog.html',
})
export class DocumentReviewDialog {
  protected readonly data = inject<DocumentReviewDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, DocumentReviewDialog>);
  private readonly reviewService = inject(DocumentReviewService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly review = signal<DocumentReview | null>(null);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  /** Paso que se está firmando (muestra contraseña y, si corresponde, motivo). */
  protected readonly signing = signal<SignAction | null>(null);
  protected readonly passwordControl = new FormControl('', { nonNullable: true });
  protected readonly reasonControl = new FormControl('', { nonNullable: true });
  private changed = false;

  private readonly isApprover = computed(() => APPROVER_ROLES.includes(this.authService.activeRole() ?? ''));
  private readonly canWork = computed(() => VERIFIER_ROLES.includes(this.authService.activeRole() ?? ''));

  /** Pasos que puede firmar el usuario según el estado actual. */
  protected readonly availableActions = computed<SignAction[]>(() => {
    const current = this.review();
    if (!current || current.isVoided) {
      return [];
    }
    switch (current.status) {
      case 'digitado':
      case 'anterior':
        return this.canWork() ? ['verify'] : [];
      case 'verificado':
        return this.isApprover() ? ['approve', 'reject'] : [];
      case 'aprobado':
        return this.isApprover() ? ['reopen'] : [];
      default:
        return [];
    }
  });

  protected readonly needsReason = computed(() => this.signing() === 'reject' || this.signing() === 'reopen');

  /** Versiones de la más nueva a la más vieja, cada una con sus pasos en orden. */
  protected readonly versions = computed(() => {
    const entries = this.review()?.entries ?? [];
    const byVersion = new Map<number, typeof entries>();
    for (const entry of entries) {
      byVersion.set(entry.version, [...(byVersion.get(entry.version) ?? []), entry]);
    }
    return [...byVersion.entries()].sort((a, b) => b[0] - a[0]).map(([version, items]) => ({ version, items }));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.review.set(await this.reviewService.get(this.data.type, this.data.id));
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  protected startSigning(action: SignAction): void {
    this.passwordControl.setValue('');
    this.reasonControl.setValue('');
    this.signing.set(action);
  }

  protected cancelSigning(): void {
    this.signing.set(null);
  }

  protected async onConfirmSign(): Promise<void> {
    const action = this.signing();
    if (!action) {
      return;
    }
    const password = this.passwordControl.value;
    const reason = this.reasonControl.value.trim();
    if (!password) {
      this.toastService.warning(this.languageService.t('review.passwordRequired'));
      return;
    }
    if (this.needsReason() && !reason) {
      this.toastService.warning(this.languageService.t('review.reasonRequired'));
      return;
    }

    this.working.set(true);
    try {
      await this.reviewService.sign(this.data.type, this.data.id, action, password, reason);
      this.changed = true;
      this.signing.set(null);
      this.toastService.success(this.languageService.t(`review.done.${action}`));
      await this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('review.error'), message);
    } finally {
      this.passwordControl.setValue('');
      this.working.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
