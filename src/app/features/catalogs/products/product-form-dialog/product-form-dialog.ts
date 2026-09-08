import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Product, ProductRequest } from '../product.models';
import { ProductService } from '../product.service';

export interface ProductFormDialogData {
  product: Product | null;
}

@Component({
  selector: 'app-product-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, Checkbox, TranslatePipe],
  templateUrl: './product-form-dialog.html',
})
export class ProductFormDialog {
  private readonly data = inject<ProductFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ProductFormDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.product;
  protected readonly productCode = this.data.product?.code ?? null;

  protected readonly departments = signal<CatalogItem[]>([]);
  protected readonly subDepartments = signal<CatalogItem[]>([]);
  protected readonly mediaTypes = signal<CatalogItem[]>([]);

  protected readonly departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly subDepartmentOptions = computed<SelectOption[]>(() =>
    this.subDepartments().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly mediaTypeOptions = computed<SelectOption[]>(() =>
    this.mediaTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.product?.name ?? '', { nonNullable: true }),
    departmentId: new FormControl(
      this.data.product?.departmentId ? String(this.data.product.departmentId) : '',
      { nonNullable: true }
    ),
    subDepartmentId: new FormControl(
      this.data.product?.subDepartmentId ? String(this.data.product.subDepartmentId) : '',
      { nonNullable: true }
    ),
    mediaTypeId: new FormControl(
      this.data.product?.mediaTypeId ? String(this.data.product.mediaTypeId) : '',
      { nonNullable: true }
    ),
    price: new FormControl(this.data.product?.price != null ? String(this.data.product.price) : '', {
      nonNullable: true,
    }),
    isActive: new FormControl(this.data.product?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  protected readonly saveDisabled = computed(() => this.formInvalid() || this.saving());

  constructor() {
    void this.loadCatalogs();

    const departmentControl = this.form.controls.departmentId;
    const subDepartmentControl = this.form.controls.subDepartmentId;

    if (!departmentControl.value) {
      subDepartmentControl.disable();
    }

    departmentControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value) {
        subDepartmentControl.enable();
      } else {
        subDepartmentControl.disable();
        subDepartmentControl.reset('');
      }
    });
  }

  private async loadCatalogs(): Promise<void> {
    const [departments, subDepartments, mediaTypes] = await settleCatalogs([
      this.catalogService.getDepartments(),
      this.catalogService.getSubDepartments(),
      this.catalogService.getMediaTypes(),
    ]);
    this.departments.set(departments);
    this.subDepartments.set(subDepartments);
    this.mediaTypes.set(mediaTypes);
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: ProductRequest = {
      productId: this.data.product?.productId ?? 0,
      name: raw.name,
      departmentId: raw.departmentId ? Number(raw.departmentId) : null,
      subDepartmentId: raw.subDepartmentId ? Number(raw.subDepartmentId) : null,
      mediaTypeId: raw.mediaTypeId ? Number(raw.mediaTypeId) : null,
      price: raw.price ? Number(raw.price) : null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.productService.update(request.productId, request);
      } else {
        await this.productService.create(request);
      }
      this.toastService.show(this.languageService.t('products.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('products.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
