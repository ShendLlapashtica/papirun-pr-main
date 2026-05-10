import grillChickenFajita from '@/assets/menu/grill-chicken-fajita.png';
import falafelFajita from '@/assets/menu/falafel-fajita.png';
import crunchySticks from '@/assets/menu/crunchy-sticks.png';
import beefSalad from '@/assets/menu/beef-salad.png';
import saladMix from '@/assets/menu/salad-mix.png';
import superMixSalad from '@/assets/menu/super-mix-salad.png';
import falafel from '@/assets/menu/falafel.png';
import coldChickenSalad from '@/assets/menu/cold-chicken-salad.png';
import grillChickenSalad from '@/assets/menu/grill-chicken-salad.png';
const mozzarella = '';
import chickenPesto from '@/assets/menu/chicken-pesto.png';
const tuna = '';
const roastBeef = '';
import coldChicken from '@/assets/menu/cold-chicken.png';
const veggie = '';

import reviewPhoto1 from '@/assets/reviews/review-photo-1.jpg';
import reviewMarigona1 from '@/assets/reviews/review-marigona-1.jpg';
import reviewMarigona2 from '@/assets/reviews/review-marigona-2.jpg';
import reviewSara from '@/assets/reviews/review-sara.jpg';

const oferta4x4 = '';
const oferta4x3 = '';
const ofertaPer2 = '';

import type { MenuItem, Review } from '@/types/menu';

export interface OfferItem {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  images?: string[];
  includes: string[];
}

export const ofertaRamazani: OfferItem[] = [
  {
    id: 'oferta-4x4',
    title: 'Oferta 4x4',
    description: '4x Sanduiqa, 4x Sallata Super Mix, 4x Pije & 4x Ëmbëlsira',
    price: 40.00,
    image: oferta4x4,
    includes: ['4x Sanduiqa', '4x Sallata Super Mix', '4x Pije', '4x Ëmbëlsira'],
  },
  {
    id: 'oferta-4x3',
    title: 'Oferta 4x3',
    description: '4x Sallata, 4x Pije & 4x Ëmbëlsira',
    price: 38.00,
    image: oferta4x3,
    includes: ['4x Sallata', '4x Pije', '4x Ëmbëlsira'],
  },
  {
    id: 'oferta-per-2',
    title: 'Oferta Për 2',
    description: '1x Sanduiq, 1x Fajita, 1x Crunchy Sticks, Patate & 2x Pije',
    price: 14.60,
    image: ofertaPer2,
    includes: ['1x Sanduiq', '1x Fajita', '1x Crunchy Sticks', 'Patate', '2x Pije'],
  },
];

const defaultExtras = ['ekstra-buke-sanduic', 'ekstra-crunch-chicken', 'qofte-pule', 'ekstra-buke-sallate', 'ekstra-falafel', 'ekstra-mozzarella', 'ekstra-djath', 'ekstra-ve', 'sauce', 'ekstra-proshute', 'ekstra-cold', 'ekstra-tuna', 'ekstra-grill-chicken', 'ekstra-beef'];

