'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Truck } from 'lucide-react';
import type { Truck as TruckType, Driver, Trailer } from '@/types/database';
import { DEFAULT_DRIVERS, DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';

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
  const availableDrivers = fallbackArray(driversList, DEFAULT_DRIVERS);
  const availableTrucks = fallbackArray(trucksList, DEFAULT_TRUCKS);
  const availableTrailers = fallbackArray(trailersList, DEFAULT_TRAILERS);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({ ...initialData });
    } else {
      if (entityType === 'truck') {
        setFormData({
          plate_number: '',
          model: '',
          status: 'active',
          weight_capacity: '',
          power: '',
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
        });
      } else {
        setFormData({
          plate_number: '',
          model: '',
          status: 'active',
        });
      }
    }
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
          const driverName = driver?.name || 'السائق المختار';
          const confirmed = window.confirm(
            `⚠️ تنبيه إعادة تخصيص السائق:\n\nالسائق "${driverName}" مخصص مسبقاً للشاحنة (${assignedTruck.plate_number}).\n\nهل توافق على نقله وإلغاء تخصيصه من الشاحنة السابقة وتعيينه لهذه الشاحنة؟`
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
          const trailerLabel = trailer ? `${trailer.plate_number} ${trailer.model || ''}` : 'المقطورة المختارة';
          const confirmed = window.confirm(
            `⚠️ تنبيه إعادة تخصيص المقطورة:\n\nالمقطورة "${trailerLabel}" مخصصة مسبقاً للشاحنة (${assignedTruck.plate_number}).\n\nهل توافق على نقلها وإلغاء تخصيصها من الشاحنة السابقة وتعيينها لهذه الشاحنة؟`
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
          const truckLabel = truck ? `${truck.plate_number} ${truck.model || ''}` : 'الشاحنة المختارة';
          const confirmed = window.confirm(
            `⚠️ تنبيه إعادة تعيين الشاحنة:\n\nالشاحنة "${truckLabel}" مخصصة مسبقاً للسائق (${assignedDriver.name}).\n\nهل توافق على نقلها وإلغاء تعيينها من السائق السابق؟`
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
        };
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
    const action = initialData?.id ? 'تعديل بيانات' : 'إضافة';
    if (entityType === 'truck') return `${action} شاحنة`;
    if (entityType === 'driver') return `${action} سائق`;
    return `${action} مقطورة (Remorque)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="w-full max-w-xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Truck className="w-5 h-5 text-primary" />
            {getTitle()}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            {/* حقول الشاحنة */}
            {entityType === 'truck' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم اللوحة (Matricule) *</label>
                    <Input
                      value={formData.plate_number || ''}
                      onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                      placeholder="مثال: 12345-A-1"
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الموديل والعلامة *</label>
                    <Input
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Volvo FH 500 / Scania R450"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">السائق الافتراضي</label>
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
                      <option value="">-- بدون سائق افتراضي --</option>
                      {availableDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} {driver.phone ? `(${driver.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">المقطورة المجرورة الافتراضية (Remorque)</label>
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
                      <option value="">-- بدون مقطورة افتراضية --</option>
                      {availableTrailers.map((trailer) => (
                        <option key={trailer.id} value={trailer.id}>
                          {trailer.plate_number} {trailer.model ? `(${trailer.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الحالة التشغيلية</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="active">جاهزة للعمل (Actif)</option>
                      <option value="in_maintenance">في الصيانة (En maintenance)</option>
                      <option value="inactive">متوقفة (Inactif)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">حمولة الوزن (بالأطنان)</label>
                    <Input
                      type="number"
                      value={formData.weight_capacity || ''}
                      onChange={(e) => setFormData({ ...formData, weight_capacity: parseFloat(e.target.value) || 0 })}
                      placeholder="مثال: 25"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">قوة المحرك (Ch)</label>
                    <Input
                      type="number"
                      value={formData.power || ''}
                      onChange={(e) => setFormData({ ...formData, power: parseFloat(e.target.value) || 0 })}
                      placeholder="500"
                      dir="ltr"
                    />
                  </div>
                </div>
              </>
            )}

            {/* حقول السائق */}
            {entityType === 'driver' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الاسم الكامل *</label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="اسم السائق..."
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم الهاتف *</label>
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
                    <label className="text-sm font-medium text-foreground">رقم رخصة السياقة *</label>
                    <Input
                      value={formData.license || ''}
                      onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                      placeholder="B/EC-12345"
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الراتب الأساسي (MAD) *</label>
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
                    <label className="text-sm font-medium text-foreground">الشاحنة المعينة للسائق</label>
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
                      <option value="">-- بدون شاحنة مخصصة --</option>
                      {availableTrucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate_number} {truck.model ? `(${truck.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الحالة</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="active">متاح للعمل (Actif)</option>
                      <option value="in_trip">في رحلة (En voyage)</option>
                      <option value="vacation">في إجازة (En congé)</option>
                      <option value="inactive">غير متاح</option>
                    </select>
                  </div>
                </div>

                {/* تأشيرات الدخول الدولية */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم التأشيرة (Visa Schengen)</label>
                    <Input
                      value={formData.visa_number || ''}
                      onChange={(e) => setFormData({ ...formData, visa_number: e.target.value })}
                      placeholder="ES-9812401"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ انتهاء التأشيرة</label>
                    <Input
                      type="date"
                      value={formData.visa_expiry_date || ''}
                      onChange={(e) => setFormData({ ...formData, visa_expiry_date: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>
              </>
            )}

            {/* حقول المقطورة */}
            {entityType === 'trailer' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">رقم لوحة المقطورة (Remorque) *</label>
                  <Input
                    value={formData.plate_number || ''}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    placeholder="R-12345-A"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">النوع / الموديل *</label>
                  <Input
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Frigorifique / Bâchée / Plateau"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">الحالة</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="active">جاهزة للاستخدام</option>
                    <option value="in_maintenance">في الصيانة</option>
                    <option value="inactive">معطلة</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? 'جاري الحفظ...' : initialData?.id ? 'تحديث البيانات' : 'إضافة الآن'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
