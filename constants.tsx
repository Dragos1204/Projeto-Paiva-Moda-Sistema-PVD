
import { Product, Customer, StockMovement, FinancialRecord, Sale } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: 1, 
    name: 'Vestido Floral Verão', 
    price: 89.90, 
    category: 'Vestidos', 
    stock: 12, 
    barcode: '789001',
    description: 'Vestido leve com estampa floral, ideal para dias quentes. Tecido viscose.',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=200'
  },
  { 
    id: 2, 
    name: 'Calça Jeans Skinny', 
    price: 129.90, 
    category: 'Calças', 
    stock: 8, 
    barcode: '789002',
    description: 'Calça jeans modelagem skinny com elastano. Lavagem escura.',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=200'
  },
  { 
    id: 3, 
    name: 'Blusa Básica Branca', 
    price: 39.90, 
    category: 'Blusas', 
    stock: 24, 
    barcode: '789003',
    description: 'T-shirt básica 100% algodão. Essencial para o dia a dia.' 
  },
  { 
    id: 4, 
    name: 'Saia Midi Plissada', 
    price: 79.90, 
    category: 'Saias', 
    stock: 5, 
    barcode: '789004',
    description: 'Saia midi com acabamento plissado, cintura alta e elástico.',
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&q=80&w=200'
  },
  { 
    id: 5, 
    name: 'Jaqueta Jeans', 
    price: 159.90, 
    category: 'Casacos', 
    stock: 3, 
    barcode: '789005',
    description: 'Jaqueta jeans oversized com botões prateados.'
  },
  { 
    id: 6, 
    name: 'Shorts Alfaiataria', 
    price: 59.90, 
    category: 'Shorts', 
    stock: 10, 
    barcode: '789006',
    description: 'Shorts em linho com corte alfaiataria. Elegante e confortável.'
  },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: '00', name: 'Cliente Não Identificado', phone: '', email: '' }, // Default Customer
  { id: '1', name: 'Maria Silva', phone: '(11) 99999-1234', email: 'maria@email.com', address: 'Rua A, 123' },
  { id: '2', name: 'Ana Oliveira', phone: '(11) 98888-4321', email: 'ana@email.com', address: 'Av B, 456' },
  { id: '3', name: 'Carla Santos', phone: '(21) 97777-5678', email: 'carla@email.com' },
];

export const MOCK_MOVEMENTS: StockMovement[] = [
  { id: 1, productId: 1, productName: 'Vestido Floral Verão', type: 'ENTRY', quantity: 10, date: '2023-10-25', reason: 'Compra Fornecedor' },
  { id: 2, productId: 3, productName: 'Blusa Básica Branca', type: 'EXIT', quantity: 2, date: '2023-10-26', reason: 'Venda #1023' },
  { id: 3, productId: 5, productName: 'Jaqueta Jeans', type: 'ENTRY', quantity: 5, date: '2023-10-27', reason: 'Reposição' },
  { id: 4, productId: 2, productName: 'Calça Jeans Skinny', type: 'EXIT', quantity: 1, date: '2023-10-28', reason: 'Defeito/Troca' },
];

export const MOCK_FINANCIALS: FinancialRecord[] = [
  { id: 1, description: 'Aluguel Loja', amount: 2500.00, type: 'EXPENSE', category: 'Custos Fixos', dueDate: '2023-11-05', status: 'PENDING' },
  { id: 2, description: 'Fornecedor Roupas SP', amount: 1200.50, type: 'EXPENSE', category: 'Fornecedores', dueDate: '2023-10-30', status: 'PAID' },
  { id: 3, description: 'Vendas Anteriores', amount: 15450.00, type: 'INCOME', category: 'Vendas', dueDate: '2023-10-31', status: 'PAID' },
  { id: 4, description: 'Internet + Telefone', amount: 180.00, type: 'EXPENSE', category: 'Custos Fixos', dueDate: '2023-11-10', status: 'PENDING' },
  { id: 5, description: 'Marketing Instagram', amount: 300.00, type: 'EXPENSE', category: 'Marketing', dueDate: '2023-11-15', status: 'PENDING' },
];

// Mock Sales for History - Empty by default
export const MOCK_SALES: Sale[] = [];

export const STORE_NAME = "Paiva Moda";
