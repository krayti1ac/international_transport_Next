'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, DeliverySignature, Client, Driver, Truck } from '@/types/database';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { Printer, X, MapPin, User, Clock } from 'lucide-react';

interface PodReportViewProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripOrder;
  client?: Client;
  clientImport?: Client;
  driver?: Driver;
  truck?: Truck;
}

export function PodReportView({ isOpen, onClose, trip, client, clientImport, driver, truck }: PodReportViewProps) {
  const [signature, setSignature] = useState<DeliverySignature | null>(null);
  const [loading, setLoading] = useState(true);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isOpen || !trip.id) return;

    const fetchSignature = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_signatures')
          .select('*')
          .eq('trip_order_id', trip.id)
          .order('signed_at', { ascending: false })
          .limit(1)
          .maybeSingle<DeliverySignature>();

        if (error) throw error;
        setSignature(data);
      } catch (error) {
        console.error('Failed to fetch delivery signature:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignature();
  }, [isOpen, trip.id, supabase]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const activeClient = clientImport || client;
  const activeDriver = driver;
  const activeTruck = truck;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden" data-print-hidden>
          <div className="flex items-center gap-2">
            <h3 className="font-amiri text-lg font-bold text-slate-900">إثبات التسليم الإلكتروني (E-POD)</h3>
          </div>
          <div className="flex items-center gap-2">
            {signature && (
              <Button onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                تحميل PDF
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible" ref={printAreaRef} data-print-p-0 data-print-overflow-visible>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">جاري تحميل بيانات إثبات التسليم...</p>
            </div>
          ) : !signature ? (
            <div className="text-center py-12">
              <p className="text-slate-500">لا يوجد إثبات تسليم مسجل لهذه الرحلة</p>
            </div>
          ) : (
            <div className="space-y-6" dir="rtl">
              <div className="border-2 border-slate-900 p-6 text-sm leading-relaxed font-sans" dir="ltr">
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-4">
                  <div>
                    <h1 className="text-2xl font-black tracking-wider text-slate-900">PROOF OF DELIVERY</h1>
                    <p className="text-sm font-bold text-slate-700">إثبات التسليم الإلكتروني (E-POD)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Trip Reference</p>
                    <p className="text-base font-mono font-bold">TRIP-{trip.id.toString().padStart(5, '0')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border border-slate-800 p-3">
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">Trip Details</span>
                    <p className="font-semibold mt-1">Route: {trip.route || 'N/A'}</p>
                    <p className="text-slate-600">Departure: {trip.departure_date}</p>
                    <p className="text-slate-600">Status: {trip.status}</p>
                    {trip.cmr_number && <p className="text-slate-600">CMR: {trip.cmr_number}</p>}
                  </div>
                  <div className="border border-slate-800 p-3">
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">Parties</span>
                    <p className="font-semibold mt-1">Driver: {activeDriver?.name || 'N/A'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-slate-600">Truck:</span>
                      <MatriculeBadge plate={activeTruck?.plate_number} variant="print" />
                    </div>
                    <p className="text-slate-600">Consignee: {activeClient?.name || 'N/A'}</p>
                  </div>
                </div>

                <div className="border border-slate-800 p-3 mb-4">
                  <span className="font-bold text-[10px] text-slate-500 uppercase block">Recipient / المستلم</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-slate-500" />
                    <p className="font-semibold">{signature.signed_by}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-600">{new Date(signature.signed_at).toLocaleString()}</p>
                  </div>
                  {signature.latitude && signature.longitude && (
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <a
                        href={`https://www.google.com/maps?q=${signature.latitude},${signature.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        View Location on Google Maps ({signature.latitude.toFixed(6)}, {signature.longitude.toFixed(6)})
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-slate-800 p-3">
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">Digital Signature</span>
                    {signature.signature_url && (
                      <img
                        src={signature.signature_url}
                        alt="Recipient Signature"
                        className="mt-2 max-h-32 mx-auto"
                      />
                    )}
                  </div>
                  <div className="border border-slate-800 p-3">
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">CMR Document Photo</span>
                    {signature.cmr_image_url && (
                      <img
                        src={signature.cmr_image_url}
                        alt="CMR Document"
                        className="mt-2 max-h-32 mx-auto object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-slate-300 text-center text-xs text-slate-500">
                  <p>This document was generated electronically and is valid as proof of delivery.</p>
                  <p className="mt-1">Generated on {new Date().toLocaleString()} | Trans Bodanon International Logistics</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
