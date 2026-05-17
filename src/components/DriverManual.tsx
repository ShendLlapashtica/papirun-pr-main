import { useState } from 'react';
import { X, Download, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverName: string;
  onClose: () => void;
}

const SECTIONS = [
  {
    id: 'hyrja',
    title: '1. Hyrja në Sistem (Login)',
    content: `
Si të hysh:
• Hap faqen e drejtorit: shko te adresa e DriverPanel-it (p.sh. papirun.com/driver)
• Fut username-in tënd (zakonisht emri ose kodi juaj i caktuar nga admini)
• Nëse gaboi: kontrollo që username të jetë saktë pa hapësira në fillim/fund
• Sesioni ruhet automatikisht — nuk duhet të hysh çdo herë nëse telefoni mbetet hapur

Çfarë ndodh pas hyrjes:
• Shfaqet paneli i plotë me porositë aktive
• GPS-i aktivizohet automatikisht (mund ta çaktivizosh me butonin GPS)
• Sistemi fillon të regjistrojë vendndodhjen tënde çdo 30 sekonda
    `,
  },
  {
    id: 'paneli',
    title: '2. Pamja e Panelit — Çfarë Sheh',
    content: `
Header (lart):
• Avatari me inicialet e tua (e coloruar — unik për ty)
• Emri yt + statusi i GPS-it (📍 aktiv / joaktiv)
• Buton "Pauzë" — kërkon leje nga admini para se të pushosh
• Buton "Pa aprovim" — pauzë e menjëhershme (pa pritur admin)
• Buton GPS — ndez/fik gjurmimin e vendndodhjes
• Buton Logout (ikonë dere)

Statistikat (3 kutia):
• AKTIVE — porositë që po trajton tani
• SOT — sa porosi ke mbaruar sot
• PRODUKTIVE — koha totale e punës produktive sot

Lista e Porosive Aktive (majtas):
• Çdo porosi shfaqet si kartë me emrin e klientit, telefonin, adresën
• Koha e kaluar nga caktimi shfaqet si orë/minuta (timer i gjallë)
• Kliko mbi porosi për të hapur detajet dhe chat-in

Paneli i Detajeve (djathtas / poshtë në mobile):
• Emri dhe telefoni i klientit (klikueshëm për telefonatë)
• Artikujt e porositur me sasi
• Totali i porosisë (€)
• Adresa e dorëzimit
• ETA e kuzhinës (nëse admini e ka vendosur)
• Shënime nga klienti (nëse ka)
• Butonat e statusit
• Chat me klientin
• Harta e vendndodhjes

Harta (fund):
• Shfaq pozicionin tënd live (nëse GPS aktiv)
• Shfaq destinacionin e klientit nëse porosia është zgjedhur
    `,
  },
  {
    id: 'marrja',
    title: '3. Marrja e Porosive — Kur Cakton Admini',
    content: `
Si funksionon caktimi:
• Admini ose sistemi (Auto-Mode) të cakton porosinë automatikisht
• Menjëherë dëgjon tingullin KRRING — ky është sinjali i porosisë
• Shfaqet njoftim push në telefon (nëse push notifications janë të lejuara)
• Porosia shfaqet si kartë e re në listën "Porositë Aktive"

RREGULL I RËNDËSISHËM — 1 minutë:
• Pas caktimit, ke MAKSIMUM 1 minutë për të nisur porosinë
• Pas 1 minute pa veprim:
  → Tingëllon alarmi sërish
  → Shfaqet banner i kuq "Provo të pranosh porosinë — ka kaluar 1 minutë!"
  → Admini gjithashtu shikon alarmin dhe mund të ri-caktojë porosinë
• Klikoje porosinë nga banneri (ose lista) dhe nise menjëherë

Çfarë duhet të bësh kur vjen porosia:
1. Kliko mbi kartën e porosisë
2. Lexo emrin, adresën dhe artikujt
3. Kontrollo nëse ka shënime speciale nga klienti (kutia portokalli)
4. Kliko "Nise Dërgesën" kur nis rrugën drejt klientit
    `,
  },
  {
    id: 'statuset',
    title: '4. Statuset e Porosisë — Hap pas Hapi',
    content: `
Statusi "Konfirmuar" (Approved):
• Porosia u caktua tek ti nga admini
• Ushqimi është duke u përgatitur në kuzhinë
• Dil nëse ke GPS, kontrollo hartën

Statusi "Nise Dërgesën" (Out for Delivery):
• Kliko "Nise Dërgesën" VETËM kur je duke lëvizur drejt klientit
• Klienti sheh në kohë reale që dërgesatarë është në rrugë
• GPS duhet të jetë aktiv në këtë fazë

Statusi "Përfunduar" (Completed):
• Kliko "Përfundo Dërgesën" pasi ia ke dorëzuar ushqimin klientit
• Sistemi regjistron kohën e dorëzimit
• Klienti mund të vlerësojë shërbimin tënd (emojimet 😊😐☹️)
• Porosia zhduket nga lista aktive dhe shkon te historiku

Butoni alternativ "Mbaro bisedën · Përfundo":
• Mund ta përdorësh gjithashtu për të mbyllur porosinë
• Ideal kur ke dorëzuar dhe ke folur me klientin në chat

KUJDES:
• Mos kliko "Përfundo" pa ia dorëzuar ushqimin klientit
• Nëse gaboi statusin, kontakto adminin menjëherë
    `,
  },
  {
    id: 'komunikimi',
    title: '5. Komunikimi me Klientin',
    content: `
Chat me Klientin:
• Çdo porosi ka chat të brendshëm (seksioni "Chat me klientin")
• Klientit i shfaqen mesazhet e tua menjëherë
• Përdore për: konfirmim adrese, vonesa, udhëzime specifike
• Chat mbyllet pasi porosia të përfundojë (status "Completed")

Telefonatë direkte:
• Kliko numrin e telefonit ose butonin "Thirr" (ikona telefon)
• Hap automatikisht aplikacionin e telefonit

Navigim (Google Maps):
• Kliko butonin "Navigo" ose "MapPin" — hap Google Maps me drejtim automatik
• Funksionon vetëm nëse klienti ka lënë koordinata GPS

Rregulla komunikimi:
• Gjithmonë konfirmo adresën nëse nuk e njeh zonën
• Njofto klientin nëse ka vonesë (>5 min nga koha e premtuar)
• Qëndro profesional dhe miqësor në çdo komunikim
    `,
  },
  {
    id: 'pauza',
    title: '6. Sistemi i Pauzës',
    content: `
Dy mënyra të pauzës:

A) "Pauzë" (me aprovim të adminit) — E REKOMANDUAR:
• Kliko butonin "Pauzë" (ikona kafe ☕)
• Sistemi dërgon kërkesë te admini
• Shikon "Duke pritur…" derisa admini pranon
• Pasi admini aprovan → shfaqet njoftimi "Admini aprovoi pauzën tënde ✓"
• Statusi të ndryshon automatikisht — nuk duhet të bësh asgjë tjetër
• Kur je gati: kliko "Disponueshëm" për t'u kthyer

B) "Pa aprovim" (pauzë e menjëhershme):
• Kliko butonin "Pa aprovim"
• Hyn menjëherë në pauzë pa pritur asnjë aprovim
• Përdore VETËM në situata urgjente (nevojë fiziologjike, problem teknik)
• Admini shikon në panelin e tij që je në pauzë

Pauzë e tejkaluar (>30 minuta):
• Nëse je >30 min në pauzë, admini shikon alarm të kuq me "PAUZË E GJATË"
• Admini mund të të kthejë disponueshëm pa pytje
• Kthe gjithmonë sa më shpejt nga pauza

Si të kthehesh nga pauza:
• Kliko butonin "Disponueshëm" (i gjelbër)
• Statusi ndryshon menjëherë dhe sistemi të radhit për porosinë e radhës
    `,
  },
  {
    id: 'gps',
    title: '7. GPS dhe Gjurmimi i Vendndodhjes',
    content: `
Pse duhet GPS aktiv:
• Admini sheh vendndodhjen tënde live në hartën e panelit
• Klienti mund të shohë drejtimin drejt tij
• Sistemi llogarit kohën e arritjes (ETA) më saktë

Si aktivizohet GPS-i:
• Hap DriverPanel-in → GPS fillon automatikisht
• Butoni GPS (ikonë busullë): jeshile = aktiv, gri = joaktiv
• Shfaqet "GPS Live" me animacion pulsues kur aktiv

Cilësimet e GPS-it:
• Vendndodhja regjistrohet çdo 30 sekonda në server
• Nëse GPS nuk funksionon: shfaqet mesazh gabimi
• Saktësia e lartë (High Accuracy): duhet të japësh leje GPS nga shfletuesi

Çfarë të bësh nëse GPS nuk punon:
1. Kontrollo që siti të ketë leje GPS (ikonë kyç ose busullë te URL-ja)
2. Kliko butonin GPS për ta rindezur
3. Nëse vazhdon problemi, njofto adminin me chat

Baterinë:
• GPS me saktësi të lartë konsumon baterinë — mban telefonin ngarkuar gjatë turnit
    `,
  },
  {
    id: 'rregullat',
    title: '8. Rregullat dhe Kohët e Detyrueshme',
    content: `
Kohët maksimale:
• 1 minutë — nga caktimi deri në nisjen e porosisë (kliko "Nise Dërgesën")
• Pas 1 minute pa veprim → alarm automatik + njoftim te admini
• Pauzë maksimale e rekomanduar: 30 minuta — pas kësaj admini shikon alarm

Rendi i marrjes së porosive:
• Sistemi të cakton porosinë bazuar në:
  → Koha e pritjes: ai që ka pritur më gjatë pa porosi merr radhën e parë
  → ETA aktuale: nëse të gjithë janë të zënë, merr ai me ETA më të shkurtër
• Nuk mund të refuzosh porosinë nëse je i disponueshëm — njofto adminin

Cilësi e shërbimit:
• Gjithmonë aktivizo GPS gjatë dorëzimit
• Komuniko me klientin nëse ka vonesë
• Nëse klienti nuk është në adresë: telefono para se të kthehesh
• Vlerësimet e klientëve (😊😐☹️) ndikojnë në performancën tënde

Problemet e zakonshme:
• Adresë e gabuar → telefono klientin MENJËHERË
• Ushqim i gabuar → kontakto adminin para dorëzimit
• Aksident/vonesë e madhe → njofto adminin me urgjencë (telefon ose chat)
• Klienti nuk përgjigjet → prit 2 min, telefono sërish, pastaj njofto adminin
    `,
  },
  {
    id: 'dita',
    title: '9. Struktura e një Dite Pune',
    content: `
Fillimi i turnit:
1. Hap DriverPanel-in dhe hyr me username-in tënd
2. Kontrollo që GPS të jetë aktiv (butoni jeshile "GPS Live")
3. Mos hyr në pauzë pa arsye — qëndro disponueshëm

Gjatë turnit:
• Porosia → KRRING → kliko kartën → kontrollo detajet → "Nise Dërgesën" → dërgoje → "Përfundo"
• Nëse ke disa porosi njëkohësisht: trajto sipas radhës dhe prioritetit
• Pas çdo dërgese, sistemi automatikisht të gjendesh disponueshëm

Pushimi i mesditës ose gjatë turnit:
• Kërko pauzë nga admini ("Pauzë" → prit aprovimin)
• Mos shky telefoni gjatë turnit — lëre aktiv
• Kthehu nga pauza sapo je gati

Mbarimi i turnit:
• Nëse admini mbyll sistemin (CLEAN UP), porositë arkivohen automatikisht
• Çdo natë në mesnatë, porositë e ditës arkivohen automatikisht
• Logou nga paneli me butonin Logout (ikonë dere)

Statistikat e tua:
• Admini sheh: sa porosi ke bërë, sa euro ke transportuar, kohën produktive
• Vlerësimet e klientëve janë të dukshme te admini (klikon mbi emrin tënd)
• Performanca juaj vlerësohet çdo ditë
    `,
  },
  {
    id: 'troubleshoot',
    title: '10. Zgjidhja e Problemeve (Troubleshooting)',
    content: `
Nuk shoh porosinë e re:
• Sistemi po-ton çdo 8 sekonda — prit pak
• Rfresko faqen (tërhiq poshtë ose F5) nëse pas 15s nuk shfaqet
• Kontrollo lidhjen me internet

Butoni "Nise Dërgesën" nuk funksionon:
• Kontrollo lidhjen me internet
• Rfresko faqen dhe provo sërish
• Njofto adminin nëse vazhdon

Chat nuk po funksionon / mesazhet nuk dërgohen:
• Kontrollo lidhjen me internet
• Nëse mesazhet nuk dërgohen: telefono direkt klientin

GPS nuk regjistron vendndodhjen:
• Shko te cilësimet e shfletuesit dhe lejo qasjen te GPS
• Rifresko faqen dhe kliko butonin GPS sërish
• GPS funksionon vetëm me HTTPS (faqe e sigurt)

Push notifications nuk funksionojnë:
• Cilësimet e telefonit → Njoftimet → Papirun Driver → Lejo
• Nëse nuk funksionon, mbaj faqen hapur gjatë gjithë turnit

Dola aksidentalisht (logout):
• Hyr sërish me username-in tënd — sesioni ndoshta ka skaduar
• Kontakto adminin nëse nuk mund të hysh

NUMRI i ADMINIT (për urgjenca): kontakto drejtpërdrejt nëpërmjet mënyrës së komunikimit të dakorduar.
    `,
  },
];

