# Ndarja totale Web ↔ App: dy faqe të ndryshme produkti, routing i pastër

## Problemi aktual (root cause)

Aktualisht `/product/:id` është **një URL e përbashkët** për Web dhe App. `ProductRoute.tsx` vendos cilën view të mbajë **bazuar në gjerësinë e ekranit** (`<768px`). Kjo është e gabuar:

- **User-i në mobile browser viziton `papirun.net**` (web) → kërcen produkti → `/product/:id` → viewport <768px → e merr si **App** → shfaqet UI e app-it edhe pse user-i nuk është kurrë te `/home`. **Ngatërresë komplete.**
- Browser-i bën back/scroll/history konfuze sepse "view-i" mund të ndryshojë vetëm duke rrotulluar telefonin.
- Ekziston ende kodi legacy `params.get('product')` në `AppProductView` që e trajton si overlay.

## Zgjidhja: dy faqe të ndara fizikisht


| Konteksti                  | URL                | Komponenti                         | Layout                       |
| -------------------------- | ------------------ | ---------------------------------- | ---------------------------- |
| **Web** (papirun.net, `/`) | `/product/:id`     | `ProductView` (ekzistuesi)         | Header web + grid horizontal |
| **App** (`/home`, PWA)     | `/app/product/:id` | `AppProductView` brenda `AppShell` | BottomNav + glassmorphism    |


Pa detektime, pa flag-e, pa `useState` për viewport. **URL-ja vetë e thotë se cila platformë je.**

## Ndryshimet konkrete

### 1. `src/App.tsx` — dy rruga të veçanta

```text
/product/:id      → ProductViewWrapper   (web — i pandryshuar)
/app/product/:id  → AppProductPage        (app — wraps AppProductView në AppShell)
```

Heqim `ProductRoute.tsx` (e kaluar vrazhdë; do e fshijmë).

### 2. Çdo "open product" thirret me URL-në e duhur sipas vendit


| Origjina                                                                                       | Navigation target  |
| ---------------------------------------------------------------------------------------------- | ------------------ |
| `MenuCard` (Web — `Index.tsx`, `ProductView.tsx`)                                              | `/product/:id`     |
| `AppMenuCard` përdoret VETËM brenda app-it (AppHome, RelatedProductsScroll, FavoritesCarousel) | `/app/product/:id` |
| `CartView` (app cart)                                                                          | `/app/product/:id` |
| `LastOrderCard`, `QuickReorder` (app)                                                          | `/app/product/:id` |
| `Tray` (web sidebar cart)                                                                      | `/product/:id`     |


Heqim plotësisht `state: { fromApp: true }` — URL-ja është e vetmja burim e së vërtetës tani.

### 3. `AppProductView.tsx` — pastrim

- Hiq `useSearchParams` dhe legacy `params.get('product')` — vetëm `useParams` për `:id`.
- Back button: `if (history.length > 1) navigate(-1); else navigate('/home');` (sjellja standarde e browser-it ruan scroll position te Kreu).
- `useEffect` i scroll-to-top mbetet (`window.scrollTo({ top: 0, behavior: 'auto' })`) për çdo ndryshim `id`-je.

### 4. `ProductView.tsx` (web) — scroll-to-top fix

Shtoj `useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);` (aktualisht përdor `behavior: 'smooth'` që në mobile shpesh ngec). Bëj `behavior: 'auto'`.

### 5. `MenuCard.tsx` (web) — heqim hack-un app-shell

Heqim `onCardClick` props dhe `isInAppShell` detekt — kjo kartë është **ekskluzivisht web**. App-i përdor `AppMenuCard`. Zemra (favorit) mbetet pas `useAuth()`, por **vetëm** për app — kështu që e heqim plotësisht nga `MenuCard` web (web nuk ka favorite). Web është anonim/storefront.

### 6. Fshirje skedari

- `src/pages/ProductRoute.tsx` — fshihet (rruga e re është direkte në `App.tsx`).

### 7. Verifikim z-index

`BottomNav` mbetet `z-50`; `AppShell` header `z-40`; sticky add-to-cart bar brenda `AppProductView` është **në flow-in normal** (jo `fixed`), pra nuk mund të bllokojë navbar-in. Pa ndryshime të tjera.

## Diagrami i navigimit pas fix-it

```text
Web visitor (papirun.net)
   │
   ├── /                    Index            (web grid)
   │     └── click product → /product/:id    ProductViewWrapper
   │           └── back   → /
   │
App user (/home, PWA)
   │
   ├── /home                Home + AppShell
   │     └── click product → /app/product/:id   AppProductPage (AppShell + AppProductView)
   │           └── back    → /home              (BottomNav stays the whole time)
```

Dy botë, dy rrugë, **zero ngatërresë**.

## Skedarët që preken

- `src/App.tsx` — shton `/app/product/:id`, mban `/product/:id` për web, heq import-in e `ProductRoute`.
- `src/pages/AppProductPage.tsx` — pa ndryshim (tashmë wraps në `AppShell`).
- `src/components/app/AppHome.tsx` — `navigate('/app/product/:id')`.
- `src/components/app/AppProductView.tsx` — heq legacy query-param fallback; `RelatedProductsScroll` përdor `/app/product/:id`.
- `src/components/app/CartView.tsx` — `/app/product/:id`.
- `src/components/app/LastOrderCard.tsx`, `QuickReorder.tsx`, `FavoritesCarousel.tsx` — të verifikohen dhe vihen te `/app/product/:id`.
- `src/components/MenuCard.tsx` — heq hack-un `onCardClick`/`isInAppShell`; gjithmonë `/product/:id`; favorit i fshirë (web është storefront publik).
- `src/pages/ProductView.tsx` — scroll-to-top me `behavior:'auto'` te ndryshimi i `id`.
- `src/pages/ProductRoute.tsx` — **fshihet**.
- `src/components/Tray.tsx` — verifikohet që përdor `/product/:id` (web).

## Çka NUK preket

- Web layout te `Index.tsx` dhe `ProductView.tsx` — si është, ashtu mbetet.
- App glassmorphism te `AppProductView.tsx` — si është, ashtu mbetet.
- BottomNav, AppShell, CartView styling — pa ndryshim vizual.
- Auth flow, SMTP — pa ndryshim (kjo është punë e ndarë).  Kjo është goditja përfundimtare. Pasi t'i ndajmë rrugët (Routing), duhet t'i japim fund edhe dramës së Email-it që mos me të hup kohë ty duke u marrë me konfigurime manuale në Supabase ose në kod.
  Shtoja këtë pjesë në fund të planit tënd teknik, që ta kryejë edhe këtë "pisllëk" pune pa u lodhur ti:
  ---
  ### 📧 KONFIGURIMI I SMTP (LAST CHANCE)
  > "Përveç ristrukturimit të Routing-ut, konfiguro **SMTP** për Magic Link dhe njoftime direkt në kod/Supabase config. Mos më thuaj 'bëje vetë', por shkruaj funksionin që lidhet me këto kredenciale:
  >
  > - **SMTP Host:** `mail.privateemail.com`
  > - **Port:** `465` (SSL)
  > - **Sender Email:** `info@papirun.net`
  > - **Password:** `#Delivery-2026`
  > - **Site URL:** `https://papirun.net`
  > - **Redirect URL:** `https://papirun.net/auth/callback`
  >
  > Sigurohu që emaili i dërguesit të jetë i formatuar saktë si: **"Papirun [info@papirun.net](mailto:info@papirun.net)"**. Duhet të funksionojë në tentimin e parë."