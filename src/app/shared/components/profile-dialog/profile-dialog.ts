import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ShortcutDirective } from '../../directives/shortcut.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** "Mi perfil": solo muestra los datos del usuario que entró (no se edita nada aquí). */
@Component({
  selector: 'app-profile-dialog',
  imports: [TranslatePipe, ShortcutDirective],
  templateUrl: './profile-dialog.html',
})
export class ProfileDialog {
  private readonly dialogRef = inject(DialogRef<void, ProfileDialog>);
  private readonly authService = inject(AuthService);

  protected readonly session = this.authService.session;
  protected readonly activeRole = this.authService.activeRole;
  protected readonly fullName = computed(() => this.session()?.fullName || this.session()?.username || '');
  protected readonly initials = computed(() =>
    this.fullName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('')
  );

  protected close(): void {
    this.dialogRef.close();
  }
}
