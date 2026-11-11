import { Component, inject, signal } from '@angular/core';
import { ToastItem, ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-toast-container',
  imports: [TranslatePipe],
  templateUrl: './toast-container.html',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
  /** Documento recién copiado (toast e índice), para mostrar "Copiado" un momento. */
  protected readonly copiedKey = signal<string | null>(null);

  /** Copia el N° del documento para pegarlo en el buscador del Historial o del Buzón. */
  protected async copy(toastId: string, index: number, item: ToastItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.copy);
    } catch {
      return;
    }
    const key = `${toastId}:${index}`;
    this.copiedKey.set(key);
    setTimeout(() => {
      if (this.copiedKey() === key) {
        this.copiedKey.set(null);
      }
    }, 2000);
  }
}
