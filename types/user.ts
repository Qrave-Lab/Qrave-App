export type { User, UserRole } from './auth';

export interface StaffMember {
  id?: string | number;
  user_id?: string | number;
  email?: string;
  name?: string;
  role?: string;
  restaurant_id?: string | number;
  created_at?: string;
  [key: string]: unknown;
}
