import { createClient } from '@/lib/supabase/client';

export interface QueuedReceipt {
  id: string;
  truck_id: number | null;
  amount: number;
  currency: string;
  date: string;
  notes: string;
  imageDataBase64?: string;
  fileName?: string;
  timestamp: string;
}

const STORAGE_KEY = 'offline_fuel_receipts_queue';

export function getOfflineQueue(): QueuedReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineQueue(item: Omit<QueuedReceipt, 'id' | 'timestamp'>) {
  const queue = getOfflineQueue();
  const newItem: QueuedReceipt = {
    ...item,
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  queue.push(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  return newItem;
}

export async function processOfflineQueue(
  onProgress?: (remaining: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0 };

  const supabase = createClient();
  let successCount = 0;
  let failCount = 0;
  const remainingQueue: QueuedReceipt[] = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let publicImageUrl = '';

      if (item.imageDataBase64 && item.fileName) {
        const byteCharacters = atob(item.imageDataBase64.split(',')[1] || item.imageDataBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        const uploadRes = await supabase.storage.from('fuel-receipts').upload(item.fileName, blob);
        if (!uploadRes.error) {
          const urlRes = supabase.storage.from('fuel-receipts').getPublicUrl(item.fileName);
          publicImageUrl = urlRes.data.publicUrl;
        }
      }

      const finalNotes = publicImageUrl ? `${item.notes}\n\nرابط الإيصال: ${publicImageUrl}` : item.notes;

      const { error } = await supabase.from('truck_maintenance').insert({
        truck_id: item.truck_id,
        expense_type: 'fuel',
        amount: item.amount,
        maintenance_date: item.date || new Date().toISOString(),
        description: finalNotes,
        payment_method: 'cash',
      });

      if (error) throw error;
      successCount++;
    } catch (err) {
      console.error('فشل مزامنة عنصر غير متصل:', err);
      failCount++;
      remainingQueue.push(item);
    }

    if (onProgress) {
      onProgress(queue.length - (i + 1), queue.length);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingQueue));
  return { successCount, failCount };
}
