
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Product, Customer, StockMovement, FinancialRecord, Sale, User } from './types';
import { DEFAULT_USERS } from './constants';

interface PaivaModaDB extends DBSchema {
  products: { key: number; value: Product; };
  customers: { key: string; value: Customer; };
  movements: { key: number; value: StockMovement; };
  financials: { key: number; value: FinancialRecord; };
  sales: { key: number; value: Sale; };
  users: { key: string; value: User; };
  settings: { key: string; value: any; };
}

const DB_NAME = 'paiva-moda-db';
const DB_VERSION = 2; 

export const db = {
  async connect(): Promise<IDBPDatabase<PaivaModaDB>> {
    const database = await openDB<PaivaModaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('customers')) db.createObjectStore('customers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('movements')) db.createObjectStore('movements', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('financials')) db.createObjectStore('financials', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          DEFAULT_USERS.forEach(u => userStore.put(u));
        }
      },
    });
    return database;
  },

  async getAll<T>(storeName: any): Promise<T[]> {
    const database = await this.connect();
    return database.getAll(storeName);
  },

  async save(storeName: any, item: any) {
    const database = await this.connect();
    return database.put(storeName, item);
  },

  async delete(storeName: any, id: any) {
    const database = await this.connect();
    return database.delete(storeName, id);
  },
  
  async saveSetting(key: string, value: any) {
    const database = await this.connect();
    return database.put('settings', value, key);
  },

  async getSetting(key: string) {
    const database = await this.connect();
    return database.get('settings', key);
  },

  // --- BACKUP & RESTORE ---
  async exportAllData() {
    const database = await this.connect();
    const data = {
      products: await database.getAll('products'),
      customers: await database.getAll('customers'),
      movements: await database.getAll('movements'),
      financials: await database.getAll('financials'),
      sales: await database.getAll('sales'),
      users: await database.getAll('users'),
      settings: await database.getAll('settings'),
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    return JSON.stringify(data);
  },

  async importAllData(jsonString: string) {
    const database = await this.connect();
    try {
      const data = JSON.parse(jsonString);
      const tx = database.transaction(
        ['products', 'customers', 'movements', 'financials', 'sales', 'settings', 'users'], 
        'readwrite'
      );

      await Promise.all([
        tx.objectStore('products').clear(),
        tx.objectStore('customers').clear(),
        tx.objectStore('movements').clear(),
        tx.objectStore('financials').clear(),
        tx.objectStore('sales').clear(),
        tx.objectStore('settings').clear(),
        tx.objectStore('users').clear(),
      ]);

      for (const p of data.products || []) await tx.objectStore('products').put(p);
      for (const c of data.customers || []) await tx.objectStore('customers').put(c);
      for (const m of data.movements || []) await tx.objectStore('movements').put(m);
      for (const f of data.financials || []) await tx.objectStore('financials').put(f);
      for (const s of data.sales || []) await tx.objectStore('sales').put(s);
      for (const u of data.users || []) await tx.objectStore('users').put(u);
      
      await tx.done;
      return true;
    } catch (e) {
      console.error("Erro na importação:", e);
      return false;
    }
  }
};
