
import { Product, Customer, StockMovement, FinancialRecord, Sale, User } from './types';

// Arrays vazios para iniciar o sistema limpo
export const MOCK_PRODUCTS: Product[] = [];

// Mantém apenas o Cliente Padrão (necessário para o sistema funcionar)
export const MOCK_CUSTOMERS: Customer[] = [
  { id: '00', name: 'Cliente Não Identificado', phone: '', email: '' }
];

export const MOCK_MOVEMENTS: StockMovement[] = [];

export const MOCK_FINANCIALS: FinancialRecord[] = [];

export const MOCK_SALES: Sale[] = [];

export const STORE_NAME = "Paiva Moda";

export const MASTER_RECOVERY_KEY = "PAIVA-RECOVERY";

export const DEFAULT_USERS: User[] = [
  { 
    id: 'admin', 
    username: 'Administrador', 
    name: 'Admin Geral', 
    password: '1234', 
    role: 'ADMIN' 
  },
  { 
    id: 'func1', 
    username: 'Funcionário 1', 
    name: 'Vendedor 01', 
    password: '1234', 
    role: 'EMPLOYEE' 
  },
  { 
    id: 'func2', 
    username: 'Funcionário 2', 
    name: 'Vendedor 02', 
    password: '1234', 
    role: 'EMPLOYEE' 
  }
];
