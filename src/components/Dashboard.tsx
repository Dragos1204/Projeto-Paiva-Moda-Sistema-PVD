import React, { useState, useMemo } from 'react';
import { ViewState, DashboardStat, Sale, User, FinancialRecord } from '../types';
import { 
  ShoppingBag, TrendingUp, ArrowUpRight, PackagePlus, Calendar, 
  History, Trophy, Clock, DollarSign, WalletCards, 
  BarChart3, ChevronRight, Sparkles
} from 'lucide-react';
import { getManausDate, getManausMonth, getManausTime } from '../utils/date';

interface DashboardProps {
  onNavigate: (view: ViewState) => void;
  sales: Sale[];
  users: User[];
  financials: FinancialRecord[];
  creditBills?: any[];
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, 
  sales, 
  users, 
  financials,
  creditBills = []
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECTED_CASH' | 'TEAM_RANKING'>('OVERVIEW');

  const todayManaus = getManausDate(); // Data de hoje em Manaus
  const currentMonthManaus = getManausMonth(); // Mês corrente em Manaus (ex: '2026-10')
  const localTodayStr = todayManaus;
  const [currentYear, currentMonth] = currentMonthManaus.split('-');

  // --- Vendas Válidas ---
  const validSales = useMemo(() => sales.filter(s => s.status !== 'CANCELLED'), [sales]);
  const todayTotal = useMemo(() => validSales.filter(s => getManausDate(s.createdAt || s.timestamp || s.date) === todayManaus).reduce((acc, curr) => acc + curr.total, 0), [validSales, todayManaus]);
  const monthTotal = useMemo(() => validSales.filter(s => getManausMonth(s.createdAt || s.timestamp || s.date) === currentMonthManaus).reduce((acc, curr) => acc + curr.total, 0), [validSales, currentMonthManaus]);


  // --- Cálculos Financeiros Realizados & Projetados via Funções Redutoras Puras ---
  // Saldo Líquido Realizado (Caixa Vivo Disponível): Soma EXCLUSIVA de todas as vendas com pagamento imediato / liquidados
  const realizedNetBalance = useMemo(() => {
    return financials
      .filter(f => (f.status as string) === 'COMPLETED' || f.status === 'PAID')
      .reduce((acc, f) => acc + (f.type === 'INCOME' ? f.amount : -f.amount), 0);
  }, [financials]);

  // A Receber no Futuro (Projetado / Carteira de Recebíveis):
  // (Total pendente dos carnês próprios 'STORE_CREDIT') + (Total das vendas 'BEMOL_CREDIT' deduzidas a taxa de 3%)
  const allPendingReceivables = useMemo(() => {
    const pendingStoreCredit = creditBills
      .filter(b => b.status === 'PENDING' || b.status === 'OVERDUE')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendingBemol = financials
      .filter(f => f.type === 'INCOME' && f.status === 'PENDING' && ['BEMOL_CREDIT', 'BEMOL'].includes(f.paymentMethod || ''))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return pendingStoreCredit + pendingBemol;
  }, [creditBills, financials]);

  // Contas a Pagar (Despesas Pendentes)
  const totalPayablesPending = useMemo(() => {
    return financials
      .filter(f => f.status === 'PENDING' && f.type === 'EXPENSE')
      .reduce((acc, f) => acc + f.amount, 0);
  }, [financials]);

  const totalReceivablesNext30 = allPendingReceivables;

  // Lista de Recebíveis Pendentes
  const pendingReceivablesNext30 = useMemo((): FinancialRecord[] => {
    return financials.filter(f => f.type === 'INCOME' && f.status === 'PENDING');
  }, [financials]);

