import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { BarChart, BarChartItem } from '../../../shared/components/bar-chart/bar-chart';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FinancialDashboardData } from '../../reports/report.models';
import { ReportService } from '../../reports/report.service';
import { formatMoney } from '../../../core/format/money';

/** Rol activo y la clave de su descripción en el inicio (home.roles.*). */
const ROLE_KEYS: Record<string, { key: string; icon: string }> = {
  'M-BOS': { key: 'mbos', icon: 'admin' },
  Tesorero: { key: 'tesorero', icon: 'receivable' },
  Contador: { key: 'contador', icon: 'report' },
  'Auxiliar Contador': { key: 'auxiliar', icon: 'receipt' },
  Pastor: { key: 'pastor', icon: 'portal' },
  Caja: { key: 'caja', icon: 'receivable' },
};

/** Un color por barra en el gráfico por departamento (se repiten si hay más de seis). */
const CHART_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'];

const DASHBOARD_ROLES = ['M-BOS', 'Tesorero', 'Contador', 'Auxiliar Contador'];

@Component({
  selector: 'app-home',
  imports: [TranslatePipe, Icon, ErrorState, Skeleton, BarChart],
  templateUrl: './home.html',
})
export class Home {
  private readonly authService = inject(AuthService);
  private readonly reportService = inject(ReportService);
  private readonly languageService = inject(LanguageService);

  /** Se saluda con el nombre real: el username muchas veces es el mismo correo. */
  protected readonly username = computed(() => {
    const session = this.authService.session();
    return session?.fullName || session?.username || '';
  });
  protected readonly showDashboard = computed(() => DASHBOARD_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly activeRole = computed(() => this.authService.activeRole() ?? '');
  /** Qué hace el rol activo: un resumen y la lista de sus tareas (null si el rol no tiene descripción). */
  protected readonly roleInfo = computed(() => {
    const role = ROLE_KEYS[this.activeRole()];
    if (!role) {
      return null;
    }
    const key = role.key;
    // Las tareas son una lista en el JSON: se leen por posición hasta que no haya más.
    const tasks: string[] = [];
    for (let i = 0; i < 10; i++) {
      const taskKey = `home.roles.${key}.tasks.${i}`;
      const text = this.languageService.t(taskKey);
      if (text === taskKey) {
        break;
      }
      tasks.push(text);
    }
    return { summary: `home.roles.${key}.summary`, icon: role.icon, tasks };
  });

  protected readonly data = signal<FinancialDashboardData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly issuesByMonthItems = computed<BarChartItem[]>(() =>
    (this.data()?.issuesByMonth ?? []).map((m) => ({ label: m.monthLabel, value: m.total, colorClass: 'bg-chart-2' }))
  );

  /** Salidas del mes divididas por departamento, de mayor a menor. */
  protected readonly issuesByDepartmentItems = computed<BarChartItem[]>(() =>
    (this.data()?.issuesByDepartment ?? []).map((d, i) => ({ label: d.name, value: d.total, colorClass: CHART_COLORS[i % CHART_COLORS.length] }))
  );

  protected readonly receivableStatusItems = computed<BarChartItem[]>(() => {
    const status = this.data()?.receivableStatus;
    if (!status) {
      return [];
    }
    return [
      { label: this.languageService.t('accountReceivables.status.pending'), value: status.pendingTotal, colorClass: 'bg-chart-6' },
      { label: this.languageService.t('accountReceivables.status.paid'), value: status.paidTotal, colorClass: 'bg-chart-3' }
    ];
  });

  constructor() {
    if (this.showDashboard()) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.data.set(await this.reportService.getFinancialDashboardData());
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected formatAmount(amount: number): string {
    return formatMoney(amount);
  }
}
