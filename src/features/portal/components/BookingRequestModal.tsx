'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Package,
  Snowflake,
  Truck as TruckIcon,
  X,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Navigation,
  FileText,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createBookingRequestAction } from '../services/portal.actions';
import type { BookingRequest, Client } from '@/types/database';
import type { CreateBookingInput } from '../types';

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  lang: 'ar' | 'fr' | 'es';
  onBookingCreated: (booking: BookingRequest) => void;
}

export function BookingRequestModal({
  isOpen,
  onClose,
  client,
  lang,
  onBookingCreated,
}: BookingRequestModalProps) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = (ar: string, fr: string, es: string) => {
    if (lang === 'fr') return fr;
    if (lang === 'es') return es;
    return ar;
  };

  // Form State
  const [routeFrom, setRouteFrom] = useState('Agadir');
  const [routeTo, setRouteTo] = useState('Perpignan');
  const [cargoType, setCargoType] = useState<
    'fresh_produce' | 'frozen_fish' | 'general_cargo' | 'pharmaceuticals'
  >('fresh_produce');
  const [trailerType, setTrailerType] = useState<'frigo' | 'bache' | 'box' | 'container'>('frigo');
  const [targetTemperature, setTargetTemperature] = useState<number | ''>(4);
  const [weightTons, setWeightTons] = useState<number | ''>(22);
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [pickupAddress, setPickupAddress] = useState(client.shipping_city || 'Agadir');
  const [pickupGpsUrl, setPickupGpsUrl] = useState(client.loading_gps_url || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryGpsUrl, setDeliveryGpsUrl] = useState(client.unloading_gps_url || '');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingRequest | null>(null);

  if (!isOpen) return null;

  const quickOrigins = ['Agadir', 'Casablanca', 'Tanger', 'Dakhla', 'Marrakech'];
  const quickDestinations = ['Perpignan', 'Madrid', 'Valencia', 'Paris', 'Dakar', 'Nouakchott'];

  const handleCargoChange = (type: typeof cargoType) => {
    setCargoType(type);
    if (type === 'frozen_fish') {
      setTrailerType('frigo');
      setTargetTemperature(-20);
    } else if (type === 'fresh_produce') {
      setTrailerType('frigo');
      setTargetTemperature(4);
    } else if (type === 'pharmaceuticals') {
      setTrailerType('frigo');
      setTargetTemperature(15);
    } else {
      setTrailerType('bache');
      setTargetTemperature('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!routeFrom.trim() || !routeTo.trim() || !pickupDate) {
      setErrorMsg(t('يرجى ملء كافة الحقول الأساسية', 'Veuillez remplir tous les champs obligatoires', 'Por favor complete todos los campos obligatorios'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateBookingInput = {
        clientId: client.id,
        routeFrom: routeFrom.trim(),
        routeTo: routeTo.trim(),
        cargoType,
        trailerType,
        targetTemperature: targetTemperature === '' ? null : Number(targetTemperature),
        weightTons: weightTons === '' ? null : Number(weightTons),
        pickupDate,
        pickupAddress: pickupAddress.trim() || null,
        pickupGpsUrl: pickupGpsUrl.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryGpsUrl: deliveryGpsUrl.trim() || null,
        specialInstructions: specialInstructions.trim() || null,
      };

      const res = await createBookingRequestAction(payload);
      if (res.success && res.booking) {
        setSuccessBooking(res.booking);
        onBookingCreated(res.booking);
      } else {
        setErrorMsg(res.error || t('تعذر إرسال طلب الحجز', 'Échec de la réservation', 'Error en la reserva'));
      }
    } catch {
      setErrorMsg(t('حدث خطأ غير متوقع أثناء إرسال الطلب', 'Erreur inattendue', 'Error inesperado'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir={dir}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0d1322] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 dark:bg-[#0d1322]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TruckIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('طلب حجز شاحنة دولية جديد', 'Nouvelle Réservation de Fret', 'Nueva Reserva de Transporte')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {client.name} — ICE: {client.ice}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {successBooking ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('تم تسجيل طلب الحجز بنجاح!', 'Réservation enregistrée avec succès!', '¡Reserva registrada con éxito!')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {t(
                  'تم إرسال إشعار فوري لغرفة العمليات وإدارة الأسطول عبر WhatsApp لمراجعة وتعيين الشاحنة والسائق.',
                  'Une alerte WhatsApp immédiate a été transmise à notre régulation pour affecter camion & chauffeur.',
                  'Se ha enviado una alerta inmediata por WhatsApp a operaciones para asignar camión y conductor.'
                )}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-mono space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('رقم الحجز:', 'N° Réservation:', 'Nº Reserva:')}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{successBooking.booking_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('المسار:', 'Trajet:', 'Trayecto:')}</span>
                <span className="font-bold">{successBooking.route_from} ➔ {successBooking.route_to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('تاريخ الشحن:', 'Date:', 'Fecha:')}</span>
                <span className="font-bold">{successBooking.pickup_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('الحالة:', 'Statut:', 'Estado:')}</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                  {t('قيد المراجعة والتعيين', 'En attente d\'affectation', 'Pendiente de asignación')}
                </Badge>
              </div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              className="w-full max-w-xs h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              {t('إغلاق والعودة للبوابة', 'Fermer & Retour', 'Cerrar y volver')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Route Section */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('مسار الشحنة الدولية (من ➔ إلى)', 'Trajet International (Départ ➔ Destination)', 'Trayecto Internacional (Origen ➔ Destino)')}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500">{t('مدينة الشحن والانطلاق', 'Ville de départ', 'Ciudad de salida')}</span>
                  <Input
                    value={routeFrom}
                    onChange={(e) => setRouteFrom(e.target.value)}
                    placeholder="Agadir, Casablanca..."
                    className="h-10 mt-1 rounded-xl text-xs"
                    required
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {quickOrigins.map((orig) => (
                      <button
                        type="button"
                        key={orig}
                        onClick={() => setRouteFrom(orig)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                          routeFrom === orig
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {orig}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500">{t('مدينة الوصول والتسليم', 'Ville de destination', 'Ciudad de destino')}</span>
                  <Input
                    value={routeTo}
                    onChange={(e) => setRouteTo(e.target.value)}
                    placeholder="Perpignan, Madrid, Dakar..."
                    className="h-10 mt-1 rounded-xl text-xs"
                    required
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {quickDestinations.map((dest) => (
                      <button
                        type="button"
                        key={dest}
                        onClick={() => setRouteTo(dest)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                          routeTo === dest
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {dest}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cargo & Equipment Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('نوع البضاعة والمقطورة المطلوبة', 'Type de Marchandise & Équipement', 'Tipo de Mercancía y Equipo')}</span>
              </label>

              {/* Cargo Type Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleCargoChange('fresh_produce')}
                  className={`p-2.5 rounded-xl border text-xs text-center transition ${
                    cargoType === 'fresh_produce'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold">🥬 {t('خضار وفواكه', 'Fruits & Lég.', 'Frutas/Verd.')}</p>
                  <span className="text-[10px] opacity-75">{t('تبريد طازج (+4°C)', 'Frais (+4°C)', 'Fresco (+4°C)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCargoChange('frozen_fish')}
                  className={`p-2.5 rounded-xl border text-xs text-center transition ${
                    cargoType === 'frozen_fish'
                      ? 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-500 text-cyan-700 dark:text-cyan-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold">❄️ {t('أسماك مجمدة', 'Poissons Cong.', 'Pescado Cong.')}</p>
                  <span className="text-[10px] opacity-75">{t('تجميد عميق (-20°C)', 'Surgelé (-20°C)', 'Congelado (-20°C)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCargoChange('general_cargo')}
                  className={`p-2.5 rounded-xl border text-xs text-center transition ${
                    cargoType === 'general_cargo'
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold">📦 {t('بضائع عامة', 'Générales', 'Carga General')}</p>
                  <span className="text-[10px] opacity-75">{t('شراع / جاف', 'Bâché / Sec', 'Lona / Seco')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCargoChange('pharmaceuticals')}
                  className={`p-2.5 rounded-xl border text-xs text-center transition ${
                    cargoType === 'pharmaceuticals'
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold">💊 {t('أدوية وصحي', 'Pharma', 'Farmacia')}</p>
                  <span className="text-[10px] opacity-75">{t('تحكم حراري (+15°C)', 'Thermo (+15°C)', 'Thermo (+15°C)')}</span>
                </button>
              </div>

              {/* Temperature & Weight & Trailer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500">{t('نوع المقطورة', 'Équipement', 'Tipo Remolque')}</span>
                  <select
                    value={trailerType}
                    onChange={(e) => setTrailerType(e.target.value as any)}
                    className="w-full h-10 mt-1 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    <option value="frigo">❄️ {t('مقطورة تبريد (Frigo)', 'Frigo Tempéré', 'Frigorífico')}</option>
                    <option value="bache">🚛 {t('شراع (Bâchée)', 'Semi Bâchée', 'Lona')}</option>
                    <option value="box">📦 {t('صندوق مغلق (Fourgon)', 'Fourgon', 'Furgón')}</option>
                    <option value="container">🚢 {t('حاوية (Container)', 'Conteneur', 'Contenedor')}</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500">{t('الحرارة المطلوبة (°C)', 'Température (°C)', 'Temperatura (°C)')}</span>
                  <Input
                    type="number"
                    value={targetTemperature}
                    onChange={(e) => setTargetTemperature(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="4, -20..."
                    className="h-10 mt-1 rounded-xl text-xs font-mono"
                    disabled={trailerType !== 'frigo'}
                  />
                </div>

                <div>
                  <span className="text-[11px] text-slate-500">{t('الوزن التقديري (طن)', 'Poids estimé (T)', 'Peso estimado (T)')}</span>
                  <Input
                    type="number"
                    value={weightTons}
                    onChange={(e) => setWeightTons(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="22"
                    className="h-10 mt-1 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Date & GPS Links */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('تاريخ الشحن ومواقع GPS', 'Date de Chargement & Coordonnées GPS', 'Fecha de Carga y Coordenadas GPS')}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500">{t('تاريخ التحميل المرغوب *', 'Date d\'enlèvement souhaitée *', 'Fecha de recogida deseada *')}</span>
                  <Input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="h-10 mt-1 rounded-xl text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <span className="text-[11px] text-slate-500">{t('رابط خرائط Google لموقع الشحن', 'Lien GPS Chargement (Google Maps)', 'Enlace GPS Carga (Google Maps)')}</span>
                  <Input
                    type="url"
                    value={pickupGpsUrl}
                    onChange={(e) => setPickupGpsUrl(e.target.value)}
                    placeholder="https://maps.google.com/?q=..."
                    className="h-10 mt-1 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500">{t('تعليمات إضافية وملاحظات الحجز', 'Instructions particulières', 'Instrucciones especiales')}</span>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                  placeholder={t('ملاحظات الممر الجمركي، أوقات فتح المستودع...', 'Horaires du quai, documents douaniers...', 'Horarios de muelle, aduanas...')}
                  className="w-full p-2.5 mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-10 rounded-xl text-xs border-slate-300 dark:border-slate-700"
              >
                {t('إلغاء', 'Annuler', 'Cancelar')}
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-md shadow-blue-500/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('جاري الإرسال وتنبيه العمليات...', 'Envoi de l\'alerte...', 'Enviando...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{t('تأكيد وتقديم طلب الحجز', 'Valider la Demande', 'Confirmar Reserva')}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

