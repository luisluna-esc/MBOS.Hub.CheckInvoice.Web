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
import { AppUser, AppUserRequest } from '../app-user.models';
import { AppUserService } from '../app-user.service';

export interface UserFormDialogData {
  user: AppUser | null;
}

@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Checkbox, TranslatePipe],
  templateUrl: './user-form-dialog.html',
})
export class UserFormDialog {
  private readonly data = inject<UserFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, UserFormDialog>);
  private readonly appUserService = inject(AppUserService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.user;

  protected readonly form = new FormGroup({
    firstName: new FormControl(this.data.user?.firstName ?? '', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl(this.data.user?.lastName ?? '', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl(this.data.user?.email ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    username: new FormControl(this.data.user?.username ?? '', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.isEdit ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)],
    }),
    isActive: new FormControl(this.data.user?.isActive ?? true, { nonNullable: true }),
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

    const request: AppUserRequest = {
      appUserId: this.data.user?.appUserId ?? 0,
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      username: raw.username,
      password: raw.password || null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.appUserService.update(request.appUserId, request);
      } else {
        await this.appUserService.create(request);
      }
      this.toastService.show(this.languageService.t('users.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('users.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
