
import React from 'react';
import { ViewState, DashboardStat, Sale } from '../types';
import { 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  AlertCircle,
  ArrowUpRight,
  PackagePlus,
  RotateCcw,
  Calendar,
  History
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: ViewState) => void;
  sales: Sale[];
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, sales }) => {
  // Calculate Stats based on Sales Data
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const todayTotal = sales
    .filter(s => s.date === todayStr)
    .reduce((acc, curr) => acc + curr.total, 0);

  const monthTotal = sales
    .filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + curr.total, 0);

  const yearTotal = sales
    .filter(s => new Date(s.date).getFullYear() === currentYear)
    .reduce((acc, curr) => acc + curr.total, 0);

  const stats: DashboardStat[] = [
    { 
      label: 'Vendas Hoje', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(todayTotal), 
      icon: TrendingUp, 
      color: 'bg-green-500', 
      trend: 'Atualizado agora' 
    },
    { 
      label: 'Vendas Mês', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthTotal), 
      icon: Calendar, 
      color: 'bg-blue-500', 
      trend: 'Este mês' 
    },
    { 
      label: 'Vendas Ano', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearTotal), 
      icon: ShoppingBag, 
      color: 'bg-purple-500', 
      trend: 'Acumulado' 
    },
  ];

  const quickActions = [
    { label: 'Nova Venda', icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', view: ViewState.POS },
    { label: 'Histórico Vendas', icon: History, color: 'text-green-600', bg: 'bg-green-50', view: ViewState.SALES_HISTORY },
    { label: 'Cadastrar Produto', icon: PackagePlus, color: 'text-blue-600', bg: 'bg-blue-50', view: ViewState.PRODUCTS },
    { label: 'Cadastrar Cliente', icon: Users, color: 'text-pink-600', bg: 'bg-pink-50', view: ViewState.CUSTOMERS },
  ];

  // Get last 5 sales for recent activity
  const recentSales = [...sales].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Painel de Controle</h1>
        <p className="text-gray-500">Visão geral da sua loja hoje.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</h3>
              {stat.trend && (
                <span className="inline-flex items-center text-xs font-medium text-green-600 mt-2 bg-green-50 px-2 py-1 rounded-full">
                  <ArrowUpRight size={12} className="mr-1" />
                  {stat.trend}
                </span>
              )}
            </div>
            <div className={`p-4 rounded-xl ${stat.color} text-white shadow-lg shadow-gray-200`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(action.view)}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group"
            >
              <div className={`p-4 rounded-full ${action.bg} ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                <action.icon size={32} />
              </div>
              <span className="font-medium text-gray-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Últimas Vendas</h2>
          <button 
            onClick={() => onNavigate(ViewState.SALES_HISTORY)}
            className="text-sm text-purple-600 font-medium hover:text-purple-700"
          >
            Ver todas
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {recentSales.length > 0 ? recentSales.map((sale) => (
            <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                  {sale.customerName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{sale.customerName}</p>
                  <p className="text-xs text-gray-500">{sale.items.length} itens • {new Date(sale.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              <span className="font-medium text-gray-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
              </span>
            </div>
          )) : (
            <div className="p-6 text-center text-gray-400">Nenhuma venda realizada ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
};
