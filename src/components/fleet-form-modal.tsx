'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, User, Camera, Upload, Trash2, Sparkles, Fuel } from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';
import type { Truck as TruckType, Driver, Trailer } from '@/types/database';
import { DEFAULT_DRIVERS, DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';
import { DriverAvatar } from '@/components/drivers/DriverAvatar';
import { PRESET_DRIVER_AVATARS, compressImageFile, saveDriverPhotoLocal, resolveDriverPhoto } from '@/lib/driver-photos';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

type EntityType = 'truck' | 'driver' | 'trailer';

interface FleetModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  initialData?: Partial<TruckType & Driver & Trailer> | null;
  driversList: Driver[];
  trucksList: TruckType[];
  trailersList?: Trailer[];
  onSave: (type: EntityType, data: any) => Promise<void>;
}

export function FleetFormModal({
  isOpen,
  onClose,
  entityType,
  initialData,
  driversList,
  trucksList,
  trailersList = [],
  onSave,
}: FleetModalProps) {
  const { locale, dir, t } = useLanguage();
  const availableDrivers = fallbackArray(driversList, DEFAULT_DRIVERS);
  const availableTrucks = fallbackArray(trucksList, DEFAULT_TRUCKS);
  const availableTrailers = fallbackArray(trailersList, DEFAULT_TRAILERS);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [showPresets, setShowPresets] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // إدارة قسم واحد نشط فقط (Mutual Exclusion Accordion)
  const [activeTruckSection, setActiveTruckSection] = useState<'driver_trailer' | 'specs_fuel' | null>(null);
  const [activeDriverSection, setActiveDriverSection] = useState<'photo' | 'visa' | null>(null);

  // Deduplicate drivers by name to prevent repeated entries in the dropdown,
  // prioritizing the currently selected driver ID if active.
  const uniqueDrivers = useMemo(() => {
    const map = new Map<string, Driver>();
    for (const driver of availableDrivers) {
      const nameKey = driver.name?.trim().toLowerCase();
      if (!nameKey) continue;
      if (!map.has(nameKey) || driver.id === formData.default_driver_id) {
        map.set(nameKey, driver);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', locale === 'ar' ? 'ar' : 'fr', { sensitivity: 'base' })
    );
  }, [availableDrivers, formData.default_driver_id, locale]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      const resolvedPhoto = (initialData as any)?.photo_url || resolveDriverPhoto(initialData as any) || '';
      setFormData({
        ...initialData,
        fuel_consumption_rate:
          (initialData as any)?.fuel_consumption_rate !== undefined && (initialData as any)?.fuel_consumption_rate !== null
            ? (initialData as any).fuel_consumption_rate
            : 36.0,
        photo_url: resolvedPhoto,
      });
    } else {
      if (entityType === 'truck') {
        setFormData({
          plate_number: '',
          model: '',
          status: 'active',
          weight_capacity: '',
          power: '',
          fuel_consumption_rate: 36.0,
          default_driver_id: undefined,
          default_trailer_id: undefined,
        });
      } else if (entityType === 'driver') {
        setFormData({
          name: '',
          phone: '',
          license: '',
          base_salary: 0,
          status: 'active',
          default_truck_id: undefined,
          visa_number: '',
          visa_expiry_date: '',
          photo_url: '',
        });
      } else {
        setFormData({
          plate_number: '',
          model: '',
          status: 'active',
        });
      }
    }
    setShowPresets(false);
  }, [isOpen, initialData, entityType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for assignment conflicts
    if (entityType === 'truck') {
      const selectedDriverId = formData.default_driver_id ? parseInt(String(formData.default_driver_id)) : null;
      if (selectedDriverId && selectedDriverId !== initialData?.default_driver_id) {
        const assignedTruck = availableTrucks.find(
          (t) => t.id !== initialData?.id && t.default_driver_id === selectedDriverId
        );
        if (assignedTruck) {
          const driver = availableDrivers.find((d) => d.id === selectedDriverId);
          const driverName = driver?.name || t('السائق المختار', 'le chauffeur sélectionné');
          const confirmed = window.confirm(
            locale === 'fr'
              ? `⚠️ Réaffectation du chauffeur :\n\nLe chauffeur "${driverName}" est déjà assigné au camion (${assignedTruck.plate_number}).\n\nConfirmez-vous son transfert vers ce camion ?`
              : `⚠️ تنبيه إعادة تخصيص السائق:\n\nالسائق "${driverName}" مخصص مسبقاً للشاحنة (${assignedTruck.plate_number}).\n\nهل توافق على نقله وإلغاء تخصيصه من الشاحنة السابقة وتعيينه لهذه الشاحنة؟`
          );
          if (!confirmed) return;
        }
      }

      const selectedTrailerId = formData.default_trailer_id ? parseInt(String(formData.default_trailer_id)) : null;
      if (selectedTrailerId && selectedTrailerId !== initialData?.default_trailer_id) {
        const assignedTruck = availableTrucks.find(
          (t) => t.id !== initialData?.id && t.default_trailer_id === selectedTrailerId
        );
        if (assignedTruck) {
          const trailer = availableTrailers.find((tr) => tr.id === selectedTrailerId);
          const trailerLabel = trailer ? `${trailer.plate_number} ${trailer.model || ''}` : t('المقطورة المختارة', 'la remorque sélectionnée');
          const confirmed = window.confirm(
            locale === 'fr'
              ? `⚠️ Réaffectation de la remorque :\n\nLa remorque "${trailerLabel}" est déjà assignée au camion (${assignedTruck.plate_number}).\n\nConfirmez-vous son transfert vers ce camion ?`
              : `⚠️ تنبيه إعادة تخصيص المقطورة:\n\nالمقطورة "${trailerLabel}" مخصصة مسبقاً للشاحنة (${assignedTruck.plate_number}).\n\nهل توافق على نقلها وإلغاء تخصيصها من الشاحنة السابقة وتعيينها لهذه الشاحنة؟`
          );
          if (!confirmed) return;
        }
      }
    } else if (entityType === 'driver') {
      const selectedTruckId = formData.default_truck_id ? parseInt(String(formData.default_truck_id)) : null;
      if (selectedTruckId && selectedTruckId !== initialData?.default_truck_id) {
        const assignedDriver = availableDrivers.find(
          (d) => d.id !== initialData?.id && d.default_truck_id === selectedTruckId
        );
        if (assignedDriver) {
          const truck = availableTrucks.find((t) => t.id === selectedTruckId);
          const truckLabel = truck ? `${truck.plate_number} ${truck.model || ''}` : t('الشاحنة المختارة', 'le camion sélectionné');
          const confirmed = window.confirm(
            locale === 'fr'
              ? `⚠️ Réaffectation du camion :\n\nLe camion "${truckLabel}" est déjà assigné au chauffeur (${assignedDriver.name}).\n\nConfirmez-vous son transfert vers ce chauffeur ?`
              : `⚠️ تنبيه إعادة تعيين الشاحنة:\n\nالشاحنة "${truckLabel}" مخصصة مسبقاً للسائق (${assignedDriver.name}).\n\nهل توافق على نقلها وإلغاء تعيينها من السائق السابق؟`
          );
          if (!confirmed) return;
        }
      }
    }

    setLoading(true);
    try {
      let payload: any = {};
      if (entityType === 'truck') {
        payload = {
          plate_number: formData.plate_number?.trim() || '',
          model: formData.model?.trim() || '',
          status: formData.status || 'active',
          default_driver_id: formData.default_driver_id ? parseInt(String(formData.default_driver_id)) : null,
          default_trailer_id: formData.default_trailer_id ? parseInt(String(formData.default_trailer_id)) : null,
          weight_capacity: formData.weight_capacity ? parseFloat(formData.weight_capacity) : null,
          power: formData.power ? parseFloat(formData.power) : null,
          fuel_consumption_rate: formData.fuel_consumption_rate !== undefined && formData.fuel_consumption_rate !== '' ? parseFloat(formData.fuel_consumption_rate) : 36.0,
        };
      } else if (entityType === 'driver') {
        payload = {
          name: formData.name?.trim() || '',
          phone: formData.phone?.trim() || '',
          license: formData.license?.trim() || '',
          base_salary: formData.base_salary !== '' && formData.base_salary !== undefined ? parseFloat(formData.base_salary) : 0,
          status: formData.status || 'active',
          default_truck_id: formData.default_truck_id ? parseInt(String(formData.default_truck_id)) : null,
          visa_number: formData.visa_number?.trim() || null,
          visa_expiry_date: formData.visa_expiry_date || null,
          has_valid_visa: Boolean(formData.visa_expiry_date),
          photo_url: formData.photo_url?.trim() || null,
        };
        if (formData.photo_url) {
          saveDriverPhotoLocal(initialData?.id || formData.name, formData.photo_url, formData.name);
        }
      } else if (entityType === 'trailer') {
        payload = {
          plate_number: formData.plate_number?.trim() || '',
          model: formData.model?.trim() || '',
          status: formData.status || 'active',
        };
      }

      if (initialData?.id) {
        payload.id = initialData.id;
      }

      await onSave(entityType, payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const action = initialData?.id ? t('تعديل بيانات', 'Modifier') : t('إضافة', 'Ajouter');
    if (entityType === 'truck') return `${action} ${t('شاحنة', 'un camion')}`;
    if (entityType === 'driver') return `${action} ${t('سائق', 'un chauffeur')}`;
    return `${action} ${t('مقطورة (Remorque)', 'une remorque')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="w-full max-w-xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            {entityType === 'trailer' ? (
              <TrailerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            ) : entityType === 'driver' ? (
              <User className="w-5 h-5 text-amber-500" />
            ) : (
              <TruckIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
            {getTitle()}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
            {/* حقول الشاحنة */}
            {entityType === 'truck' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم اللوحة (Matricule) *', 'Numéro d\'immatriculation (Matricule) *')}</label>
                    <Input
                      value={formData.plate_number || ''}
                      onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                      placeholder={t('مثال: 12345-A-1', 'Ex: 12345-A-1')}
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الموديل والعلامة *', 'Modèle et marque *')}</label>
                    <Input
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Volvo FH 500 / Scania R450"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الحالة التشغيلية', 'Statut opérationnel')}</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="active">{t('جاهزة للعمل (Actif)', 'Disponible (Actif)')}</option>
                      <option value="in_maintenance">{t('في الصيانة (En maintenance)', 'En maintenance')}</option>
                      <option value="inactive">{t('متوقفة (Inactif)', 'Arrêté (Inactif)')}</option>
                    </select>
                  </div>
                </div>

                {/* قسم السائق والمقطورة الافتراضية */}
                {/* قسم السائق والمقطورة الافتراضية */}
                <CollapsibleSection
                  title={t('تعيين السائق والمقطورة الافتراضية', 'Chauffeur et remorque par défaut')}
                  description={t('ربط الشاحنة بسائق أو مقطورة أساسية للرحلات', 'Associer ce camion à un chauffeur ou une remorque')}
                  icon={<User className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  variant="blue"
                  defaultOpen={Boolean(formData.default_driver_id || formData.default_trailer_id)}
                  isOpen={activeTruckSection === 'driver_trailer'}
                  onToggle={() => setActiveTruckSection((prev) => (prev === 'driver_trailer' ? null : 'driver_trailer'))}
                  badge={
                    formData.default_driver_id
                      ? uniqueDrivers.find((d) => d.id === formData.default_driver_id)?.name
                      : undefined
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('السائق الافتراضي', 'Chauffeur par défaut')}</label>
                      <select
                        value={formData.default_driver_id || ''}
                        onChange={(e) => {
                          const dId = parseInt(e.target.value) || undefined;
                          setFormData({
                            ...formData,
                            default_driver_id: dId,
                          });
                        }}
                        className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value="">{t('-- بدون سائق افتراضي --', '-- Sans chauffeur par défaut --')}</option>
                        {uniqueDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('المقطورة المجرورة الافتراضية (Remorque)', 'Remorque attelée par défaut')}</label>
                      <select
                        value={formData.default_trailer_id || ''}
                        onChange={(e) => {
                          const trId = parseInt(e.target.value) || undefined;
                          setFormData({
                            ...formData,
                            default_trailer_id: trId,
                          });
                        }}
                        className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value="">{t('-- بدون مقطورة افتراضية --', '-- Sans remorque par défaut --')}</option>
                        {availableTrailers.map((trailer) => (
                          <option key={trailer.id} value={trailer.id}>
                            {trailer.plate_number} {trailer.model ? `(${trailer.model})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* قسم المواصفات الفنية واستهلاك الوقود */}
                <CollapsibleSection
                  title={t('المواصفات الفنية واستهلاك الوقود', 'Spécifications techniques & Carburant')}
                  description={t('الوزن وقوة المحرك ونسبة استهلاك الديزل لكل 100 كم', 'Capacité, puissance et consommation de gasoil')}
                  icon={<Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  variant="emerald"
                  defaultOpen={false}
                  isOpen={activeTruckSection === 'specs_fuel'}
                  onToggle={() => setActiveTruckSection((prev) => (prev === 'specs_fuel' ? null : 'specs_fuel'))}
                  badge={`${formData.fuel_consumption_rate ?? 36} L/100km`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('حمولة الوزن (بالأطنان)', 'Capacité de charge (Tonnes)')}</label>
                      <Input
                        type="number"
                        value={formData.weight_capacity || ''}
                        onChange={(e) => setFormData({ ...formData, weight_capacity: parseFloat(e.target.value) || 0 })}
                        placeholder={t('مثال: 25', 'Ex: 25')}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('قوة المحرك (Ch)', 'Puissance moteur (Ch)')}</label>
                      <Input
                        type="number"
                        value={formData.power || ''}
                        onChange={(e) => setFormData({ ...formData, power: parseFloat(e.target.value) || 0 })}
                        placeholder="500"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Fuel className="h-4 w-4 text-primary" />
                        {t('معدل الاستهلاك (L/100km أو %)', 'Consommation (L/100km)')}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="10"
                        max="80"
                        value={formData.fuel_consumption_rate ?? 36}
                        onChange={(e) => setFormData({ ...formData, fuel_consumption_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="36"
                        dir="ltr"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {t('افتراضي 36% - قابل للتعديل والتتبع', 'Par défaut 36% - ajustable')}
                      </span>
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}

            {/* حقول السائق */}
            {entityType === 'driver' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الاسم الكامل *', 'Nom complet *')}</label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('اسم السائق...', 'Nom du chauffeur...')}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم الهاتف *', 'Numéro de téléphone *')}</label>
                    <Input
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+212600000000"
                      required
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم رخصة السياقة *', 'Numéro de permis *')}</label>
                    <Input
                      value={formData.license || ''}
                      onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                      placeholder="B/EC-12345"
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الراتب الأساسي (MAD) *', 'Salaire de base (MAD) *')}</label>
                    <Input
                      type="number"
                      value={formData.base_salary || ''}
                      onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                      placeholder="5000"
                      required
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الشاحنة المعينة للسائق', 'Camion assigné au chauffeur')}</label>
                    <select
                      value={formData.default_truck_id || ''}
                      onChange={(e) => {
                        const tId = parseInt(e.target.value) || undefined;
                        setFormData({
                          ...formData,
                          default_truck_id: tId,
                        });
                      }}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{t('-- بدون شاحنة مخصصة --', '-- Sans camion assigné --')}</option>
                      {availableTrucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate_number} {truck.model ? `(${truck.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الحالة', 'Statut')}</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="active">{t('متاح للعمل (Actif)', 'Disponible (Actif)')}</option>
                      <option value="in_trip">{t('في رحلة (En voyage)', 'En voyage')}</option>
                      <option value="vacation">{t('في إجازة (En congé)', 'En congé')}</option>
                      <option value="inactive">{t('غير متاح', 'Indisponible')}</option>
                    </select>
                  </div>
                </div>

                {/* قسم الصورة الشخصية للسائق */}
                <CollapsibleSection
                  title={t('الصورة الشخصية للسائق', 'Photo de profil du chauffeur')}
                  description={t('رفع صورة أو اختيار نموذج جاهز للملف التعريفي', 'Téléverser une photo ou choisir parmi les modèles')}
                  icon={<Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  variant="amber"
                  defaultOpen={Boolean(formData.photo_url)}
                  isOpen={activeDriverSection === 'photo'}
                  onToggle={() => setActiveDriverSection((prev) => (prev === 'photo' ? null : 'photo'))}
                  badge={formData.photo_url ? t('تم تعيين صورة', 'Photo configurée') : undefined}
                >
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row items-center gap-4">
                    <DriverAvatar
                      name={formData.name || 'سائق'}
                      photoUrl={formData.photo_url}
                      size="xl"
                      className="ring-2 ring-primary/20 shadow-xs"
                    />
                    <div className="flex-1 space-y-2 text-center sm:text-start w-full">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          {t('الصورة الشخصية للسائق', 'Photo de profil du chauffeur')}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {t('اختر صورة من جهازك أو اختر من النماذج الاحترافية الجاهزة', 'Téléversez une photo ou choisissez parmi les modèles')}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCompressing(true);
                            try {
                              const compressed = await compressImageFile(file);
                              setFormData((prev: any) => ({ ...prev, photo_url: compressed }));
                            } catch (err) {
                              console.error('Error compressing image:', err);
                            } finally {
                              setCompressing(false);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={compressing}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 text-xs rounded-xl gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          {compressing ? t('جاري المعالجة...', 'Traitement...') : t('رفع صورة', 'Téléverser')}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPresets(!showPresets)}
                          className="h-8 text-xs rounded-xl gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {t('نماذج جاهزة', 'Modèles')}
                        </Button>

                        {formData.photo_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData((prev: any) => ({ ...prev, photo_url: '' }))}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-xl gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('إزالة', 'Supprimer')}
                          </Button>
                        )}
                      </div>

                      {/* معرض النماذج الجاهزة */}
                      {showPresets && (
                        <div className="pt-2 border-t border-border/40">
                          <div className="flex flex-wrap gap-2 pt-1">
                            {PRESET_DRIVER_AVATARS.map((preset) => (
                              <button
                                type="button"
                                key={preset.id}
                                onClick={() => {
                                  setFormData((prev: any) => ({ ...prev, photo_url: preset.url }));
                                  setShowPresets(false);
                                }}
                                className={`relative rounded-xl overflow-hidden border-2 transition-all p-0.5 hover:scale-105 ${
                                  formData.photo_url === preset.url
                                    ? 'border-primary shadow-xs ring-2 ring-primary/30'
                                    : 'border-border/60 hover:border-border'
                                }`}
                                title={preset.label}
                              >
                                <img
                                  src={preset.url}
                                  alt={preset.label}
                                  className="w-9 h-9 object-cover rounded-lg"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* تأشيرات الدخول الدولية */}
                <CollapsibleSection
                  title={t('تأشيرة الدخول الدولية (Visa Schengen)', 'Visa Schengen & Validité')}
                  description={t('بيانات التأشيرة للرحلات الدولية والعبور الأوروبي', 'Données de visa pour le transport international')}
                  icon={<Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                  variant="purple"
                  defaultOpen={Boolean(formData.visa_number || formData.visa_expiry_date)}
                  isOpen={activeDriverSection === 'visa'}
                  onToggle={() => setActiveDriverSection((prev) => (prev === 'visa' ? null : 'visa'))}
                  badge={formData.visa_number || undefined}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('رقم التأشيرة (Visa Schengen)', 'Numéro de visa (Visa Schengen)')}</label>
                      <Input
                        value={formData.visa_number || ''}
                        onChange={(e) => setFormData({ ...formData, visa_number: e.target.value })}
                        placeholder="ES-9812401"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('تاريخ انتهاء التأشيرة', 'Date d\'expiration du visa')}</label>
                      <Input
                        type="date"
                        value={formData.visa_expiry_date || ''}
                        onChange={(e) => setFormData({ ...formData, visa_expiry_date: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}

            {/* حقول المقطورة */}
            {entityType === 'trailer' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('رقم لوحة المقطورة (Remorque) *', 'Numéro d\'immatriculation de la remorque *')}</label>
                  <Input
                    value={formData.plate_number || ''}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    placeholder="R-12345-A"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('النوع / الموديل *', 'Type / Modèle *')}</label>
                  <Input
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Frigorifique / Bâchée / Plateau"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('الحالة', 'Statut')}</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="active">{t('جاهزة للاستخدام', 'Prête à l\'emploi (Actif)')}</option>
                    <option value="in_maintenance">{t('في الصيانة', 'En maintenance')}</option>
                    <option value="inactive">{t('معطلة', 'Inactif')}</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading
                  ? t('جاري الحفظ...', 'Enregistrement...')
                  : initialData?.id
                  ? t('تحديث البيانات', 'Mettre à jour')
                  : t('إضافة الآن', 'Ajouter')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
