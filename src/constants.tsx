import { Product, Customer, StockMovement, FinancialRecord, Sale, User } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Calça Jeans Flare Elegance',
    price: 189.90,
    costPrice: 95.00,
    category: 'Calças',
    stock: 24,
    internalCode: 'CJF-01',
    description: 'Calça jeans cintura alta flare com elastano',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80',
    variations: [
      { id: 'v1_36_azul', size: '36', color: 'Azul Escuro', barcode: '789100100036', stock: 6, sku: 'CJF-36-AZ' },
      { id: 'v1_38_azul', size: '38', color: 'Azul Escuro', barcode: '789100100038', stock: 8, sku: 'CJF-38-AZ' },
      { id: 'v1_40_azul', size: '40', color: 'Azul Escuro', barcode: '789100100040', stock: 6, sku: 'CJF-40-AZ' },
      { id: 'v1_42_azul', size: '42', color: 'Azul Escuro', barcode: '789100100042', stock: 4, sku: 'CJF-42-AZ' },
    ]
  },
  {
    id: 2,
    name: 'Vestido Midi Floral Primavera',
    price: 229.00,
    costPrice: 110.00,
    category: 'Vestidos',
    stock: 15,
    internalCode: 'VMF-02',
    description: 'Vestido midi em crepe com estampa floral',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80',
    variations: [
      { id: 'v2_p_rosa', size: 'P', color: 'Rosa Floral', barcode: '789200200001', stock: 5, sku: 'VMF-P-RS' },
      { id: 'v2_m_rosa', size: 'M', color: 'Rosa Floral', barcode: '789200200002', stock: 6, sku: 'VMF-M-RS' },
      { id: 'v2_g_rosa', size: 'G', color: 'Rosa Floral', barcode: '789200200003', stock: 4, sku: 'VMF-G-RS' },
    ]
  },
  {
    id: 3,
    name: 'Blusa Crepe Manga Bufante',
    price: 119.90,
    costPrice: 52.00,
    category: 'Blusas',
    stock: 18,
    internalCode: 'BCB-03',
    description: 'Blusa decote V em crepe com manga bufante',
    image: 'https://images.unsplash.com/photo-1564257631407-4deb129f042b?w=400&q=80',
    variations: [
      { id: 'v3_p_branca', size: 'P', color: 'Branco', barcode: '789300300001', stock: 6, sku: 'BCB-P-BR' },
      { id: 'v3_m_branca', size: 'M', color: 'Branco', barcode: '789300300002', stock: 7, sku: 'BCB-M-BR' },
      { id: 'v3_g_branca', size: 'G', color: 'Branco', barcode: '789300300003', stock: 5, sku: 'BCB-G-BR' },
    ]
  }
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: '00', name: 'Cliente Não Identificado', phone: '', email: '', cpf: '' }
];

export const MOCK_MOVEMENTS: StockMovement[] = [];
export const MOCK_FINANCIALS: FinancialRecord[] = [];
export const MOCK_SALES: Sale[] = [];

export const STORE_NAME = "Paiva Moda";
export const MASTER_RECOVERY_KEY = "PAIVA-RECOVERY";

export const DEFAULT_USERS: User[] = [];
