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

// ── DAMAGES ─────────────────────────────────────────────────────────────────
// Recording a damage deducts the product's quantity (same as a sale would,
// minus the revenue) AND creates a linked Expense (category: 'damages') so
// the loss shows up in net profit automatically. expenseId ties the two
// records together so a delete can cleanly reverse both sides.

export interface DamageRecord {
  id:          string;
  businessId:  string;
  productId:   string;
  productName: string;  // snapshot — survives product edits/renames
  productSku:  string;  // snapshot
  quantity:    number;
  unitCost:    number;  // product.costPrice at time of damage
  totalCost:   number;  // quantity * unitCost — mirrored as the linked expense amount
  reason:      string;
  expenseId:   string;  // the Expense doc this damage created
  reportedBy:  string;
  reportedAt:  Date;
  notes?:      string;
}

export const DAMAGE_REASONS = [
  'Broken / Physical Damage',
  'Expired',
  'Water Damage',
  'Lost / Theft',
  'Defective Return',
  'Other',
] as const;

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
// cost of goods sold. 'damages' is a system-linked category — entries in it
// are normally created automatically by the Damages page, not typed in by
// hand, but it stays a normal category so reports/breakdowns just work.

export type ExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'marketing'
  | 'transport'
  | 'maintenance'
  | 'damages'
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
  linkedDamageId?: string;   // set when this expense was auto-created by a damage record
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  salaries:    'Salaries & Wages',
  rent:        'Rent',
  utilities:   'Utilities',
  supplies:    'Supplies & Inventory',
  marketing:   'Marketing',
  transport:   'Transport',
  maintenance: 'Maintenance',
  damages:     'Damages & Losses',
  other:       'Other',
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

// ── BUSINESS TYPE ───────────────────────────────────────────────────────────
// Drives labels/icons/accent color in the ServiceForm (phone-repair vs
// barbing-salon vs general). No longer drives a fixed category list — see
// note on ServiceCategory below.
// Existing businesses with no value set should be treated as 'phone-repair'
// for backwards compatibility.

export type BusinessType = 'phone-repair' | 'barbing-salon' | 'general';

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  'phone-repair':  'Phone Repair Shop',
  'barbing-salon': 'Barbing Salon',
  general:         'General / Other',
};

// ── SERVICES ────────────────────────────────────────────────────────────────
// Non-inventory work — phone flashing/repair, barbing/grooming, etc. No stock
// to decrement; revenue/profit still roll into the same dashboard + reports
// numbers as product sales.
//
// Category used to be a fixed union (flashing/haircut/etc.) with a preset
// dropdown. It's now free text: every business defines its own categories
// from scratch when they add their first service, so nothing is preset for
// them and nothing leaks across business types. A brand-new business always
// starts with zero services and zero categories until the owner adds one.

export type ServiceCategory = string;

// Catalog entry — a reusable service type with a default price, so staff
// aren't retyping "iPhone Flash" and its price every single time.
export interface Service {
  id:           string;
  businessId:   string;
  name:         string;
  category:     ServiceCategory;  // free text, entered by the business owner
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