export const menuItems: MenuItem[] = [
  // Salads
  {
    id: 'super-salad-crunch',
    name: { sq: 'Super Salad Crunch', en: 'Super Salad Crunch' },
    description: {
      sq: 'Rucola e fresket, djathe feta, miser, karota me topping-un tone unik krokant me cornflakes.',
      en: 'Fresh arugula, feta cheese, corn, carrots with our signature crunchy cornflake topping.',
    },
    price: 6.50,
    image: superMixSalad,
    category: 'salad',
    ingredients: ['pule crunch', 'rukola', 'tranguj', 'karote', 'speca', 'miser', 'qepe te reja', 'djath', 'dressing', 'brusketa'],
    extras: defaultExtras,
    crunchLevel: 5,
    likes: 234,
    rating: 4.9,
    reviewCount: 89,
    isAvailable: true,
  },
  {
    id: 'beef-salad',
    name: { sq: 'Beef Salad', en: 'Beef Salad' },
    description: {
      sq: 'Copeza viçi te buta me perime te fresketa, sallate pasta dhe tost krokant.',
      en: 'Tender beef strips with fresh veggies, pasta salad and crunchy toast.',
    },
    price: 7.00,
    image: beefSalad,
    category: 'salad',
    ingredients: ['qepe te ferguara', 'sallate e perzier', 'pasta'],
    extras: defaultExtras,
    crunchLevel: 4,
    likes: 187,
    rating: 4.8,
    reviewCount: 67,
    isAvailable: true,
  },
  {
    id: 'grill-chicken-salad',
    name: { sq: 'Grill Chicken Salad', en: 'Grill Chicken Salad' },
    description: {
      sq: 'File pule ne skare me sallate kopshti te fresket dhe salce kremoze.',
      en: 'Grilled chicken breast with fresh garden salad and creamy sauce.',
    },
    price: 6.50,
    image: grillChickenSalad,
    category: 'salad',
    ingredients: ['sallate e perzier', 'pasta', 'salce golden queen'],
    extras: defaultExtras,
    crunchLevel: 4,
    likes: 156,
    rating: 4.7,
    reviewCount: 54,
    isAvailable: true,
  },
  {
    id: 'cold-chicken-salad',
    name: { sq: 'Cold Chicken Salad', en: 'Cold Chicken Salad' },
    description: {
      sq: 'Sallate pule kremoze me pasta, perime te fresketa dhe buke te tostuar.',
      en: 'Creamy chicken salad with pasta, fresh vegetables and toasted bread.',
    },
    price: 6.00,
    image: coldChickenSalad,
    category: 'salad',
    ingredients: ['selino', 'karote', 'tranguj turshi', 'borzilok', 'sallate e perzier', 'pasta'],
    extras: defaultExtras,
    crunchLevel: 3,
    likes: 98,
    rating: 4.6,
    reviewCount: 42,
    isAvailable: true,
  },
  {
    id: 'falafel-plate',
    name: { sq: 'Falafel Plate', en: 'Falafel Plate' },
    description: {
      sq: 'Falafel shtepie krokant me sallate pasta, perime te fresketa dhe salca speciale.',
      en: 'Crispy homemade falafel with pasta salad, fresh veggies and signature sauces.',
    },
    price: 5.50,
    image: falafel,
    category: 'salad',
    ingredients: ['qiqra', 'fasule', 'koriander', 'qepe te kuqe', 'majdanoz', 'sallate e perzier', 'pasta', 'hummus', 'salce tartar'],
    extras: defaultExtras,
    crunchLevel: 5,
    likes: 143,
    rating: 4.8,
    reviewCount: 61,
    isAvailable: true,
  },
  {
    id: 'salad-mix',
    name: { sq: 'Fresh Salad Mix', en: 'Fresh Salad Mix' },
    description: {
      sq: 'Mix i lehte dhe freskues perimesh sezonale me ereza.',
      en: 'Light and refreshing mix of seasonal vegetables with herbs.',
    },
    price: 4.00,
    image: saladMix,
    category: 'salad',
    ingredients: ['sallate e gjelber', 'domate', 'tranguj', 'karote', 'rukolle', 'dresing'],
    extras: defaultExtras,
    crunchLevel: 2,
    likes: 76,
    rating: 4.5,
    reviewCount: 31,
    isAvailable: true,
  },
  // Fajitas
  {
    id: 'grill-chicken-fajita',
    name: { sq: 'Grill Chicken Fajita', en: 'Grill Chicken Fajita' },
    description: {
      sq: 'Tortilla te ngrohta te mbushura me pule ne skare, rucola te fresket dhe salce pikante.',
      en: 'Warm tortillas filled with grilled chicken, fresh arugula and spicy sauce.',
    },
    price: 5.50,
    image: grillChickenFajita,
    category: 'fajita',
    ingredients: ['chicken', 'tortilla', 'arugula', 'tomato', 'spicy sauce'],
    extras: defaultExtras,
    crunchLevel: 3,
    likes: 198,
    rating: 4.9,
    reviewCount: 78,
    isAvailable: true,
  },
  {
    id: 'falafel-fajita',
    name: { sq: 'Falafel Fajita', en: 'Falafel Fajita' },
    description: {
      sq: 'Falafel krokant i mbeshtjelle ne tortilla te ngrohte me perime te fresketa dhe tahini.',
      en: 'Crispy falafel wrapped in warm tortilla with fresh vegetables and tahini.',
    },
    price: 5.00,
    image: falafelFajita,
    category: 'fajita',
    ingredients: ['falafel', 'tortilla', 'arugula', 'tomato', 'tahini'],
    extras: defaultExtras,
    crunchLevel: 5,
    likes: 167,
    rating: 4.8,
    reviewCount: 55,
    isAvailable: true,
  },
  // Sandwiches
  {
    id: 'mozzarella',
    name: { sq: 'Mozzarella', en: 'Mozzarella' },
    description: {
      sq: 'Sanduiç i fresket me djathe mozzarella, domate, borzilok dhe salce shtepie.',
      en: 'Fresh sandwich with mozzarella cheese, tomato, basil and house sauce.',
    },
    price: 4.00,
    image: mozzarella,
    category: 'sandwich',
    ingredients: ['mocarella', 'domate', 'speca te kuq', 'rukolle', 'salce pesto'],
    extras: defaultExtras,
    crunchLevel: 2,
    likes: 112,
    rating: 4.6,
    reviewCount: 38,
    isAvailable: true,
  },
  {
    id: 'chicken-pesto',
    name: { sq: 'Chicken Pesto', en: 'Chicken Pesto' },
    description: {
      sq: 'File pileti e kombinuar me salce pesto aromatike dhe perime te fresketa.',
      en: 'Chicken fillet combined with aromatic pesto sauce and fresh vegetables.',
    },
    price: 4.00,
    image: chickenPesto,
    category: 'sandwich',
    ingredients: ['qofte pule', 'speca te pjekur', 'sallate e gjelber', 'salce pesto'],
    extras: defaultExtras,
    crunchLevel: 3,
    likes: 134,
    rating: 4.7,
    reviewCount: 45,
    isAvailable: true,
  },
  {
    id: 'tuna',
    name: { sq: 'Tuna', en: 'Tuna' },
    description: {
      sq: 'Copeza toni me miser, domate dhe dresing special ne buke te fresket.',
      en: 'Tuna chunks with corn, tomato and special dressing in fresh bread.',
    },
    price: 4.00,
    image: tuna,
    category: 'sandwich',
    ingredients: ['miser', 'spec i kuq', 'selino', 'tranguj turshi', 'domate', 'sallate e gjelber', 'salce makiato'],
    extras: defaultExtras,
    crunchLevel: 2,
    likes: 89,
    rating: 4.5,
    reviewCount: 29,
    isAvailable: true,
  },
  {
    id: 'roast-beef',
    name: { sq: 'Roast Beef', en: 'Roast Beef' },
    description: {
      sq: 'Mish viçi i pjekur dhe i marinuar, qepë të fërguara, tranguj turshi, domate, sallatë e gjelbër, salcë makiato.',
      en: 'Roasted and marinated beef, fried onions, pickled cucumbers, tomato, green lettuce, makiato sauce.',
    },
    price: 4.80,
    image: roastBeef,
    category: 'sandwich',
    ingredients: ['qepe te ferguara', 'tranguj turshi', 'domate', 'sallate e gjelber', 'salce makiato'],
    extras: defaultExtras,
    crunchLevel: 3,
    likes: 156,
    rating: 4.8,
    reviewCount: 52,
    isAvailable: true,
  },
  {
    id: 'cold-chicken-sandwich',
    name: { sq: 'Cold Chicken', en: 'Cold Chicken' },
    description: {
      sq: 'Sallate pule e ftohte me perime sezonale dhe dresing kremoz.',
      en: 'Cold chicken salad with seasonal vegetables and creamy dressing.',
    },
    price: 4.00,
    image: coldChicken,
    category: 'sandwich',
    ingredients: ['selino', 'tranguj turshi', 'borzilok', 'domate', 'sallate e gjelber', 'salce makiato'],
    extras: defaultExtras,
    crunchLevel: 2,
    likes: 78,
    rating: 4.5,
    reviewCount: 24,
    isAvailable: true,
  },
  {
    id: 'veggie',
    name: { sq: 'Veggie', en: 'Veggie' },
    description: {
      sq: 'Opsioni vegjetarian me perime te pjekura ne skare, djathe dhe ereza mesdhetare.',
      en: 'Vegetarian option with grilled vegetables, cheese and Mediterranean herbs.',
    },
    price: 4.00,
    image: veggie,
    category: 'sandwich',
    ingredients: ['patellxhane', 'kungullesha', 'karote', 'speca', 'djathe i bardhe', 'sallate e gjelber', 'salce makiato'],
    extras: defaultExtras,
    crunchLevel: 3,
    likes: 67,
    rating: 4.4,
    reviewCount: 21,
    isAvailable: true,
  },
  // Sides
  {
    id: 'crunchy-sticks',
    name: { sq: 'Crunchy Sticks & Wedges', en: 'Crunchy Sticks & Wedges' },
    description: {
      sq: 'Shkopinj pule te arte dhe krokante me patate wedges dhe salca shoqeruese.',
      en: 'Golden crispy chicken sticks with potato wedges and signature dips.',
    },
    price: 5.50,
    image: crunchySticks,
    category: 'sides',
    ingredients: ['chicken', 'cornflakes', 'potato', 'spicy sauce', 'mayo'],
    extras: defaultExtras,
    crunchLevel: 5,
    likes: 245,
    rating: 4.9,
    reviewCount: 92,
    isAvailable: true,
  },
];

