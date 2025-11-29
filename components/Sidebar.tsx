
import React from 'react';
import { ViewState } from '../types';
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
  History
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  isMobileOpen, 
  setIsMobileOpen,
  onLogout 
}) => {
  const menuItems = [
    { view: ViewState.DASHBOARD, label: 'Painel', icon: LayoutDashboard },
    { view: ViewState.POS, label: 'Vendas (PDV)', icon: ShoppingBag },
    { view: ViewState.PRODUCTS, label: 'Produtos', icon: Package },
    { view: ViewState.SALES_HISTORY, label: 'Histórico Vendas', icon: History },
    { view: ViewState.INVENTORY, label: 'Inventário', icon: ClipboardList },
    { view: ViewState.CUSTOMERS, label: 'Clientes', icon: Users },
    { view: ViewState.FINANCIAL, label: 'Financeiro', icon: DollarSign },
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

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
          {menuItems.map((item) => (
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
          ))}

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
      </aside>
    </>
  );
};
