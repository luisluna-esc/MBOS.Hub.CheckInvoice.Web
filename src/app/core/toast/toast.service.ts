import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  description?: string;
}

const DEFAULT_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, description?: string, durationMs = DEFAULT_DURATION_MS): string {
    const id = crypto.randomUUID();
    this.toasts.update((current) => [...current, { id, message, description }]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }

    return id;
  }

  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }
}
