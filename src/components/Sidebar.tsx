
import React from 'react';
import { ViewState, User } from '../types';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Users, 
  DollarSign, 
  LogOut, 
  X,
  ClipboardList,
  Settings,
  History,
  WalletCards,
  Code2
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  onLogout: () => void;
  currentUser: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  isMobileOpen, 
  setIsMobileOpen,
  onLogout,
  currentUser
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  const menuItems = [
    { view: ViewState.DASHBOARD, label: 'Painel', icon: LayoutDashboard, requiredRole: 'EMPLOYEE' },
    { view: ViewState.POS, label: 'Vendas (PDV)', icon: ShoppingBag, requiredRole: 'EMPLOYEE' },
    { view: ViewState.PRODUCTS, label: 'Produtos', icon: Package, requiredRole: 'EMPLOYEE' },
    { view: ViewState.SALES_HISTORY, label: 'Histórico Vendas', icon: History, requiredRole: 'EMPLOYEE' },
    // Inventory: Only Admin or maybe Stockist (using admin logic for now for restriction)
    { view: ViewState.INVENTORY, label: 'Inventário', icon: ClipboardList, requiredRole: 'ADMIN' },
    { view: ViewState.CUSTOMERS, label: 'Clientes', icon: Users, requiredRole: 'EMPLOYEE' },
    { view: ViewState.BILLING, label: 'Cobranças / Crediário', icon: WalletCards, requiredRole: 'EMPLOYEE' },
    // Financial: Only Admin
    { view: ViewState.FINANCIAL, label: 'Financeiro', icon: DollarSign, requiredRole: 'ADMIN' },
  ];

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0 flex flex-col
      `}>
        <div className="flex h-16 items-center justify-between px-6 bg-slate-950 shrink-0">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">
            Paiva Moda
          </span>
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Info Mini */}
        <div className="px-6 py-4 bg-slate-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold">
                {currentUser?.username.charAt(0)}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{currentUser?.username}</p>
                <p className="text-xs text-slate-400">{isAdmin ? 'Administrador' : 'Funcionário'}</p>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          {menuItems.map((item) => {
            // Hide if requiredRole is ADMIN and user is NOT admin
            if (item.requiredRole === 'ADMIN' && !isAdmin) return null;

            return (
              <button
                key={item.view}
                onClick={() => handleNavigate(item.view)}
                className={`
                  flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                  ${currentView === item.view 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800">
             <button
              onClick={() => handleNavigate(ViewState.SETTINGS)}
              className={`
                flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                ${currentView === ViewState.SETTINGS 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <Settings size={20} />
              Configurações
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <button 
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={20} />
            Sair do Sistema
          </button>
        </div>

        {/* Developer Credit Footer */}
        <div className="py-3 bg-slate-950 text-center border-t border-slate-900 shrink-0">
           <p className="text-[10px] text-slate-500 mb-0.5">Desenvolvido por</p>
           <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300">
              <Code2 size={12} className="text-purple-500" />
              <span>Ericles Silva</span>
           </div>
        </div>
      </aside>
    </>
  );
};
