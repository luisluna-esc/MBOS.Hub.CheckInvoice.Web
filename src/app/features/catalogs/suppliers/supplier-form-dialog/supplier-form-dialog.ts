import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { PartySearchInput, PartySearchResult } from '../../../../shared/components/party-search-input/party-search-input';
import { Tooltip } from '../../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientRequest } from '../../clients/client.models';
import { ClientService } from '../../clients/client.service';
import { Supplier, SupplierRequest } from '../supplier.models';
import { SupplierService } from '../supplier.service';

export interface SupplierFormDialogData {
  supplier: Supplier | null;
}

interface LinkedIdentity {
  partyId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  mobilePhone: string | null;
}

@Component({
  selector: 'app-supplier-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, Checkbox, PartySearchInput, Tooltip, TranslatePipe],
  templateUrl: './supplier-form-dialog.html',
})
export class SupplierFormDialog {
  private readonly data = inject<SupplierFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<number | null, SupplierFormDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly supplierService = inject(SupplierService);
  private readonly clientService = inject(ClientService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.supplier;
  protected readonly supplierCode = this.data.supplier?.code ?? null;

  // --- Proveedor que también es Cliente: sin diálogos anidados, todo en este mismo formulario ---

  /** Ya registrado como Proveedor: si además existe como Cliente, viene resuelto del backend. */
  protected readonly linkedClient = computed(() => {
    const supplier = this.data.supplier;
    return supplier?.linkedClientId ? { id: supplier.linkedClientId, name: supplier.linkedClientName ?? '' } : null;
  });

  /** Solo al crear: identidad de un Cliente ya existente elegida para compartir Nombre/NIT/Correo/Teléfono. */
  protected readonly linkedParty = signal<LinkedIdentity | null>(null);

  /** Registrar además como Cliente nuevo (comparte esta misma identidad). */
  protected readonly alsoRegisterAsClient = new FormControl(false, { nonNullable: true });
  protected readonly alsoRegisterAsClientValue = toSignal(
    this.alsoRegisterAsClient.valueChanges.pipe(startWith(this.alsoRegisterAsClient.value), takeUntilDestroyed()),
    { initialValue: false }
  );
  protected readonly clientDistrictId = new FormControl('', { nonNullable: true });
  protected readonly clientChurchId = new FormControl('', { nonNullable: true });
  protected readonly districts = signal<CatalogItem[]>([]);
  protected readonly churches = signal<CatalogItem[]>([]);
  protected readonly districtOptions = computed<SelectOption[]>(() =>
    this.districts().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly churchOptions = computed<SelectOption[]>(() =>
    this.churches().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly countries = signal<CatalogItem[]>([]);
  protected readonly countryOptions = computed<SelectOption[]>(() =>
    this.countries().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly form = new FormGroup({
    legalName: new FormControl(this.data.supplier?.legalName ?? '', { nonNullable: true }),
    name: new FormControl(this.data.supplier?.name ?? '', { nonNullable: true }),
    taxId: new FormControl(this.data.supplier?.taxId ?? '', { nonNullable: true }),
    countryId: new FormControl(
      this.data.supplier?.countryId ? String(this.data.supplier.countryId) : '',
      { nonNullable: true }
    ),
    address: new FormControl(this.data.supplier?.address ?? '', { nonNullable: true }),
    mobilePhone: new FormControl(this.data.supplier?.mobilePhone ?? '', { nonNullable: true }),
    email: new FormControl(this.data.supplier?.email ?? '', { nonNullable: true }),
    notes: new FormControl(this.data.supplier?.notes ?? '', { nonNullable: true }),
    isActive: new FormControl(this.data.supplier?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  /** El resto del formulario queda bloqueado hasta resolver "¿es también Cliente?" primero:
   *  en la práctica nadie lee esas opciones si ya puede escribir el Nombre de una vez. */
  protected readonly decisionsConfirmed = signal(this.isEdit);

  /** Pantalla inicial (solo al crear): dos botones grandes en vez de un párrafo para explicar,
   *  para que la elección misma sea la explicación. */
  protected readonly preStage = signal<'choose' | 'link'>('choose');

  protected readonly saveDisabled = computed(
    () => !this.decisionsConfirmed() || this.formInvalid() || this.saving()
  );

  constructor() {
    void this.loadCatalogs();

    this.clientDistrictId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.clientChurchId.setValue('');
      void this.loadChurches(value ? Number(value) : null);
    });
  }

  protected onContinue(): void {
    this.decisionsConfirmed.set(true);
  }

  protected onEditDecisions(): void {
    this.decisionsConfirmed.set(false);
    this.preStage.set(this.linkedParty() ? 'link' : 'choose');
  }

  /** "Proveedor nuevo": el caso más común, directo al formulario sin nada más que resolver. */
  protected chooseNew(): void {
    this.decisionsConfirmed.set(true);
  }

  protected chooseLink(): void {
    this.preStage.set('link');
  }

  protected backToChoose(): void {
    this.preStage.set('choose');
  }

  /** Elegido en el buscador en vivo: comparte identidad y ya no tiene sentido además marcar "registrar como Cliente nuevo". */
  protected onClientPicked(result: PartySearchResult): void {
    this.linkedParty.set(result);
    this.form.controls.name.setValue(result.name);
    this.form.controls.taxId.setValue(result.taxId ?? '');
    this.form.controls.email.setValue(result.email ?? '');
    this.form.controls.mobilePhone.setValue(result.mobilePhone ?? '');
    this.form.controls.name.disable({ emitEvent: false });
    this.form.controls.taxId.disable({ emitEvent: false });
    this.form.controls.email.disable({ emitEvent: false });
    this.form.controls.mobilePhone.disable({ emitEvent: false });
    this.alsoRegisterAsClient.setValue(false);
    this.decisionsConfirmed.set(true);
  }

  private async loadCatalogs(): Promise<void> {
    this.countries.set(await this.catalogService.getCountries());
    this.districts.set(await this.catalogService.getDistricts());
  }

  private async loadChurches(districtId: number | null): Promise<void> {
    this.churches.set(districtId ? await this.catalogService.getChurches(districtId) : []);
  }

  protected clearLinkedParty(): void {
    this.linkedParty.set(null);
    this.form.controls.name.setValue('');
    this.form.controls.taxId.setValue('');
    this.form.controls.email.setValue('');
    this.form.controls.mobilePhone.setValue('');
    this.form.controls.name.enable({ emitEvent: false });
    this.form.controls.taxId.enable({ emitEvent: false });
    this.form.controls.email.enable({ emitEvent: false });
    this.form.controls.mobilePhone.enable({ emitEvent: false });
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: SupplierRequest = {
      supplierId: this.data.supplier?.supplierId ?? 0,
      partyId: this.linkedParty()?.partyId,
      legalName: raw.legalName || null,
      name: raw.name,
      taxId: raw.taxId || null,
      countryId: raw.countryId ? Number(raw.countryId) : null,
      address: raw.address || null,
      // Ya no se edita desde el formulario; se conserva el valor existente tal cual para no
      // borrarlo en registros que ya lo tenían antes de quitar el campo.
      phone: this.data.supplier?.phone ?? null,
      mobilePhone: raw.mobilePhone || null,
      email: raw.email || null,
      notes: raw.notes || null,
      isActive: raw.isActive,
    };

    try {
      let supplierId = request.supplierId;
      let supplierPartyId = this.data.supplier?.partyId ?? null;
      if (this.isEdit) {
        await this.supplierService.update(request.supplierId, request);
      } else {
        const response = await this.supplierService.create(request);
        supplierId = response.id;
      }

      let successKey = 'suppliers.form.success';
      if (this.alsoRegisterAsClient.value) {
        if (supplierPartyId === null) {
          const created = await this.supplierService.list(1, 1, { supplierId });
          supplierPartyId = created.items[0]?.partyId ?? null;
        }
        if (supplierPartyId !== null) {
          const clientRequest: ClientRequest = {
            clientId: 0,
            partyId: supplierPartyId,
            name: raw.name,
            taxId: raw.taxId || null,
            email: raw.email || null,
            mobilePhone: raw.mobilePhone || null,
            districtId: this.clientDistrictId.value ? Number(this.clientDistrictId.value) : null,
            churchId: this.clientChurchId.value ? Number(this.clientChurchId.value) : null,
            isActive: true,
            isPastor: false,
          };
          await this.clientService.create(clientRequest);
          successKey = 'suppliers.form.successWithClient';
        }
      }

      this.toastService.show(this.languageService.t(successKey));
      this.dialogRef.close(supplierId);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('suppliers.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
