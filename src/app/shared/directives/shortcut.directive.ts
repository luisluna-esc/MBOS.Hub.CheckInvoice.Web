import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';
import { ElementShortcut, ShortcutService } from '../../core/shortcuts/shortcut.service';

/**
 * Marca un botón (o campo) como destino de un atajo: `<button appShortcut="save">`.
 * Con un valor vacío o null no registra nada (útil para marcar solo el primer campo de una lista).
 * Agrega `aria-keyshortcuts` y, si el botón no tiene `title`, uno con las teclas ("Ctrl+S" / "⌘S").
 */
@Directive({ selector: '[appShortcut]' })
export class ShortcutDirective implements OnDestroy {
  private readonly shortcuts = inject(ShortcutService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly appShortcut = input<ElementShortcut | null | ''>(null);
  private registered: ElementShortcut | null = null;

  constructor() {
    effect(() => {
      this.release();
      const action = this.appShortcut();
      if (!action) {
        return;
      }
      this.registered = action;
      this.shortcuts.register(action, this.element);
      const label = this.shortcuts.label(action);
      this.element.setAttribute('aria-keyshortcuts', label);
      if (!this.element.hasAttribute('title') && action !== 'search' && action !== 'cancel') {
        this.element.setAttribute('title', label);
      }
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    if (this.registered) {
      this.shortcuts.unregister(this.registered, this.element);
      this.registered = null;
    }
  }
}
