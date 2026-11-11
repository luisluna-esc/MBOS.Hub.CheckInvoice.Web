import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/i18n/language.service';
import { DocumentReviewService, ReviewDocumentType } from '../../../core/review/document-review';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Dialog } from '../dialog/dialog';
import { DocumentLines } from '../document-lines/document-lines';
import { Input as AppInput } from '../input/input';

export interface ReviewQueueItem {
  type: ReviewDocumentType;
  id: number;
  /** Cómo se llama el documento en pantalla (ej. "Nota I 4-10-26"). */
  title: string;
  detail: string | null;
  /** Firma que corresponde: verificar o aprobar. */
  action: 'verify' | 'approve';
}

export interface ReviewQueueDialogData {
  items: ReviewQueueItem[];
}

/**
 * Revisión de pendientes uno por uno: se ve cada documento (productos y PDF), se acepta y se pasa
 * al siguiente; al final se firman juntos todos los aceptados con una sola contraseña. Un
 * aceptado se puede quitar, o limpiar toda la selección. Devuelve true si firmó algo.
 */
@Component({
  selector: 'app-review-queue-dialog',
  imports: [Dialog, DocumentLines, AppInput, ReactiveFormsModule, TranslatePipe],
  templateUrl: './review-queue-dialog.html',
})
export class ReviewQueueDialog {
  protected readonly data = inject<ReviewQueueDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ReviewQueueDialog>);
  private readonly reviewService = inject(DocumentReviewService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly index = signal(0);
  /** Documentos aceptados ("tipo-id"). */
  protected readonly accepted = signal<Set<string>>(new Set());
  /** Ya firmados en esta revisión: no se vuelven a firmar. */
  protected readonly signed = signal<Set<string>>(new Set());
  protected readonly working = signal(false);
  protected readonly passwordControl = new FormControl('', { nonNullable: true });
  private changed = false;

  protected readonly current = computed(() => this.data.items[this.index()]);
  protected readonly acceptedCount = computed(() => this.accepted().size);
  protected readonly isLast = computed(() => this.index() >= this.data.items.length - 1);

  protected key(item: ReviewQueueItem): string {
    return `${item.type}-${item.id}`;
  }

  protected isAccepted(item: ReviewQueueItem): boolean {
    return this.accepted().has(this.key(item));
  }

  protected isSigned(item: ReviewQueueItem): boolean {
    return this.signed().has(this.key(item));
  }

  protected goTo(index: number): void {
    if (index >= 0 && index < this.data.items.length) {
      this.index.set(index);
    }
  }

  /** Acepta el documento que se está viendo y pasa al siguiente. */
  protected acceptAndNext(): void {
    const next = new Set(this.accepted());
    next.add(this.key(this.current()));
    this.accepted.set(next);
    if (!this.isLast()) {
      this.goTo(this.index() + 1);
    }
  }

  /** Quita un documento de los aceptados. */
  protected unaccept(item: ReviewQueueItem): void {
    const next = new Set(this.accepted());
    next.delete(this.key(item));
    this.accepted.set(next);
  }

  protected clearSelection(): void {
    this.accepted.set(new Set());
  }

  /** Firma todos los aceptados con la contraseña (cada uno con su firma: verificar o aprobar). */
  protected async signAccepted(): Promise<void> {
    const password = this.passwordControl.value;
    if (!password) {
      this.toastService.warning(this.languageService.t('review.passwordRequired'));
      return;
    }
    const items = this.data.items.filter((item) => this.isAccepted(item) && !this.isSigned(item));
    if (items.length === 0) {
      return;
    }

    this.working.set(true);
    let ok = 0;
    const failed: string[] = [];
    for (const item of items) {
      try {
        await this.reviewService.sign(item.type, item.id, item.action, password);
        ok++;
        this.changed = true;
        this.signed.set(new Set(this.signed()).add(this.key(item)));
        this.unaccept(item);
      } catch (error) {
        const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]?.description;
        failed.push(message ? `${item.title}: ${message}` : item.title);
        // Contraseña incorrecta: no tiene sentido seguir con los demás.
        if ((error as { status?: number })?.status === 401 || (error as { status?: number })?.status === 400) {
          break;
        }
      }
    }
    this.passwordControl.setValue('');
    this.working.set(false);

    if (ok > 0) {
      this.toastService.success(this.languageService.t('review.queue.signedCount', { count: ok }));
    }
    if (failed.length > 0) {
      this.toastService.error(this.languageService.t('review.error'), failed.join(' · '));
    } else if (this.signed().size === this.data.items.length) {
      this.close();
    }
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
