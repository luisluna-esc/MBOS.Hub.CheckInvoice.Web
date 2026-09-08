import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  open<R = unknown, D = unknown, T = unknown>(
    component: ComponentType<T>,
    config?: DialogConfig<D, DialogRef<R, T>>
  ): DialogRef<R, T> {
    return this.dialog.open<R, D, T>(component, {
      hasBackdrop: true,
      backdropClass: 'app-dialog-backdrop',
      panelClass: 'app-dialog-panel',
      disableClose: true,
      ...config,
    });
  }
}
