import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReceiptVoidRequestService } from '../receipt-void-request.service';

export interface ReceiptVoidRequestReviewDialogData {
  receiptVoidRequestId: number;
  mode: 'approve' | 'reject';
}

@Component({
  selector: 'app-receipt-void-request-review-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, TranslatePipe],
  templateUrl: './receipt-void-request-review-dialog.html',
})
export class ReceiptVoidRequestReviewDialog {
  protected readonly data = inject<ReceiptVoidRequestReviewDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ReceiptVoidRequestReviewDialog>);
  private readonly receiptVoidRequestService = inject(ReceiptVoidRequestService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isReject = this.data.mode === 'reject';

  protected readonly form = new FormGroup({
    reviewNotes: new FormControl('', { nonNullable: true }),
  });

  // computed() no reacciona a form.controls.reviewNotes.value directamente (no es una señal) —
  // sin este puente por toSignal(valueChanges), el botón queda deshabilitado para siempre al
  // rechazar, aunque el usuario sí escriba el motivo.
  private readonly reviewNotesValue = toSignal(
    this.form.controls.reviewNotes.valueChanges.pipe(
      startWith(this.form.controls.reviewNotes.value),
      takeUntilDestroyed()
    ),
    { initialValue: '' }
  );

  protected readonly saveDisabled = computed(
    () => this.saving() || (this.isReject && !this.reviewNotesValue().trim())
  );

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const review = { reviewNotes: this.form.controls.reviewNotes.value || null };
      if (this.isReject) {
        await this.receiptVoidRequestService.reject(this.data.receiptVoidRequestId, review);
      } else {
        await this.receiptVoidRequestService.approve(this.data.receiptVoidRequestId, review);
      }
      this.toastService.show(
        this.languageService.t(this.isReject ? 'receiptVoidRequests.review.rejectSuccess' : 'receiptVoidRequests.review.approveSuccess')
      );
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('receiptVoidRequests.review.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