export const openDriverManualPDF = (driverName: string) => {
  const w = window.open('', '_blank');
  if (!w) return;

  const sectionsHtml = SECTIONS.map((s) =>
    `<div class="section">
      <h2>${s.title}</h2>
      <pre>${s.content.trim()}</pre>
    </div>`
  ).join('');

  w.document.write(`<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8" />
  <title>Manual Shofer — Papirun</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; padding: 32px 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #111; }
    .subtitle { font-size: 12px; color: #666; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #999; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    h2 { font-size: 14px; font-weight: 700; background: #f3f4f6; border-left: 4px solid #111; padding: 8px 12px; margin-bottom: 10px; }
    pre { font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.65; color: #222; }
    .footer { border-top: 1px solid #ddd; margin-top: 32px; padding-top: 12px; font-size: 11px; color: #999; text-align: center; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
    .print-btn { display: block; background: #111; color: #fff; border: none; padding: 10px 24px; font-size: 13px; font-weight: 700; cursor: pointer; border-radius: 8px; margin-bottom: 24px; }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">⬇ Shkarko / Printo si PDF</button>
  <h1>Manual Shofer — Papirun</h1>
  <p class="subtitle">Udhëzues i plotë për punën si shofer dërgese</p>
  <p class="meta">Shofer: <strong>${driverName}</strong> &nbsp;·&nbsp; Gjeneruar: ${new Date().toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  ${sectionsHtml}
  <div class="footer">Papirun Delivery System · Manual konfidencial — vetëm për shoferë</div>
</body>
</html>`);
  w.document.close();
};

const DriverManual = ({ driverName, onClose }: Props) => {
  const [openId, setOpenId] = useState<string | null>('hyrja');

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border/50 flex items-center gap-3 px-4 py-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-base leading-tight">Manual Shofer</h2>
          <p className="text-[10px] text-muted-foreground">Udhëzues i plotë · Papirun Delivery</p>
        </div>
        <button
          onClick={() => openDriverManualPDF(driverName)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {SECTIONS.map((s) => {
          const isOpen = openId === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-border/50 overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : s.id)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left font-bold text-sm hover:bg-secondary/40 transition-colors"
              >
                <span>{s.title}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border/30">
                  <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans pt-3">
                    {s.content.trim()}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        <div className="text-center py-6">
          <button
            onClick={() => openDriverManualPDF(driverName)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
          >
            <Download className="w-4 h-4" /> Shkarko Manual si PDF
          </button>
          <p className="text-[10px] text-muted-foreground mt-2">Hap skedarin → File → Print → "Save as PDF"</p>
        </div>
      </div>
    </div>
  );
};

export default DriverManual;
