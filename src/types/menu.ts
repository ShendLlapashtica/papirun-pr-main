import type { SelectedExtra } from '@/types/menuExtra';

export interface LocalizedString {
  sq: string;
  en: string;
}

export interface MenuItem {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price: number;
  image: string;
  category: 'salad' | 'fajita' | 'sandwich' | 'sides';
  ingredients: string[];
  extras: string[];
  crunchLevel: number; // 1-5
  likes: number;
  rating: number;
  reviewCount: number;
  isAvailable: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
  removedIngredients: string[];
  addedExtras: SelectedExtra[];
  customerNote?: string;
}


export interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: LocalizedString;
  date: LocalizedString;
  dineType: LocalizedString;
  photoCount?: number;
  photo?: string;
  photos?: string[];
  subtitle?: LocalizedString;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered';
  createdAt: string;
}
