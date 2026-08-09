export interface Restaurant {
  id?: string | number;
  restaurant_id?: string | number;
  name?: string;
  restaurant?: string;
  currency?: string;
  table_count?: number;
  open_time?: string;
  close_time?: string;
  logo_url?: string;
  [key: string]: unknown;
}

export interface Branch {
  id?: string | number;
  restaurant_id?: string | number;
  address?: string;
  name?: string;
  [key: string]: unknown;
}

export interface BranchOption {
  id: string;
  label: string;
}

export interface Location {
  restaurant_id?: string;
  restaurant?: string;
  [key: string]: unknown;
}

export interface LocationsResponse {
  locations: Location[];
}

export interface BranchesResponse {
  branches: Branch[];
}
