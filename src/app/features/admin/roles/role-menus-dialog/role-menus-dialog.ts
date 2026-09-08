import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Menu, Role } from '../role.models';
import { RoleService } from '../role.service';

export interface RoleMenusDialogData {
  role: Role;
}

interface MenuGroup {
  label: string;
  items: Menu[];
}

@Component({
  selector: 'app-role-menus-dialog',
  imports: [FormsModule, Dialog, Checkbox, TranslatePipe],
  templateUrl: './role-menus-dialog.html',
})
export class RoleMenusDialog {
  protected readonly data = inject<RoleMenusDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, RoleMenusDialog>);
  private readonly roleService = inject(RoleService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly loading = signal(true);
  protected readonly allMenus = signal<Menu[]>([]);
  protected readonly assignedIds = signal<Set<number>>(new Set());
  protected readonly pendingIds = signal<Set<number>>(new Set());

  protected readonly groups = computed<MenuGroup[]>(() => {
    const menus = this.allMenus();
    const nameById = new Map(menus.map((m) => [m.menuId, m.name]));
    // Solo se listan los items con ruta propia (hojas): un grupo sin hijos
    // visibles se oculta solo en el sidebar, no hace falta marcarlo aparte.
    const leaves = menus.filter((m) => !!m.route);

    const byGroup = new Map<string, Menu[]>();
    for (const leaf of leaves) {
      const label = leaf.parentMenuId ? (nameById.get(leaf.parentMenuId) ?? '—') : this.languageService.t('roles.menus.general');
      const list = byGroup.get(label) ?? [];
      list.push(leaf);
      byGroup.set(label, list);
    }
    return [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const [all, assigned] = await Promise.all([
      this.roleService.listAllMenus(),
      this.roleService.getMenus(this.data.role.roleId),
    ]);
    this.allMenus.set(all);
    this.assignedIds.set(new Set(assigned.map((m) => m.menuId)));
    this.loading.set(false);
  }

  protected isAssigned(menuId: number): boolean {
    return this.assignedIds().has(menuId);
  }

  protected isPending(menuId: number): boolean {
    return this.pendingIds().has(menuId);
  }

  protected async toggle(menuId: number): Promise<void> {
    if (this.isPending(menuId)) {
      return;
    }
    const wasAssigned = this.isAssigned(menuId);
    this.pendingIds.update((current) => new Set(current).add(menuId));

    try {
      if (wasAssigned) {
        await this.roleService.removeMenu(this.data.role.roleId, menuId);
      } else {
        await this.roleService.assignMenu(this.data.role.roleId, menuId);
      }
      this.assignedIds.update((current) => {
        const next = new Set(current);
        if (wasAssigned) {
          next.delete(menuId);
        } else {
          next.add(menuId);
        }
        return next;
      });
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('roles.menus.error'), message);
    } finally {
      this.pendingIds.update((current) => {
        const next = new Set(current);
        next.delete(menuId);
        return next;
      });
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
