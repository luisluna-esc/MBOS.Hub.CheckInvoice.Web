import { Injectable, signal } from '@angular/core';

/** Tipo de aviso: define el ícono y el color de la franja superior. */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

const DEFAULT_DURATION_MS = 5000;
/** Los errores se leen con más calma: quedan un poco más en pantalla. */
const ERROR_DURATION_MS = 8000;

let nextToastId = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  success(message: string, description?: string, durationMs = DEFAULT_DURATION_MS): string {
    return this.push('success', message, description, durationMs);
  }

  error(message: string, description?: string, durationMs = ERROR_DURATION_MS): string {
    return this.push('error', message, description, durationMs);
  }

  warning(message: string, description?: string, durationMs = DEFAULT_DURATION_MS): string {
    return this.push('warning', message, description, durationMs);
  }

  info(message: string, description?: string, durationMs = DEFAULT_DURATION_MS): string {
    return this.push('info', message, description, durationMs);
  }

  /** Aviso informativo (se mantiene por compatibilidad: preferir success/error/warning/info). */
  show(message: string, description?: string, durationMs = DEFAULT_DURATION_MS): string {
    return this.push('info', message, description, durationMs);
  }

  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  private push(type: ToastType, message: string, description: string | undefined, durationMs: number): string {
    const id = `toast-${Date.now()}-${++nextToastId}`;
    this.toasts.update((current) => [...current, { id, type, message, description }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }
}
