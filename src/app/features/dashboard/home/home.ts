import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { BarChart, BarChartItem } from '../../../shared/components/bar-chart/bar-chart';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FinancialDashboardData } from '../../reports/report.models';
import { ReportService } from '../../reports/report.service';

const DASHBOARD_ROLES = ['M-BOS', 'Tesorero', 'Contador', 'Auxiliar Contador'];

@Component({
  selector: 'app-home',
  imports: [TranslatePipe, ErrorState, Skeleton, BarChart],
  templateUrl: './home.html',
})
export class Home {
  private readonly authService = inject(AuthService);
  private readonly reportService = inject(ReportService);
  private readonly languageService = inject(LanguageService);

  protected readonly username = computed(() => this.authService.session()?.username ?? '');
  protected readonly showDashboard = computed(() => DASHBOARD_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly data = signal<FinancialDashboardData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly issuesByMonthItems = computed<BarChartItem[]>(() =>
    (this.data()?.issuesByMonth ?? []).map((m) => ({ label: m.monthLabel, value: m.total, colorClass: 'bg-primary' }))
  );

  protected readonly receivableStatusItems = computed<BarChartItem[]>(() => {
    const status = this.data()?.receivableStatus;
    if (!status) {
      return [];
    }
    return [
      { label: this.languageService.t('accountReceivables.status.pending'), value: status.pendingTotal, colorClass: 'bg-danger' },
      { label: this.languageService.t('accountReceivables.status.paid'), value: status.paidTotal, colorClass: 'bg-primary' }
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
    return amount.toFixed(2);
  }
}