  // Repasses Bemol específicos
  const totalBemolNext30 = useMemo(() => {
    return financials
      .filter(f => f.type === 'INCOME' && f.status === 'PENDING' && ['BEMOL_CREDIT', 'BEMOL'].includes(f.paymentMethod || ''))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [financials]);

  // Crediário Próprio (Carnê)
  const totalStoreCreditNext30 = useMemo(() => {
    return creditBills
      .filter(b => b.status === 'PENDING' || b.status === 'OVERDUE')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [creditBills]);

  // Saldo Líquido Projetado Final (Realizado + A Receber - Dívidas a Pagar)
  const projectedNetBalance = useMemo(() => {
    return realizedNetBalance + allPendingReceivables - totalPayablesPending;
  }, [realizedNetBalance, allPendingReceivables, totalPayablesPending]);

  // --- Pilar 1: Performance da Equipe & Ranqueamento Mensal (Apenas Usuários Reais Cadastrados) ---
  const teamRanking = useMemo(() => {
    // Exclui usuários de teste legados ou inativos
    const activeRealUsers = users.filter(u => {
      if (u.isActive === false) return false;
      const nLower = (u.name || '').toLowerCase();
      const uLower = (u.username || '').toLowerCase();
      return !nLower.includes('admin geral') &&
             !nLower.includes('administrador geral') &&
             !nLower.includes('vendedor 01') &&
             !nLower.includes('vendedor 02') &&
             uLower !== 'vendedor01' &&
             uLower !== 'vendedor02' &&
             uLower !== 'admin_geral' &&
             u.id !== 'seller1' &&
             u.id !== 'seller2' &&
             !u.id.startsWith('mock_');
    });

    const sellersMap: { [key: string]: { user: User; totalAmount: number; salesCount: number; ticketAverage: number } } = {};

    activeRealUsers.forEach(u => {
      sellersMap[u.id] = {
        user: u,
        totalAmount: 0,
        salesCount: 0,
        ticketAverage: 0
      };
    });

    // Processa vendas do mês corrente
    validSales.forEach(sale => {
      const saleMonthStr = getManausMonth(sale.createdAt || sale.timestamp || sale.date);
      if (saleMonthStr === currentMonthManaus) {
        const sId = sale.sellerId;
        const sName = (sale.sellerName || '').toLowerCase();
        
        const matched = activeRealUsers.find(u => 
          u.id === sId || 
          u.username === sId || 
          (u.cpf && sId && u.cpf.replace(/\D/g, '') === sId.replace(/\D/g, '')) ||
          (u.name && sName && u.name.toLowerCase() === sName)
        );

        if (matched && sellersMap[matched.id]) {
          sellersMap[matched.id].totalAmount += sale.total;
          sellersMap[matched.id].salesCount += 1;
        } else if (activeRealUsers.length > 0) {
          const defaultUser = activeRealUsers.find(u => u.role === 'ADMIN') || activeRealUsers[0];
          if (defaultUser && sellersMap[defaultUser.id]) {
            sellersMap[defaultUser.id].totalAmount += sale.total;
            sellersMap[defaultUser.id].salesCount += 1;
          }
        }
      }
    });

    const rankingArray = Object.values(sellersMap).map(item => ({
      ...item,
      ticketAverage: item.salesCount > 0 ? item.totalAmount / item.salesCount : 0
    }));

    return rankingArray.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [users, validSales, currentMonthManaus]);

  const formatCurrency = (val: number) => {
    const rounded = Math.round((val || 0) * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rounded);
  };

  const stats: DashboardStat[] = [
    { label: 'Faturamento Hoje', value: formatCurrency(todayTotal), icon: TrendingUp, color: 'bg-emerald-600', trend: 'Entradas imediatas' },
    { label: 'Faturamento do Mês', value: formatCurrency(monthTotal), icon: Calendar, color: 'bg-purple-600', trend: 'Acumulado no mês' },
    { label: 'Recebíveis Futuros (30d)', value: formatCurrency(totalReceivablesNext30), icon: WalletCards, color: 'bg-amber-600', trend: 'Parceiro Bemol + Carnê' },
  ];

  const recentSales = [...validSales]
    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header do Dashboard com Abas Executivas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Painel Executivo da Loja</h1>
            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full border border-purple-200">
              Gerente / Dono
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Gestão estratégica, fluxo de recebíveis, crediário parceiro e performance comercial.</p>
        </div>

        {/* Seletor de Abas */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 text-xs font-bold gap-1">
          <button 
            onClick={() => setActiveTab('OVERVIEW')} 
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'OVERVIEW' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <BarChart3 size={15} /> Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('PROJECTED_CASH')} 
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'PROJECTED_CASH' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Clock size={15} /> Fluxo Projetado (30d)
          </button>
          <button 
            onClick={() => setActiveTab('TEAM_RANKING')} 
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'TEAM_RANKING' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Trophy size={15} /> Ranqueamento Equipe
          </button>
        </div>
      </div>

      {/* --- ABA 1: VISÃO GERAL --- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Métricas Principais de Vendas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl lg:text-3xl font-black text-gray-800 mt-1">{stat.value}</h3>
                  {stat.trend && (
                    <span className="inline-flex items-center text-xs font-semibold text-purple-600 mt-2 bg-purple-50 px-2.5 py-1 rounded-full">
                      <ArrowUpRight size={13} className="mr-1" /> {stat.trend}
                    </span>
                  )}
                </div>
                <div className={`p-4 rounded-2xl ${stat.color} text-white shadow-lg`}>
                  <stat.icon size={26} />
                </div>
              </div>
            ))}
          </div>

          {/* Integração: Saúde Financeira & Saldo Projetado */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <DollarSign size={18} className="text-purple-600" /> Fluxo Financeiro & Projeção com Dívidas
                </h2>
                <p className="text-xs text-gray-500">Saldo realizado em caixa, previsões de recebíveis e despesas pendentes a pagar.</p>
              </div>
              <button 
                onClick={() => onNavigate(ViewState.FINANCIAL)}
                className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 self-start sm:self-auto"
              >
                Abrir Financeiro Completo <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Saldo Líquido Realizado */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Saldo Líquido Realizado</span>
                <p className={`text-xl font-black mt-1 ${realizedNetBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(realizedNetBalance)}
                </p>
                <span className="text-[10px] text-gray-400">Entradas quitadas - Saídas pagas</span>
              </div>

              {/* A Receber Futuro */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">A Receber Futuro</span>
                <p className="text-xl font-black text-purple-900 mt-1">{formatCurrency(allPendingReceivables)}</p>
                <span className="text-[10px] text-purple-600 font-medium">Crediário Parceiro Bemol (3%) + Carnê</span>
              </div>

              {/* Contas a Pagar Pendentes */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Contas a Pagar (Pendentes)</span>
                <p className="text-xl font-black text-rose-700 mt-1">{formatCurrency(totalPayablesPending)}</p>
                <span className="text-[10px] text-rose-600 font-medium">Fornecedores NFe & despesas</span>
              </div>

              {/* Saldo Projetado Geral */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 text-white shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">Saldo Projetado Final</span>
                    <Sparkles size={13} className="text-purple-300" />
                  </div>
                  <p className={`text-xl font-black mt-1 ${projectedNetBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {formatCurrency(projectedNetBalance)}
                  </p>
                </div>
                <span className="text-[10px] text-purple-200/80">Realizado + A Receber - Dívidas</span>
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Atalhos Operacionais</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => onNavigate(ViewState.POS)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group text-center">
                <div className="p-3.5 rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                  <ShoppingBag size={28} />
                </div>
                <span className="text-sm font-bold text-gray-800">Frente de Caixa (PDV)</span>
              </button>
              <button onClick={() => onNavigate(ViewState.REPORTS)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group text-center">
                <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                  <BarChart3 size={28} />
                </div>
                <span className="text-sm font-bold text-gray-800">Relatórios & Gestão</span>
              </button>
              <button onClick={() => onNavigate(ViewState.BILLING)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group text-center">
                <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                  <WalletCards size={28} />
                </div>
                <span className="text-sm font-bold text-gray-800">Cobranças & Crediário</span>
              </button>
              <button onClick={() => onNavigate(ViewState.SALES_HISTORY)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group text-center">
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  <History size={28} />
                </div>
                <span className="text-sm font-bold text-gray-800">Histórico de Vendas</span>
              </button>
            </div>
          </div>

          {/* Vendas Recentes */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Clock size={18} className="text-purple-600" /> Transações Recentes
              </h2>
              <button onClick={() => onNavigate(ViewState.SALES_HISTORY)} className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1">
                Ver todas <ChevronRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {recentSales.length > 0 ? (
                recentSales.map((sale) => (
                  <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm">
                        #{sale.sequence || 'V'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{sale.customerName}</p>
                        {(() => {
                          const sellerUser = users.find(u => u.id === sale.sellerId || u.username === sale.sellerId);
                          const sellerFullName = sellerUser?.firstName && sellerUser?.lastName
                            ? `${sellerUser.firstName} ${sellerUser.lastName}`
                            : sellerUser?.name || sale.sellerName || 'Loja';
                          return (
                            <p className="text-xs text-gray-500">
                              {sale.items.length} itens • Vendedor(a): <strong className="text-purple-700">{sellerFullName}</strong> • {getManausTime(sale.createdAt || sale.timestamp || sale.date).substring(0, 5)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-gray-900">{formatCurrency(sale.total)}</span>
                      <span className="block text-[11px] font-semibold text-gray-400 uppercase">
                        {sale.paymentMethod === 'BEMOL' ? 'Crediário Parceiro Bemol' : sale.paymentMethod}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhuma venda registrada ainda.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ABA 2: FLUXO DE CAIXA PROJETADO (RECEBÍVEIS BEMOL & CREDIÁRIO) --- */}
      {activeTab === 'PROJECTED_CASH' && (
        <div className="space-y-6">
          {/* Banner de Previsibilidade */}
          <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full inline-block mb-3">
                  Previsibilidade Financeira • 30 Dias
                </span>
                <h2 className="text-3xl lg:text-4xl font-black">
                  {formatCurrency(totalReceivablesNext30)}
                </h2>
                <p className="text-purple-200 text-sm mt-2 max-w-xl">
                  Total líquido previsto para entrar nos próximos 30 dias decorrente de compras a prazo liquidadas via <strong>Crediário Parceiro BEMOL</strong> (com taxa de 3% deduzida) e <strong>Crediário Próprio da Loja</strong> (carnê).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-xs text-amber-200 font-semibold">Repasses Parceiro Bemol</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalBemolNext30)}</p>
                  <span className="text-[10px] text-amber-300">Líquido (-3% taxa) • 25d</span>
                </div>
                <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-xs text-purple-200 font-semibold">Crediário Próprio (Carnê)</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalStoreCreditNext30)}</p>
                  <span className="text-[10px] text-purple-300">Parcelas a receber</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo de Dívidas vs Recebíveis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Recebíveis Previstos (30d)</span>
              <p className="text-2xl font-black text-purple-700 mt-1">{formatCurrency(totalReceivablesNext30)}</p>
              <p className="text-[11px] text-gray-400 mt-1">Créditos futuros garantidos</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Contas a Pagar Pendentes</span>
              <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(totalPayablesPending)}</p>
              <p className="text-[11px] text-gray-400 mt-1">Boletos de fornecedores & despesas</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Saldo Líquido Projetado</span>
              <p className={`text-2xl font-black mt-1 ${projectedNetBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {formatCurrency(projectedNetBalance)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Realizado + A Receber - Dívidas</p>
            </div>
          </div>

          {/* Lista Detalhada de Títulos Projetados a Receber */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-base font-bold text-gray-800">Cronograma de Recebimento Previsto</h3>
                <p className="text-xs text-gray-500">Títulos pendentes ordenados pela data de liquidação prevista</p>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-200/70 px-3 py-1 rounded-full">
                {pendingReceivablesNext30.length} títulos programados
              </span>
            </div>

            <div className="divide-y divide-gray-100 font-medium text-xs">
              {pendingReceivablesNext30.length > 0 ? (
                pendingReceivablesNext30.map((record: any) => {
                  const isBemol = record.paymentMethod === 'BEMOL' || record.paymentMethod === 'BEMOL_CREDIT';
                  return (
                    <div key={record.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${isBemol ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                          {isBemol ? 'BEMOL' : 'CARNÊ'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{record.description}</p>
                          <p className="text-xs text-gray-500">
                            Previsão de Crédito em Conta: <strong>{new Date(record.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="font-black text-gray-900 text-base">{formatCurrency(record.amount)}</span>
                        <span className={`block text-[11px] font-bold ${isBemol ? 'text-orange-600' : 'text-purple-600'}`}>
                          {isBemol ? 'Aguardando repasse Crediário Parceiro Bemol' : 'Aguardando pagamento do cliente'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-gray-400 text-sm">
                  Nenhum recebível futuro com previsão para os próximos 30 dias.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ABA 3: PERFORMANCE DA EQUIPE & RANQUEAMENTO --- */}
      {activeTab === 'TEAM_RANKING' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                <Trophy size={28} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">Ranqueamento de Vendas do Mês</h2>
                <p className="text-xs text-gray-500">Desempenho individual, ticket médio e volume comercial exclusivo dos colaboradores cadastrados na loja.</p>
              </div>
            </div>

            <div className="space-y-4">
              {teamRanking.length > 0 ? (
                teamRanking.map((rankItem, index) => {
                  const isFirst = index === 0 && rankItem.totalAmount > 0;
                  const isSecond = index === 1 && rankItem.totalAmount > 0;
                  const isThird = index === 2 && rankItem.totalAmount > 0;

                  const percentShare = monthTotal > 0 ? (rankItem.totalAmount / monthTotal) * 100 : 0;

                  return (
                    <div key={rankItem.user.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Medalha / Posição */}
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-sm shrink-0">
                          {isFirst ? (
                            <div className="bg-amber-400 text-amber-950 w-full h-full rounded-2xl flex items-center justify-center text-xl shadow-amber-200 shadow-md">
                              🥇
                            </div>
                          ) : isSecond ? (
                            <div className="bg-slate-300 text-slate-800 w-full h-full rounded-2xl flex items-center justify-center text-xl">
                              🥈
                            </div>
                          ) : isThird ? (
                            <div className="bg-amber-700 text-amber-100 w-full h-full rounded-2xl flex items-center justify-center text-xl">
                              🥉
                            </div>
                          ) : (
                            <div className="bg-gray-200 text-gray-600 w-full h-full rounded-2xl flex items-center justify-center font-bold">
                              {index + 1}º
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base">
                              {rankItem.user.firstName && rankItem.user.lastName 
                                ? `${rankItem.user.firstName} ${rankItem.user.lastName}` 
                                : rankItem.user.name}
                            </h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rankItem.user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                              {rankItem.user.role === 'ADMIN' ? 'Gerente / Dono' : 'Vendedor(a) / Caixa'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            CPF: {rankItem.user.cpf || 'Não cadastrado'} • {rankItem.salesCount} vendas realizadas
                          </p>
                        </div>
                      </div>

                      {/* Estatísticas e Barra de Participação */}
                      <div className="flex flex-col md:items-end gap-1.5 min-w-[200px]">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-gray-400 font-semibold">Total Faturado:</span>
                          <span className="text-lg font-black text-purple-900">{formatCurrency(rankItem.totalAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Ticket Médio: <strong>{formatCurrency(rankItem.ticketAverage)}</strong></span>
                          <span>•</span>
                          <span>{percentShare.toFixed(1)}% do mês</span>
                        </div>
                        {/* Barra de Progresso */}
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-1">
                          <div 
                            className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, percentShare)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhum colaborador registrado no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
