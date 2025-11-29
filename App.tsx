
import React, { useState } from 'react';
import { ViewState, Product, CartItem, StockMovement, Customer, Sale, FinancialRecord } from './types';
import { MOCK_PRODUCTS, MOCK_MOVEMENTS, MOCK_CUSTOMERS, MOCK_SALES, MOCK_FINANCIALS } from './constants';
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
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // App State - Lifted Up for Sync
  const [currentPassword, setCurrentPassword] = useState('1234');
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [movements, setMovements] = useState<StockMovement[]>(MOCK_MOVEMENTS);
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [sales, setSales] = useState<Sale[]>(MOCK_SALES);
  const [financials, setFinancials] = useState<FinancialRecord[]>(MOCK_FINANCIALS);

  const handleLogin = () => {
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentView(ViewState.LOGIN);
  };

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    // Create a new date adjusted for timezone to ensure we get the correct local YYYY-MM-DD
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  // --- Handlers for Data Sync ---

  // Called when a sale is finalized in POS
  const handleFinalizeSale = (
    cart: CartItem[], 
    customerId: string, 
    paymentMethod: string, 
    subtotal: number,
    discount: number,
    total: number,
    observation: string,
    change: number,
    installments: number
  ) => {
    const saleId = Date.now();
    const date = getLocalDateString(); // Use local date
    const timestamp = new Date().toISOString();
    const customer = customers.find(c => c.id === customerId);
    const customerName = customer ? customer.name : 'Cliente Não Identificado';

    // 1. Create Sale Record
    const newSale: Sale = {
      id: saleId,
      date,
      timestamp,
      customerId,
      customerName,
      items: [...cart], // snapshot
      subtotal,
      discount,
      total,
      paymentMethod,
      observation,
      change,
      installments
    };
    setSales(prev => [newSale, ...prev]);

    // 2. Update Product Stock
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.id === product.id);
      if (cartItem) {
        return { ...product, stock: product.stock - cartItem.quantity };
      }
      return product;
    });
    setProducts(updatedProducts);

    // 3. Create Inventory Movements (Exits)
    const newMovements: StockMovement[] = cart.map(item => ({
      id: Math.random(), // Simple ID gen
      productId: item.id,
      productName: item.name,
      type: 'EXIT',
      quantity: item.quantity,
      date: date,
      reason: `Venda #${saleId} - ${customerName} (${paymentMethod})`
    }));
    setMovements(prev => [...newMovements, ...prev]);

    // 4. Create Financial Record (Income)
    let financialDescription = `Venda #${saleId} - ${customerName}`;
    if (paymentMethod === 'CREDIT_CARD' && installments > 1) {
       financialDescription += ` (${installments}x)`;
    }

    const newFinancial: FinancialRecord = {
      id: saleId, // Use same ID for linkage
      description: financialDescription,
      amount: total,
      type: 'INCOME',
      category: 'Vendas',
      dueDate: date, // Paid today
      paymentDate: date, // IMPORTANT: Set payment date to today
      status: 'PAID', // Sales are immediately paid in this flow
      saleId: saleId
    };
    setFinancials(prev => [newFinancial, ...prev]);
  };

  // Called from ProductList
  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleDeleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Called from Inventory
  const handleAddMovement = (movement: StockMovement) => {
    // 1. Add movement log
    setMovements(prev => [movement, ...prev]);
    
    // 2. Update actual product stock based on movement type
    setProducts(prev => prev.map(p => {
      if (p.id === movement.productId) {
        const adjustment = movement.type === 'ENTRY' ? movement.quantity : -movement.quantity;
        return { ...p, stock: p.stock + adjustment };
      }
      return p;
    }));
  };

  if (currentView === ViewState.LOGIN) {
    return (
      <Login 
        onLogin={handleLogin} 
        validatePassword={(pass) => pass === currentPassword}
      />
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} sales={sales} />;
      case ViewState.POS:
        return (
          <POS 
            products={products} 
            customers={customers}
            onFinalizeSale={handleFinalizeSale}
          />
        );
      case ViewState.PRODUCTS:
        return (
          <ProductList 
            products={products}
            onUpdateProduct={handleUpdateProduct}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        );
      case ViewState.SALES_HISTORY:
        return (
          <SalesHistory sales={sales} />
        );
      case ViewState.INVENTORY:
        return (
          <Inventory 
            movements={movements} 
            onAddMovement={handleAddMovement}
            products={products}
          />
        );
      case ViewState.CUSTOMERS:
        return (
          <CustomerList 
            customers={customers}
            setCustomers={setCustomers}
          />
        );
      case ViewState.FINANCIAL:
        return (
          <Financial 
            records={financials} 
            setRecords={setFinancials} 
          />
        );
      case ViewState.SETTINGS:
        return (
          <Settings 
            currentPasswordHash={currentPassword}
            onPasswordChange={setCurrentPassword}
          />
        );
      default:
        return <Dashboard onNavigate={setCurrentView} sales={sales} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-600 p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-800">Paiva Moda</span>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
