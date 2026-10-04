import React from 'react';
import { TabType, User } from '../types';
import { 
  LayoutDashboard, ShoppingBag, Package, Users, DollarSign, LogOut, 
  X, ClipboardList, Settings as SettingsIcon, History, WalletCards, 
  BarChart3, Tag, Code2, LucideIcon 
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  onLogout: () => void;
  currentUser: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onSelectTab, 
  isMobileOpen, 
  setIsMobileOpen, 
  onLogout, 
  currentUser 
}) => {
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.isOwner === true;
  const isManager = currentUser?.role === 'MANAGER';
  const isAdmin = isOwner || isManager || currentUser?.role === 'ADMIN';

  // Itens do menu com tipagem estrita de TabType
  const menuItems: { id: TabType; label: string; icon: LucideIcon; requiredRole: 'ALL' | 'ADMIN' }[] = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard, requiredRole: 'ADMIN' },
    { id: 'pos', label: 'Frente de Caixa (PDV)', icon: ShoppingBag, requiredRole: 'ALL' },
    { id: 'catalog', label: 'Catálogo de Produtos', icon: Package, requiredRole: 'ALL' },
    { id: 'promotions', label: 'Promoções & Liquidação', icon: Tag, requiredRole: 'ADMIN' },
    { id: 'sales_history', label: 'Histórico de Vendas', icon: History, requiredRole: 'ALL' },
    { id: 'customers', label: 'Clientes', icon: Users, requiredRole: 'ALL' },
    { id: 'credit', label: 'Cobranças & Crediário', icon: WalletCards, requiredRole: 'ALL' },
    { id: 'inventory', label: 'Inventário & Estoque', icon: ClipboardList, requiredRole: 'ADMIN' },
    { id: 'financial', label: 'Financeiro & DRE', icon: DollarSign, requiredRole: 'ADMIN' },
    { id: 'reports', label: 'Relatórios & Gestão', icon: BarChart3, requiredRole: 'ADMIN' },
  ];

  const handleNavigate = (tab: TabType) => { 
    onSelectTab(tab); 
    setIsMobileOpen(false); 
  };

  const displayName = currentUser?.firstName && currentUser?.lastName 
    ? `${currentUser.firstName} ${currentUser.lastName}` 
    : currentUser?.name || currentUser?.username || 'Colaborador';

  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity" 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0 flex flex-col shadow-2xl`}>
        {/* Header da Marca */}
        <div className="flex h-16 items-center justify-between px-6 bg-slate-950 shrink-0 border-b border-slate-800/80">
          <button 
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 cursor-pointer text-left hover:opacity-90 transition"
            title="Ir para o Painel Inicial"
          >
            Paiva Moda
          </button>
          <button 
            type="button"
            onClick={() => setIsMobileOpen(false)} 
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X size={22} />
          </button>
        </div>

        {/* Perfil do Usuário Ativo */}
        <div className="px-5 py-3.5 bg-slate-800/50 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-sm font-black text-white shadow-md shrink-0">
            {currentUser?.firstName?.charAt(0) || currentUser?.name?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-black truncate text-slate-100">
              {displayName}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
              isOwner
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                : isManager
                ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                : 'bg-purple-400/20 text-purple-300 border border-purple-400/30'
            }`}>
              {isOwner ? '👑 Dono / Super Admin' : isManager ? '💼 Gerente' : '🏷️ Vendedor(a) / Caixa'}
            </span>
          </div>
        </div>

        {/* Status da Conexão em Nuvem */}
        <div className="mx-3 my-2.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-emerald-300 text-[11px]">Firestore Online</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono font-bold">Tempo Real</span>
        </div>

        {/* Lista de Navegação */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {menuItems.map((item) => {
            if (item.requiredRole === 'ADMIN' && !isAdmin) return null;
            const isActive = activeTab === item.id;
            const IconComponent = item.icon;

            return (
              <button 
                key={item.id} 
                type="button"
                onClick={() => handleNavigate(item.id)} 
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50 font-black' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <IconComponent size={18} className={isActive ? 'text-white' : 'text-slate-400'} /> 
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Seção de Configurações & Equipe */}
          <div className="pt-2.5 mt-2.5 border-t border-slate-800">
            <button 
              type="button"
              onClick={() => handleNavigate('settings')} 
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50 font-black' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <SettingsIcon size={18} className={activeTab === 'settings' ? 'text-white' : 'text-slate-400'} /> 
              <span>{isAdmin ? 'Configurações & Equipe' : 'Minha Senha & Zoom'}</span>
            </button>
          </div>
        </div>

        {/* Rodapé: Logout e Créditos */}
        <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
          <button 
            type="button"
            onClick={onLogout} 
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut size={18} /> Sair do Sistema
          </button>
        </div>

        <div className="py-2.5 bg-slate-950 text-center border-t border-slate-900 shrink-0">
          <p className="text-[10px] text-slate-500 mb-0.5">Desenvolvido por</p>
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300">
            <Code2 size={12} className="text-purple-500" /> <span>Ericles Silva</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
