import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { firestore, storage, app, firebaseConfig } from './firebase';
export { firestore, storage, app, firebaseConfig };
import { Product, Customer, StockMovement, FinancialRecord, Sale, User, PreSale, Promotion } from './types';

/**
 * Fuso horário canônico e obrigatório do sistema Paiva Moda (Manaus / UTC-4)
 */
export const MANAUS_TIMEZONE = 'America/Manaus';

/**
 * Retorna a data no formato YYYY-MM-DD rigorosamente calculada no fuso de Manaus
 */
export function getManausDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: MANAUS_TIMEZONE }).format(date);
  } catch {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Retorna a data e hora ISO adaptada ao fuso de Manaus
 */
export function getManausDateTimeString(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: MANAUS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);

    const map: Record<string, string> = {};
    parts.forEach(p => { map[p.type] = p.value; });
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}-04:00`;
  } catch {
    return date.toISOString();
  }
}

/**
 * Exclusão em lote segura no Cloud Firestore com particionamento automático
 * (chunks de 400 documentos para respeitar estritamente o limite de 500 do writeBatch).
 */
export const clearFirestoreCollection = async (collectionName: string): Promise<number> => {
  try {
    const colRef = collection(firestore, collectionName);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return 0;

    const docs = snapshot.docs;
    const BATCH_SIZE = 400;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      deletedCount += chunk.length;
    }

    console.log(`[Firestore] Coleção ${collectionName} limpa com sucesso. (${deletedCount} docs)`);
    return deletedCount;
  } catch (error) {
    console.error(`[Firestore] Erro ao limpar coleção ${collectionName}:`, error);
    throw error;
  }
};

const LOCAL_STORAGE_PREFIX = 'paiva_moda_cache_';

/**
 * Lê dados em cache local como plano de contingência para modo offline e inicialização instantânea
 */
export function getLocalCache<T>(collectionName: string, fallback: T[] = []): T[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${collectionName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Erro ao ler cache local de ${collectionName}:`, e);
  }
  return fallback;
}

/**
 * Grava dados no cache local para resiliência instantânea
 */
