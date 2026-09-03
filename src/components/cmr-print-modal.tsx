'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { Printer, X, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import type { TripOrder, Client, Driver, Truck } from '@/types/database';

interface CMRModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripOrder;
  client?: Client;
  clientImport?: Client;
  driver?: Driver;
  truck?: Truck;
}

export function CMRPrintModal({ isOpen, onClose, trip, client, clientImport, driver, truck }: CMRModalProps) {
  const [cmrType, setCmrType] = useState<'export' | 'import'>('export');
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isExport = cmrType === 'export';
  const cmrDocNumber = isExport
    ? (trip.cmr_export_number || trip.cmr_number || `CMR-EXP-${trip.id.toString().padStart(5, '0')}`)
    : (trip.cmr_import_number || `CMR-IMP-${trip.id.toString().padStart(5, '0')}`);

  const activeClient = isExport ? client : (clientImport || client);
  const activeRoute = isExport ? (trip.route_export || trip.route) : (trip.route_import || trip.route);
  const activeUnloadingDate = isExport ? (trip.unloading_date_export || trip.departure_date) : (trip.unloading_date_import || trip.loading_date_import || trip.departure_date);
  const activeFerry = isExport ? (trip.ferry_company || 'Tanger Med / Algeciras') : (trip.ferry_company_import || 'Algeciras / Tanger Med');
  const activeLocalizador = isExport ? trip.ferry_localizador : trip.ferry_localizador_import;
  const activeGoods = isExport ? (trip.goods_description_export || 'General Freight Cargo') : (trip.goods_description_import || 'Industrial Goods & Supplies');
  const activeWeight = isExport ? trip.weight_export : trip.weight_import;
  const activePrice = isExport ? (trip.price_export || trip.price) : (trip.price_import || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Controls */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden" data-print-hidden>
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
              <button
                onClick={() => setCmrType('export')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isExport ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlaneTakeoff className="w-3.5 h-3.5" />
                CMR الذهاب (Export Aller)
              </button>
              <button
                onClick={() => setCmrType('import')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                  !isExport ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlaneLanding className="w-3.5 h-3.5" />
                CMR العودة (Import Retour)
              </button>
            </div>

            <Button onClick={handlePrint} className="flex items-center gap-2 mr-2">
              <Printer className="w-4 h-4" />
              طباعة {isExport ? 'CMR الذهاب' : 'CMR العودة'} (PDF)
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Printable Area */}
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible" ref={printAreaRef} data-print-p-0 data-print-overflow-visible>
          <div className="border-2 border-slate-900 p-4 text-xs leading-relaxed font-sans" dir="ltr">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-wider text-slate-900">INTERNATIONAL CONSIGNMENT NOTE</h1>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${isExport ? 'bg-emerald-700' : 'bg-blue-700'}`}>
                    {isExport ? 'EXPORT / ALLER' : 'IMPORT / RETOUR'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-700">LETTRE DE VOITURE INTERNATIONALE (CMR)</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">CMR Document N°</p>
                <p className="text-base font-mono font-bold">{cmrDocNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="border border-slate-800 p-2 min-h-[90px]">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">1. Sender / Expéditeur</span>
                {isExport ? (
                  <>
                    <p className="font-bold mt-1">TRANS BODANON INTERNATIONAL LOGISTICS</p>
                    <p className="text-slate-600">Headquarters - Tanger Med, Morocco</p>
                    <p className="text-slate-600">contact@transbodanon.com</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold mt-1">{activeClient?.name || 'European Shipper'}</p>
                    <p className="text-slate-600">{activeClient?.city || 'Europe'}</p>
                    <p className="text-slate-600">Import Ref: {cmrDocNumber}</p>
                  </>
                )}
              </div>

              <div className="border border-slate-800 p-2 min-h-[90px]">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">2. Consignee / Destinataire</span>
                {isExport ? (
                  <>
                    <p className="font-bold mt-1">{activeClient?.name || 'European Consignee'}</p>
                    <p className="text-slate-600">{activeClient?.address || activeClient?.city || 'Delivery Address'}</p>
                    <p className="text-slate-600">ICE / VAT: {activeClient?.ice || 'N/A'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold mt-1">TRANS BODANON / MOROCCO CONSIGNEE</p>
                    <p className="text-slate-600">Tanger Med Port Customs, Morocco</p>
                    <p className="text-slate-600">contact@transbodanon.com</p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="border border-slate-800 p-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">3. Place of Delivery / Lieu de livraison</span>
                <p className="font-semibold mt-1">{activeRoute || 'International Delivery Route'}</p>
                <p className="text-slate-600">Unloading Date: {activeUnloadingDate}</p>
              </div>

              <div className="border border-slate-800 p-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">4. Place & Date / Prise en charge</span>
                <p className="font-semibold mt-1">Date: {isExport ? trip.departure_date : (trip.loading_date_import || trip.departure_date)}</p>
                <p className="text-slate-600">Transit Hub: {activeFerry}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="border border-slate-800 p-2 col-span-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">5. Carrier / Transporteur & Driver</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <p><span className="font-medium">Driver:</span> {driver?.name || 'Assigned Driver'}</p>
                    <p><span className="font-medium">License:</span> {driver?.license || 'N/A'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs">Truck Plate:</span>
                      <MatriculeBadge plate={truck?.plate_number} variant="print" />
                    </div>
                    <p className="mt-0.5"><span className="font-medium">Model:</span> {truck?.model || 'Heavy Cargo'}</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 p-2 col-span-1">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">6. Ferry / Transit Maritime</span>
                <p className="font-semibold mt-1">{activeFerry}</p>
                <p className="text-slate-600">Localizador: {activeLocalizador || 'N/A'}</p>
              </div>
            </div>

            <div className="border border-slate-800 p-3 mb-2 min-h-[110px]">
              <span className="font-bold text-[10px] text-slate-500 uppercase block">7. Goods / Marchandises transportées</span>
              <table className="w-full text-left mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="pb-1">Nature of Cargo</th>
                    <th className="pb-1">Trip Leg</th>
                    <th className="pb-1">Weight</th>
                    <th className="pb-1">Declared Price</th>
                    <th className="pb-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-medium">
                    <td className="py-2">{activeGoods}</td>
                    <td className="py-2 uppercase font-bold text-slate-700">{isExport ? 'Outbound (Aller)' : 'Inbound (Retour)'}</td>
                    <td className="py-2">{activeWeight ? `${activeWeight} Tons` : 'Standard'}</td>
                    <td className="py-2">{activePrice.toLocaleString()} {trip.price_type || 'MAD'}</td>
                    <td className="py-2 capitalize">{trip.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-2 border border-slate-800 p-2 min-h-[110px]">
              <div className="border-r border-slate-300 pr-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">Sender Signature & Stamp</span>
                <div className="h-14 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
              <div className="border-r border-slate-300 px-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">Carrier / Driver Signature</span>
                <div className="h-14 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
              <div className="pl-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">Consignee Receipt & Stamp</span>
                <div className="h-14 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
