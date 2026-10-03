
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
  username: string; // The display name in the dropdown
  password: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  costPrice?: number; // Preço de Custo
  category: string;
  stock: number;
  barcode: string;     // Código de Barras (GTIN/EAN)
  internalCode?: string; // Código Interno da Loja
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
  creditLimit?: number; // Limite de Crédito
  usedCredit?: number;  // Crédito em uso
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
  sequence?: number; // Número sequencial da venda (Ex: 1, 2, 3...)
  date: string; // ISO Date YYYY-MM-DD
  timestamp: string; // ISO String
  customerId: string;
  customerName: string;
  cpf?: string; // CPF na nota
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string; // 'CREDIT_CARD', 'DEBIT_CARD', 'MONEY', 'PIX', 'BEMOL', 'STORE_CREDIT'
  installments?: number; // Number of installments for credit card
  observation?: string;
  change?: number;
  status?: SaleStatus; // Status da venda
  interestAndFines?: number; // Valor acumulado de juros recebidos (Cobrança)
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
  paymentMethod?: string; // How it was paid (Pix, Money, etc.)
  status: FinancialStatus;
  saleId?: number; // Link to sale
  customerId?: string; // Link to customer for debts
}

export interface AppSetting {
  key: string;
  value: any;
}
