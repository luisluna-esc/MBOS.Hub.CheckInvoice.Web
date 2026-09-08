import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { MenuTreeItem } from '../../core/menu/menu.models';
import { MenuService } from '../../core/menu/menu.service';
import { ThemeService } from '../../core/theme/theme.service';
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

  protected readonly mobileNavOpen = signal(false);
  protected readonly collapsed = signal(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
  protected readonly accountMenuOpen = signal(false);
  protected readonly expandedItems = signal<ReadonlySet<number>>(new Set());

  protected readonly username = computed(() => this.authService.session()?.username ?? '');
  protected readonly email = computed(() => this.authService.session()?.email ?? '');
  protected readonly initials = computed(() => this.username().charAt(0).toUpperCase() || '?');

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

  constructor() {
    effect(() => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.collapsed()));
    });

    void this.menuService.loadMyMenu();
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
