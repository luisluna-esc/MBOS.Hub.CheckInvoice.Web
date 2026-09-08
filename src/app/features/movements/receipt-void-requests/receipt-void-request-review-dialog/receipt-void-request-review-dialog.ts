import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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

  protected readonly saveDisabled = computed(
    () => this.saving() || (this.isReject && !this.form.controls.reviewNotes.value.trim())
  );

  protected async onSave(): Promise<void> {
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
