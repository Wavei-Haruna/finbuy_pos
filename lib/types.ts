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
  id:           string;
  name:         string;
  brand:        string;
  sku:          string;
  category:     string;
  quantity:     number;
  costPrice:    number;
  sellingPrice: number;
  lowStockAlert:number;
  description:  string;
  businessId:   string;
  dateAdded:    Date;
  lastUpdated:  Date;
    imageUrl?:    string;  // Supabase Storage public URL
   caseSize?:    number;  // units per case/box
  caseQuantity?: number; // number of cases in stock


}


export type ProductCategory = 'home-appliances' | 'sneakers' | 'phone-laptop-accessories';
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  brand: string;
  sku: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  size?: string;
  color?: string;
  image?: string;
  dateAdded: Date;
  lastUpdated: Date;
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
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  reportedBy: string;
  reportedAt: Date;
  notes?: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  currentQuantity: number;
  minThreshold: number;
  createdAt: Date;
  acknowledged: boolean;
}
