import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  TabType, Product, CartItem, StockMovement, Customer, Sale, 
  FinancialRecord, User, PreSale, Promotion, StoreProfile 
} from './types';

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  name: 'PAIVA MODA',
  phone: '',
  instagram: '',
  address: '',
  cnpj: '',
  receiptMessage: '*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre.'
};
import { MOCK_PRODUCTS, MOCK_MOVEMENTS, MOCK_CUSTOMERS, MOCK_SALES, MOCK_FINANCIALS } from './constants';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { POS } from './components/POS';
import { ProductList } from './components/ProductList';
import { Inventory } from './components/Inventory';
import { CustomerList } from './components/CustomerList';
import { Financial } from './components/FinancialManager';
import { SalesHistory } from './components/SalesHistory';
import { Settings } from './components/Settings';
import { CreditManager } from './components/CreditManager';
import { Reports } from './components/Reports';
import { Promotions } from './components/Promotions';
import { PasswordModal } from './components/PasswordModal';
import { Menu, AlertTriangle } from 'lucide-react';
import { db, getLocalCache } from './database';
import { ToastProvider, useToast } from './context/ToastContext';

function getLocalDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus' }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

// Helper universal de deduplicação estrita por ID único em todas as coleções
const deduplicateById = <T extends { id: any }>(items: T[]): T[] => {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  items.forEach(item => {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(String(item.id), item);
    }
  });
  return Array.from(map.values());
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou um erro não tratado:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-800 p-8 rounded-3xl border border-rose-500/20 max-w-lg shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black">Ops! Algo deu errado</h1>
              <p className="text-sm text-slate-400">
                Ocorreu um erro imprevisto na renderização. Não se preocupe, sua sessão de login e seus dados continuam seguros!
              </p>
            </div>
            {this.state.error && (
              <pre className="text-left bg-slate-950 p-4 rounded-xl text-xs text-rose-400 overflow-x-auto max-h-40 border border-slate-900 font-mono">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-purple-950/50"
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const DEFAULT_OWNER_USER: User = {
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
  createdAt: new Date().toISOString()
};

const AppContent: React.FC = () => {
  // Inicialização segura de sessão persistente de 15 horas
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('paiva_session_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.user && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed.user;
        } else {
          localStorage.removeItem('paiva_session_v1');
        }
      }
    } catch (e) {
      console.error("Erro ao carregar sessão do localStorage:", e);
    }
    return null;
  });

  // Controle de Navegação Padronizado por TabType com base na sessão
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const saved = localStorage.getItem('paiva_session_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.user && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          const user = parsed.user;
          const userIsAdmin = user.role === 'OWNER' || user.isOwner === true || user.role === 'MANAGER' || user.role === 'ADMIN';
          return userIsAdmin ? 'dashboard' : 'pos';
        }
      }
    } catch (e) {}
    return 'dashboard';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [appScale, setAppScale] = useState(1); 
  const toast = useToast(); 

  // Verificação em tempo real da validade da sessão de 15 horas
  useEffect(() => {
    const checkSession = () => {
      try {
        const saved = localStorage.getItem('paiva_session_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.expiresAt && parsed.expiresAt < Date.now()) {
            setCurrentUser(null);
            localStorage.removeItem('paiva_session_v1');
            toast.warning("Sessão Expirada", "Sua sessão de 15 horas expirou. Faça login novamente.");
          }
        }
      } catch (e) {}
    };
    checkSession();
    const interval = setInterval(checkSession, 30000); // Checa a cada 30 segundos
    return () => clearInterval(interval);
  }, [toast]);
  
  // Hierarquia de Acesso Completa
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.isOwner === true;
  const isManager = currentUser?.role === 'MANAGER';
  const isAdmin = isOwner || isManager || currentUser?.role === 'ADMIN';

  // Coleções em tempo real do Firestore (9 Coleções Essenciais)
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [preSales, setPreSales] = useState<PreSale[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [creditBills, setCreditBills] = useState<any[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);

  // Estados de Edição e Ações Críticas com Senha
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ 
    type: 'DELETE_PRODUCT' | 'DELETE_CUSTOMER' | 'CANCEL_SALE' | 'EDIT_SALE' | 'CANCEL_DEBT'; 
    data: any; 
    title: string; 
  } | null>(null);

  // --- Real-time Cloud Database Listeners (Firestore onSnapshot) ---
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let isMounted = true;

    // 1. Carrega plano de contingência local imediatamente (sem travar a tela)
    setProducts(getLocalCache<Product>('products', []));
    setCustomers(getLocalCache<Customer>('customers', []));
    setMovements(getLocalCache<StockMovement>('movements', []));
    setSales(getLocalCache<Sale>('sales', []));
    setFinancials(getLocalCache<FinancialRecord>('financials', []));
    setUsers(getLocalCache<User>('users', [DEFAULT_OWNER_USER]));
    setPreSales(getLocalCache<PreSale>('pre_sales', []));
    setPromotions(getLocalCache<Promotion>('promotions', []));

    // 2. Trava de segurança para não prender a interface
    const hardSafetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsOfflineMode(true);
        setLoading(false);
      }
    }, 3500);

    // 3. Backup periódico de contingência
    const stopBackup = db.startPeriodicFirestoreBackup(3 * 60 * 1000);

    const initializeCloudData = async () => {
      try {
        db.seedInitialDataIfNeeded().catch(err => {
          console.warn("Aviso na checagem assíncrona de dados iniciais:", err);
        });

        db.getSetting('appScale').then(dbScale => {
          if (dbScale && isMounted) setAppScale(dbScale);
        }).catch(() => {});

        let hasLoadedAtLeastOne = false;
        const markOnlineAndReady = () => {
          if (!hasLoadedAtLeastOne && isMounted) {
            hasLoadedAtLeastOne = true;
            clearTimeout(hardSafetyTimer);
            setIsOfflineMode(false);
            setLoading(false);
          }
        };

        const handleSyncError = () => {
          if (isMounted) {
            setIsOfflineMode(true);
            setLoading(false);
          }
        };

        // 1. Users (com João Neto deduplicado e garantido como MASTER_OWNER único no topo)
        const unsubUsers = db.listen<User>('users', (items) => {
          if (!isMounted) return;
          const userList = items || [];
          let masterOwnerUser: User | null = null;
          const otherUsersMap = new Map<string, User>();

          userList.forEach(u => {
            if (!u || !u.id) return;
            const nameLower = (u.name || '').toLowerCase();
            const uNameLower = (u.username || '').toLowerCase();
            const uEmail = (u.email || '').trim().toLowerCase();
            const uCpfDigits = (u.cpf || '').replace(/\D/g, '');
            const uId = String(u.id);

            // Purga legados de mock data
            const isMock = nameLower.includes('admin geral') || 
                           nameLower.includes('vendedor 01') || 
                           nameLower.includes('vendedor 02') ||
                           uId === 'seller1' || 
                           uId === 'seller2';
            if (isMock) {
              db.delete('users', u.id).catch(() => {});
              return;
            }

            // Identificação unificada do Dono (João Neto) por Email, CPF, Username ou ID
            const isJoao = uId === 'joao_master_owner' || 
                           uId === 'joao_master' || 
                           uEmail === 'netocardoso06@gmail.com' ||
                           uCpfDigits === '02954901284' ||
                           uNameLower === '02954901284' ||
                           (nameLower.includes('joão') && nameLower.includes('neto'));

            if (isJoao) {
              // Se existirem documentos do João com IDs antigos/temporários, purga do Firestore
              if (uId !== 'joao_master_owner') {
                db.delete('users', uId).catch(err => console.warn("Purga de documento antigo duplicado:", err));
              }

              // Mantém apenas UMA instância canônica na memória: MASTER_OWNER
              if (!masterOwnerUser || uId === 'joao_master_owner') {
                masterOwnerUser = {
                  ...DEFAULT_OWNER_USER,
                  ...u,
                  id: 'joao_master_owner',
                  firstName: 'João',
                  lastName: 'Neto',
                  name: 'João Neto',
                  username: '02954901284',
                  email: 'netocardoso06@gmail.com',
                  cpf: '029.549.012-84',
                  password: u.password || '1234',
                  role: 'OWNER',
                  isOwner: true,
                  isActive: true,
                  isProfileComplete: true,
                  mustChangePassword: false
                };
              }
              return;
            }

            // Demais colaboradores: Deduplicação unificada por CPF ou E-mail
            const dedupKey = uCpfDigits.length === 11 ? uCpfDigits : (uEmail || uId);
            if (otherUsersMap.has(dedupKey)) {
              // Se houver duplicata com ID diferente, remove o documento secundário
              const existing = otherUsersMap.get(dedupKey)!;
              if (String(existing.id) !== uId) {
                db.delete('users', uId).catch(() => {});
              }
            } else {
              otherUsersMap.set(dedupKey, u);
            }
          });

          // Se o dono não constar na lista retornada, cria a instância canônica e persiste
          if (!masterOwnerUser) {
            masterOwnerUser = DEFAULT_OWNER_USER;
            db.save('users', DEFAULT_OWNER_USER).catch(() => {});
          } else {
            // Garante que o documento com ID 'joao_master_owner' está gravado
            db.save('users', masterOwnerUser).catch(() => {});
          }

          const finalizedUsers = [masterOwnerUser, ...Array.from(otherUsersMap.values())];
          setUsers(finalizedUsers);
          markOnlineAndReady();
        }, handleSyncError);

        // 2. Products
        const unsubProducts = db.listen<Product>('products', (items) => {
          if (!isMounted) return;
          const deduped = deduplicateById(items || []);
          setProducts(deduped);
          markOnlineAndReady();
        }, handleSyncError);

        // 3. Customers
        const unsubCustomers = db.listen<Customer>('customers', (items) => {
          if (!isMounted) return;
          const realCustomers = (items || []).filter(c => c && c.id && c.id !== 'c1' && c.id !== 'c2');
          const deduped = deduplicateById(realCustomers);
          setCustomers(deduped);
          markOnlineAndReady();
        }, handleSyncError);

        // 4. Movements
        const unsubMovements = db.listen<StockMovement>('movements', (items) => {
          if (!isMounted) return;
          const deduped = deduplicateById(items || []);
          setMovements(deduped);
          markOnlineAndReady();
        }, handleSyncError);

        // 5. Sales
        const unsubSales = db.listen<Sale>('sales', (items) => {
          if (!isMounted) return;
          const realSales = (items || []).filter(s => s && s.id);
          const deduped = deduplicateById(realSales);
          const sorted = [...deduped].sort((a, b) => (b.sequence || 0) - (a.sequence || 0));
          setSales(sorted);
          markOnlineAndReady();
        }, handleSyncError);

        // 6. Financials
        const unsubFinancials = db.listen<FinancialRecord>('financials', (items) => {
          if (!isMounted) return;
          const todayStr = getLocalDateString();
          const realFinancials: FinancialRecord[] = [];
          (items || []).forEach(f => {
            if (!f || !f.id) return;
            if (f.paymentMethod === 'BEMOL' && f.status === 'PENDING' && f.dueDate && f.dueDate <= todayStr) {
              const autoLiquidated: FinancialRecord = {
                ...f,
                status: 'PAID',
                paymentDate: f.dueDate
              };
              db.save('financials', autoLiquidated).catch(() => {});
              realFinancials.push(autoLiquidated);
            } else {
              realFinancials.push(f);
            }
          });
          const deduped = deduplicateById(realFinancials);
          setFinancials(deduped);
          markOnlineAndReady();
        }, handleSyncError);

        // 7. Pre-Sales
        const unsubPreSales = db.listen<PreSale>('pre_sales', (items) => {
          if (!isMounted) return;
          setPreSales(deduplicateById(items || []));
          markOnlineAndReady();
        }, handleSyncError);

        // 8. Promotions
        const unsubPromotions = db.listen<Promotion>('promotions', (items) => {
          if (!isMounted) return;
          setPromotions(deduplicateById(items || []));
          markOnlineAndReady();
        }, handleSyncError);

        // 9. Credit Bills
        const unsubCreditBills = db.listen<any>('credit_bills', (items) => {
          if (!isMounted) return;
          setCreditBills(deduplicateById(items || []));
          markOnlineAndReady();
        }, handleSyncError);

        // 10. Store Profile / Settings
        const unsubSettings = db.listen<any>('settings', (items) => {
          if (!isMounted) return;
          const found = (items || []).find(i => String(i.id) === 'store_profile' || String(i.key) === 'store_profile');
          if (found) {
            setStoreProfile({
              name: found.name || 'PAIVA MODA',
              phone: found.phone || '',
              instagram: found.instagram || '',
              address: found.address || '',
              cnpj: found.cnpj || '',
              receiptMessage: found.receiptMessage || '*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre.'
            });
          }
          markOnlineAndReady();
        }, handleSyncError);

        unsubs = [
          unsubUsers, unsubProducts, unsubCustomers, unsubMovements, 
          unsubSales, unsubFinancials, unsubPreSales, unsubPromotions, 
          unsubCreditBills, unsubSettings
        ];
      } catch (error) {
        console.warn("Aviso na inicialização do Firestore:", error);
        if (isMounted) {
          setIsOfflineMode(true);
          setLoading(false);
        }
      }
    };

    initializeCloudData();

    return () => {
      isMounted = false;
      clearTimeout(hardSafetyTimer);
      if (stopBackup) stopBackup();
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, []);

  // --- Blindagem de Rotas RBAC (Apenas bloqueia vendedores em rotas exclusivas de admin) ---
  useEffect(() => {
    if (currentUser && !isAdmin) {
      const adminOnlyTabs: TabType[] = ['dashboard', 'inventory', 'financial', 'reports', 'promotions'];
      if (adminOnlyTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [currentUser, isAdmin, activeTab]);

  const handleLogin = (user: User) => { 
    setCurrentUser(user); 
    const sessionData = {
      user,
      expiresAt: Date.now() + (15 * 60 * 60 * 1000) // 15 horas
    };
    localStorage.setItem('paiva_session_v1', JSON.stringify(sessionData));
    const userIsAdmin = user.role === 'OWNER' || user.isOwner === true || user.role === 'MANAGER' || user.role === 'ADMIN';
    setActiveTab(userIsAdmin ? 'dashboard' : 'pos'); 
  };

  const handleInitialOwnerSetup = async (owner: User) => {
    await db.save('users', owner);
    setCurrentUser(owner);
    const sessionData = {
      user: owner,
      expiresAt: Date.now() + (15 * 60 * 60 * 1000)
    };
    localStorage.setItem('paiva_session_v1', JSON.stringify(sessionData));
    setActiveTab('dashboard');
  };

  const handleCompleteEmployeeProfile = async (updatedUser: User) => {
    await db.save('users', updatedUser);
    setCurrentUser(updatedUser);
    const sessionData = {
      user: updatedUser,
      expiresAt: Date.now() + (15 * 60 * 60 * 1000)
    };
    localStorage.setItem('paiva_session_v1', JSON.stringify(sessionData));
    const userIsAdmin = updatedUser.role === 'OWNER' || updatedUser.isOwner === true || updatedUser.role === 'MANAGER' || updatedUser.role === 'ADMIN';
    setActiveTab(userIsAdmin ? 'dashboard' : 'pos');
  };

  const handleLogout = () => { 
    setCurrentUser(null); 
    localStorage.removeItem('paiva_session_v1');
  };

  const handleAddUser = async (user: User) => { await db.save('users', user); };
  const handleDeleteUser = async (id: string) => { 
    if (id === 'joao_master_owner' || id === 'joao_master' || id === 'admin') return; 
    setUsers(prev => prev.filter(u => u.id !== id));
    await db.delete('users', id); 
  };

  const handleResetUserPassword = async (id: string, newPassword?: string) => { 
    const user = users.find(u => u.id === id); 
    if (user) { 
      const pass = newPassword || '1234';
      const updated: User = { ...user, password: pass, mustChangePassword: true }; 
      await db.save('users', updated); 
    } 
  };

  const handleToggleUserStatus = async (id: string, isActive: boolean) => {
    const user = users.find(u => u.id === id);
    if (user) {
      if (user.isOwner || user.id === currentUser?.id) return; // Dono não pode ser desativado
      const updated = { ...user, isActive };
      await db.save('users', updated);
    }
  };

  const handleRecoverPassword = async (userId: string, newPass: string) => { 
    const user = users.find(u => u.id === userId); 
    if (user) { 
      const updated = { ...user, password: newPass, mustChangePassword: false }; 
      await db.save('users', updated); 
    } 
  };

  const handlePasswordChange = async (newPass: string) => { 
    if (currentUser) { 
      const updated = { ...currentUser, password: newPass, mustChangePassword: false }; 
      setCurrentUser(updated); 
      await db.save('users', updated); 
    } 
  };

  const handleSavePromotion = async (promotion: Promotion) => {
    await db.save('promotions', promotion);
  };

  const handleDeletePromotion = async (id: string) => {
    await db.delete('promotions', id);
  };

  // Sanitiza rigorosamente o payload da venda
  const buildCleanSalePayload = (rawSale: any): Sale => {
    const cleanCpf = (rawSale.cpf !== undefined && rawSale.cpf !== null && typeof rawSale.cpf === 'string' && rawSale.cpf.trim().length > 0)
      ? rawSale.cpf.trim()
      : "";

    const cleanItems: CartItem[] = (rawSale.items || []).map((item: any) => {
      const cleanVariation = item.selectedVariation ? {
        id: String(item.selectedVariation.id || ''),
        size: String(item.selectedVariation.size || ''),
        color: String(item.selectedVariation.color || ''),
        barcode: String(item.selectedVariation.barcode || ''),
        sku: String(item.selectedVariation.sku || ''),
        stock: Number(item.selectedVariation.stock) || 0,
        price: Number(item.selectedVariation.price || item.price) || 0
      } : null;

      return {
        id: item.id,
        name: String(item.name || ''),
        price: Number(item.price) || 0,
        costPrice: (item.costPrice !== undefined && item.costPrice !== null) ? Number(item.costPrice) : 0,
        category: String(item.category || 'Geral'),
        stock: Number(item.stock) || 0,
        quantity: Number(item.quantity) || 1,
        barcode: item.barcode ? String(item.barcode) : '',
        internalCode: item.internalCode ? String(item.internalCode) : '',
        image: item.image ? String(item.image) : '',
        description: item.description ? String(item.description) : '',
        selectedVariation: cleanVariation
      } as CartItem;
    });

    return {
      id: rawSale.id,
      sequence: Number(rawSale.sequence) || 1,
      date: String(rawSale.date || getLocalDateString()),
      timestamp: String(rawSale.timestamp || new Date().toISOString()),
      customerId: String(rawSale.customerId || '00'),
      customerName: String(rawSale.customerName || 'Cliente Balcão'),
      cpf: cleanCpf,
      items: cleanItems,
      subtotal: Number(rawSale.subtotal) || 0,
      discount: Number(rawSale.discount) || 0,
      total: Number(rawSale.total) || 0,
      paymentMethod: String(rawSale.paymentMethod || 'MONEY'),
      observation: String(rawSale.observation || ''),
      change: Number(rawSale.change) || 0,
      installments: Number(rawSale.installments) || 1,
      status: rawSale.status || 'COMPLETED',
      interestAndFines: Number(rawSale.interestAndFines) || 0,
      sellerId: String(rawSale.sellerId || 'admin'),
      sellerName: String(rawSale.sellerName || 'Loja'),
      preSaleId: rawSale.preSaleId ? String(rawSale.preSaleId) : null,
      discountPercent: rawSale.discountPercent ? Number(rawSale.discountPercent) : 0,
      discountValue: rawSale.discountValue ? Number(rawSale.discountValue) : Number(rawSale.discount || 0),
      requiresAuthorization: Boolean(rawSale.requiresAuthorization),
      authorizedBy: rawSale.authorizedBy ? String(rawSale.authorizedBy) : undefined,
      authorizedAt: rawSale.authorizedAt ? String(rawSale.authorizedAt) : undefined
    };
  };

  // --- Finalização da Venda pelo Caixa ---
  const handleFinalizeSale = async (
    cart: CartItem[], 
    customerId: string, 
    paymentMethod: string, 
    subtotal: number, 
    discount: number, 
    total: number, 
    observation: string, 
    change: number, 
    installments: number, 
    cpf: string, 
    customTimestamp?: string, 
    customDueDate?: string,
    sellerId?: string,
    sellerName?: string,
    preSaleId?: string | number,
    discountAudit?: {
      discountPercent?: number;
      discountValue?: number;
      requiresAuthorization?: boolean;
      authorizedBy?: string;
      authorizedAt?: string;
    }
  ): Promise<Sale> => {
    const saleId = Date.now();
    let dateStr: string; 
    let timestampStr: string;

    if (customTimestamp) { 
      timestampStr = customTimestamp; 
      dateStr = customTimestamp.split('T')[0]; 
    } else { 
      dateStr = getLocalDateString(); 
      timestampStr = new Date().toISOString(); 
    }

    const customer = customers.find(c => c.id === customerId);
    const customerName = customer ? customer.name : 'Cliente Não Identificado';
    const maxSequence = sales.reduce((max, s) => (s.sequence || 0) > max ? (s.sequence || 0) : max, 0);
    const nextSequence = maxSequence + 1;

    const assignedSellerId = sellerId || currentUser?.id || 'admin';
    const assignedSellerName = sellerName || currentUser?.name || 'Loja';

    const newSale = buildCleanSalePayload({
      id: saleId, 
      sequence: nextSequence, 
      date: dateStr, 
      timestamp: timestampStr, 
      customerId: customerId || '00', 
      customerName: customerName || 'Cliente Balcão', 
      items: cart, 
      subtotal, 
      discount, 
      total, 
      paymentMethod, 
      observation: observation || '', 
      change: change || 0, 
      installments: installments || 1, 
      status: 'COMPLETED', 
      cpf: (cpf && typeof cpf === 'string' && cpf.trim().length > 0) ? cpf.trim() : '', 
      interestAndFines: 0,
      sellerId: assignedSellerId,
      sellerName: assignedSellerName,
      preSaleId: preSaleId ? String(preSaleId) : null,
      discountPercent: discountAudit?.discountPercent || (subtotal > 0 ? Number(((discount / subtotal) * 100).toFixed(1)) : 0),
      discountValue: discountAudit?.discountValue !== undefined ? discountAudit.discountValue : discount,
      requiresAuthorization: Boolean(discountAudit?.requiresAuthorization),
      authorizedBy: discountAudit?.authorizedBy || null,
      authorizedAt: discountAudit?.authorizedAt || null
    });
    
    // REGRA DE OURO: A gravação de vendas e movimentos no Firestore ocorre EXCLUSIVAMENTE em POS.tsx em background.
    // handleFinalizeSale em App.tsx apenas constrói e retorna a venda limpa sem duplicar operações de banco.
    return newSale;
  };

  const handleReceiveDebt = async (record: FinancialRecord, totalReceived: number, paymentMethod: string) => {
    const today = getLocalDateString(); 
    const extraAmount = Math.max(0, totalReceived - record.amount);
    const updatedRecord: FinancialRecord = { 
      ...record, 
      status: 'PAID' as const, 
      paymentDate: today, 
      amount: totalReceived, 
      paymentMethod: paymentMethod, 
      description: `${record.description} (Pago em ${today})` 
    };
    await db.save('financials', updatedRecord); 

    if (record.customerId) { 
      const customer = customers.find(c => c.id === record.customerId); 
      if (customer) { 
        const originalDebt = record.amount; 
        const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - originalDebt) }; 
        await db.save('customers', updatedCustomer); 
      } 
    }
    if (record.saleId) { 
      const sale = sales.find(s => String(s.id) === String(record.saleId)); 
      if (sale) { 
        const updatedSale = buildCleanSalePayload({ ...sale, total: sale.total + extraAmount, interestAndFines: (sale.interestAndFines || 0) + extraAmount }); 
        await db.save('sales', updatedSale); 
      } 
    }
  };

  const handleReceiveInstallment = async (billId: string, paymentMethod: string, amountPaid: number) => {
    const bill = creditBills.find(b => b.id === billId);
    if (!bill) return;

    // 1. Mark the bill as PAID
    const updatedBill = {
      ...bill,
      status: 'PAID' as const,
      paymentDate: new Date().toISOString(),
      paymentMethod
    };
    await db.save('credit_bills', updatedBill);

    // 2. Add an INCOME transaction in financials representing the cash received
    await db.save('financials', {
      id: `fin_payment_${bill.id}_${Date.now()}`,
      type: 'INCOME',
      category: 'Recebimento de Carnê',
      amount: amountPaid,
      paymentMethod: paymentMethod,
      status: 'COMPLETED', // Now cash is in hand
      date: new Date().toISOString(),
      description: `Quitação Parcela ${bill.installmentNumber}/${bill.totalInstallments} - Cliente: ${bill.customerName}`,
      createdAt: new Date().toISOString()
    });

    // 3. Abate the paid amount from the original sale's STORE_CREDIT record in financials
    const originalRecord = financials.find(f => String(f.saleId) === String(bill.saleId) && f.category === 'Crediário Loja (Carnê)');
    if (originalRecord) {
      const remainingAmount = Math.round((originalRecord.amount - bill.amount) * 100) / 100;
      if (remainingAmount <= 0.05) {
        await db.save('financials', {
          ...originalRecord,
          amount: 0,
          status: 'COMPLETED'
        });
      } else {
        await db.save('financials', {
          ...originalRecord,
          amount: remainingAmount
        });
      }
    }

    // 4. Subtract from Customer usedCredit
    if (bill.customerId) {
      const customer = customers.find(c => c.id === bill.customerId);
      if (customer) {
        await db.save('customers', {
          ...customer,
          usedCredit: Math.max(0, (customer.usedCredit || 0) - bill.amount)
        });
      }
    }
  };

  const performSaleCancellation = async (sale: Sale) => {
    const date = getLocalDateString(); 
    const updatedSale = buildCleanSalePayload({ ...sale, status: 'CANCELLED' as const });
    await db.save('sales', updatedSale);

    for (const item of sale.items) {
      const prod = products.find(p => String(p.id) === String(item.id));
      if (prod) {
        if (prod.variations && prod.variations.length > 0 && item.selectedVariation) {
          const updatedVars = prod.variations.map(v => v.id === item.selectedVariation!.id ? { ...v, stock: v.stock + item.quantity } : v);
          const newTotalStock = updatedVars.reduce((acc, v) => acc + v.stock, 0);
          await db.save('products', { ...prod, stock: newTotalStock, variations: updatedVars });
        } else {
          await db.save('products', { ...prod, stock: prod.stock + item.quantity });
        }

        const movement: StockMovement = { 
          id: Math.floor(Date.now() + Math.random() * 1000), 
          productId: item.id, 
          productName: item.name, 
          variationId: item.selectedVariation?.id,
          type: 'ENTRY', 
          quantity: item.quantity, 
          date: date, 
          reason: `Estorno Venda #${sale.sequence} (${currentUser?.name})`,
          sellerId: currentUser?.id,
          sellerName: currentUser?.name
        };
        await db.save('movements', movement);
      }
    }

    const saleFinancials = financials.filter(f => String(f.saleId) === String(sale.id));
    for (const f of saleFinancials) {
      await db.delete('financials', f.id);
    }
    if (sale.paymentMethod === 'STORE_CREDIT' && sale.customerId) { 
      const customer = customers.find(c => c.id === sale.customerId); 
      if (customer) { 
        const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - sale.total) }; 
        await db.save('customers', updatedCustomer); 
      } 
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => { await db.save('products', updatedProduct); };
  const handleAddProduct = async (newProduct: Product) => { await db.save('products', newProduct); };
  const handleAddCustomer = async (newCustomer: Customer) => { await db.save('customers', newCustomer); };
  const handleUpdateCustomer = async (updatedCustomer: Customer) => { await db.save('customers', updatedCustomer); };
  const handleAddMovement = async (movement: StockMovement) => { 
    await db.save('movements', movement); 
    const product = products.find(p => String(p.id) === String(movement.productId)); 
    if (product) { 
      const adjustment = movement.type === 'ENTRY' ? movement.quantity : -movement.quantity; 
      await db.save('products', { ...product, stock: product.stock + adjustment }); 
    } 
  };

  const handleCreatePreSale = async (
    cart: CartItem[],
    customerId: string,
    customerName: string,
    subtotal: number,
    discount: number,
    total: number,
    observation: string
  ): Promise<PreSale> => {
    const id = `pre_${Date.now()}`;
    const count = preSales.length + 1;
    const code = `PV-${String(count).padStart(3, '0')}`;

    const newPreSale: PreSale = {
      id,
      code,
      customerId,
      customerName,
      sellerId: currentUser?.id || 'admin',
      sellerName: currentUser?.name || 'Vendedor',
      items: [...cart],
      subtotal,
      discount,
      total,
      observation,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    await db.save('pre_sales', newPreSale);
    return newPreSale;
  };

  const handleCancelPreSale = async (preSaleId: string | number) => {
    await db.delete('pre_sales', String(preSaleId));
  };

  const requestAction = (type: 'DELETE_PRODUCT' | 'DELETE_CUSTOMER' | 'CANCEL_SALE' | 'EDIT_SALE' | 'CANCEL_DEBT', data: any, title: string) => {
    if (!isAdmin && type !== 'EDIT_SALE') { 
      if (type.includes('DELETE') || type === 'CANCEL_DEBT') { 
        alert('Acesso negado. Apenas a Gerência/Dono pode realizar exclusões.'); 
        return; 
      } 
    }
    setPendingAction({ type, data, title }); 
    setIsPasswordModalOpen(true);
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { type, data } = pendingAction;
    if (type === 'DELETE_PRODUCT') { 
      await db.delete('products', data); 
    } 
    else if (type === 'DELETE_CUSTOMER') { 
      await db.delete('customers', data); 
    } 
    else if (type === 'CANCEL_SALE') { 
      await performSaleCancellation(data); 
    } 
    else if (type === 'EDIT_SALE') { 
      const sale = data; 
      await performSaleCancellation(sale); 
      setSaleToEdit(sale); 
      setActiveTab('pos'); 
    } 
    else if (type === 'CANCEL_DEBT') { 
      const billId = String(data);
      const bill = creditBills.find(b => b.id === billId);
      if (bill) {
        await db.delete('credit_bills', bill.id);
        if (bill.customerId && bill.status !== 'PAID') {
          const customer = customers.find(c => c.id === bill.customerId);
          if (customer) {
            const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - bill.amount) };
            await db.save('customers', updatedCustomer);
          }
        }
      }
    }
    setPendingAction(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-purple-600 gap-3 font-sans">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="font-bold text-gray-800">Conectando ao ERP Paiva Moda...</p>
        <span className="text-xs text-gray-400">Sincronizando Firestore em tempo real</span>
      </div>
    );
  }

  if (!currentUser) { 
    return (
      <Login 
        users={users} 
        onLogin={handleLogin} 
        onRecoverPassword={handleRecoverPassword} 
        onInitialOwnerSetup={handleInitialOwnerSetup}
        onCompleteEmployeeProfile={handleCompleteEmployeeProfile}
      />
    ); 
  }

  const userDisplayName = currentUser?.firstName && currentUser?.lastName 
    ? `${currentUser.firstName} ${currentUser.lastName}` 
    : currentUser?.name || currentUser?.username || 'Usuário';

  const tabLabels: { [key in TabType]: string } = {
    dashboard: 'Painel Geral & Visão Executiva',
    pos: 'Frente de Caixa (PDV) & Vendas',
    catalog: 'Catálogo de Produtos & Grade',
    promotions: 'Promoções & Liquidações',
    sales_history: 'Histórico Geral de Vendas',
    customers: 'Gestão de Clientes',
    credit: 'Cobranças & Crediário',
    inventory: 'Inventário & Movimentações de Estoque',
    financial: 'Controle Financeiro & DRE',
    reports: 'Relatórios & Gestão',
    settings: 'Configurações do Sistema & Equipe'
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans" style={{ zoom: appScale }}>
      <PasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        onConfirm={executePendingAction} 
        currentPasswordHash={currentUser.password} 
        actionTitle={pendingAction?.title || ''} 
      />

      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={setActiveTab} 
        isMobileOpen={isMobileMenuOpen} 
        setIsMobileOpen={setIsMobileMenuOpen} 
        onLogout={handleLogout} 
        currentUser={currentUser} 
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Desktop */}
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => setActiveTab(isAdmin ? 'dashboard' : 'pos')}
              className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-600 hover:opacity-80 transition cursor-pointer"
              title="Ir para o início"
            >
              Paiva Moda
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-base font-black text-gray-800">
              {tabLabels[activeTab] || 'Sistema'}
            </span>
            {isOfflineMode ? (
              <span className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-full border border-amber-200" title="Operando com cache local e sincronizando em segundo plano">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Modo Offline
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Firestore Sincronizado
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200/80 rounded-2xl px-3.5 py-1.5 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center text-xs shadow-sm">
                {currentUser?.firstName?.charAt(0) || currentUser?.name?.charAt(0) || 'U'}
              </div>
              <div>
                <span className="text-xs font-black text-gray-900 block leading-tight">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-gray-500 font-bold block leading-tight">
                  {isOwner ? '👑 Dono / Super Admin' : isManager ? '💼 Gerente' : '🏷️ Vendedor(a) / Caixa'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(true)} 
            className="text-gray-600 p-2 hover:bg-gray-100 rounded-xl cursor-pointer"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setActiveTab(isAdmin ? 'dashboard' : 'pos')} 
              className="font-black text-gray-900 hover:text-purple-700 transition cursor-pointer text-base"
            >
              Paiva Moda
            </button>
            {isOfflineMode ? (
              <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Offline
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            )}
          </div>
          <div className="text-xs font-black text-purple-800 bg-purple-100 border border-purple-200 px-3 py-1 rounded-xl shadow-sm">
            {userDisplayName}
          </div>
        </header>

        {/* Conteúdo Principal com Destravamento Total de Abas */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onNavigate={(targetView: any) => {
                const str = String(targetView).toLowerCase();
                if (str.includes('financial')) setActiveTab('financial');
                else if (str.includes('pos')) setActiveTab('pos');
                else if (str.includes('report')) setActiveTab('reports');
                else if (str.includes('product') || str.includes('catalog')) setActiveTab('catalog');
                else if (str.includes('customer')) setActiveTab('customers');
                else if (str.includes('inventory')) setActiveTab('inventory');
                else if (str.includes('sale')) setActiveTab('sales_history');
                else if (str.includes('credit') || str.includes('billing')) setActiveTab('credit');
                else if (str.includes('setting')) setActiveTab('settings');
                else setActiveTab('dashboard');
              }} 
              sales={sales || []} 
              users={users || []}
              financials={financials || []}
              creditBills={creditBills || []}
            />
          )}

          {activeTab === 'pos' && ( 
            <POS 
              products={products || []} 
              customers={customers || []} 
              preSales={preSales || []}
              sales={sales || []}
              storeProfile={storeProfile}
              currentUser={currentUser}
              promotions={promotions || []}
              users={users || []}
              onFinalizeSale={handleFinalizeSale} 
              onCreatePreSale={handleCreatePreSale}
              onCancelPreSale={handleCancelPreSale}
              onAddCustomer={handleAddCustomer}
              saleToEdit={saleToEdit} 
              onClearSaleToEdit={() => setSaleToEdit(null)} 
            /> 
          )}

          {activeTab === 'catalog' && ( 
            <ProductList 
              products={products || []} 
              onUpdateProduct={handleUpdateProduct} 
              onAddProduct={handleAddProduct} 
              onDeleteProduct={(id) => requestAction('DELETE_PRODUCT', id, 'Excluir Produto')} 
              currentUser={currentUser} 
              promotions={promotions || []}
            /> 
          )}

          {activeTab === 'promotions' && (
            <Promotions 
              products={products || []} 
              sales={sales || []} 
              promotions={promotions || []} 
              onSavePromotion={handleSavePromotion} 
              onDeletePromotion={handleDeletePromotion} 
              currentUser={currentUser} 
            />
          )}

          {activeTab === 'sales_history' && ( 
            <SalesHistory 
              sales={sales || []} 
              storeProfile={storeProfile}
              onCancelSale={(sale) => requestAction('CANCEL_SALE', sale, `Estornar Venda #${sale.sequence}`)} 
              onEditSale={(sale) => requestAction('EDIT_SALE', sale, `Editar/Reabrir Venda #${sale.sequence}`)} 
            /> 
          )}

          {activeTab === 'customers' && ( 
            <CustomerList 
              customers={customers || []} 
              onAddCustomer={handleAddCustomer} 
              onUpdateCustomer={handleUpdateCustomer} 
              onDeleteCustomer={(id) => requestAction('DELETE_CUSTOMER', id, 'Excluir Cliente')} 
              currentUser={currentUser} 
            /> 
          )}

          {activeTab === 'credit' && ( 
            <CreditManager 
              customers={customers || []} 
              creditBills={creditBills || []} 
              onReceiveInstallment={handleReceiveInstallment} 
              onDeleteInstallment={isAdmin ? (billId) => requestAction('CANCEL_DEBT', billId, 'Excluir Dívida') : undefined} 
            /> 
          )}

          {activeTab === 'inventory' && ( 
            <Inventory 
              movements={movements || []} 
              onAddMovement={handleAddMovement} 
              products={products || []} 
              onUpdateProduct={handleUpdateProduct}
              currentUser={currentUser}
            /> 
          )}

          {activeTab === 'financial' && ( 
            <Financial 
              records={financials || []} 
              setRecords={setFinancials} 
            /> 
          )}

          {activeTab === 'reports' && (
            <Reports 
              sales={sales || []}
              movements={movements || []}
              products={products || []}
              customers={customers || []}
              users={users || []}
              financials={financials || []}
            />
          )}

          {activeTab === 'settings' && ( 
            <Settings 
              currentUser={currentUser} 
              users={users || []} 
              storeProfile={storeProfile}
              onUpdateStoreProfile={(p) => setStoreProfile(p)}
              onPasswordChange={handlePasswordChange} 
              currentScale={appScale} 
              onScaleChange={(newScale) => { 
                setAppScale(newScale); 
                db.saveSetting('appScale', newScale); 
              }} 
              onAddUser={isAdmin ? handleAddUser : undefined} 
              onDeleteUser={isAdmin ? handleDeleteUser : undefined} 
              onResetUserPassword={isAdmin ? handleResetUserPassword : undefined} 
              onToggleUserStatus={isAdmin ? handleToggleUserStatus : undefined}
            /> 
          )}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
