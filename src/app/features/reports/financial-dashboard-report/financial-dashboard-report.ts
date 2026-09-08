import { Component, inject, signal } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ReportService } from '../report.service';

@Component({
  selector: 'app-financial-dashboard-report',
  imports: [TranslatePipe],
  templateUrl: './financial-dashboard-report.html',
})
export class FinancialDashboardReport {
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly downloading = signal(false);

  protected async onDownload(): Promise<void> {
    this.downloading.set(true);
    try {
      await this.reportService.downloadFinancialDashboard();
    } catch {
      this.toastService.show(this.languageService.t('reports.financialDashboard.error'));
    } finally {
      this.downloading.set(false);
    }
  }
}
