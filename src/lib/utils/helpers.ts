export function calculateAdvanceSettlement(
  amountGiven: number,
  amountSpent: number,
  amountReturned: number
): { remaining: number; status: string } {
  const remaining = amountGiven - amountSpent - amountReturned;

  if (remaining === 0) {
    return { remaining: 0, status: 'settled' };
  } else if (remaining > 0) {
    return { remaining, status: 'driver_owes' };
  } else {
    return { remaining: Math.abs(remaining), status: 'company_owes' };
  }
}

export function generateCMRNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CMR-${timestamp}-${random}`;
}

export function generateWhatsAppLink(
  phone: string,
  message: string
): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encoded}`;
}

export function formatWhatsAppFerryMessage(
  truckPlate: string,
  mrnNumber: string,
  ferryCompany: string,
  localizador: string
): string {
  return `Bonjour,\n\nJe souhaite réserver une traversée ferry:\n\nCamion: ${truckPlate}\nNuméro MRN: ${mrnNumber}\nCompagnie: ${ferryCompany}\nLocalisateur: ${localizador}\n\nMerci de confirmer.`;
}

export function parseFuelReceiptText(text: string): { amount?: number; liters?: number; station?: string } {
  const amountMatch = text.match(/(\d+[.,]\d{2})\s*(DH|MAD|EUR|€|DH)/i);
  const litersMatch = text.match(/(\d+[.,]\d{1,2})\s*(L|litres?|liters?)/i);
  const stationMatch = text.match(/station\s+([A-Za-z]+)/i);

  return {
    amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : undefined,
    liters: litersMatch ? parseFloat(litersMatch[1].replace(',', '.')) : undefined,
    station: stationMatch ? stationMatch[1] : undefined,
  };
}
