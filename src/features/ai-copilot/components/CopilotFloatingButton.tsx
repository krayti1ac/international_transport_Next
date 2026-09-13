'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { TransBodanonCopilotModal } from './TransBodanonCopilotModal';

export function CopilotFloatingButton() {
  const { t, dir } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 end-6 z-40 print:hidden">
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 px-4 shadow-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-xs gap-2 border border-white/20 transition-all hover:scale-105 active:scale-95 group"
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline font-amiri text-sm">
            {t('Trans Bodanon Copilot', 'Trans Bodanon Copilot')}
          </span>
        </Button>
      </div>

      <TransBodanonCopilotModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

