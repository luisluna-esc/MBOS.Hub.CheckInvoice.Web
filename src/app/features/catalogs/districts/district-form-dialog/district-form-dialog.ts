import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { District, DistrictRequest } from '../district.models';
import { DistrictService } from '../district.service';

export interface DistrictFormDialogData {
  district: District | null;
}

@Component({
  selector: 'app-district-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, Checkbox, TranslatePipe],
  templateUrl: './district-form-dialog.html',
})
export class DistrictFormDialog {
  private readonly data = inject<DistrictFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, DistrictFormDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly districtService = inject(DistrictService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.district;
  protected readonly districtCode = this.data.district?.code ?? null;

  protected readonly missions = signal<CatalogItem[]>([]);
  protected readonly provinces = signal<CatalogItem[]>([]);

  protected readonly missionOptions = computed<SelectOption[]>(() =>
    this.missions().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly provinceOptions = computed<SelectOption[]>(() =>
    this.provinces().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly form = new FormGroup({
    districtName: new FormControl(this.data.district?.districtName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    missionId: new FormControl(this.data.district?.missionId ? String(this.data.district.missionId) : '', {
      nonNullable: true,
    }),
    provinceId: new FormControl(this.data.district?.provinceId ? String(this.data.district.provinceId) : '', {
      nonNullable: true,
    }),
    isActive: new FormControl(this.data.district?.isActive ?? true, { nonNullable: true }),
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
  }

  private async loadCatalogs(): Promise<void> {
    const [missions, provinces] = await settleCatalogs([
      this.catalogService.getMissions(),
      this.catalogService.getProvinces(),
    ]);
    this.missions.set(missions);
    this.provinces.set(provinces);
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: DistrictRequest = {
      districtId: this.data.district?.districtId ?? 0,
      districtName: raw.districtName,
      missionId: raw.missionId ? Number(raw.missionId) : null,
      provinceId: raw.provinceId ? Number(raw.provinceId) : null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.districtService.update(request.districtId, request);
      } else {
        await this.districtService.create(request);
      }
      this.toastService.show(this.languageService.t('districts.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('districts.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
