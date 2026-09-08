import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService, SpecialCaseItem } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { PartySearchInput, PartySearchResult } from '../../../../shared/components/party-search-input/party-search-input';
import { Tooltip } from '../../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupplierRequest } from '../../suppliers/supplier.models';
import { SupplierService } from '../../suppliers/supplier.service';
import { Client, ClientRequest } from '../client.models';
import { ClientService } from '../client.service';

export interface ClientFormDialogData {
  client: Client | null;
}

interface LinkedIdentity {
  partyId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  mobilePhone: string | null;
}

let nextComplementId = 0;

@Component({
  selector: 'app-client-form-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, Checkbox, PartySearchInput, Tooltip, TranslatePipe],
  templateUrl: './client-form-dialog.html',
})
export class ClientFormDialog {
  private readonly data = inject<ClientFormDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<number | null, ClientFormDialog>);
  private readonly catalogService = inject(CatalogService);
  private readonly clientService = inject(ClientService);
  private readonly supplierService = inject(SupplierService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.client;
  protected readonly complementId = `client-complement-${nextComplementId++}`;

  // --- Cliente que también es Proveedor: sin diálogos anidados, todo en este mismo formulario ---

  /** Ya registrado como Cliente: si además existe como Proveedor, viene resuelto del backend. */
  protected readonly linkedSupplier = computed(() => {
    const client = this.data.client;
    return client?.linkedSupplierId ? { id: client.linkedSupplierId, name: client.linkedSupplierName ?? '' } : null;
  });

  /** Solo al crear: identidad de un Proveedor ya existente elegida para compartir Nombre/NIT/Correo/Teléfono. */
  protected readonly linkedParty = signal<LinkedIdentity | null>(null);

  /** Registrar además como Proveedor nuevo (comparte esta misma identidad). */
  protected readonly alsoRegisterAsSupplier = new FormControl(false, { nonNullable: true });
  protected readonly alsoRegisterAsSupplierValue = toSignal(
    this.alsoRegisterAsSupplier.valueChanges.pipe(startWith(this.alsoRegisterAsSupplier.value), takeUntilDestroyed()),
    { initialValue: false }
  );
  protected readonly supplierCountryId = new FormControl('', { nonNullable: true });
  protected readonly supplierLegalName = new FormControl('', { nonNullable: true });
  protected readonly countries = signal<CatalogItem[]>([]);
  protected readonly countryOptions = computed<SelectOption[]>(() =>
    this.countries().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly documentTypes = signal<CatalogItem[]>([]);
  protected readonly districts = signal<CatalogItem[]>([]);
  protected readonly churches = signal<CatalogItem[]>([]);
  protected readonly specialCases = signal<SpecialCaseItem[]>([]);

  protected readonly documentTypeOptions = computed<SelectOption[]>(() =>
    this.documentTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly districtOptions = computed<SelectOption[]>(() =>
    this.districts().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly churchOptions = computed<SelectOption[]>(() =>
    this.churches().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly specialCaseOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('clients.form.specialCaseNone') },
    ...this.specialCases().map((item) => ({ value: String(item.id), label: `${item.code} (${item.name})` })),
  ]);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.client?.name ?? '', { nonNullable: true }),
    documentTypeId: new FormControl(
      this.data.client?.documentTypeId ? String(this.data.client.documentTypeId) : '',
      { nonNullable: true }
    ),
    taxId: new FormControl(this.data.client?.taxId ?? '', { nonNullable: true }),
    complement: new FormControl(this.data.client?.complement ?? '', { nonNullable: true }),
    specialCaseId: new FormControl(
      this.data.client?.specialCaseId ? String(this.data.client.specialCaseId) : '',
      { nonNullable: true }
    ),
    email: new FormControl(this.data.client?.email ?? '', { nonNullable: true }),
    mobilePhone: new FormControl(this.data.client?.mobilePhone ?? '', { nonNullable: true }),
    districtId: new FormControl(this.data.client?.districtId ? String(this.data.client.districtId) : '', {
      nonNullable: true,
    }),
    churchId: new FormControl(this.data.client?.churchId ? String(this.data.client.churchId) : '', {
      nonNullable: true,
    }),
    isActive: new FormControl(this.data.client?.isActive ?? true, { nonNullable: true }),
    isPastor: new FormControl(this.data.client?.isPastor ?? false, { nonNullable: true }),
  });

  private readonly documentTypeIdValue = toSignal(
    this.form.controls.documentTypeId.valueChanges.pipe(
      startWith(this.form.controls.documentTypeId.value),
      takeUntilDestroyed()
    ),
    { initialValue: this.form.controls.documentTypeId.value }
  );

  /** El Complemento (verificador del NIT) solo aplica cuando el tipo de documento es NIT. */
  protected readonly isNitDocumentType = computed(() => {
    const id = Number(this.documentTypeIdValue());
    if (!id) {
      return false;
    }
    return this.documentTypes().find((item) => item.id === id)?.name.trim().toUpperCase() === 'NIT';
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  private readonly districtIdValue = toSignal(
    this.form.controls.districtId.valueChanges.pipe(
      startWith(this.form.controls.districtId.value),
      takeUntilDestroyed()
    ),
    { initialValue: this.form.controls.districtId.value }
  );

  private readonly specialCaseIdValue = toSignal(
    this.form.controls.specialCaseId.valueChanges.pipe(
      startWith(this.form.controls.specialCaseId.value),
      takeUntilDestroyed()
    ),
    { initialValue: this.form.controls.specialCaseId.value }
  );

  private readonly selectedSpecialCase = computed(() =>
    this.specialCases().find((item) => String(item.id) === this.specialCaseIdValue()) ?? null
  );

  protected readonly hasSpecialCase = computed(() => !!this.selectedSpecialCase());

  /** 99001 (Extranjeros no inscritos) no trae un nombre fijo: el nombre queda editable. */
  protected readonly specialCaseLocksName = computed(() => this.selectedSpecialCase()?.code !== '99001');

  /** El resto del formulario queda bloqueado hasta resolver Caso Especial y "¿es también Proveedor?"
   *  primero: en la práctica nadie lee esas opciones si ya puede escribir el Nombre de una vez. */
  protected readonly decisionsConfirmed = signal(this.isEdit);

  /** Pantalla inicial (solo al crear): dos botones grandes en vez de un párrafo para explicar,
   *  para que la elección misma sea la explicación. */
  protected readonly preStage = signal<'choose' | 'link' | 'special'>('choose');

  protected readonly saveDisabled = computed(
    () => !this.decisionsConfirmed() || this.formInvalid() || this.saving()
  );

  protected readonly specialCaseSummary = computed(() => {
    const selected = this.selectedSpecialCase();
    return selected ? `${selected.code} (${selected.name})` : this.languageService.t('clients.form.specialCaseNone');
  });

  constructor() {
    void this.loadCatalogs();

    // La Iglesia se maneja por Distrito: al cambiar el Distrito se recarga la lista
    // de Iglesias filtrada por ese distrito y se limpia la Iglesia elegida antes.
    this.form.controls.districtId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.form.controls.churchId.setValue('');
      void this.loadChurches(value ? Number(value) : null);
    });

    // La Iglesia queda bloqueada hasta que se elija un Distrito.
    effect(() => {
      this.form.controls.churchId[this.districtIdValue() ? 'enable' : 'disable']({ emitEvent: false });
    });

    effect(() => {
      if (this.isNitDocumentType()) {
        this.form.controls.complement.enable({ emitEvent: false });
      } else {
        this.form.controls.complement.disable({ emitEvent: false });
        this.form.controls.complement.setValue('', { emitEvent: false });
      }
    });

    // Los campos que rellena un caso especial se bloquean mientras esté elegido, para
    // que no queden editables con datos que en realidad dicta el caso especial. Lo
    // mismo aplica si se vinculó a la identidad de un Proveedor ya existente: esos
    // datos ya no se escriben aquí, vienen de esa identidad compartida.
    effect(() => {
      const specialCaseLocked = this.hasSpecialCase();
      const partyLocked = !!this.linkedParty();
      this.form.controls.documentTypeId[specialCaseLocked ? 'disable' : 'enable']({ emitEvent: false });
      this.form.controls.taxId[specialCaseLocked || partyLocked ? 'disable' : 'enable']({ emitEvent: false });
      this.form.controls.name[(specialCaseLocked && this.specialCaseLocksName()) || partyLocked ? 'disable' : 'enable']({ emitEvent: false });
      this.form.controls.email[partyLocked ? 'disable' : 'enable']({ emitEvent: false });
      this.form.controls.mobilePhone[partyLocked ? 'disable' : 'enable']({ emitEvent: false });
    });

    // Un caso especial reemplaza el NIT real: al elegirlo, se rellenan Carnet/NIT y
    // Nombres y Apellidos con el código y la descripción del caso (convención del SIN).
    // Al volver a "Ninguna" se limpian esos mismos campos.
    this.form.controls.specialCaseId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const selected = this.specialCases().find((item) => String(item.id) === value);
      if (!selected) {
        this.form.controls.documentTypeId.setValue('');
        this.form.controls.taxId.setValue('');
        this.form.controls.name.setValue('');
        return;
      }

      const nitDocumentType = this.documentTypes().find((item) => item.name.trim().toUpperCase() === 'NIT');
      if (nitDocumentType) {
        this.form.controls.documentTypeId.setValue(String(nitDocumentType.id));
      }
      this.form.controls.taxId.setValue(selected.code);

      // 99001 (Extranjeros no inscritos) no tiene un nombre fijo: se limpia el
      // campo para que escriban el nombre real del extranjero, en vez de dejar
      // el nombre que haya quedado de un caso especial seleccionado antes.
      this.form.controls.name.setValue(selected.code === '99001' ? '' : selected.name);
    });
  }

  protected onContinue(): void {
    this.decisionsConfirmed.set(true);
  }

  protected onEditDecisions(): void {
    this.decisionsConfirmed.set(false);
    this.preStage.set(this.linkedParty() ? 'link' : this.hasSpecialCase() ? 'special' : 'choose');
  }

  /** "Cliente nuevo": el caso más común, directo al formulario sin nada más que resolver. */
  protected chooseNew(): void {
    this.decisionsConfirmed.set(true);
  }

  protected chooseLink(): void {
    this.preStage.set('link');
  }

  protected chooseSpecial(): void {
    this.preStage.set('special');
  }

  protected backToChoose(): void {
    this.preStage.set('choose');
  }

  /** Elegido en el buscador en vivo: comparte identidad y ya no tiene sentido además marcar "registrar como Proveedor nuevo". */
  protected onSupplierPicked(result: PartySearchResult): void {
    this.linkedParty.set(result);
    this.form.controls.name.setValue(result.name);
    this.form.controls.taxId.setValue(result.taxId ?? '');
    this.form.controls.email.setValue(result.email ?? '');
    this.form.controls.mobilePhone.setValue(result.mobilePhone ?? '');
    this.alsoRegisterAsSupplier.setValue(false);
    this.decisionsConfirmed.set(true);
  }

  private async loadCatalogs(): Promise<void> {
    const initialDistrictId = this.form.controls.districtId.value;
    const [documentTypes, districts, churches, specialCases, countries] = await settleCatalogs([
      this.catalogService.getDocumentTypes(),
      this.catalogService.getDistricts(),
      this.catalogService.getChurches(initialDistrictId ? Number(initialDistrictId) : null),
      this.catalogService.getSpecialCases(),
      this.catalogService.getCountries(),
    ]);
    this.documentTypes.set(documentTypes);
    this.districts.set(districts);
    this.churches.set(churches);
    this.specialCases.set(specialCases);
    this.countries.set(countries);
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
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    const request: ClientRequest = {
      clientId: this.data.client?.clientId ?? 0,
      partyId: this.linkedParty()?.partyId,
      name: raw.name,
      documentTypeId: raw.documentTypeId ? Number(raw.documentTypeId) : null,
      taxId: raw.taxId || null,
      complement: raw.complement || null,
      specialCaseId: raw.specialCaseId ? Number(raw.specialCaseId) : null,
      email: raw.email || null,
      mobilePhone: raw.mobilePhone || null,
      districtId: raw.districtId ? Number(raw.districtId) : null,
      churchId: raw.churchId ? Number(raw.churchId) : null,
      isActive: raw.isActive,
      isPastor: raw.isPastor,
    };

    try {
      let clientId = request.clientId;
      let clientPartyId = this.data.client?.partyId ?? null;
      if (this.isEdit) {
        await this.clientService.update(request.clientId, request);
      } else {
        const response = await this.clientService.create(request);
        clientId = response.id;
      }

      let successKey = 'clients.form.success';
      if (this.alsoRegisterAsSupplier.value) {
        if (clientPartyId === null) {
          const created = await this.clientService.list(1, 1, { clientId });
          clientPartyId = created.items[0]?.partyId ?? null;
        }
        if (clientPartyId !== null) {
          const supplierRequest: SupplierRequest = {
            supplierId: 0,
            partyId: clientPartyId,
            name: raw.name,
            taxId: raw.taxId || null,
            email: raw.email || null,
            mobilePhone: raw.mobilePhone || null,
            countryId: this.supplierCountryId.value ? Number(this.supplierCountryId.value) : null,
            legalName: this.supplierLegalName.value || null,
            isActive: true,
          };
          await this.supplierService.create(supplierRequest);
          successKey = 'clients.form.successWithSupplier';
        }
      }

      this.toastService.show(this.languageService.t(successKey));
      this.dialogRef.close(clientId);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('clients.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
