import { Overlay } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../core/dialog/dialog.service';
import { InboxService } from '../../core/inbox/inbox.service';
import { LanguageService } from '../../core/i18n/language.service';
import { MenuTreeItem } from '../../core/menu/menu.models';
import { MenuService } from '../../core/menu/menu.service';
import { GO_TO_SHORTCUTS, ShortcutService } from '../../core/shortcuts/shortcut.service';
import { ThemeService } from '../../core/theme/theme.service';
import { CommandPalette, CommandPaletteData, CommandPaletteEntry } from '../../shared/components/command-palette/command-palette';
import { ShortcutsHelp, ShortcutsHelpData } from '../../shared/components/shortcuts-help/shortcuts-help';
import { Icon } from '../../shared/components/icon/icon';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { Select, SelectOption } from '../../shared/components/select/select';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { Tooltip } from '../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

const SIDEBAR_STORAGE_KEY = 'sidebarCollapsed';

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgTemplateOutlet,
    FormsModule,
    Icon,
    LanguageSwitcher,
    Select,
    ThemeToggle,
    Tooltip,
    TranslatePipe,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly authService = inject(AuthService);
  protected readonly menuService = inject(MenuService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);
  /** Buzón de pendientes: acceso arriba del menú con el número de cosas por hacer. */
  protected readonly inboxService = inject(InboxService);
  protected readonly shortcuts = inject(ShortcutService);
  private readonly dialogService = inject(DialogService);
  private readonly overlay = inject(Overlay);
  private paletteOpen = false;
  private helpOpen = false;

  protected readonly mobileNavOpen = signal(false);
  protected readonly collapsed = signal(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
  protected readonly accountMenuOpen = signal(false);
  protected readonly expandedItems = signal<ReadonlySet<number>>(new Set());

  protected readonly email = computed(() => this.authService.session()?.email ?? '');
  protected readonly activeRole = computed(() => this.authService.activeRole() ?? '');
  protected readonly initials = computed(() => {
    const session = this.authService.session();
    return (session?.fullName || session?.email || '').charAt(0).toUpperCase() || '?';
  });

  protected readonly roleOptions = computed<SelectOption[]>(() =>
    this.authService.roles().map((role) => ({ value: role, label: role }))
  );

  /** Solo se muestran los items del rol activo, no la unión de permisos de todos los roles del usuario. */
  protected readonly visibleNavItems = computed<MenuTreeItem[]>(() => this.filterByActiveRole(this.menuService.items()));

  /**
   * Todas las rutas de items visibles (padres e hijos), para detectar cuándo una ruta de menú
   * es prefijo de otra (ej. "/issues" lo es de "/issues/void-requests"): en ese caso hace falta
   * match exacto o los dos items del menú se pintan activos a la vez al estar en la ruta hija.
   */
  private readonly allVisibleRoutes = computed<string[]>(() =>
    this.visibleNavItems().flatMap((item) => [
      ...(item.route ? [item.route] : []),
      ...item.children.map((child) => child.route).filter((route): route is string => !!route),
    ])
  );

  protected readonly logoSrc = computed(() =>
    this.themeService.theme() === 'dark' ? 'img/inven-track-blanco.png' : 'img/inven-track-negro.png'
  );

  /** Solo el ícono del logo (sin el texto), para el menú reducido. */
  protected readonly iconSrc = computed(() =>
    this.themeService.theme() === 'dark' ? 'img/inven-track-icono-blanco.png' : 'img/inven-track-icono-negro.png'
  );

  constructor() {
    effect(() => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.collapsed()));
    });

    void this.menuService.loadMyMenu();

    // Al cambiar de rol cambia lo que hay por hacer: se vuelve a contar.
    effect(() => {
      this.authService.activeRole();
      void this.inboxService.refresh();
    });
    this.inboxService.start();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        void this.inboxService.refresh();
      }
    });

    this.shortcuts.onApp('palette', () => this.openPalette());
    this.shortcuts.onApp('help', () => this.openShortcutsHelp());
    this.shortcuts.onApp('sidebar', () => this.toggleCollapsed());
    this.shortcuts.onGoTo((route) => {
      if (this.canGoTo(route)) {
        void this.router.navigateByUrl(route);
      }
    });
  }

  /** "G + letra" solo lleva a pantallas que el rol activo tiene en su menú (Inicio siempre). */
  private canGoTo(route: string): boolean {
    if (route === '/') {
      return true;
    }
    if (route === '/inbox') {
      return this.inboxService.enabled();
    }
    return this.allVisibleRoutes().includes(route);
  }

  /** Pantallas del menú del rol activo, para la paleta "Ir a…". */
  private paletteEntries(): CommandPaletteEntry[] {
    const entries: CommandPaletteEntry[] = [];
    if (this.inboxService.enabled()) {
      entries.push({ label: this.languageService.t('inbox.title'), group: null, route: '/inbox' });
    }
    for (const item of this.visibleNavItems()) {
      if (item.route) {
        entries.push({ label: this.displayName(item), group: null, route: item.route });
      }
      for (const child of item.children) {
        if (child.route) {
          entries.push({ label: this.displayName(child), group: this.displayName(item), route: child.route });
        }
      }
    }
    return entries.filter((entry, index) => entries.findIndex((other) => other.route === entry.route) === index);
  }

  protected openPalette(): void {
    if (this.paletteOpen) {
      return;
    }
    this.paletteOpen = true;
    const ref = this.dialogService.open<string, CommandPaletteData>(CommandPalette, {
      data: { entries: this.paletteEntries() },
      positionStrategy: this.overlay.position().global().centerHorizontally().top('12vh'),
    });
    ref.closed.subscribe((route) => {
      this.paletteOpen = false;
      if (route) {
        void this.router.navigateByUrl(route);
      }
    });
  }

  protected openShortcutsHelp(): void {
    if (this.helpOpen) {
      return;
    }
    this.helpOpen = true;
    this.accountMenuOpen.set(false);
    const goTo = GO_TO_SHORTCUTS.filter((item) => this.canGoTo(item.route));
    const ref = this.dialogService.open<void, ShortcutsHelpData>(ShortcutsHelp, { data: { goTo } });
    ref.closed.subscribe(() => (this.helpOpen = false));
  }

  private filterByActiveRole(items: MenuTreeItem[]): MenuTreeItem[] {
    const hasAccess = (permissionCode: string | null) =>
      !permissionCode || this.authService.hasActiveRolePermission(permissionCode);

    return items
      .filter((item) => hasAccess(item.permissionCode))
      .map((item) => ({ ...item, children: this.filterByActiveRole(item.children) }))
      .filter((item) => item.children.length > 0 || !!item.route);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  protected toggleAccountMenu(): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
    }
    this.accountMenuOpen.update((value) => !value);
  }

  protected isExactMatch(route: string | null): boolean {
    if (!route || route === '/') {
      return true;
    }
    return this.allVisibleRoutes().some((other) => other !== route && other.startsWith(`${route}/`));
  }

  protected displayName(item: MenuTreeItem): string {
    return item.translationKey ? this.languageService.t(item.translationKey) : item.name;
  }

  protected isExpanded(menuId: number): boolean {
    return this.expandedItems().has(menuId);
  }

  protected toggleExpanded(menuId: number): void {
    this.expandedItems.update((current) => {
      const next = new Set(current);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }

  protected onRoleChange(role: string | null): void {
    if (role) {
      this.authService.setActiveRole(role);
    }
  }

  protected onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.menuService.clear();
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.menuService.clear();
        this.router.navigateByUrl('/login');
      },
    });
  }
}
