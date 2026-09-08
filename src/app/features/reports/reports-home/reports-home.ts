import { Component } from '@angular/core';
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FinancialDashboardReport } from '../financial-dashboard-report/financial-dashboard-report';

@Component({
  selector: 'app-reports-home',
  imports: [FinancialDashboardReport, Tooltip, TranslatePipe],
  templateUrl: './reports-home.html',
})
export class ReportsHome {}
