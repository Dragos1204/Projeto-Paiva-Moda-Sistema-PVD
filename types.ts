
export enum ViewState {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  POS = 'POS',
  PRODUCTS = 'PRODUCTS',
  SALES_HISTORY = 'SALES_HISTORY',
  INVENTORY = 'INVENTORY',
  CUSTOMERS = 'CUSTOMERS',
  FINANCIAL = 'FINANCIAL',
  SETTINGS = 'SETTINGS'
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
  barcode: string;
  image?: string;
  description?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Customer {
  id: string; 
  name: string;
  phone: string;
  email: string;
  address?: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  icon: any;
  color: string;
  trend?: string;
}

export type MovementType = 'ENTRY' | 'EXIT';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: MovementType;
  quantity: number;
  date: string;
  reason: string;
}

export interface Sale {
  id: number;
  date: string; // ISO Date YYYY-MM-DD
  timestamp: string; // ISO String
  customerId: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string; // 'CREDIT_CARD', 'DEBIT_CARD', 'MONEY', 'PIX', 'BEMOL'
  installments?: number; // Number of installments for credit card
  observation?: string;
  change?: number;
}

export type FinancialType = 'INCOME' | 'EXPENSE';
export type FinancialStatus = 'PAID' | 'PENDING';

export interface FinancialRecord {
  id: number;
  description: string;
  amount: number;
  type: FinancialType;
  category: string;
  dueDate: string;
  paymentDate?: string; // Date when it was actually paid
  status: FinancialStatus;
  saleId?: number; // Link to sale
}
