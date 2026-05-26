const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'locales');
const languages = ['en', 'fr', 'es', 'de', 'sw', 'ar'];

const dashboardAdditions = {
  fr: { pending: "En attente", closed: "Clôturé", archived: "Archivé", partial: "Partiel", paid: "Payé" },
  en: { pending: "Pending", closed: "Closed", archived: "Archived", partial: "Partial", paid: "Paid" },
  es: { pending: "Pendiente", closed: "Cerrado", archived: "Archivado", partial: "Parcial", paid: "Pagado" },
  de: { pending: "Ausstehend", closed: "Geschlossen", archived: "Archiviert", partial: "Teilweise", paid: "Bezahlt" },
  sw: { pending: "Inasubiri", closed: "Imefungwa", archived: "Imehifadhiwa", partial: "Sehemu", paid: "Imelipwa" },
  ar: { pending: "قيد الانتظار", closed: "مغلق", archived: "مؤرشف", partial: "جزئي", paid: "مدفوع" }
};

languages.forEach(lang => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Fix nesting: move events, clients, users, roles out of cases if they are there
    if (data.cases) {
      ['events', 'clients', 'users', 'roles'].forEach(key => {
        if (data.cases[key]) {
          data[key] = data.cases[key];
          delete data.cases[key];
        }
      });
    }

    // Add missing dashboard keys
    if (data.dashboard) {
      Object.assign(data.dashboard, dashboardAdditions[lang]);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Fixed ${lang}`);
  }
});
