export type UserRole = 'admin' | 'sales' | 'manager' | 'staff';

export interface User {
  id:        string;
  email:     string;
  name:      string;
  role:      UserRole;
  phone?:    string;   // admin SMS copy number
  createdAt: Date;
}

export interface Product {
  id:            string;
  name:          string;
  brand:         string;
  sku:           string;
  category:      string;
  quantity:      number;
  costPrice:     number;
  sellingPrice:  number;
  lowStockAlert: number;
  description:   string;
  businessId:    string;
  dateAdded:     Date;
  lastUpdated:   Date;
  imageUrl?:     string;  // Supabase Storage public URL
  caseSize?:     number;  // units per case/box
  caseQuantity?: number;  // number of cases in stock
}

export interface SalesRecord {
  productId:     string;
  businessId:    string;
  quantity:      number;
  price:         number;
  totalAmount:   number;
  customerName:  string;
  customerPhone: string;
  recordedBy:    string;
  recordedAt:    Date;
  notes:         string;
  receiptNo:     string;
}

export interface DamageRecord {
  id:         string;
  productId:  string;
  quantity:   number;
  reason:     string;
  reportedBy: string;
  reportedAt: Date;
  notes?:     string;
}

export interface StockAlert {
  id:              string;
  productId:       string;
  currentQuantity: number;
  minThreshold:    number;
  createdAt:       Date;
  acknowledged:    boolean;
}

// ── EXPENSES ────────────────────────────────────────────────────────────────
// Powers weekly/monthly/yearly expense tracking (salaries, rent, utilities,
// etc.) so the dashboard can show true net profit, not just revenue minus
// cost of goods sold.

export type ExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'marketing'
  | 'transport'
  | 'maintenance'
  | 'other';

export type ExpenseFrequency = 'one-time' | 'weekly' | 'monthly' | 'yearly';

export interface Expense {
  id:          string;
  businessId:  string;
  category:    ExpenseCategory;
  description: string;
  amount:      number;
  frequency:   ExpenseFrequency;
  startDate:   Date;         // one-time date, or when a recurring expense started
  endDate:     Date | null;  // null = still active (recurring only; ignored for one-time)
  recordedBy:  string;
  createdAt:   Date;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  salaries:    'Salaries & Wages',
  rent:        'Rent',
  utilities:   'Utilities',
  supplies:    'Supplies & Inventory',
  marketing:   'Marketing',
  transport:   'Transport',
  maintenance: 'Maintenance',
  other:       'Other',
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

// ── SERVICES ────────────────────────────────────────────────────────────────
// Non-inventory work — phone flashing, unlocking, repairs. No stock to
// decrement; revenue/profit still roll into the same dashboard + reports
// numbers as product sales.

export type ServiceCategory =
  | 'flashing'
  | 'unlocking'
  | 'software-repair'
  | 'hardware-repair'
  | 'data-recovery'
  | 'other';

// Catalog entry — a reusable service type with a default price, so staff
// aren't retyping "iPhone Flash" and its price every single time.
export interface Service {
  id:           string;
  businessId:   string;
  name:         string;
  category:     ServiceCategory;
  defaultPrice: number;
  createdAt:    Date;
}

// One completed job. Snapshots serviceName/category at time of sale so the
// record still reads correctly even if the catalog entry is later renamed
// or deleted.
export interface ServiceRecord {
  id?:           string;
  serviceId:     string;
  serviceName:   string;
  category:      ServiceCategory;
  businessId:    string;
  price:         number;   // amount actually charged for this job
  cost:          number;   // parts/materials used, if any — 0 for pure labor
  customerName:  string;
  customerPhone: string;
  recordedBy:    string;
  recordedAt:    Date;
  notes:         string;
  receiptNo:     string;
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  flashing:          'Phone Flashing',
  unlocking:         'Unlocking',
  'software-repair': 'Software Repair',
  'hardware-repair': 'Hardware Repair',
  'data-recovery':   'Data Recovery',
  other:             'Other',
};

export const SERVICE_CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[];