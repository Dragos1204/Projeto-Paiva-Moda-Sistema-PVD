export type TabType = 
  | 'dashboard' 
  | 'pos' 
  | 'catalog' 
  | 'promotions' 
  | 'sales_history' 
  | 'customers' 
  | 'credit' 
  | 'inventory' 
  | 'financial' 
  | 'reports' 
  | 'settings';

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
  REPORTS = 'REPORTS',
  PROMOTIONS = 'PROMOTIONS',
  SETTINGS = 'SETTINGS'
}

export type UserRole = 'OWNER' | 'MANAGER' | 'SELLER' | 'ADMIN' | 'CASHIER' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string; // Login principal ou CPF
  firstName?: string; // Nome
  lastName?: string;  // Sobrenome
  name: string;       // Nome Completo (Nome + Sobrenome, ex: João Neto)
  birthDate?: string; // Data de nascimento YYYY-MM-DD
  email?: string;     // E-mail para login
  cpf: string;        // CPF com máscara ou limpo
  password: string;
  role: UserRole;
  isOwner?: boolean;  // Identificador do Administrador Principal (Dono)
  isActive?: boolean; // Status Ativo / Inativo (Soft delete para integridade)
  isProfileComplete?: boolean; // Se o perfil já foi completado no primeiro acesso
  mustChangePassword?: boolean; // Forçar redefinição de senha após reset
  createdAt?: string;
}

export interface ProductVariation {
  id: string;
  size: string;      // Ex: "38", "40", "P", "M", "G"
  color: string;     // Ex: "Azul Escuro", "Preto", "Branco"
  barcode: string;   // Código de barras único da variação
  sku?: string;      // Código de referência interna
  stock: number;     // Estoque específico dessa variação
  price?: number;    // Preço opcional (se diferir do produto-pai)
}

export interface Product {
  id: number | string;
  name: string;
  price: number;
  costPrice?: number;
  category: string;
  stock: number; // Soma do estoque de todas as variações
  barcode?: string;     
  internalCode?: string;
  image?: string;
  description?: string;
  variations?: ProductVariation[]; // Grade de variações
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariation?: ProductVariation;
}

export interface Customer {
  id: string; 
  name: string;
  phone: string;
  email: string;
  address?: string;
  cpf?: string;
  creditLimit?: number;
  usedCredit?: number;
  creditScore?: number | null;        // Score Serasa / Cadastro Positivo (0 a 1000)
  creditRisk?: 'MUITO_BAIXO' | 'BAIXO' | 'MEDIO' | 'ALTO' | null;
  creditApprovedBy?: string | null;  // Nome de quem autorizou / Dono
  lastCreditAnalysis?: string | null;
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
  id: number | string;
  productId: number | string;
  productName: string;
  variationId?: string | null;
  variationDescription?: string | null;
  type: MovementType;
  quantity: number;
  date: string;
  reason: string;
  sellerId?: string;
  sellerName?: string;
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface StoreProfile {
  name: string;
  phone?: string;
  instagram?: string;
  address?: string;
  cnpj?: string;
  receiptMessage?: string;
}

export interface Sale {
  id: number | string;
  sequence?: number;
  saleNumber?: string;
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
  interestAndFines?: number;
  sellerId?: string;
  sellerName?: string;
  preSaleId?: string | number | null;
  discountPercent?: number;
  discountValue?: number;
  requiresAuthorization?: boolean;
  authorizedBy?: string;
  authorizedAt?: string;
  createdAt?: string;
  originalTotal?: number;
  grossTotal?: number;
  discountAmount?: number;
  discountType?: 'PROMOTION' | 'MANUAL';
  netTotal?: number;
}

export interface Promotion {
  id: string;
  title: string;
  name?: string;
  discountType: 'PERCENTAGE' | 'FIXED_PRICE';
  discountPercent?: number;
  promotionalPrice?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  productIds: (string | number)[];
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
  createdAt: string;
}

export interface PreSale {
  id: string | number;
  code: string; // Ex: PV-102
  customerId: string;
  customerName: string;
  sellerId: string;
  sellerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  observation?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  completedAt?: string;
}

export type FinancialType = 'INCOME' | 'EXPENSE';
export type FinancialStatus = 'PAID' | 'PENDING' | 'COMPLETED';

export interface FinancialRecord {
  id: number | string;
  description: string;
  amount: number;
  type: FinancialType;
  category: string;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  status: FinancialStatus;
  saleId?: number | string;
  saleNumber?: string;
  date?: string;
  customerId?: string;
  sellerId?: string;
  sellerName?: string;
  isProjectedReceivable?: boolean;
  expectedDate?: string;
  supplierName?: string;
  nfeKey?: string;
  nfeNumber?: string;
  createdAt?: string;
}

export interface AppSetting {
  key: string;
  value: any;
}
