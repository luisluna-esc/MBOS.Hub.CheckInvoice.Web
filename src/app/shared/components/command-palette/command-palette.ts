import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, ElementRef, computed, inject, signal, viewChild, afterNextRender } from '@angular/core';
import { ShortcutDirective } from '../../directives/shortcut.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CommandPaletteEntry {
  label: string;
  /** Nombre del grupo del menú (ej. "Reportes"), para distinguir pantallas con el mismo nombre. */
  group: string | null;
  route: string;
}

export interface CommandPaletteData {
  entries: CommandPaletteEntry[];
}

/** Sin tildes y en minúsculas, para que "kardex fisico" encuentre "Kardex Físico". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * "Ir a…": busca entre las pantallas del menú del rol activo y abre la elegida.
 * Devuelve la ruta elegida al cerrar (la navegación la hace el Shell).
 */
@Component({
  selector: 'app-command-palette',
  imports: [TranslatePipe, ShortcutDirective],
  templateUrl: './command-palette.html',
})
export class CommandPalette {
  private readonly dialogRef = inject(DialogRef<string, CommandPalette>);
  private readonly data = inject<CommandPaletteData>(DIALOG_DATA);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly results = computed(() => {
    const words = normalize(this.query()).split(/\s+/).filter(Boolean);
    return this.data.entries.filter((entry) => {
      const haystack = normalize(`${entry.label} ${entry.group ?? ''}`);
      return words.every((word) => haystack.includes(word));
    });
  });

  constructor() {
    afterNextRender(() => this.searchInput().nativeElement.focus());
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.moveTo((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.moveTo((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = this.results()[this.active()];
      if (entry) {
        this.open(entry);
      }
    }
  }

  protected open(entry: CommandPaletteEntry): void {
    this.dialogRef.close(entry.route);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private moveTo(index: number): void {
    this.active.set(index);
    this.list()?.nativeElement.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }
}
