import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CatalogService, VoidReasonItem } from '../../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IssueVoidRequestService } from '../issue-void-request.service';

export interface IssueVoidRequestDialogData {
  issueId: number;
}

@Component({
  selector: 'app-issue-void-request-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, TranslatePipe],
  templateUrl: './issue-void-request-dialog.html',
})
export class IssueVoidRequestDialog {
  private readonly data = inject<IssueVoidRequestDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, IssueVoidRequestDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly issueVoidRequestService = inject(IssueVoidRequestService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly voidReasons = signal<VoidReasonItem[]>([]);
  protected readonly voidReasonOptions = computed<SelectOption[]>(() =>
    this.voidReasons().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly form = new FormGroup({
    voidReasonId: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
  });

  protected readonly saveDisabled = computed(() => this.saving());

  constructor() {
    void this.loadVoidReasons();
  }

  private async loadVoidReasons(): Promise<void> {
    this.voidReasons.set(await this.catalogService.getVoidReasons());
  }

  protected async onSave(): Promise<void> {
    if (!this.form.controls.voidReasonId.value) {
      this.toastService.show(this.languageService.t('issueVoidRequests.dialog.reasonRequired'));
      return;
    }

    this.saving.set(true);
    try {
      await this.issueVoidRequestService.create({
        issueId: this.data.issueId,
        voidReasonId: Number(this.form.controls.voidReasonId.value),
        detail: this.form.controls.detail.value || null,
      });
      this.toastService.show(this.languageService.t('issueVoidRequests.dialog.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('issueVoidRequests.dialog.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
