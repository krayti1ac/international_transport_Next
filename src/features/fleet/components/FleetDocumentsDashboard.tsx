'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutGrid,
  Table as TableIcon,
  PlusCircle,
  RefreshCw,
  FileCheck2,
  Truck,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { FleetDocument, Truck as TruckType, Trailer as TrailerType } from '@/types/database';
import {
  getFleetMatrixData,
  getFleetDocuments,
  type FleetMatrixRow,
} from '@/features/fleet/services/fleet-documents.actions';
import { FleetDocumentsMatrix } from '@/features/fleet/components/FleetDocumentsMatrix';
import { FleetDocumentsList } from '@/features/fleet/components/FleetDocumentsList';
import { QuickRenewDialog } from '@/features/fleet/components/QuickRenewDialog';
import { RenewalHistoryModal } from '@/features/fleet/components/RenewalHistoryModal';
import { DocumentUploadModal } from '@/features/fleet/components/DocumentUploadModal';
import { createClient } from '@/lib/supabase/client';

export function FleetDocumentsDashboard() {
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
  const [matrixRows, setMatrixRows] = useState<FleetMatrixRow[]>([]);
  const [allDocuments, setAllDocuments] = useState<FleetDocument[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trailers, setTrailers] = useState<TrailerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [renewingDoc, setRenewingDoc] = useState<{ doc: FleetDocument; vehiclePlate: string } | null>(null);
  const [historyDoc, setHistoryDoc] = useState<FleetDocument | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadInitialVehicle, setUploadInitialVehicle] = useState<{
    type: 'truck' | 'trailer';
    id: number;
    plate: string;
  } | null>(null);
  const [uploadInitialDocType, setUploadInitialDocType] = useState<string | null>(null);

  const { toast } = useToast();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      const [matrixRes, docsRes, trucksRes, trailersRes] = await Promise.all([
        getFleetMatrixData(),
        getFleetDocuments({ showArchived: true }),
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('trailers').select('*').order('plate_number'),
      ]);

      if (matrixRes.success) {
        setMatrixRows(matrixRes.rows);
      }
      if (docsRes.success) {
        setAllDocuments(docsRes.data);
      }
      if (trucksRes.data) {
        setTrucks(trucksRes.data);
      }
      if (trailersRes.data) {
        setTrailers(trailersRes.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في تحميل بيانات الأسطول';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenRenew = (doc: FleetDocument, vehiclePlate: string) => {
    setRenewingDoc({ doc, vehiclePlate });
  };

  const handleOpenHistory = (doc: FleetDocument) => {
    setHistoryDoc(doc);
  };

  const handleOpenAddNew = (
    vehicle?: { type: 'truck' | 'trailer'; id: number; plate: string },
    docType?: string
  ) => {
    setUploadInitialVehicle(vehicle || null);
    setUploadInitialDocType(docType || null);
    setUploadModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>رادار وثائق الأسطول والتجديد المالي</span>
            <span className="text-border">|</span>
            <span className="text-primary font-bold">Trans Bodanon Enterprise</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            مصفوفة وثائق الأسطول والتجديد
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            متابعة شاملة لتأمين، فحص، وتراخيص الشاحنات والمقطورات مع الربط التلقائي بالخزينة.
          </p>
        </div>

        {/* View Toggle & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/70">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'matrix'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>عرض المصفوفة (Matrix)</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>عرض البطاقات (Cards)</span>
            </button>
          </div>

          <Button
            onClick={() => handleOpenAddNew()}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <PlusCircle className="w-4 h-4 ml-1.5" />
            إضافة وثيقة جديدة
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="تحديث البيانات"
            className="rounded-xl h-10 w-10 border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'matrix' ? (
        <FleetDocumentsMatrix
          matrixRows={matrixRows}
          trucks={trucks}
          trailers={trailers}
          loading={loading}
          onRenewDocument={handleOpenRenew}
          onViewHistory={handleOpenHistory}
          onAddNewDoc={handleOpenAddNew}
        />
      ) : (
        <FleetDocumentsList
          documents={allDocuments}
          loading={loading}
          onRenewDocument={handleOpenRenew}
          onViewHistory={handleOpenHistory}
          onRefresh={loadData}
        />
      )}

      {/* Quick Renew Modal */}
      {renewingDoc && (
        <QuickRenewDialog
          document={renewingDoc.doc}
          vehicleName={renewingDoc.vehiclePlate}
          isOpen={!!renewingDoc}
          onClose={() => setRenewingDoc(null)}
          onSuccess={loadData}
        />
      )}

      {/* Renewal Audit History Modal */}
      {historyDoc && (
        <RenewalHistoryModal
          document={historyDoc}
          isOpen={!!historyDoc}
          onClose={() => setHistoryDoc(null)}
        />
      )}

      {/* Document Upload & Edit Modal */}
      {uploadModalOpen && (
        <DocumentUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={loadData}
          trucks={trucks}
          trailers={trailers}
          initialVehicle={uploadInitialVehicle}
          initialDocType={uploadInitialDocType}
        />
      )}
    </div>
  );
}

