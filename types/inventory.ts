export interface MenuItem {
  id?: string | number;
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  is_available?: boolean;
  image_url?: string;
  variants?: MenuItemVariant[];
  [key: string]: unknown;
}

export interface MenuItemVariant {
  id?: string | number;
  label?: string;
  price?: number;
  [key: string]: unknown;
}

export interface InventoryCategory {
  id?: string | number;
  name?: string;
  items?: MenuItem[];
  [key: string]: unknown;
}