export const reviews: Review[] = [
  {
    id: '1',
    customerName: 'Marigona Meta',
    rating: 5,
    comment: {
      sq: 'Gjithmonë eksperiencë e shkëlqyer në Papirun! Vendi ka një atmosferë shumë të ngrohtë dhe stafi janë super miqësorë dhe të shpejtë. Ushqimi është vërtet i shijshëm — i freskët, plot shije, dhe pikërisht çfarë dëshiron kur ke dëshirë për diçka të mirë. Çdo gjë ka shije fantastike. Definitivisht një nga ato vendet ku dëshiron të kthehesh. Rekomandoj shumë nëse jeni në Prishtinë!',
      en: 'Always a great experience at Papirun! The place has a really cozy vibe and the staff are super friendly and quick. The food is honestly delicious — fresh, flavorful, and exactly what you want when you\'re craving something good. Everything tastes amazing. Definitely one of those spots you want to go back to. Highly recommend if you\'re in Prishtina and want something tasty!',
    },
    date: { sq: '3 muaj me pare', en: '3 months ago' },
    dineType: { sq: 'Ne restorant | Dreke', en: 'Dine in | Lunch' },
    subtitle: { sq: '3 recensione · 3 foto', en: '3 reviews · 3 photos' },
    photos: [reviewMarigona1, reviewMarigona2],
  },
  {
    id: '2',
    customerName: 'Sara Begolli',
    rating: 5,
    comment: {
      sq: 'Sallata Crunch eshte jashtzakonisht e fresket, me nje kercitje te persosur qe larteson çdo kafshate. Fajita me falafel e ploteson ate mrekullueshem - krokante jashte, e bute dhe plot shije brenda, me nje përzierje te ekuilibruar erezash. Kjo pjatë ofron nje kombinim te kendshem freskie, teksture dhe shije qe e ben nje zgjedhje te shkelqyer per kendone qe kerkon nje vakt te shendetshëm por te kenaqshëm.',
      en: 'The Crunch salad is exceptionally fresh, with a perfect crunch that elevates every bite. The falafel fajita complements it beautifully - crisp on the outside, tender and flavorful on the inside, with a well balanced blend of spices. This dish offers a delightful combination of freshness, texture, and taste making it an excellent choice for anyone seeking a healthy yet satisfying meal.',
    },
    date: { sq: '2 muaj me pare', en: '2 months ago' },
    dineType: { sq: 'Ne restorant | Dreke', en: 'Dine in | Lunch' },
    subtitle: { sq: '1 recensione · 2 foto', en: '1 review · 2 photos' },
    photo: reviewSara,
  },
];
