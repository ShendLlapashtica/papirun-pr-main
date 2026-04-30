export interface MenuExtra {
  id: string;
  name: {
    sq: string;
    en: string;
  };
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface SelectedExtra {
  id: string;
  name: {
    sq: string;
    en: string;
  };
  price: number;
}
