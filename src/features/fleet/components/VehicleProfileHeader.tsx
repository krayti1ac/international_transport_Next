'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';
import { DriverAvatar } from '@/components/drivers/DriverAvatar';
import { useLanguage } from '@/components/language-provider';
import type { Truck, Trailer, Driver, CompanyBranch } from '@/types/database';
import {
  ArrowRight,
  Building2,
  Fuel,
  Weight,
  Zap,
  Edit3,
  PlusCircle,
  Wrench,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  User,
  MapPin,
} from 'lucide-react';

interface VehicleProfileHeaderProps {
  vehicle: Truck | Trailer;
  vehicleType: 'truck' | 'trailer';
  driver: Driver | null;
  assignedTrailer: Trailer | null;
  assignedTruck: Truck | null;
  homeBranch: CompanyBranch | null;
  onEditVehicle: () => void;
  onAddDocument: () => void;
  onScheduleMaintenance: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function VehicleProfileHeader({
  vehicle,
  vehicleType,
  driver,
  assignedTrailer,
  assignedTruck,
  homeBranch,
  onEditVehicle,
  onAddDocument,
  onScheduleMaintenance,
  onRefresh,
  refreshing = false,
}: VehicleProfileHeaderProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();

  const isTruck = vehicleType === 'truck';
  const truckData = isTruck ? (vehicle as Truck) : null;
  const isActive = vehicle.status === 'active';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/95 to-muted/30 p-6 sm:p-7 shadow-xs">
      {/* Top Bar: Back button, Status Badge, Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full hover:bg-muted"
            title={t('رجوع', 'Retour', 'Back')}
          >
            <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Button>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isTruck ? (
                  <TruckIcon className="w-5 h-5" />
                ) : (
                  <TrailerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-amiri text-foreground tracking-tight">
                {isTruck
                  ? t('تفاصيل الشاحنة والجرار', 'Fiche Camion Tracteur', 'Truck Tractor Details')
                  : t('تفاصيل المقطورة والمبرد', 'Fiche Semi-Remorque & Frigo', 'Trailer & Frigo Details')}
              </h1>
              <Badge
                variant={isActive ? 'default' : 'secondary'}
                className={`text-xs px-3 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                }`}
              >
                {isActive ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t('نشط وجاهز للتشغيل', 'Actif & Opérationnel', 'Active & Ready')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {vehicle.status || t('تحت الصيانة', 'En maintenance', 'Under Maintenance')}
                  </span>
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ms-12">
              {vehicle.model || (isTruck ? 'Volvo FH 500 / Scania V8' : 'Schmitz Cargobull SKO')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-xl text-xs gap-1.5 border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t('تحديث', 'Actualiser', 'Refresh')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onScheduleMaintenance}
            className="rounded-xl text-xs gap-1.5 border-border hover:border-primary/50"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('جدولة صيانة', 'Planifier maintenance', 'Schedule Maintenance')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onAddDocument}
            className="rounded-xl text-xs gap-1.5 border-border hover:border-primary/50"
          >
            <PlusCircle className="w-3.5 h-3.5 text-primary" />
            <span>{t('إضافة وثيقة', 'Ajouter document', 'Add Document')}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onEditVehicle}
            className="rounded-xl text-xs gap-1.5 shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{t('تعديل البيانات', 'Modifier la fiche', 'Edit Vehicle')}</span>
          </Button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
        {/* Matricule & Model Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="shrink-0">
            <MatriculeBadge plate={vehicle.plate_number} variant="badge" size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t('رقم اللوحة والتسجيل', 'Immatriculation', 'License Plate')}
            </p>
            <p className="text-sm font-bold text-foreground truncate mt-0.5 font-mono">
              {vehicle.plate_number}
            </p>
          </div>
        </div>

        {/* Assigned Driver (or Assigned Truck) */}
        {isTruck ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            {driver ? (
              <>
                <DriverAvatar
                  name={driver.name}
                  photoUrl={driver.photo_url}
                  driverId={driver.id}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3 text-primary" />
                    {t('السائق المعتمد', 'Chauffeur titulaire', 'Assigned Driver')}
                  </p>
                  <Link
                    href={`/drivers/${driver.id}`}
                    className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate mt-0.5 group"
                  >
                    <span className="truncate">{driver.name}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t('السائق المعتمد', 'Chauffeur titulaire', 'Assigned Driver')}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('لم يُعيّن سائق افتراضي', 'Aucun chauffeur assigné', 'No driver assigned')}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <TruckIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t('الشاحنة المرتبطة', 'Tracteur associé', 'Linked Truck')}
              </p>
              {assignedTruck ? (
                <Link
                  href={`/fleet/${assignedTruck.id}?type=truck`}
                  className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate mt-0.5 group"
                >
                  <span className="truncate font-mono">{assignedTruck.plate_number}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ) : (
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {t('جاهزة للربط مع أي جرار', 'Disponible pour tracteur', 'Available')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Linked Trailer (if truck) or Assigned Branch */}
        {isTruck ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <TrailerIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t('المقطورة الملحقة الافتراضية', 'Remorque par défaut', 'Default Trailer')}
              </p>
              {assignedTrailer ? (
                <Link
                  href={`/fleet/${assignedTrailer.id}?type=trailer`}
                  className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate mt-0.5 group"
                >
                  <span className="truncate font-mono">{assignedTrailer.plate_number}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ) : (
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {t('غير ملحقة بمقطورة ثابتة', 'Aucune remorque', 'None')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t('نوع المقطورة', 'Type de remorque', 'Trailer Type')}
              </p>
              <p className="text-sm font-bold text-foreground truncate mt-0.5">
                {vehicle.model?.includes('Frigo') || vehicle.model?.includes('Carrier') || vehicle.model?.includes('Thermo')
                  ? t('مقطورة مبردة (Frigo ATP)', 'Frigorifique (Frigo ATP)', 'Refrigerated (ATP)')
                  : t('مقطورة مشمعة (Bâchée TIR)', 'Bâchée TIR', 'Tarpaulin TIR')}
              </p>
            </div>
          </div>
        )}

        {/* Home Branch Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t('الفرع التشغيلي', 'Succursale d\'attache', 'Home Branch')}
            </p>
            {homeBranch ? (
              <Link
                href="/branches"
                className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate mt-0.5 group"
              >
                <span className="truncate">{homeBranch.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ) : (
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                {t('الفرع الرئيسي / عام', 'Succursale Principale', 'Main Branch')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Technical Specs Strip (Only for trucks or relevant specs) */}
      {isTruck && truckData && (
        <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
          {truckData.fuel_consumption_rate && (
            <div className="flex items-center gap-1.5 font-medium">
              <Fuel className="w-3.5 h-3.5 text-primary" />
              <span>{t('المعدل القياسي للوقود:', 'Consommation étalon :')}</span>
              <span className="font-mono font-bold text-foreground">
                {truckData.fuel_consumption_rate} L/100km ({truckData.fuel_consumption_rate}%)
              </span>
            </div>
          )}

          {truckData.power && (
            <div className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('قوة المحرك:', 'Puissance moteur :')}</span>
              <span className="font-mono font-bold text-foreground">{truckData.power} CV</span>
            </div>
          )}

          {truckData.weight_capacity && (
            <div className="flex items-center gap-1.5 font-medium">
              <Weight className="w-3.5 h-3.5 text-blue-500" />
              <span>{t('الحمولة القصوى:', 'Charge utile :')}</span>
              <span className="font-mono font-bold text-foreground">{truckData.weight_capacity} T</span>
            </div>
          )}

          {truckData.current_location && (
            <div className="flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('الموقع الحالي:', 'Position actuelle :')}</span>
              <span className="font-bold text-foreground">{truckData.current_location}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
