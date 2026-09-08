import { Component, computed, input } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

@Component({
  selector: 'app-tooltip',
  imports: [],
  templateUrl: './tooltip.html',
  host: { class: 'group relative inline-flex' },
})
export class Tooltip {
  /** Texto del tooltip. Si viene vacío, no se renderiza (útil para desactivarlo condicionalmente). */
  readonly text = input<string>('');
  readonly position = input<TooltipPosition>('top');

  protected readonly bubbleClasses = computed(() => {
    switch (this.position()) {
      case 'bottom':
        return 'top-full left-1/2 mt-2 -translate-x-1/2';
      case 'left':
        return 'right-full top-1/2 mr-2 -translate-y-1/2';
      case 'right':
        return 'left-full top-1/2 ml-2 -translate-y-1/2';
      case 'top':
      default:
        return 'bottom-full left-1/2 mb-2 -translate-x-1/2';
    }
  });

  /** Rombo de 8x8 rotado, con el mismo fondo/borde de la burbuja, para que se vea conectado al elemento. */
  protected readonly arrowClasses = computed(() => {
    switch (this.position()) {
      case 'bottom':
        return 'left-1/2 top-0 -mt-1 -translate-x-1/2 border-t border-l';
      case 'left':
        return 'top-1/2 left-full -ml-1 -translate-y-1/2 border-t border-r';
      case 'right':
        return 'top-1/2 right-full -mr-1 -translate-y-1/2 border-b border-l';
      case 'top':
      default:
        return 'left-1/2 bottom-0 -mb-1 -translate-x-1/2 border-b border-r';
    }
  });
}
