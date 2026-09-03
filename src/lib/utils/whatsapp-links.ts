export function generateWhatsAppLink(phone: string, template: 'ferry' | 'transit_export' | 'overdue_invoice', tripData: { truck_plate?: string; trailer_plate?: string; ferry_company?: string; cmr_export_number?: string; mrn_export_url?: string; cmr_export_url?: string; facture_url?: string }): string {
  const formattedPhone = phone.replace(/[^\d+]/g, '').replace(/^00/, '').replace(/^0/, '212');
  
  const truckPlate = tripData.truck_plate || 'N/A';
  const trailerPlate = tripData.trailer_plate || 'N/A';

  let message = '';

  if (template === 'ferry') {
    const company = tripData.ferry_company || 'la compagnie';
    message = `Bonjour ${company}, Merci de préparer le Triptique.\nTracteur: ${truckPlate}\nRemorque: ${trailerPlate}.`;
    if (tripData.mrn_export_url) {
      message += `\nCi-joint le MRN: ${tripData.mrn_export_url}`;
    }
  } else if (template === 'transit_export') {
    message = `Bonjour, Prière de préparer le MRN (DUA).\nTracteur: ${truckPlate}\nRemorque: ${trailerPlate}.`;
    const attachments = [];
    if (tripData.cmr_export_url) attachments.push(`CMR: ${tripData.cmr_export_url}`);
    if (tripData.facture_url) attachments.push(`Facture: ${tripData.facture_url}`);
    if (attachments.length > 0) {
      message += `\nCi-joint: ${attachments.join(', ')}.`;
    }
  } else if (template === 'overdue_invoice') {
    message = `Dear Client, your invoice #${truckPlate} is overdue by ${trailerPlate}. Please settle it.`;
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}
