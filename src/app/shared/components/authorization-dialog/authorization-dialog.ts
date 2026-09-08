import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface AuthorizationDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-authorization-dialog',
  imports: [TranslatePipe],
  templateUrl: './authorization-dialog.html',
})
export class AuthorizationDialog {
  protected readonly data = inject<AuthorizationDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, AuthorizationDialog>);

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
