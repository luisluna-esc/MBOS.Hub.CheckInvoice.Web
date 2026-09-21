import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GrantPortalAccessResult } from '../client.models';

export interface PortalAccessGrantedDialogData {
  title: string;
  message: string;
  username: string;
  result: GrantPortalAccessResult;
}

@Component({
  selector: 'app-portal-access-granted-dialog',
  imports: [Dialog, TranslatePipe],
  templateUrl: './portal-access-granted-dialog.html',
})
export class PortalAccessGrantedDialog {
  protected readonly data = inject<PortalAccessGrantedDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, PortalAccessGrantedDialog>);

  protected close(): void {
    this.dialogRef.close();
  }
}
