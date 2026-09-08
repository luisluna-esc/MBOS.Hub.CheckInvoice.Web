import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../auth/auth.models';
import { MenuTreeItem } from './menu.models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);

  readonly items = signal<MenuTreeItem[]>([]);
  readonly loaded = signal(false);

  async loadMyMenu(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MenuTreeItem[]>>(`${environment.apiUrl}/Menus/my-menu`)
      );
      this.items.set(response.data);
    } catch {
      this.items.set([]);
    } finally {
      this.loaded.set(true);
    }
  }

  clear(): void {
    this.items.set([]);
    this.loaded.set(false);
  }
}
