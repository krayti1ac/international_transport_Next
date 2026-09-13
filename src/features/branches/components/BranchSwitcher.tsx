'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useBranchStore } from '@/lib/stores/branch-store';
import { getCompanyBranches } from '../services/branches.actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, Globe, Check, Settings } from 'lucide-react';
import Link from 'next/link';

const COUNTRY_FLAGS: Record<string, string> = {
  MA: '🇲🇦',
  ES: '🇪🇸',
  FR: '🇫🇷',
};

export function BranchSwitcher() {
  const { t, dir } = useLanguage();
  const {
    selectedBranchId,
    availableBranches,
    setSelectedBranchId,
    setAvailableBranches,
    getSelectedBranch,
  } = useBranchStore();

  const [open, setOpen] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const res = await getCompanyBranches();
      if (res.success && res.branches) {
        setAvailableBranches(res.branches);
      }
    } catch {
      // Graceful fallback
    }
  }, [setAvailableBranches]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const activeBranch = getSelectedBranch();

  return (
    <DropdownMenu dir={dir} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border border-border/70 bg-background/80 hover:bg-muted/40 transition-all text-xs font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring select-none shadow-2xs"
          title={t('اختيار وتحديد الفرع التشغيلي', 'Sélectionner l’agence')}
        >
          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[90px] sm:max-w-[130px]">
            {activeBranch ? (
              <span className="flex items-center gap-1">
                <span>{COUNTRY_FLAGS[activeBranch.country] || '🏢'}</span>
                <span>{activeBranch.city || activeBranch.name}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span>🌐</span>
                <span>{t('كافة الفروع', 'Toutes agences')}</span>
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-muted-foreground transition-transform duration-200 shrink-0 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 p-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-xl z-50 text-xs"
      >
        <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1 flex items-center justify-between">
          <span>{t('فروع ومقرات الشركة', 'Agences de l’entreprise')}</span>
          <Badge variant="outline" className="text-[9px] font-mono">
            {availableBranches.length} {t('فروع', 'agences')}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Option: All Branches */}
        <DropdownMenuItem
          onClick={() => setSelectedBranchId('all')}
          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer ${
            selectedBranchId === 'all' ? 'bg-primary/10 text-primary font-bold' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{t('كافة الفروع (عرض شامل)', 'Toutes les agences (Global)')}</span>
          </div>
          {selectedBranchId === 'all' && <Check className="w-3.5 h-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* List of individual branches */}
        <div className="max-h-60 overflow-y-auto space-y-1 py-1">
          {availableBranches.map((branch) => {
            const isSelected = selectedBranchId === branch.id;
            const flag = COUNTRY_FLAGS[branch.country] || '🏢';
            return (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer ${
                  isSelected ? 'bg-primary/10 text-primary font-bold' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{flag}</span>
                  <div className="truncate">
                    <p className="font-semibold truncate">{branch.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {branch.code} • {branch.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ms-2">
                  {branch.is_headquarters && (
                    <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">
                      HQ
                    </Badge>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        {/* Link to Branch Management Screen */}
        <DropdownMenuItem asChild>
          <Link
            href="/branches"
            className="flex items-center gap-2 p-2 rounded-xl text-primary font-semibold hover:bg-primary/5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t('إدارة الفروع والمقرات', 'Gérer les agences')}</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

