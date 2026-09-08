import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Permission, Role } from '../role.models';
import { RoleService } from '../role.service';

export interface RolePermissionsDialogData {
  role: Role;
}

interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

@Component({
  selector: 'app-role-permissions-dialog',
  imports: [FormsModule, Dialog, Checkbox, TranslatePipe],
  templateUrl: './role-permissions-dialog.html',
})
export class RolePermissionsDialog {
  protected readonly data = inject<RolePermissionsDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, RolePermissionsDialog>);
  private readonly roleService = inject(RoleService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly isLocked = this.data.role.name === 'M-BOS';

  protected readonly loading = signal(true);
  protected readonly allPermissions = signal<Permission[]>([]);
  protected readonly assignedIds = signal<Set<number>>(new Set());
  protected readonly pendingIds = signal<Set<number>>(new Set());

  protected readonly groups = computed<PermissionGroup[]>(() => {
    const byModule = new Map<string, Permission[]>();
    for (const permission of this.allPermissions()) {
      const list = byModule.get(permission.module) ?? [];
      list.push(permission);
      byModule.set(permission.module, list);
    }
    return [...byModule.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, permissions]) => ({ module, permissions }));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const [all, assigned] = await Promise.all([
      this.roleService.listAllPermissions(),
      this.roleService.getPermissions(this.data.role.roleId),
    ]);
    this.allPermissions.set(all);
    this.assignedIds.set(new Set(assigned.map((p) => p.permissionId)));
    this.loading.set(false);
  }

  protected isAssigned(permissionId: number): boolean {
    return this.assignedIds().has(permissionId);
  }

  protected isPending(permissionId: number): boolean {
    return this.pendingIds().has(permissionId);
  }

  protected async toggle(permissionId: number): Promise<void> {
    if (this.isPending(permissionId) || this.isLocked) {
      return;
    }
    const wasAssigned = this.isAssigned(permissionId);
    this.pendingIds.update((current) => new Set(current).add(permissionId));

    try {
      if (wasAssigned) {
        await this.roleService.removePermission(this.data.role.roleId, permissionId);
      } else {
        await this.roleService.assignPermission(this.data.role.roleId, permissionId);
      }
      this.assignedIds.update((current) => {
        const next = new Set(current);
        if (wasAssigned) {
          next.delete(permissionId);
        } else {
          next.add(permissionId);
        }
        return next;
      });
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('roles.permissions.error'), message);
    } finally {
      this.pendingIds.update((current) => {
        const next = new Set(current);
        next.delete(permissionId);
        return next;
      });
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
