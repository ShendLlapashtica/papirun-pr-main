import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Privacy = () => {
  const { language } = useLanguage();
  const sq = language === 'sq';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {sq ? 'Kthehu' : 'Back'}
        </Link>

        <h1 className="font-display font-bold text-3xl mb-2">
          {sq ? 'Politika e Privatësisë' : 'Privacy Policy'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {sq ? 'Përditësuar së fundmi: Maj 2026' : 'Last updated: May 2026'}
        </p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '1. Kush jemi ne' : '1. Who we are'}
            </h2>
            <p className="text-sm">
              {sq
                ? 'Papirun është një shërbim i porositjes dhe dorëzimit të ushqimit me bazë në Prishtinë, Kosovë. Adresa jonë: Johan V. Hahn, Nr.14, Prishtinë 10000. Kontakt: +38349644168.'
                : 'Papirun is a food ordering and delivery service based in Pristina, Kosovo. Address: Johan V. Hahn, Nr.14, Pristina 10000. Contact: +38349644168.'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '2. Çfarë të dhënash mbledhim' : '2. What data we collect'}
            </h2>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-foreground/80">
              <li>{sq ? 'Emri dhe numri i telefonit (për konfirmimin e porosisë)' : 'Name and phone number (for order confirmation)'}</li>
              <li>{sq ? 'Adresa e dorëzimit dhe koordinatat GPS (për të dërguar porosinë)' : 'Delivery address and GPS coordinates (to deliver your order)'}</li>
              <li>{sq ? 'Historia e porosive (produktet e zgjedhura, totali, data)' : 'Order history (selected products, total, date)'}</li>
              <li>{sq ? 'Adresa e e-mailit nëse regjistroheni me llogari' : 'Email address if you create an account'}</li>
              <li>{sq ? 'Pajisja dhe shfletuesi (automatikisht nga infrastruktura e hostimit)' : 'Device and browser info (automatically via hosting infrastructure)'}</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '3. Si i përdorim të dhënat' : '3. How we use your data'}
            </h2>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-foreground/80">
              <li>{sq ? 'Përpunimi dhe dorëzimi i porosisë suaj' : 'Processing and delivering your order'}</li>
              <li>{sq ? 'Komunikimi me ju lidhur me statusin e porosisë (telefon ose mesazh)' : 'Communicating with you about order status (phone or message)'}</li>
              <li>{sq ? 'Ruajtja e adresave tuaja të preferuara për lehtësi në të ardhmen' : 'Saving your preferred addresses for future convenience'}</li>
              <li>{sq ? 'Sigurimi i funksionimit të duhur të aplikacionit' : 'Ensuring the app works properly'}</li>
            </ul>
            <p className="text-sm mt-3 text-foreground/70">
              {sq
                ? 'Nuk shesim, nuk ndajmë dhe nuk i përdorim të dhënat tuaja për qëllime reklamimi.'
                : 'We do not sell, share, or use your data for advertising purposes.'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '4. Shërbime të palëve të treta' : '4. Third-party services'}
            </h2>
            <p className="text-sm text-foreground/80 mb-3">
              {sq
                ? 'Aplikacioni ynë përdor shërbime të jashtme teknike për funksionim:'
                : 'Our app uses external technical services to function:'}
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-foreground/80">
              <li>
                <strong>Supabase</strong> — {sq ? 'databaza dhe autentikimi (serverë në BE/EU). ' : 'database and authentication (servers in EU). '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                  {sq ? 'Politika e privatësisë →' : 'Privacy policy →'}
                </a>
              </li>
              <li>
                <strong>Google Maps / OpenStreetMap</strong> — {sq ? 'shfaqja e hartës dhe gjeolokalizimi i adresës.' : 'map display and address geo-location.'}
              </li>
              <li>
                <strong>Vercel</strong> — {sq ? 'hostimi i aplikacionit (serverë në EU).' : 'app hosting (servers in EU).'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '5. Ruajtja e të dhënave' : '5. Data retention'}
            </h2>
            <p className="text-sm text-foreground/80">
              {sq
                ? 'Porositë dhe të dhënat e lidhura me to ruhen për aq kohë sa nevojitet për qëllime operacionale dhe ligjore, zakonisht deri në 12 muaj. Mund të kërkoni fshirjen e llogarisë dhe të dhënave tuaja në çdo kohë.'
                : 'Orders and related data are retained as long as necessary for operational and legal purposes, typically up to 12 months. You can request deletion of your account and data at any time.'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '6. Të drejtat tuaja' : '6. Your rights'}
            </h2>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-foreground/80">
              <li>{sq ? 'E drejta për të aksesuar të dhënat tuaja' : 'Right to access your data'}</li>
              <li>{sq ? 'E drejta për të korrigjuar të dhëna të pasakta' : 'Right to correct inaccurate data'}</li>
              <li>{sq ? 'E drejta për të fshirë të dhënat tuaja' : 'Right to delete your data'}</li>
              <li>{sq ? 'E drejta për të kufizuar përpunimin' : 'Right to restrict processing'}</li>
            </ul>
            <p className="text-sm mt-3 text-foreground/70">
              {sq
                ? 'Për të ushtruar këto të drejta, na kontaktoni direkt: +38349644168'
                : 'To exercise these rights, contact us directly: +38349644168'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '7. Cookies dhe ruajtja lokale' : '7. Cookies & local storage'}
            </h2>
            <p className="text-sm text-foreground/80">
              {sq
                ? 'Aplikacioni përdor ruajtjen lokale (localStorage) vetëm për funksione esenciale: gjuha e preferuar, statusi i porosisë aktive dhe informacioni i adresës. Nuk përdorim cookies reklamuese ose ndjekëse.'
                : 'The app uses localStorage only for essential functions: preferred language, active order status, and address info. We do not use advertising or tracking cookies.'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '8. Ndryshimet e kësaj politike' : '8. Changes to this policy'}
            </h2>
            <p className="text-sm text-foreground/80">
              {sq
                ? 'Mund të përditësojmë këtë politikë herë pas here. Ndryshimet e rëndësishme do të njoftohen nëpërmjet aplikacionit. Ju inkurajojmë ta rishikoni periodikisht.'
                : 'We may update this policy from time to time. Significant changes will be communicated through the app. We encourage you to review it periodically.'}
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">
              {sq ? '9. Kontakti' : '9. Contact'}
            </h2>
            <p className="text-sm text-foreground/80">
              {sq
                ? 'Nëse keni pyetje rreth kësaj politike ose mënyrës se si trajtojmë të dhënat tuaja:'
                : 'If you have questions about this policy or how we handle your data:'}
            </p>
            <div className="mt-2 text-sm space-y-1 text-foreground/70">
              <p><strong>Papirun</strong></p>
              <p>Johan V. Hahn, Nr.14, Prishtinë 10000</p>
              <p>
                <a href="tel:+38349644168" className="text-primary hover:underline">+38349644168</a>
              </p>
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
