import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { operationalWarehouseOnly } from '../../../../core/catalogs/operational-warehouse';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { InfoHint } from '../../../../shared/components/info-hint/info-hint';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Issue, IssueFilters } from '../../issues/issue.models';
import { IssueService } from '../../issues/issue.service';
import { ReturnableIssueLine } from '../../receipts/receipt.models';
import { ReceiptService } from '../../receipts/receipt.service';

interface ReturnLineRow {
  productId: number;
  productName: string;
  quantityIssued: number;
  quantityAlreadyReturned: number;
  quantityReturnable: number;
  quantityControl: FormControl<string>;
}

@Component({
  selector: 'app-issue-return-create',
  imports: [Filters, Table, ErrorState, ReactiveFormsModule, AppInput, TranslatePipe, InfoHint],
  templateUrl: './issue-return-create.html',
})
export class IssueReturnCreate {
  private readonly issueService = inject(IssueService);
  private readonly receiptService = inject(ReceiptService);
  private readonly catalogService = inject(CatalogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly selectedIssue = signal<Issue | null>(null);
  protected readonly selectedIssueVoucher = computed(() => {
    const issue = this.selectedIssue();
    return issue ? String(issue.issueId).padStart(5, '0') : '';
  });
  protected readonly selectedIssueDetail = computed(() => {
    const issue = this.selectedIssue();
    if (!issue) {
      return '';
    }
    const clientName = issue.clientId ? (this.nameMap(this.clients())[issue.clientId] ?? null) : null;
    const date = new Date(issue.issueDate).toLocaleDateString();
    return clientName ? `${clientName} · ${date}` : date;
  });

  protected readonly rows = signal<Issue[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly clients = signal<CatalogItem[]>([]);

  private currentFilters: IssueFilters = {};

  protected readonly formLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly lineRows = signal<ReturnLineRow[]>([]);
  private returnReceiptTypeId: number | null = null;

  protected readonly hasReturnableLines = computed(() => this.lineRows().some((row) => row.quantityReturnable > 0));
  protected readonly saveDisabled = computed(() => this.formLoading() || this.saving() || !this.hasReturnableLines());

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'issueId',
      label: this.languageService.t('issues.columns.voucherNumber'),
      type: 'text',
    },
    {
      key: 'warehouseId',
      label: this.languageService.t('issues.filters.warehouse'),
      type: 'select',
      options: operationalWarehouseOnly(this.warehouses()).map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'clientName',
      label: this.languageService.t('issues.filters.client'),
      type: 'text',
    },
  ]);

  protected readonly columns = computed<TableColumn<Issue>[]>(() => {
    const clientNames = this.nameMap(this.clients());

    return [
      {
        key: 'issueId',
        header: this.languageService.t('issues.columns.voucherNumber'),
        format: (value) => String(value).padStart(5, '0'),
      },
      {
        key: 'clientId',
        header: this.languageService.t('issues.columns.client'),
        format: (value) => (value ? (clientNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'issueDate',
        header: this.languageService.t('issues.columns.issueDate'),
        format: (value) => new Date(value as string).toLocaleDateString(),
      },
      {
        key: 'total',
        header: this.languageService.t('issues.columns.total'),
        align: 'right',
        format: (value) => (value != null ? Number(value).toFixed(2) : '—'),
      },
    ];
  });

  protected readonly actions = computed<TableAction<Issue>[]>(() => [
    {
      label: this.languageService.t('issueReturns.select'),
      icon: 'return',
      disabled: (row) => row.isVoided,
      disabledReason: (row) => (row.isVoided ? this.languageService.t('issueReturns.selectDisabledVoided') : null),
      onClick: (row) => this.selectIssue(row),
    },
  ]);

  constructor() {
    void this.loadCatalogs();
    void this.load();
  }

  private nameMap(items: CatalogItem[]): Record<number, string> {
    return Object.fromEntries(items.map((item) => [item.id, item.name]));
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, clients] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getClients(),
    ]);
    this.warehouses.set(warehouses);
    this.clients.set(clients);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.issueService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(values: FilterValues): void {
    this.currentFilters = {
      issueId: values['issueId'] ? Number(values['issueId']) : undefined,
      warehouseId: values['warehouseId'] ? Number(values['warehouseId']) : undefined,
      clientName: values['clientName'] || undefined,
    };
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.currentFilters = {};
    this.pageNumber.set(1);
    void this.load();
  }

  protected onPageChange(page: number): void {
    this.pageNumber.set(page);
    void this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    void this.load();
  }

  protected selectIssue(row: Issue): void {
    this.selectedIssue.set(row);
    void this.loadReturnableLines(row.issueId);
  }

  protected changeIssue(): void {
    this.selectedIssue.set(null);
    this.lineRows.set([]);
    void this.load();
  }

  private async loadReturnableLines(issueId: number): Promise<void> {
    this.formLoading.set(true);
    try {
      const [lines, products, receiptTypes] = await Promise.all([
        this.receiptService.getReturnableLines(issueId),
        this.catalogService.getProducts(),
        this.catalogService.getReceiptTypes(),
      ]);

      const productNames = Object.fromEntries(products.map((item) => [item.id, item.name]));
      this.returnReceiptTypeId = receiptTypes.find((item) => item.name === 'Devolucion')?.id ?? null;

      this.lineRows.set(
        lines.map((line: ReturnableIssueLine) => ({
          productId: line.productId,
          productName: productNames[line.productId] ?? `#${line.productId}`,
          quantityIssued: line.quantityIssued,
          quantityAlreadyReturned: line.quantityAlreadyReturned,
          quantityReturnable: line.quantityReturnable,
          quantityControl: new FormControl(
            { value: '0', disabled: line.quantityReturnable <= 0 },
            { nonNullable: true }
          ),
        }))
      );
    } finally {
      this.formLoading.set(false);
    }
  }

  protected async onSave(): Promise<void> {
    const issue = this.selectedIssue();
    if (!issue || this.saveDisabled()) {
      return;
    }

    if (this.returnReceiptTypeId === null) {
      this.toastService.show(this.languageService.t('issueReturns.error'));
      return;
    }

    const lines: { productId: number; quantity: number }[] = [];
    for (const row of this.lineRows()) {
      const quantity = Number(row.quantityControl.value || 0);
      if (quantity <= 0) {
        continue;
      }
      if (quantity > row.quantityReturnable) {
        this.toastService.show(this.languageService.t('issueReturns.exceedsReturnable', { product: row.productName }));
        return;
      }
      lines.push({ productId: row.productId, quantity });
    }

    if (lines.length === 0) {
      this.toastService.show(this.languageService.t('issueReturns.noLines'));
      return;
    }

    this.saving.set(true);
    try {
      await this.receiptService.createReturn({
        issueId: issue.issueId,
        receiptTypeId: this.returnReceiptTypeId,
        lines,
      });
      this.toastService.show(this.languageService.t('issueReturns.success'));
      this.changeIssue();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('issueReturns.error'), message);
    } finally {
      this.saving.set(false);
    }
  }
}
