'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Navigation,
  MapPin,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildGoogleMapsNavigationUrl,
  buildWazeNavigationUrl,
  buildAppleMapsNavigationUrl,
  type NavigationTarget,
} from '@/lib/navigation-links';
import { useToast } from '@/hooks/use-toast';

interface NavigationLauncherProps {
  target: NavigationTarget;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function NavigationLauncher({
  target,
  variant = 'outline',
  size = 'sm',
  className = '',
}: NavigationLauncherProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const googleUrl = buildGoogleMapsNavigationUrl(target);
  const wazeUrl = buildWazeNavigationUrl(target);
  const appleUrl = buildAppleMapsNavigationUrl(target);

  const handleCopy = () => {
    const textToCopy =
      target.latitude && target.longitude
        ? `${target.latitude}, ${target.longitude}`
        : target.addressOrCity || '';

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({ title: 'تم نسخ إحداثيات الوجهة إلى الحافظة' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5" dir="rtl">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={`rounded-xl gap-1.5 font-semibold shadow-xs ${className}`}
          >
            <Navigation className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>بدء الملاحة</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem
            onClick={() => window.open(googleUrl, '_blank', 'noopener,noreferrer')}
            className="cursor-pointer gap-2 py-2"
          >
            <MapPin className="w-4 h-4 text-rose-500" />
            <span>خرائط Google Maps</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground mr-auto" />
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => window.open(wazeUrl, '_blank', 'noopener,noreferrer')}
            className="cursor-pointer gap-2 py-2"
          >
            <Navigation className="w-4 h-4 text-sky-500" />
            <span>تطبيق Waze</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground mr-auto" />
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => window.open(appleUrl, '_blank', 'noopener,noreferrer')}
            className="cursor-pointer gap-2 py-2"
          >
            <MapPin className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <span>خرائط Apple Maps</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground mr-auto" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size={size}
        onClick={handleCopy}
        className="h-8 w-8 p-0 rounded-xl"
        title="نسخ الإحداثيات أو العنوان"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
