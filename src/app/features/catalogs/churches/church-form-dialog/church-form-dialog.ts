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
import { Church, ChurchRequest } from '../church.models';
import { ChurchService } from '../church.service';

export interface ChurchFormDialogData {
  church: Church | null;
}

// Clasificación vigente para iglesias nuevas. Los tipos previos (Iglesia, Grupo, Núcleo,
// Filial) siguen existiendo en el catálogo solo para no romper las 498 iglesias ya
// importadas del Excel — no se ofrecen para elegir salvo que sean el valor ya asignado.
const CURRENT_CHURCH_TYPE_NAMES = ['Organizada', 'Congregacion', 'Corporacion'];

@Component({
  selector: 'app-church-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, Checkbox, TranslatePipe],
  templateUrl: './church-form-dialog.html',
})
export class ChurchFormDialog {
  private readonly data = inject<ChurchFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ChurchFormDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly churchService = inject(ChurchService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.church;

  protected readonly districts = signal<CatalogItem[]>([]);
  protected readonly churchTypes = signal<CatalogItem[]>([]);

  protected readonly districtOptions = computed<SelectOption[]>(() =>
    this.districts().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly churchTypeOptions = computed<SelectOption[]>(() => {
    const currentTypeId = this.data.church?.churchTypeId;
    return this.churchTypes()
      .filter((item) => CURRENT_CHURCH_TYPE_NAMES.includes(item.name) || item.id === currentTypeId)
      .map((item) => ({ value: String(item.id), label: item.name }));
  });

  protected readonly form = new FormGroup({
    code: new FormControl(this.data.church?.code ?? '', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    churchName: new FormControl(this.data.church?.churchName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    districtId: new FormControl(this.data.church?.districtId ? String(this.data.church.districtId) : '', {
      nonNullable: true,
    }),
    churchTypeId: new FormControl(this.data.church?.churchTypeId ? String(this.data.church.churchTypeId) : '', {
      nonNullable: true,
    }),
    isActive: new FormControl(this.data.church?.isActive ?? true, { nonNullable: true }),
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
    const [districts, churchTypes] = await settleCatalogs([
      this.catalogService.getDistricts(),
      this.catalogService.getChurchTypes(),
    ]);
    this.districts.set(districts);
    this.churchTypes.set(churchTypes);
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: ChurchRequest = {
      churchId: this.data.church?.churchId ?? 0,
      code: raw.code || null,
      churchName: raw.churchName,
      districtId: raw.districtId ? Number(raw.districtId) : null,
      churchTypeId: raw.churchTypeId ? Number(raw.churchTypeId) : null,
      isActive: raw.isActive,
    };

    try {
      if (this.isEdit) {
        await this.churchService.update(request.churchId, request);
      } else {
        await this.churchService.create(request);
      }
      this.toastService.show(this.languageService.t('churches.form.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('churches.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
