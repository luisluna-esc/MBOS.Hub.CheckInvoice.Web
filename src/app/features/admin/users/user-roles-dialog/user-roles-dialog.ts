import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Role } from '../../roles/role.models';
import { RoleService } from '../../roles/role.service';
import { AppUser } from '../app-user.models';
import { AppUserService } from '../app-user.service';

export interface UserRolesDialogData {
  user: AppUser;
}

@Component({
  selector: 'app-user-roles-dialog',
  imports: [FormsModule, Dialog, Checkbox, TranslatePipe],
  templateUrl: './user-roles-dialog.html',
})
export class UserRolesDialog {
  protected readonly data = inject<UserRolesDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, UserRolesDialog>);
  private readonly roleService = inject(RoleService);
  private readonly appUserService = inject(AppUserService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly loading = signal(true);
  protected readonly allRoles = signal<Role[]>([]);
  protected readonly assignedIds = signal<Set<number>>(new Set());
  protected readonly pendingIds = signal<Set<number>>(new Set());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const [all, assigned] = await Promise.all([
      this.roleService.list(1, 500, {}),
      this.appUserService.getRoles(this.data.user.appUserId),
    ]);
    this.allRoles.set(all.items);
    this.assignedIds.set(new Set(assigned.map((r) => r.roleId)));
    this.loading.set(false);
  }

  protected isAssigned(roleId: number): boolean {
    return this.assignedIds().has(roleId);
  }

  protected isPending(roleId: number): boolean {
    return this.pendingIds().has(roleId);
  }

  protected async toggle(roleId: number): Promise<void> {
    if (this.isPending(roleId)) {
      return;
    }
    const wasAssigned = this.isAssigned(roleId);
    this.pendingIds.update((current) => new Set(current).add(roleId));

    try {
      if (wasAssigned) {
        await this.appUserService.removeRole(this.data.user.appUserId, roleId);
      } else {
        await this.appUserService.assignRole(this.data.user.appUserId, roleId);
      }
      this.assignedIds.update((current) => {
        const next = new Set(current);
        if (wasAssigned) {
          next.delete(roleId);
        } else {
          next.add(roleId);
        }
        return next;
      });
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('users.roles.error'), message);
    } finally {
      this.pendingIds.update((current) => {
        const next = new Set(current);
        next.delete(roleId);
        return next;
      });
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
