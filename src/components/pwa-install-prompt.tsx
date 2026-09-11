'use client';

import { useState } from 'react';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import {
  Download,
  X,
  Monitor,
  Zap,
  Info,
  Pin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';

export function PwaInstallPrompt() {
  const {
    isInstalled,
    isInstalling,
    isOpen,
    isReady,
    platform,
    hasDeferredPrompt,
    showPrompt,
    dismissPrompt,
    openPrompt,
  } = usePwaInstall();

  const { locale, dir } = useLanguage();
  const isAr = locale === 'ar';
  const [showManualGuide, setShowManualGuide] = useState(false);

  // If already installed (running in standalone mode), NEVER show prompt or trigger
  if (!isReady || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (hasDeferredPrompt) {
      const outcome = await showPrompt();
      if (!outcome) {
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  return (
    <>
      {/* 1. Modal Dialog - Prompts upon first visiting from the browser */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          dir={dir}
        >
          <div className="relative w-full max-w-lg bg-card/95 dark:bg-slate-900/95 text-foreground rounded-2xl sm:rounded-3xl border border-primary/20 shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col gap-4 backdrop-blur-md">
            {/* Ambient background glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-sky-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header section with Close button */}
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-sky-500 p-0.5 shadow-lg shadow-primary/20 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-white">
                    <Monitor className="w-6 h-6 text-sky-400" />
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 mb-1">
                    <Pin className="w-3 h-3" />
                    <span>{isAr ? 'تطبيق مثبت في النظام' : 'Application PWA'}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground font-amiri leading-tight">
                    {isAr
                      ? 'يرجى تثبيت النظام كبرنامج في الجهاز'
                      : "Veuillez installer l'application sur votre appareil"}
                  </h3>
                </div>
              </div>

              <button
                onClick={dismissPrompt}
                className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-full transition-colors"
                title={isAr ? 'إغلاق' : 'Fermer'}
                aria-label={isAr ? 'إغلاق' : 'Fermer'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description context */}
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed relative z-10">
              {isAr
                ? 'للحصول على أفضل تجربة عمل وسرعة في إنجاز الشحنات، يوصى بتثبيت التطبيق على جهازك ليصبح برنامجاً رسمياً متاحاً بنقرة واحدة دون الحاجة لإعادة البحث في المتصفح.'
                : "Pour une expérience de travail optimale et un traitement rapide des expéditions, installez l'application pour un accès direct en un clic."}
            </p>

            {/* Highlights Grid: Taskbar, Desktop & Offline Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
              {/* Feature 1: PC Taskbar (Barre des tâches) */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 dark:bg-slate-800/40 border border-border/60 hover:border-primary/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Pin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {isAr ? 'شريط المهام للكمبيوتر' : 'Barre des tâches (PC)'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {isAr
                      ? 'تثبيت فوري في BARRE DE TACHE أسفل الشاشة لفتحه بضغطة زر.'
                      : "Épinglage direct dans la barre des tâches pour un accès immédiat."}
                  </p>
                </div>
              </div>

              {/* Feature 2: Desktop / Home Screen */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 dark:bg-slate-800/40 border border-border/60 hover:border-primary/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {isAr ? 'الشاشة الرئيسية وسطح المكتب' : "Bureau / Écran d'accueil"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {isAr
                      ? 'أيقونة رسمية على سطح المكتب أو شاشة الهاتف لفتح النظام مباشرة.'
                      : "Raccourci officiel sur votre bureau ou écran d'accueil."}
                  </p>
                </div>
              </div>

              {/* Feature 3: Native App Window */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 dark:bg-slate-800/40 border border-border/60 hover:border-primary/30 transition-colors sm:col-span-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {isAr ? 'تشغيل كنافذة برنامج مستقلة' : 'Application autonome & Rapide'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {isAr
                      ? 'واجهة نظيفة بدون شريط عناوين المتصفح، مع سرعة أعلى ودعم للعمل بدون إنترنت.'
                      : 'Interface épurée sans barre du navigateur, haute performance et mode hors-ligne.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Manual Installation Guide if browser native prompt isn't directly triggered */}
            {showManualGuide && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 font-bold">
                  <Info className="w-4 h-4 text-amber-500" />
                  <span>
                    {isAr
                      ? 'خطوات التثبيت من المتصفح (Chrome / Edge):'
                      : 'Étapes d’installation depuis votre navigateur :'}
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] ps-1 text-muted-foreground dark:text-amber-100/90">
                  {platform === 'windows' || platform === 'mac' ? (
                    <>
                      <li>
                        {isAr
                          ? 'انقر على أيقونة التثبيت (⊕) في شريط عناوين المتصفح بالأعلى (Address Bar).'
                          : "Cliquez sur l'icône d'installation (⊕) dans la barre d'adresse en haut."}
                      </li>
                      <li>
                        {isAr
                          ? 'أو افتح قائمة المتصفح (⋮) ثم اختر "تثبيت Trans Bodanon" أو "تطبيقات > تثبيت".'
                          : 'Ou ouvrez le menu (⋮) > "Installer Trans Bodanon".'}
                      </li>
                      <li>
                        {isAr
                          ? 'اختر "تثبيت في شريط المهام" وسطح المكتب عند انتهاء التثبيت.'
                          : "Cochez 'Épingler à la barre des tâches' et sur le Bureau."}
                      </li>
                    </>
                  ) : platform === 'ios' ? (
                    <>
                      <li>{isAr ? 'انقر على زر المشاركة (Share) في Safari.' : 'Appuyez sur le bouton Partager dans Safari.'}</li>
                      <li>{isAr ? 'اختر "إضافة إلى الصفحة الرئيسية".' : 'Sélectionnez "Sur l’écran d’accueil".'}</li>
                    </>
                  ) : (
                    <>
                      <li>{isAr ? 'انقر على قائمة المتصفح (⋮) بالأعلى.' : 'Appuyez sur le menu (⋮) du navigateur.'}</li>
                      <li>{isAr ? 'اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".' : 'Sélectionnez "Installer l’application".'}</li>
                    </>
                  )}
                </ol>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-border/50 relative z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissPrompt}
                className="text-xs h-9 px-4 text-muted-foreground hover:text-foreground font-medium rounded-xl"
              >
                {isAr ? 'المتابعة عبر المتصفح (لاحقاً)' : 'Continuer dans le navigateur'}
              </Button>

              <Button
                size="sm"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="text-xs h-9 px-5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white font-bold rounded-xl shadow-md shadow-primary/20 gap-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isInstalling
                    ? isAr
                      ? 'جاري التثبيت...'
                      : 'Installation...'
                    : isAr
                    ? 'تثبيت كبرنامج الآن'
                    : "Installer l'application"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Floating quick-access install button when prompt was dismissed for the current session */}
      {!isOpen && (
        <button
          onClick={openPrompt}
          className="fixed bottom-4 start-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-card/90 dark:bg-slate-900/90 hover:bg-primary hover:text-white border border-primary/20 shadow-lg backdrop-blur-sm text-xs font-semibold text-foreground transition-all duration-200 group"
          title={isAr ? 'تثبيت البرنامج على الجهاز' : "Installer l'application"}
        >
          <div className="w-6 h-6 rounded-full bg-primary/15 group-hover:bg-white/20 text-primary group-hover:text-white flex items-center justify-center transition-colors">
            <Download className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline">
            {isAr ? 'تثبيت البرنامج (PC / جهازك)' : 'Installer l’application'}
          </span>
          <span className="sm:hidden">{isAr ? 'تثبيت' : 'Installer'}</span>
        </button>
      )}
    </>
  );
}
