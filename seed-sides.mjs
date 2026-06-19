import { createClient } from '@supabase/supabase-js';

// Provide credentials via env: SUPABASE_URL and SUPABASE_SERVICE_KEY
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { data: maxRow } = await sb
  .from('products')
  .select('sort_order')
  .order('sort_order', { ascending: false })
  .limit(1)
  .single();

const base = (maxRow?.sort_order ?? 0) + 10;

const products = [
  { id: 'keqap-ne-qese',              name_sq: 'Keqap në qese',              name_en: 'Ketchup in a sachet',        price: 0.30 },
  { id: 'sos-hummus',                  name_sq: 'Sos hummus',                  name_en: 'Hummus sauce',               price: 1.50 },
  { id: 'sos-bbq',                     name_sq: 'Sos BBQ',                     name_en: 'BBQ sauce',                  price: 1.00 },
  { id: 'sos-burgerit',                name_sq: 'Sos burgerit',                name_en: 'Burger sauce',               price: 0.70 },
  { id: 'sos-domateve-djeges',         name_sq: 'Sos domateve djegës',         name_en: 'Spicy tomato sauce',         price: 0.70 },
  { id: 'sos-domateve-padjeges',       name_sq: 'Sos domateve padjegës',       name_en: 'Mild tomato sauce',          price: 0.70 },
  { id: 'sos-dresing',                 name_sq: 'Sos dresing',                 name_en: 'Dressing sauce',             price: 0.70 },
  { id: 'sos-hem-hem',                 name_sq: 'Sos hem hem',                 name_en: 'Hem Hem sauce',              price: 0.70 },
  { id: 'sos-makiato',                 name_sq: 'Sos makiato',                 name_en: 'Macchiato sauce',            price: 0.70 },
  { id: 'sos-pesto',                   name_sq: 'Sos pesto',                   name_en: 'Pesto sauce',                price: 1.00 },
  { id: 'sos-vaj-djeges',              name_sq: 'Sos vaj djegës',              name_en: 'Spicy oil sauce',            price: 0.70 },
  { id: 'sos-tartar',                  name_sq: 'Sosa tartar',                 name_en: 'Tartar sauce',               price: 0.70 },
  { id: 'extra-cheddar-i-shkrire',     name_sq: 'Extra cheddar i shkrirë',     name_en: 'Extra melted cheddar',       price: 1.00 },
  { id: 'extra-buke-sandwichit-e-zeze',name_sq: 'Extra bukë sandwichit e zezë',name_en: 'Extra black sandwich bread', price: 0.70 },
  { id: 'peta',                        name_sq: 'Peta',                        name_en: 'Pita wrap',                  price: 0.50 },
  { id: 'extra-ve',                    name_sq: 'Extra ve',                    name_en: 'Extra egg',                  price: 0.60 },
  { id: 'extra-djathe-50gr',           name_sq: 'Extra djathë 50 gr',          name_en: 'Extra cheese 50g',           price: 1.00 },
  { id: 'extra-kackavall',             name_sq: 'Extra kaçkavall',             name_en: 'Extra kashkaval cheese',     price: 1.00 },
  { id: 'extra-mozzarella-40gr',       name_sq: 'Extra mozzarella 40 gr',      name_en: 'Extra mozzarella 40g',       price: 1.50 },
  { id: 'extra-falafel',               name_sq: 'Extra 1 falafel',             name_en: 'Extra 1 falafel',            price: 1.00 },
  { id: 'extra-prosciutto-100gr',      name_sq: 'Extra prosciutto 100 gr',     name_en: 'Extra prosciutto 100g',      price: 2.00 },
  { id: 'extra-tuna-100gr',            name_sq: 'Extra tuna 100',              name_en: 'Extra tuna 100g',            price: 3.00 },
  { id: 'extra-cold-100gr',            name_sq: 'Extra cold 100 gr',           name_en: 'Extra cold 100g',            price: 3.00 },
  { id: 'extra-grill-150gr',           name_sq: 'Extra grill 150 gr',          name_en: 'Extra grill 150g',           price: 3.50 },
  { id: 'extra-crunch-150gr',          name_sq: 'Extra crunch 150 gr',         name_en: 'Extra crunch 150g',          price: 3.50 },
  { id: 'extra-beef-140gr',            name_sq: 'Extra beef 140 gr',           name_en: 'Extra beef 140g',            price: 4.00 },
  { id: 'extra-buke-sallates',         name_sq: 'Extra bukë sallatës',         name_en: 'Extra salad bread',          price: 0.70 },
  { id: 'extra-buke-sandwich',         name_sq: 'Extra bukë sandwich',         name_en: 'Extra sandwich bread',       price: 0.70 },
];

const rows = products.map((p, i) => ({
  id: p.id,
  name_sq: p.name_sq,
  name_en: p.name_en,
  description_sq: '',
  description_en: '',
  price: p.price,
  image_url: '',
  category: 'sides',
  ingredients: [],
  extras: [],
  crunch_level: 3,
  is_available: true,
  sort_order: base + i,
}));

const { error } = await sb.from('products').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log(`Inserted ${rows.length} products (sort_order ${base} – ${base + rows.length - 1})`);
