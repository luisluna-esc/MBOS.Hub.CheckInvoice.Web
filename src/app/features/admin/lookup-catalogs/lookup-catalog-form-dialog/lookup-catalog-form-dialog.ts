import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LookupCatalogConfig, LookupCatalogItem, LookupCatalogRequest } from '../lookup-catalog.models';
import { LookupCatalogService } from '../lookup-catalog.service';

export interface LookupCatalogFormDialogData {
  config: LookupCatalogConfig;
  item: LookupCatalogItem | null;
}

@Component({
  selector: 'app-lookup-catalog-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Checkbox, TranslatePipe],
  templateUrl: './lookup-catalog-form-dialog.html',
})
export class LookupCatalogFormDialog {
  private readonly data = inject<LookupCatalogFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, LookupCatalogFormDialog>);
  private readonly catalogService = inject(LookupCatalogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly config = this.data.config;
  protected readonly isEdit = !!this.data.item;
  protected readonly saving = signal(false);

  protected readonly title = computed(() => {
    const catalogTitle = this.languageService.t(this.config.titleKey);
    return this.languageService.t(this.isEdit ? 'lookupCatalogs.form.editTitle' : 'lookupCatalogs.form.newTitle', {
      title: catalogTitle,
    });
  });

  protected readonly form = new FormGroup({
    code: new FormControl(this.data.item?.code ?? '', { nonNullable: true }),
    name: new FormControl(this.data.item?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl(this.data.item?.address ?? '', { nonNullable: true }),
    isActive: new FormControl(this.data.item?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  protected readonly saveDisabled = computed(() => this.formInvalid() || this.saving());

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const request: LookupCatalogRequest = {
      id: this.isEdit ? (this.data.item![this.config.idField] as number) : 0,
      name: raw.name,
      ...(this.config.hasCode ? { code: raw.code } : {}),
      ...(this.config.hasAddress ? { address: raw.address || null } : {}),
      ...(this.config.hasIsActive ? { isActive: raw.isActive } : {}),
    };

    try {
      if (this.isEdit) {
        await this.catalogService.update(this.config.resource, request.id, request);
      } else {
        await this.catalogService.create(this.config.resource, request);
      }
      this.toastService.show(this.languageService.t('lookupCatalogs.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('lookupCatalogs.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
