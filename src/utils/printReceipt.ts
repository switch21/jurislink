import type { UserProfile } from '../store/authStore';

export const printReceipt = (invoice: any, profile: UserProfile, index?: number) => {
  const tenant = profile.tenant;
  if (!tenant) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Generate Receipt Number: XXXDDMMAAPP
  const now = new Date();
  const DD = String(now.getDate()).padStart(2, '0');
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const AA = String(now.getFullYear()).slice(-2);
  
  const initials = profile.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
    
  const XXX = String(index || 1).padStart(3, '0');
  const receiptNo = `${XXX}${DD}${MM}${AA}${initials}`;

  const receiptContent = `
    <div class="receipt-container">
      <div class="header" style="margin-bottom: 10px; padding-bottom: 5px;">
        <div class="firm-info" style="display: flex; flex-direction: column; align-items: flex-start;">
          ${tenant.logo_url ? `<img src="${tenant.logo_url}" style="max-height: 50px; margin-bottom: 2px;" />` : ''}
          <p style="font-weight: 800; font-size: 12px; margin: 0; color: #1e293b;">${tenant.name}</p>
          <p style="font-size: 10px; margin: 1px 0;">${tenant.address || ''}</p>
          <p style="font-size: 10px; margin: 1px 0;">Tél: ${tenant.phone || ''} | Email: ${tenant.email || ''}</p>
          <p style="font-size: 10px; margin: 1px 0;">NIU: ${tenant.niu || ''}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-weight: bold; margin: 0; font-size: 14px;">Reçu N°: ${receiptNo}</p>
          <p style="margin: 3px 0; color: #64748b; font-size: 12px;">Date: ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      <div class="receipt-title">
        <h2 style="font-size: 20px;">Reçu de Paiement</h2>
        <p style="font-size: 14px; color: #10b981; margin: 5px 0;">PAYÉ</p>
      </div>

      <div class="details" style="font-size: 13px;">
        <div>
          <h3 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9;">Client</h3>
          <p><strong>${invoice.client?.full_name || 'Client'}</strong></p>
        </div>
        <div>
          <h3 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9;">Dossier</h3>
          <p>${invoice.case?.title || 'Prestations juridiques'}</p>
        </div>
      </div>

      <div class="amount-card">
        <h4 style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Montant Réglé</h4>
        <div class="amount" style="font-size: 24px; font-weight: 800; margin: 5px 0;">${Number(invoice.amount).toLocaleString('fr-FR')} ${invoice.currency?.symbol || invoice.currency?.code || ''}</div>
      </div>

      <div class="footer">
        <p>Merci de votre confiance.</p>
      </div>
    </div>
  `;

  const html = `
    <html>
      <head>
        <title>Reçu ${receiptNo}</title>
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
          .page-a4 { 
            width: 210mm; 
            height: 297mm; 
            background: white; 
            margin: 0 auto; 
            display: flex; 
            flex-direction: column;
            padding: 5mm 10mm;
            box-sizing: border-box;
          }
          .receipt-container {
            border: 1px dashed #e2e8f0;
            padding: 10mm;
            height: 135mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .firm-info p { margin: 1px 0; font-size: 11px; color: #475569; }
          .receipt-title { text-align: center; margin-bottom: 15px; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
          .amount-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; margin: 10px 0; }
          .footer { text-align: center; font-size: 11px; color: #64748b; padding-top: 10px; }
          
          .divider {
            height: 10mm;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .divider::after {
            content: '';
            width: 100%;
            border-bottom: 1px dashed #94a3b8;
          }
          .divider span {
            position: absolute;
            background: white;
            padding: 0 10px;
            font-size: 8px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          @media print {
            .page-a4 { width: 210mm; height: 297mm; padding: 5mm 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="page-a4">
          ${receiptContent}
          <div class="divider"><span>Découper ici</span></div>
          ${receiptContent}
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
