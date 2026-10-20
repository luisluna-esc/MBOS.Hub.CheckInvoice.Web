import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Acciones que se disparan sobre un elemento marcado con la directiva `appShortcut`
 * (botón que se presiona o campo que recibe el foco).
 */
export type ElementShortcut = 'save' | 'cancel' | 'search';

/** Acciones de la aplicación (no dependen de un botón en pantalla); las registra el Shell. */
export type AppShortcut = 'palette' | 'help' | 'sidebar';

/** Atajos de "ir a": se escribe G y después la letra, sin mantener nada presionado. */
export const GO_TO_SHORTCUTS: readonly { key: string; route: string; labelKey: string }[] = [
  { key: 'i', route: '/', labelKey: 'shortcuts.goHome' },
  { key: 'b', route: '/inbox', labelKey: 'shortcuts.goInbox' },
  { key: 'e', route: '/receipts', labelKey: 'shortcuts.goReceipts' },
  { key: 's', route: '/issues', labelKey: 'shortcuts.goIssues' },
  { key: 't', route: '/transfers/sent', labelKey: 'shortcuts.goTransfers' },
  { key: 'p', route: '/catalogs/products', labelKey: 'shortcuts.goProducts' },
];

/** Tiempo para escribir la segunda letra después de la G. */
const SEQUENCE_TIMEOUT_MS = 1200;

/**
 * Atajos de teclado de todo el sistema. Solo convenciones conocidas (las mismas de Gmail,
 * GitHub, Slack, VS Code...), nada inventado: Ctrl/⌘+S guardar, Ctrl/⌘+Enter enviar, Esc
 * cerrar, Ctrl/⌘+K ir a, "/" buscar, "?" ayuda, "G y una letra" para ir a una sección.
 * En Windows la tecla principal es Ctrl y en Mac es ⌘.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly document = inject(DOCUMENT);

  readonly isMac = /Mac|iPhone|iPad|iPod/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent
  );

  /** Elementos registrados por acción; el último registrado (ej. el diálogo abierto encima) gana. */
  private readonly elements = new Map<ElementShortcut, HTMLElement[]>();
  private readonly appHandlers = new Map<AppShortcut, () => void>();
  private goToHandler: ((route: string) => void) | null = null;
  private pendingG = 0;

  constructor() {
    this.document.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  register(action: ElementShortcut, element: HTMLElement): void {
    const list = this.elements.get(action) ?? [];
    list.push(element);
    this.elements.set(action, list);
  }

  unregister(action: ElementShortcut, element: HTMLElement): void {
    const list = this.elements.get(action);
    if (list) {
      this.elements.set(action, list.filter((item) => item !== element));
    }
  }

  onApp(action: AppShortcut, handler: () => void): void {
    this.appHandlers.set(action, handler);
  }

  onGoTo(handler: (route: string) => void): void {
    this.goToHandler = handler;
  }

  /** Teclas para mostrar, según el sistema: ej. ['Ctrl', 'S'] o ['⌘', 'S']. */
  keysFor(action: ElementShortcut | AppShortcut): string[] {
    const mod = this.isMac ? '⌘' : 'Ctrl';
    switch (action) {
      case 'save':
        return [mod, 'S'];
      case 'cancel':
        return ['Esc'];
      case 'search':
        return ['/'];
      case 'palette':
        return [mod, 'K'];
      case 'help':
        return [mod, '/'];
      case 'sidebar':
        return [mod, 'B'];
    }
  }

  /** Texto corto para el tooltip de un botón: "Ctrl+S" o "⌘S". */
  label(action: ElementShortcut | AppShortcut): string {
    return this.keysFor(action).join(this.isMac ? '' : '+');
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }
    const mod = this.isMac ? event.metaKey : event.ctrlKey;
    const otherMod = this.isMac ? event.ctrlKey : event.metaKey;
    const typing = this.isTyping(event.target);
    const key = event.key.toLowerCase();


    if (mod && !otherMod && !event.altKey) {
      if (key === 's' && !event.shiftKey) {
        this.consume(event, () => this.trigger('save'));
      } else if (key === 'enter') {
        this.consume(event, () => this.trigger('save'));
      } else if (key === 'k' && !event.shiftKey) {
        this.consume(event, () => this.runApp('palette'));
      } else if ((key === '/' || event.code === 'Slash') && !event.shiftKey) {
        this.consume(event, () => this.runApp('help'));
      } else if (key === 'b' && !event.shiftKey) {
        this.consume(event, () => this.runApp('sidebar'));
      }
      return;
    }

    if (event.key === 'Escape') {
      if (this.trigger('cancel')) {
        event.preventDefault();
      }
      return;
    }

    if (typing || mod || otherMod || event.altKey) {
      return;
    }

    if (event.key === '?') {
      this.consume(event, () => this.runApp('help'));
      return;
    }

    if (event.key === '/' && this.trigger('search')) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey) {
      return;
    }

    // Secuencia G + letra
    if (this.pendingG && Date.now() - this.pendingG < SEQUENCE_TIMEOUT_MS) {
      this.pendingG = 0;
      const target = GO_TO_SHORTCUTS.find((item) => item.key === key);
      if (target && this.goToHandler) {
        event.preventDefault();
        this.goToHandler(target.route);
      }
      return;
    }
    this.pendingG = key === 'g' ? Date.now() : 0;
  }

  private consume(event: KeyboardEvent, action: () => void): void {
    event.preventDefault();
    action();
  }

  private runApp(action: AppShortcut): void {
    this.appHandlers.get(action)?.();
  }

  /** Presiona (o enfoca) el último elemento visible y habilitado de la acción. */
  private trigger(action: ElementShortcut): boolean {
    const list = this.elements.get(action) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const element = list[i];
      if (!this.isUsable(element)) {
        continue;
      }
      if (action === 'search') {
        const input = element.matches('input, textarea') ? element : element.querySelector<HTMLElement>('input, textarea');
        input?.focus();
        return !!input;
      }
      element.click();
      return true;
    }
    return false;
  }

  private isUsable(element: HTMLElement): boolean {
    if (!element.isConnected || element.getClientRects().length === 0) {
      return false;
    }
    if ((element as HTMLButtonElement).disabled) {
      return false;
    }
    // Con un diálogo abierto, solo cuentan los elementos que están dentro del diálogo de arriba.
    const panes = this.document.querySelectorAll<HTMLElement>('.cdk-overlay-pane');
    const topDialog = Array.from(panes).reverse().find((pane) => pane.querySelector('[role="dialog"], .cdk-dialog-container'));
    return !topDialog || topDialog.contains(element);
  }

  private isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }
}
