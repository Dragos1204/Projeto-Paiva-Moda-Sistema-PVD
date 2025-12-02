
import React, { useState, useEffect } from 'react';
import { ViewState, Product, CartItem, StockMovement, Customer, Sale, FinancialRecord, User } from './types';
import { MOCK_PRODUCTS, MOCK_MOVEMENTS, MOCK_CUSTOMERS, MOCK_SALES, MOCK_FINANCIALS, DEFAULT_USERS } from './constants';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { POS } from './components/POS';
import { ProductList } from './components/ProductList';
import { Inventory } from './components/Inventory';
import { CustomerList } from './components/CustomerList';
import { Financial } from './components/Financial';
import { SalesHistory } from './components/SalesHistory';
import { Settings } from './components/Settings';
import { Billing } from './components/Billing';
import { PasswordModal } from './components/PasswordModal';
import { Menu } from 'lucide-react';
import { db } from './database';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appScale, setAppScale] = useState(1); 

  // Computed
  const isAdmin = currentUser?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [movements, setMovements] = useState<StockMovement[]>(MOCK_MOVEMENTS);
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [sales, setSales] = useState<Sale[]>(MOCK_SALES);
  const [financials, setFinancials] = useState<FinancialRecord[]>(MOCK_FINANCIALS);

  // Edit Sale State
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'DELETE_PRODUCT' | 'DELETE_CUSTOMER' | 'CANCEL_SALE' | 'EDIT_SALE' | 'CANCEL_DEBT';
    data: any;
    title: string;
  } | null>(null);

  // --- Database Loading ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbProducts, dbCustomers, dbMovements, dbSales, dbFinancials, dbUsers, dbScale] = await Promise.all([
          db.getAll<Product>('products'),
          db.getAll<Customer>('customers'),
          db.getAll<StockMovement>('movements'),
          db.getAll<Sale>('sales'),
          db.getAll<FinancialRecord>('financials'),
          db.getAll<User>('users'),
          db.getSetting('appScale')
        ]);

        if (dbProducts.length > 0) setProducts(dbProducts);
        
        if (dbCustomers.length > 0) {
          setCustomers(dbCustomers);
        } else {
          await db.save('customers', MOCK_CUSTOMERS[0]);
        }

        if (dbMovements.length > 0) setMovements(dbMovements);
        if (dbSales.length > 0) setSales(dbSales);
        if (dbFinancials.length > 0) setFinancials(dbFinancials);
        
        if (dbUsers.length > 0) {
            setUsers(dbUsers);
        } else {
            setUsers(DEFAULT_USERS);
        }

        if (dbScale) setAppScale(dbScale);

      } catch (error) {
        console.error("Erro ao carregar banco de dados:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  // --- User Management Handlers ---
  const handleAddUser = (user: User) => {
      setUsers(prev => [...prev, user]);
      db.save('users', user);
  };

  const handleDeleteUser = (id: string) => {
      if (id === 'admin') return; 
      setUsers(prev => prev.filter(u => u.id !== id));
      db.delete('users', id);
  };

  const handleResetUserPassword = (id: string) => {
      const user = users.find(u => u.id === id);
      if (user) {
          const updated = { ...user, password: '1234' }; 
          setUsers(prev => prev.map(u => u.id === id ? updated : u));
          db.save('users', updated);
          alert(`Senha de ${user.username} resetada para 1234.`);
      }
  };

  const handleRecoverPassword = (userId: string, newPass: string) => {
      const user = users.find(u => u.id === userId);
      if (user) {
          const updated = { ...user, password: newPass };
          setUsers(prev => prev.map(u => u.id === userId ? updated : u));
          db.save('users', updated);
      }
  };

  const handlePasswordChange = (newPass: string) => {
      if (currentUser) {
          const updated = { ...currentUser, password: newPass };
          setCurrentUser(updated);
          setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
          db.save('users', updated);
      }
  };

  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  const requestAction = (type: 'DELETE_PRODUCT' | 'DELETE_CUSTOMER' | 'CANCEL_SALE' | 'EDIT_SALE' | 'CANCEL_DEBT', data: any, title: string) => {
    if (currentUser?.role !== 'ADMIN' && type !== 'EDIT_SALE') {
        if (type.includes('DELETE') || type === 'CANCEL_DEBT') {
            alert('Acesso negado. Apenas administradores podem excluir itens.');
            return;
        }
    }
    setPendingAction({ type, data, title });
    setIsPasswordModalOpen(true);
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    const { type, data } = pendingAction;

    if (type === 'DELETE_PRODUCT') {
      const id = data;
      setProducts(prev => prev.filter(p => p.id !== id));
      db.delete('products', id);
    } 
    else if (type === 'DELETE_CUSTOMER') {
      const id = data;
      setCustomers(prev => prev.filter(c => c.id !== id));
      db.delete('customers', id);
    }
    else if (type === 'CANCEL_SALE') {
      performSaleCancellation(data);
    }
    else if (type === 'EDIT_SALE') {
      const sale = data;
      performSaleCancellation(sale);
      setSaleToEdit(sale);
      setCurrentView(ViewState.POS);
    }
    else if (type === 'CANCEL_DEBT') {
        const debt = data;
        setFinancials(prev => prev.filter(f => f.id !== debt.id));
        db.delete('financials', debt.id);
        if (debt.customerId) {
            const customer = customers.find(c => c.id === debt.customerId);
            if (customer) {
                const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - debt.amount) };
                setCustomers(prev => prev.map(c => c.id === debt.customerId ? updatedCustomer : c));
                db.save('customers', updatedCustomer);
            }
        }
    }
    setPendingAction(null);
  };

  const handleFinalizeSale = (
    cart: CartItem[], customerId: string, paymentMethod: string, 
    subtotal: number, discount: number, total: number, 
    observation: string, change: number, installments: number, cpf: string,
    customTimestamp?: string, customDueDate?: string
  ): Sale => {
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

    const newSale: Sale = {
      id: saleId, sequence: nextSequence, date: dateStr, timestamp: timestampStr,
      customerId, customerName, items: [...cart], subtotal, discount, total,
      paymentMethod, observation, change, installments, status: 'COMPLETED',
      cpf: cpf || undefined, interestAndFines: 0
    };
    
    setSales(prev => [newSale, ...prev]);
    db.save('sales', newSale);

    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.id === product.id);
      if (cartItem) {
        const newStock = product.stock - cartItem.quantity;
        const updated = { ...product, stock: newStock };
        db.save('products', updated);
        return updated;
      }
      return product;
    });
    setProducts(updatedProducts);

    cart.forEach(item => {
      const movement: StockMovement = {
        id: Math.random(), productId: item.id, productName: item.name, type: 'EXIT',
        quantity: item.quantity, date: dateStr, 
        reason: `Venda #${nextSequence} - ${customerName} (${currentUser?.username})`
      };
      setMovements(prev => [movement, ...prev]);
      db.save('movements', movement); 
    });

    if (paymentMethod === 'STORE_CREDIT') {
        const installmentCount = Math.max(1, installments);
        const installmentValue = total / installmentCount;
        let baseDateObj = new Date(timestampStr);
        if (customDueDate) {
            const [y, m, d] = customDueDate.split('-').map(Number);
            baseDateObj = new Date(y, m - 1, d);
        } else {
            baseDateObj.setDate(baseDateObj.getDate() + 30);
        }

        for (let i = 0; i < installmentCount; i++) {
            const dueDateObj = new Date(baseDateObj);
            dueDateObj.setMonth(dueDateObj.getMonth() + i);
            const offset = dueDateObj.getTimezoneOffset() * 60000;
            const dueDateStr = new Date(dueDateObj.getTime() - offset).toISOString().split('T')[0];

            const record: FinancialRecord = {
                id: saleId + i,
                description: `Venda #${nextSequence} - ${customerName} (Parc ${i+1}/${installmentCount})`,
                amount: installmentValue, type: 'INCOME', category: 'Vendas',
                dueDate: dueDateStr, status: 'PENDING', saleId: saleId, customerId: customerId
            };
            setFinancials(prev => [record, ...prev]);
            db.save('financials', record);
        }
    } else {
        let financialDescription = `Venda #${nextSequence} - ${customerName}`;
        if (paymentMethod === 'CREDIT_CARD' && installments > 1) financialDescription += ` (${installments}x)`;

        const newFinancial: FinancialRecord = {
          id: saleId, description: financialDescription, amount: total, type: 'INCOME', category: 'Vendas',
          dueDate: dateStr, paymentDate: dateStr, paymentMethod: paymentMethod, status: 'PAID',
          saleId: saleId, customerId: customerId
        };
        setFinancials(prev => [newFinancial, ...prev]);
        db.save('financials', newFinancial);
    }

    if (paymentMethod === 'STORE_CREDIT' && customer) {
       const updatedCustomer = { ...customer, usedCredit: (customer.usedCredit || 0) + total };
       setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
       db.save('customers', updatedCustomer);
    }
    return newSale;
  };

  const handleReceiveDebt = (record: FinancialRecord, totalReceived: number, paymentMethod: string) => {
    const today = getLocalDateString();
    const extraAmount = Math.max(0, totalReceived - record.amount);

    const updatedRecord = { 
        ...record, status: 'PAID' as const, paymentDate: today, amount: totalReceived, 
        paymentMethod: paymentMethod, description: `${record.description} (Pago em ${today})` 
    };

    setFinancials(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
    db.save('financials', updatedRecord); 

    if (record.customerId) {
       const customer = customers.find(c => c.id === record.customerId);
       if (customer) {
         const originalDebt = record.amount; 
         const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - originalDebt) };
         setCustomers(prev => prev.map(c => c.id === record.customerId ? updatedCustomer : c));
         db.save('customers', updatedCustomer);
       }
    }

    if (record.saleId) {
        const sale = sales.find(s => s.id === record.saleId);
        if (sale) {
            const updatedSale = { 
                ...sale, total: sale.total + extraAmount, 
                interestAndFines: (sale.interestAndFines || 0) + extraAmount 
            };
            setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
            db.save('sales', updatedSale);
        }
    }
  };

  const performSaleCancellation = (sale: Sale) => {
    const date = getLocalDateString();
    const updatedSale = { ...sale, status: 'CANCELLED' as const };
    setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
    db.save('sales', updatedSale);

    const updatedProducts = [...products];
    sale.items.forEach(item => {
      const prod = updatedProducts.find(p => p.id === item.id);
      if (prod) {
        prod.stock += item.quantity;
        db.save('products', prod); 
        const movement: StockMovement = {
            id: Math.random(), productId: item.id, productName: item.name, type: 'ENTRY',
            quantity: item.quantity, date: date, reason: `Estorno Venda #${sale.sequence} (${currentUser?.username})`
        };
        setMovements(prev => [movement, ...prev]);
        db.save('movements', movement);
      }
    });
    setProducts(updatedProducts);

    if (sale.paymentMethod === 'STORE_CREDIT') {
       setFinancials(prev => prev.filter(f => f.saleId !== sale.id));
       financials.filter(f => f.saleId === sale.id).forEach(f => db.delete('financials', f.id));
       
       if (sale.customerId) {
          const customer = customers.find(c => c.id === sale.customerId);
          if (customer) {
             const updatedCustomer = { ...customer, usedCredit: Math.max(0, (customer.usedCredit || 0) - sale.total) };
             setCustomers(prev => prev.map(c => c.id === sale.customerId ? updatedCustomer : c));
             db.save('customers', updatedCustomer);
          }
       }
    } else {
       setFinancials(prev => prev.filter(f => f.saleId !== sale.id));
       db.delete('financials', sale.id);
    }
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    db.save('products', updatedProduct);
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    db.save('products', newProduct);
  };

  const handleAddCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
    db.save('customers', newCustomer);
  };

  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    db.save('customers', updatedCustomer);
  };

  const handleAddMovement = (movement: StockMovement) => {
    setMovements(prev => [movement, ...prev]);
    db.save('movements', movement);
    const product = products.find(p => p.id === movement.productId);
    if (product) {
        const adjustment = movement.type === 'ENTRY' ? movement.quantity : -movement.quantity;
        const updatedProduct = { ...product, stock: product.stock + adjustment };
        setProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p));
        db.save('products', updatedProduct);
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-purple-600 font-bold">Carregando Sistema...</div>;

  if (currentView === ViewState.LOGIN || !currentUser) {
    return <Login users={users} onLogin={handleLogin} onRecoverPassword={handleRecoverPassword} />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans" style={{ zoom: appScale }} >
      <PasswordModal 
        isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={executePendingAction} currentPasswordHash={currentUser.password}
        actionTitle={pendingAction?.title || ''}
      />
      <Sidebar 
        currentView={currentView} setCurrentView={setCurrentView}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
        onLogout={handleLogout} currentUser={currentUser}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 p-2 hover:bg-gray-100"><Menu size={24} /></button>
          <span className="font-bold text-gray-800">Paiva Moda</span>
          <div className="w-10" />
        </header>
        <main className="flex-1 overflow-auto">
          {currentView === ViewState.DASHBOARD && <Dashboard onNavigate={setCurrentView} sales={sales} />}
          {currentView === ViewState.POS && (
             <POS products={products} customers={customers} onFinalizeSale={handleFinalizeSale}
                saleToEdit={saleToEdit} onClearSaleToEdit={() => setSaleToEdit(null)}
             />
          )}
          {currentView === ViewState.PRODUCTS && (
            <ProductList products={products} onUpdateProduct={handleUpdateProduct} onAddProduct={handleAddProduct}
              onDeleteProduct={(id) => requestAction('DELETE_PRODUCT', id, 'Excluir Produto')} currentUser={currentUser}
            />
          )}
          {currentView === ViewState.SALES_HISTORY && (
            <SalesHistory sales={sales} 
              onCancelSale={(sale) => requestAction('CANCEL_SALE', sale, `Estornar Venda #${sale.sequence}`)}
              onEditSale={(sale) => requestAction('EDIT_SALE', sale, `Editar/Reabrir Venda #${sale.sequence}`)}
            />
          )}
          {currentView === ViewState.INVENTORY && (
            <Inventory movements={movements} onAddMovement={handleAddMovement} products={products} />
          )}
          {currentView === ViewState.CUSTOMERS && (
            <CustomerList customers={customers} onAddCustomer={handleAddCustomer} onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={(id) => requestAction('DELETE_CUSTOMER', id, 'Excluir Cliente')} currentUser={currentUser}
            />
          )}
          {currentView === ViewState.BILLING && (
            <Billing customers={customers} financialRecords={financials} onReceiveDebt={handleReceiveDebt}
              onDeleteDebt={currentUser.role === 'ADMIN' ? (debt) => requestAction('CANCEL_DEBT', debt, 'Excluir Dívida') : undefined}
            />
          )}
          {currentView === ViewState.FINANCIAL && (
            <Financial records={financials} setRecords={setFinancials} />
          )}
          {currentView === ViewState.SETTINGS && (
            <Settings currentUser={currentUser} users={users} onPasswordChange={handlePasswordChange}
              currentScale={appScale} onScaleChange={(newScale) => { setAppScale(newScale); db.saveSetting('appScale', newScale); }}
              onAddUser={isAdmin ? handleAddUser : undefined} onDeleteUser={isAdmin ? handleDeleteUser : undefined}
              onResetUserPassword={isAdmin ? handleResetUserPassword : undefined}
            />
          )}
        </main>
      </div>
    </div>
  );
};
export default App;
