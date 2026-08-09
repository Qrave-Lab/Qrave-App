export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'completed' | 'cancelled';

export interface OrderItem {
  name?: string;
  menu_item_name?: string;
  variant_label?: string | null;
  qty?: number;
  quantity?: number;
}

export interface Order {
  id: string;
  order_id?: string;
  customer?: string;
  items: OrderItem[];
  total?: string | number;
  status: OrderStatus | string;
  time?: string;
  created_at?: string;
  session_id?: string;
  table_number?: number;
}

export interface ActiveOrdersResponse {
  orders: Order[];
}
