export interface ParsedReceiptData {
  amount?: number;
  liters?: number;
  currency: 'MAD' | 'EUR';
  station?: string;
  date?: string;
  confidence: number;
  rawText: string;
}

const KNOWN_STATIONS = [
  { name: 'Afriquia (أفريقيا)', pattern: /afriquia|أفريقيا|afriq/i },
  { name: 'TotalEnergies', pattern: /total|totalenergies|توتال/i },
  { name: 'Shell (شل)', pattern: /shell|شل/i },
  { name: 'Winxo (وينكسو)', pattern: /winxo|وينكسو/i },
  { name: 'Petrom (بتروم)', pattern: /petrom|بتروم/i },
  { name: 'Ola Energy', pattern: /ola|oililibya|أولا/i },
  { name: 'Cepsa', pattern: /cepsa/i },
  { name: 'Repsol', pattern: /repsol/i },
  { name: 'AS 24', pattern: /as\s*24/i },
  { name: 'BP', pattern: /\bbp\b/i },
];

export function parseReceiptTextAdvanced(rawText: string): ParsedReceiptData {
  const normalized = rawText.replace(/\r/g, ' ');
  let confidenceScore = 0;

  let detectedStation: string | undefined;
  for (const station of KNOWN_STATIONS) {
    if (station.pattern.test(normalized)) {
      detectedStation = station.name;
      confidenceScore += 25;
      break;
    }
  }

  let currency: 'MAD' | 'EUR' = 'MAD';
  if (/€|eur|euros?/i.test(normalized)) {
    currency = 'EUR';
  } else if (/dh|mad|درهم/i.test(normalized)) {
    currency = 'MAD';
  }

  let detectedAmount: number | undefined;
  const totalKeywords = /(?:total|montant|ttc|importe|net\s*a\s*payer|المبلغ|المجموع)[\s:=]*([0-9]+[.,][0-9]{2})/i;
  const totalMatch = normalized.match(totalKeywords);

  if (totalMatch) {
    detectedAmount = parseFloat(totalMatch[1].replace(',', '.'));
    confidenceScore += 35;
  } else {
    const genericAmount = normalized.match(/([0-9]+[.,][0-9]{2})\s*(?:dh|mad|€|eur|درهم)/i);
    if (genericAmount) {
      detectedAmount = parseFloat(genericAmount[1].replace(',', '.'));
      confidenceScore += 25;
    }
  }

  let detectedLiters: number | undefined;
  const litersMatch = normalized.match(/([0-9]+[.,][0-9]{1,2})\s*(?:l|litres?|litros?|لتر)/i);
  if (litersMatch) {
    detectedLiters = parseFloat(litersMatch[1].replace(',', '.'));
    confidenceScore += 20;
  }

  let detectedDate: string | undefined;
  const dateMatch = normalized.match(/\b([0-3]?[0-9])[/-]([0-1]?[0-9])[/-](202[4-9]|20[0-9]{2})\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    detectedDate = `${year}-${month}-${day}`;
    confidenceScore += 20;
  } else {
    const isoDateMatch = normalized.match(/\b(202[4-9])-([0-1][0-9])-([0-3][0-9])\b/);
    if (isoDateMatch) {
      detectedDate = isoDateMatch[0];
      confidenceScore += 20;
    }
  }

  return {
    amount: detectedAmount,
    liters: detectedLiters,
    currency,
    station: detectedStation,
    date: detectedDate || new Date().toISOString().split('T')[0],
    confidence: Math.min(100, confidenceScore),
    rawText,
  };
}
