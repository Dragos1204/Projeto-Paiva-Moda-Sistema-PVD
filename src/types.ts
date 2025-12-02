
export enum ViewState {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  POS = 'POS',
  PRODUCTS = 'PRODUCTS',
  SALES_HISTORY = 'SALES_HISTORY',
  INVENTORY = 'INVENTORY',
  CUSTOMERS = 'CUSTOMERS',
  FINANCIAL = 'FINANCIAL',
  BILLING = 'BILLING',
  SETTINGS = 'SETTINGS'
}

export type UserRole = 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string; // Nome exibido no login
  password: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  costPrice?: number;
  category: string;
  stock: number;
  barcode: string;     
  internalCode?: string;
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
  creditLimit?: number;
  usedCredit?: number;
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

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface Sale {
  id: number;
  sequence?: number;
  date: string;
  timestamp: string;
  customerId: string;
  customerName: string;
  cpf?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  installments?: number;
  observation?: string;
  change?: number;
  status?: SaleStatus;
  interestAndFines?: number; // Juros Recebidos
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
  paymentDate?: string;
  paymentMethod?: string;
  status: FinancialStatus;
  saleId?: number;
  customerId?: string;
}

export interface AppSetting {
  key: string;
  value: any;
}
