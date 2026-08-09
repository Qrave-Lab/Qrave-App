export interface Table {
  id?: string | number;
  table_number?: number;
  label?: string;
  status?: TableStatus;
  seats?: number;
  x?: number;
  y?: number;
  qr_code_url?: string;
  [key: string]: unknown;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'inactive';
