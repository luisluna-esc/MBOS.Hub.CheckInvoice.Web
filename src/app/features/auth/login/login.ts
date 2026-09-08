import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Input as AppInput } from '../../../shared/components/input/input';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AppInput, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);

  protected readonly form = new FormGroup({
    usernameOrEmail: new FormControl(''),
    password: new FormControl(''),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  protected onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    const { usernameOrEmail, password } = this.form.getRawValue();

    this.authService.login({ usernameOrEmail: usernameOrEmail ?? '', password: password ?? '' }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/');
      },
      error: (error: { error?: { messages?: { description: string }[] } }) => {
        this.loading.set(false);
        const message = error.error?.messages?.[0]?.description;
        this.toastService.show(this.languageService.t('login.error'), message);
      },
    });
  }
}
