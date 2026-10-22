import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { InfoHint } from '../../../shared/components/info-hint/info-hint';
import { reportReviewStateOptions, toReportReviewState } from '../../../core/reviews/review-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Table, TableColumn } from '../../../shared/components/table/table';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ExcelDownloadButton, TxtDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ALL_WAREHOUSES_VALUE, warehouseIdFilter, warehouseOptionsWithGeneral } from '../report-warehouse.util';
import { AccountingEntryRow, AccountingKind, AccountingReportFilters } from '../report.models';
import { ReportService } from '../report.service';

/** "-135,72": el valor como sale en el archivo para contabilidad. */
function accountingAmount(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Valor del filtro "Tipo de entrada" que significa "todos". */
const ALL_TYPES_VALUE = 'all';

/**
 * Salidas o Ingresos para contabilidad (según la ruta): una fila por producto de cada documento,
 * en el formato que se importa en el sistema contable. Se revisa en la tabla y se descarga el
 * Excel listo para importar.
 */
@Component({
  selector: 'app-accounting-report',
  imports: [FormsModule, Select, DatePicker, Table, InfoHint, ExcelDownloadButton, TxtDownloadButton, TranslatePipe],
  templateUrl: './accounting-report.html',
})
export class AccountingReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  /** Viene de la ruta (data.kind): 'issues' (salidas) o 'receipts' (entradas). */
  readonly kind = input<AccountingKind>('issues');
  /** Prefijo de los textos de la pantalla según el informe. */
  protected readonly texts = computed(() => (this.kind() === 'issues' ? 'reports.issuesAccounting' : 'reports.receiptsAccounting'));

  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly receiptTypes = signal<SelectOption[]>([]);
  protected readonly warehouseId = signal<string | null>(ALL_WAREHOUSES_VALUE);
  protected readonly receiptTypeId = signal<string | null>(ALL_TYPES_VALUE);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);
  /** Estado: "Solo actualizado" (firmado) o "Actualizado y sin actualizar" (todo). */
  protected readonly reviewState = signal<string | null>('updated');
  protected readonly reviewStates = computed(() => reportReviewStateOptions((key) => this.languageService.t(key)));

  protected readonly rows = signal<AccountingEntryRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportingTxt = signal(false);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly pageRows = computed(() => {
    const start = (this.pageNumber() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  protected readonly total = computed(() => accountingAmount(this.rows().reduce((sum, row) => sum + row.entityValue, 0)));
  protected readonly documentCount = computed(() => new Set(this.rows().map((row) => row.documentId)).size);

  /** Departamentos de los productos que todavía no tienen código contable cargado. */
  protected readonly departmentsWithoutCode = computed(() => {
    const names = this.rows()
      .filter((row) => !row.subAccountCode)
      .map((row) => row.departmentName ?? this.languageService.t('reports.issuesAccounting.noDepartment'));
    return [...new Set(names)].sort();
  });

  protected readonly columns = computed<TableColumn<AccountingEntryRow>[]>(() => [
    { key: 'accountCode', header: 'AccountCode' },
    {
      key: 'subAccountCode',
      header: 'SubAccountCode',
      format: (value, row) => (value as string) || `⚠ ${row.departmentName ?? '—'}`,
    },
    { key: 'fundCode', header: 'FundCode', align: 'center' },
    { key: 'functionCode', header: 'FunctionCode', align: 'center' },
    { key: 'restrictionCode', header: 'RestrictionCode', align: 'center' },
    { key: 'entityValue', header: 'EntityValue', align: 'right', format: (value) => accountingAmount(value as number) },
    { key: 'sendMemo', header: 'SendMemo', align: 'center' },
    { key: 'description', header: 'Description' },
  ]);

  constructor() {
    void this.loadCatalogs();
    effect(() => {
      const kind = this.kind();
      const filters = this.currentFilters();
      void this.load(kind, filters);
    });
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, receiptTypes] = await Promise.all([
      this.catalogService.getWarehouses(),
      this.catalogService.getReceiptTypes().catch(() => []),
    ]);
    this.warehouses.set(warehouseOptionsWithGeneral(warehouses, this.languageService.t('reports.filters.allWarehouses')));
    this.receiptTypes.set([
      { value: ALL_TYPES_VALUE, label: this.languageService.t('reports.receiptsAccounting.allTypes') },
      ...receiptTypes.map((item) => ({ value: String(item.id), label: item.name })),
    ]);
  }

  private currentFilters(): AccountingReportFilters {
    const type = this.receiptTypeId();
    return {
      warehouseId: warehouseIdFilter(this.warehouseId()),
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined,
      reviewState: toReportReviewState(this.reviewState()),
      receiptTypeId: type && type !== ALL_TYPES_VALUE ? Number(type) : undefined,
    };
  }

  private async load(kind: AccountingKind, filters: AccountingReportFilters): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.reportService.getAccounting(kind, filters));
      this.pageNumber.set(1);
    } catch {
      this.toastService.error(this.languageService.t(`${this.texts()}.error`));
    } finally {
      this.loading.set(false);
    }
  }

  protected async onExportExcel(): Promise<void> {
    const filters = this.currentFilters();
    this.exporting.set(true);
    try {
      const range = filters.dateFrom && filters.dateTo ? `-${filters.dateFrom}-al-${filters.dateTo}` : '';
      const name = this.kind() === 'issues' ? 'salidas-contabilidad' : 'ingresos-contabilidad';
      downloadBlob(await this.reportService.getAccountingExcelBlob(this.kind(), filters), `${name}${range}.xlsx`);
    } catch {
      this.toastService.error(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected async onExportTxt(): Promise<void> {
    const filters = this.currentFilters();
    this.exportingTxt.set(true);
    try {
      const range = filters.dateFrom && filters.dateTo ? `-${filters.dateFrom}-al-${filters.dateTo}` : '';
      const name = this.kind() === 'issues' ? 'salidas-contabilidad' : 'ingresos-contabilidad';
      downloadBlob(await this.reportService.getAccountingTxtBlob(this.kind(), filters), `${name}${range}.txt`);
    } catch {
      this.toastService.error(this.languageService.t('reports.txt.error'));
    } finally {
      this.exportingTxt.set(false);
    }
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
  }
}