export function setLocalCache<T>(collectionName: string, items: T[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${collectionName}`, JSON.stringify(items));
  } catch (e) {
    // Quota excedida ou navegação restrita
  }
}

/**
 * Sanitiza recursivamente qualquer objeto antes de enviar ao Firestore.
 * Converte ou remove valores 'undefined' para null ou string vazia "", evitando o erro fatal:
 * "Unsupported field value: undefined"
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item === undefined ? null : item));
  }
  const clean: { [key: string]: any } = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) {
      clean[key] = (key === 'cpf' || key.toLowerCase().includes('cpf')) ? '' : null;
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeForFirestore(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export const db = {
  /**
   * Busca todos os documentos de uma coleção com timeout de segurança de 3 segundos
   */
  async getAll<T>(collectionName: string): Promise<T[]> {
    try {
      const colRef = collection(firestore, collectionName);
      
      const fetchPromise = getDocs(colRef).then(snapshot => 
        snapshot.docs.map(d => d.data() as T)
      );

      const timeoutPromise = new Promise<T[]>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de consulta no Firestore')), 3000)
      );

      const items = await Promise.race([fetchPromise, timeoutPromise]);
      if (items.length > 0) {
        setLocalCache(collectionName, items);
      }
      return items;
    } catch (error) {
      console.warn(`Aviso de leitura em ${collectionName}, usando cache local:`, error);
      return getLocalCache<T>(collectionName, []);
    }
  },

  /**
   * Salva ou atualiza um documento no Firestore e atualiza o cache local imediatamente
   */
  async save(collectionName: string, item: any): Promise<void> {
    try {
      if (!item || item.id === undefined || item.id === null) {
        console.warn(`Item sem id não pode ser salvo em ${collectionName}`);
        return;
      }
      
      // Atualiza cache local imediatamente para feedback instantâneo (UI Otimista)
      const currentCache = getLocalCache<any>(collectionName, []);
      const index = currentCache.findIndex(c => String(c.id) === String(item.id));
      if (index >= 0) {
        currentCache[index] = item;
      } else {
        currentCache.push(item);
      }
      setLocalCache(collectionName, currentCache);

      // Persiste no Cloud Firestore com dados sanitizados
      const docId = String(item.id);
      const docRef = doc(firestore, collectionName, docId);
      const sanitized = sanitizeForFirestore(item);
      await setDoc(docRef, sanitized, { merge: true });
    } catch (error) {
      console.error(`Erro ao salvar em ${collectionName}:`, error);
    }
  },

  /**
   * Deleta um documento pelo ID no Firestore com timeout protetivo e remove do cache local imediatamente
   */
  async delete(collectionName: string, id: any): Promise<void> {
    try {
      const docId = String(id).trim();
      if (!docId) return;
      
      // Remove do cache local imediatamente
      const currentCache = getLocalCache<any>(collectionName, []);
      const filtered = currentCache.filter(c => String(c.id) !== docId);
      setLocalCache(collectionName, filtered);

      // Remove do Firestore com timeout de 2s para nunca travar a UI
      const docRef = doc(firestore, collectionName, docId);
      const deletePromise = deleteDoc(docRef);
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      await Promise.race([deletePromise, timeoutPromise]);
    } catch (error) {
      console.error(`Erro ao deletar de ${collectionName}:`, error);
    }
  },

  /**
   * Limpa uma coleção inteira no Firestore via batches seguros e zera o cache local
   */
  async clearCollection(collectionName: string): Promise<void> {
    try {
      setLocalCache(collectionName, []);
      await clearFirestoreCollection(collectionName);
    } catch (e) {
      console.warn(`Erro ao limpar coleção ${collectionName}:`, e);
    }
  },

  /**
   * Zera vendas, movimentações de estoque, pré-vendas e financeiro de teste,
   * preservando o catálogo de produtos, clientes, promoções e a equipe.
   */
  async clearDatabaseForProduction(): Promise<void> {
    const collectionsToClear = [
      'sales',
      'movements',
      'pre_sales',
      'financials',
      'credit_bills'
    ];

    for (const col of collectionsToClear) {
      await this.clearCollection(col);
    }

    // Limpa todas as chaves de cache local relacionadas a transações
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (
          k.startsWith('paiva_moda_cache_sales') || 
          k.startsWith('paiva_moda_cache_movements') || 
          k.startsWith('paiva_moda_cache_financials') || 
          k.startsWith('paiva_moda_cache_pre_sales') ||
          k.startsWith('paiva_moda_cache_credit_bills')
        )) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Erro ao limpar chaves do localStorage:', e);
    }
  },

  /**
   * Salva uma configuração do sistema (settings).
   */
  async saveSetting(key: string, value: any): Promise<void> {
    try {
      try {
        localStorage.setItem(`paiva_setting_${key}`, JSON.stringify(value));
      } catch (e) {}

      const docRef = doc(firestore, 'settings', key);
      await setDoc(docRef, { key, value }, { merge: true });
    } catch (error) {
      console.warn(`Aviso ao salvar configuração ${key}:`, error);
    }
  },

  /**
   * Obtém uma configuração salva no sistema com fallback local.
   */
  async getSetting(key: string): Promise<any> {
    try {
      const cached = localStorage.getItem(`paiva_setting_${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    try {
      const docRef = doc(firestore, 'settings', key);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const val = snap.data()?.value;
        try { localStorage.setItem(`paiva_setting_${key}`, JSON.stringify(val)); } catch (e) {}
        return val;
      }
    } catch (error) {
      console.warn(`Aviso ao obter configuração ${key}:`, error);
    }
    return null;
  },

  /**
   * Inscrição em tempo real resiliente no Firestore (Real-time listener onSnapshot).
   * Atualiza o cache local a cada snapshot e garante persistência offline.
   */
  listen<T>(
    collectionName: string, 
    onUpdate: (items: T[]) => void, 
    onError?: (error: any) => void
  ): Unsubscribe {
    const colRef = collection(firestore, collectionName);
    return onSnapshot(
      colRef, 
      (snapshot) => {
        const items = snapshot.docs.map(docSnap => docSnap.data() as T);
        setLocalCache(collectionName, items);
        onUpdate(items);
      }, 
      (error) => {
        console.warn(`Aviso na assinatura em tempo real de ${collectionName} (utilizando cache):`, error);
        if (onError) onError(error);
        const cached = getLocalCache<T>(collectionName, []);
        if (cached.length > 0) {
          onUpdate(cached);
        }
      }
    );
  },

  /**
   * Alias de compatibilidade para db.listen
   */
  subscribe<T>(
    collectionName: string, 
    onUpdate: (items: T[]) => void, 
    onError?: (error: any) => void
  ): Unsubscribe {
    return this.listen<T>(collectionName, onUpdate, onError);
  },

  /**
   * Garante a presença exclusiva do usuário Dono/Super Admin (João Neto) no banco oficial.
   * Não popula coleções com dados fictícios ou mocks de teste para produção.
   */
  async seedInitialDataIfNeeded(): Promise<void> {
    const seedTask = async () => {
      try {
        const usersSnap = await getDocs(collection(firestore, 'users'));
        let hasOwner = false;
        if (!usersSnap.empty) {
          usersSnap.docs.forEach(d => {
            const u = d.data() as User;
            const uEmail = (u.email || '').trim().toLowerCase();
            const uCpf = (u.cpf || '').replace(/\D/g, '');
            if (
              u.role === 'OWNER' || 
              u.isOwner === true || 
              uEmail === 'netocardoso06@gmail.com' ||
              uCpf === '02954901284'
            ) {
              hasOwner = true;
            }
          });
        }
        
        if (!hasOwner) {
          console.log('[Firestore] Garantindo criação do perfil do Dono (João Neto)...');
          const masterOwner: User = {
            id: 'joao_master_owner',
            username: '02954901284',
            firstName: 'João',
            lastName: 'Neto',
            name: 'João Neto',
            birthDate: '1990-01-01',
            email: 'netocardoso06@gmail.com',
            cpf: '029.549.012-84',
            password: '1234',
            role: 'OWNER',
            isOwner: true,
            isActive: true,
            isProfileComplete: true,
            mustChangePassword: false,
            createdAt: getManausDateTimeString()
          };
          await setDoc(doc(firestore, 'users', masterOwner.id), sanitizeForFirestore(masterOwner), { merge: true });
          setLocalCache('users', [masterOwner]);
        }
      } catch (e) {
        console.warn('Aviso na verificação de Dono no Firestore:', e);
      }
    };

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
    await Promise.race([seedTask(), timeout]);
  },

  /**
   * Exporta todo o banco de dados oficial em formato JSON.
   */
  async exportAllData(): Promise<string> {
    const [products, customers, movements, financials, sales, users, preSales, promotions, creditBills] = await Promise.all([
      this.getAll<Product>('products'),
      this.getAll<Customer>('customers'),
      this.getAll<StockMovement>('movements'),
      this.getAll<FinancialRecord>('financials'),
      this.getAll<Sale>('sales'),
      this.getAll<User>('users'),
      this.getAll<PreSale>('pre_sales'),
      this.getAll<Promotion>('promotions'),
      this.getAll<any>('credit_bills')
    ]);

    const data = {
      products,
      customers,
      movements,
      financials,
      sales,
      users,
      preSales,
      promotions,
      creditBills,
      exportDate: getManausDateTimeString(),
      cloudDatabase: 'Firestore - Online Paiva Moda (paiva-moda)',
      version: '2.0.0'
    };
    return JSON.stringify(data, null, 2);
  },

  /**
   * Importa dados de um arquivo de backup JSON para a nuvem em lotes protegidos.
   */
  async importAllData(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);

      const importCollection = async (colName: string, items: any[]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        const BATCH_SIZE = 400;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const chunk = items.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(firestore);
          chunk.forEach(item => {
            if (item && item.id !== undefined && item.id !== null) {
              const docRef = doc(firestore, colName, String(item.id));
              batch.set(docRef, sanitizeForFirestore(item), { merge: true });
            }
          });
          await batch.commit();
        }
      };

      await importCollection('products', data.products);
      await importCollection('customers', data.customers);
      await importCollection('sales', data.sales);
      await importCollection('movements', data.movements);
      await importCollection('financials', data.financials);
      await importCollection('users', data.users);
      await importCollection('pre_sales', data.preSales || data.pre_sales);
      await importCollection('promotions', data.promotions);
      await importCollection('credit_bills', data.creditBills || data.credit_bills);

      return true;
    } catch (e) {
      console.error("Erro na importação para nuvem:", e);
      return false;
    }
  },

  exportFirestoreToLocalStorage,
  startPeriodicFirestoreBackup,

  getLastBackupTime(): string | null {
    try {
      return localStorage.getItem(BACKUP_META_KEY);
    } catch {
      return null;
    }
  },

  getBackupSnapshot(): any | null {
    try {
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
};

export const BACKUP_STORAGE_KEY = 'paiva_moda_system_backup_snapshot';
export const BACKUP_META_KEY = 'paiva_moda_last_backup_time';

/**
 * Exporta o estado atual de todas as 10 coleções do Firestore para o LocalStorage
 */
export async function exportFirestoreToLocalStorage(): Promise<boolean> {
  try {
    const collectionsToBackup = [
      'products',
      'customers',
      'movements',
      'financials',
      'sales',
      'users',
      'pre_sales',
      'promotions',
      'credit_bills',
      'settings'
    ];

    const snapshotData: Record<string, any[]> = {};

    await Promise.all(
      collectionsToBackup.map(async (colName) => {
        try {
          const colRef = collection(firestore, colName);
          const timeoutPromise = new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout ao sincronizar ${colName}`)), 4000)
          );
          const fetchPromise = getDocs(colRef).then(snap => snap.docs.map(d => d.data()));
          const items = await Promise.race([fetchPromise, timeoutPromise]);

          if (Array.isArray(items) && items.length > 0) {
            snapshotData[colName] = items;
            setLocalCache(colName, items);
          } else {
            snapshotData[colName] = getLocalCache(colName, []);
          }
        } catch {
          snapshotData[colName] = getLocalCache(colName, []);
        }
      })
    );

    const fullBackup = {
      timestamp: getManausDateTimeString(),
      source: 'Periodic Firestore Backup Engine',
      database: 'Firestore - Online Paiva Moda (paiva-moda)',
      version: '2.0.0',
      data: snapshotData
    };

    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(fullBackup));
    localStorage.setItem(BACKUP_META_KEY, fullBackup.timestamp);
    return true;
  } catch (error) {
    console.warn('[Backup Firestore] Falha ao exportar estado para LocalStorage:', error);
    return false;
  }
}

/**
 * Inicia a rotina de exportação periódica do Firestore para o LocalStorage.
 */
export function startPeriodicFirestoreBackup(intervalMs: number = 3 * 60 * 1000): () => void {
  const initialTimer = setTimeout(() => {
    exportFirestoreToLocalStorage().catch(() => {});
  }, 8000);

  const intervalId = setInterval(() => {
    exportFirestoreToLocalStorage().catch(() => {});
  }, Math.max(intervalMs, 30000));

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
}

export default db;
