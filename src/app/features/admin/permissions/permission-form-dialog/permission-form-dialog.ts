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
import { Permission, PermissionRequest } from '../permission.models';
import { PermissionService } from '../permission.service';

export interface PermissionFormDialogData {
  permission: Permission | null;
}

@Component({
  selector: 'app-permission-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Checkbox, TranslatePipe],
  templateUrl: './permission-form-dialog.html',
})
export class PermissionFormDialog {
  private readonly data = inject<PermissionFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, PermissionFormDialog>);
  private readonly permissionService = inject(PermissionService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.permission;

  protected readonly form = new FormGroup({
    code: new FormControl(this.data.permission?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    name: new FormControl(this.data.permission?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    module: new FormControl(this.data.permission?.module ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl(this.data.permission?.description ?? '', { nonNullable: true }),
    isActive: new FormControl(this.data.permission?.isActive ?? true, { nonNullable: true }),
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
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: PermissionRequest = {
      permissionId: this.data.permission?.permissionId ?? 0,
      code: raw.code,
      name: raw.name,
      module: raw.module,
      description: raw.description || null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.permissionService.update(request.permissionId, request);
      } else {
        await this.permissionService.create(request);
      }
      this.toastService.show(this.languageService.t('permissions.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('permissions.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
