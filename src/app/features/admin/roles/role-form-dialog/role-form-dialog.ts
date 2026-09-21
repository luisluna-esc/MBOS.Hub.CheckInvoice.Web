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
import { Role, RoleRequest } from '../role.models';
import { RoleService } from '../role.service';

export interface RoleFormDialogData {
  role: Role | null;
}

@Component({
  selector: 'app-role-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Checkbox, TranslatePipe],
  templateUrl: './role-form-dialog.html',
})
export class RoleFormDialog {
  private readonly data = inject<RoleFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, RoleFormDialog>);
  private readonly roleService = inject(RoleService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.role;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.role?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl(this.data.role?.description ?? '', { nonNullable: true }),
    isActive: new FormControl(this.data.role?.isActive ?? true, { nonNullable: true }),
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

    const request: RoleRequest = {
      roleId: this.data.role?.roleId ?? 0,
      name: raw.name,
      description: raw.description || null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.roleService.update(request.roleId, request);
      } else {
        await this.roleService.create(request);
      }
      this.toastService.show(this.languageService.t('roles.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('roles.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
