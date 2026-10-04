import React, { useState, useMemo } from 'react';
import { Sale, StoreProfile } from '../types';
import { 
  Search, Eye, X, Tag, FileText, Undo2, Printer, Pencil, TrendingUp, 
  Calendar, CheckCircle2, AlertCircle, ShoppingBag, User, CreditCard, Banknote, Store
} from 'lucide-react';
import { printer } from '../printer';
import { getManausDate, getManausMonth, getManausTime } from '../utils/date';

interface SalesHistoryProps {
  sales: Sale[];
  storeProfile?: StoreProfile;
  onCancelSale?: (sale: Sale) => void;
  onEditSale?: (sale: Sale) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ 
  sales, 
  storeProfile,
  onCancelSale, 
  onEditSale 
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Formatação de Moeda BRL
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Mapeamento e Estilização de Badges Coloridos das Formas de Pagamento
  const getPaymentBadge = (method: string, installments?: number) => {
    const m = (method || '').toUpperCase();
    if (m === 'PIX') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> PIX
        </span>
      );
    }
    if (m === 'MONEY' || m === 'DINHEIRO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
          <Banknote size={12} /> Dinheiro
        </span>
      );
    }
    if (m === 'CREDIT_CARD' || m === 'CREDITO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
          <CreditCard size={12} /> Crédito {installments && installments > 1 ? `(${installments}x)` : ''}
        </span>
      );
    }
    if (m === 'DEBIT_CARD' || m === 'DEBITO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
          <CreditCard size={12} /> Débito
        </span>
      );
    }
    if (m === 'BEMOL' || m === 'BEMOL_CREDIT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-950 border border-cyan-300">
          <Store size={12} className="text-cyan-700" /> Crediário Bemol
        </span>
      );
    }
    if (m === 'STORE_CREDIT' || m === 'CREDIARIO' || m === 'CARNE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <FileText size={12} className="text-amber-700" /> Crediário Loja {installments && installments > 1 ? `(${installments}x)` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
        {method}
      </span>
    );
  };

  // Filtragem de Vendas por Período e Busca
  const filteredSales = useMemo(() => {
    const todayStr = getManausDate();
    const currentMonthStr = getManausMonth();
    const cleanSearch = searchTerm.trim().toLowerCase();

    return (sales || []).filter(sale => {
      if (!sale) return false;
      const saleDateStr = getManausDate(sale.createdAt || sale.timestamp || sale.date);

      let matchesPeriod = true;
      if (filterPeriod === 'TODAY') {
        matchesPeriod = saleDateStr === todayStr;
      } else if (filterPeriod === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = getManausDate(weekAgo);
        matchesPeriod = saleDateStr >= weekAgoStr;
      } else if (filterPeriod === 'MONTH') {
        const saleMonthStr = getManausMonth(sale.createdAt || sale.timestamp || sale.date);
        matchesPeriod = saleMonthStr === currentMonthStr;
      }

      const seqNum = sale.saleNumber || String(sale.sequence || 1).padStart(6, '0');
      const matchesSearch = 
        cleanSearch === '' ||
        (sale.customerName && sale.customerName.toLowerCase().includes(cleanSearch)) ||
        (sale.cpf && sale.cpf.includes(cleanSearch)) ||
        (sale.sellerName && sale.sellerName.toLowerCase().includes(cleanSearch)) ||
        seqNum.includes(cleanSearch) ||
        String(sale.id).includes(cleanSearch);

      return matchesPeriod && matchesSearch;
    });
  }, [sales, filterPeriod, searchTerm]);

  // Totalizador do Filtro Ativo
  const totalRevenueFiltered = useMemo(() => {
    return filteredSales
      .filter(s => s.status !== 'CANCELLED')
      .reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [filteredSales]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900">
            Histórico de Vendas & Cupons
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Consulte cupons emitidos, analise itens vendidos, estorne vendas ou reimprima comprovantes térmicos.
          </p>
        </div>

        {/* Filtros de Período */}
        <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 shadow-sm text-xs font-bold">
          <button 
            onClick={() => setFilterPeriod('TODAY')}
            className={`px-3 py-1.5 rounded-xl transition ${filterPeriod === 'TODAY' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-purple-600'}`}
          >
            Hoje
          </button>
          <button 
            onClick={() => setFilterPeriod('WEEK')}
            className={`px-3 py-1.5 rounded-xl transition ${filterPeriod === 'WEEK' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-purple-600'}`}
          >
            Esta Semana
          </button>
          <button 
            onClick={() => setFilterPeriod('MONTH')}
            className={`px-3 py-1.5 rounded-xl transition ${filterPeriod === 'MONTH' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-purple-600'}`}
          >
            Este Mês
          </button>
          <button 
            onClick={() => setFilterPeriod('ALL')}
            className={`px-3 py-1.5 rounded-xl transition ${filterPeriod === 'ALL' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-purple-600'}`}
          >
            Todas
          </button>
        </div>
      </div>

      {/* Card de Métricas do Filtro & Busca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-3">
          <Search size={18} className="text-gray-400 shrink-0 ml-2" />
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, CPF, vendedor ou Nº do cupom (ex: 000001)..."
            className="w-full text-xs font-semibold outline-none bg-transparent"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">Total Faturado no Filtro</span>
            <p className="text-xl font-black mt-0.5">{formatCurrency(totalRevenueFiltered)}</p>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl shrink-0">
            <TrendingUp size={22} className="text-white" />
          </div>
        </div>
      </div>

      {/* Tabela Principal de Vendas */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                <th className="p-4">Nº Cupom</th>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vendedor</th>
                <th className="p-4">Forma de Pagamento</th>
                <th className="p-4 text-right">Total Líquido</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-medium">
              {filteredSales.length > 0 ? (
                filteredSales.map((sale) => {
                  const isCancelled = sale.status === 'CANCELLED';
                  const saleNum = sale.saleNumber || String(sale.sequence || 1).padStart(6, '0');
                  const saleDateStr = getManausDate(sale.createdAt || sale.timestamp || sale.date).split('-').reverse().join('/');
                  const saleTimeStr = getManausTime(sale.createdAt || sale.timestamp || sale.date);

                  return (
                    <tr 
                      key={sale.id} 
                      className={`hover:bg-gray-50/80 transition ${isCancelled ? 'bg-rose-50/40 opacity-60' : ''}`}
                    >
                      <td className="p-4 font-mono font-bold text-purple-700">
                        Nº {saleNum}
                      </td>
                      <td className="p-4 text-gray-600 font-mono text-[11px]">
                        {saleDateStr} {saleTimeStr}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-gray-900 block">{sale.customerName || 'Cliente Balcão'}</span>
                        {sale.cpf && <span className="text-[10px] text-gray-400 font-mono">CPF: {sale.cpf}</span>}
                      </td>
                      <td className="p-4 text-gray-700 font-semibold">
                        {sale.sellerName || 'Loja'}
                      </td>
                      <td className="p-4">
                        {getPaymentBadge(sale.paymentMethod, sale.installments)}
                      </td>
                      <td className="p-4 text-right font-black text-sm text-gray-900">
                        {formatCurrency(sale.total || 0)}
                      </td>
                      <td className="p-4 text-center">
                        {isCancelled ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Cancelado
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Concluído
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          type="button"
                          onClick={() => setSelectedSale(sale)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs flex items-center gap-1 mx-auto transition cursor-pointer"
                        >
                          <Eye size={14} /> <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400 text-xs font-semibold">
                    Nenhuma venda encontrada no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL: DETALHES COMPLETOS DA VENDA & REIMPRESSÃO DE CUPOM TÉRMICO */}
      {/* ================================================================= */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200">
            {/* Cabeçalho */}
            <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                  Comprovante de Atendimento
                </span>
                <h3 className="font-black text-base flex items-center gap-2 mt-0.5">
                  <FileText size={18} /> Venda Nº {selectedSale.saleNumber || String(selectedSale.sequence || 1).padStart(6, '0')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSale(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo dos Detalhes */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              {/* Informações da Venda */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">Cliente</span>
                  <span className="font-bold text-gray-900 block">{selectedSale.customerName || 'Cliente Balcão'}</span>
                  {selectedSale.cpf && <span className="text-[10px] text-gray-500 font-mono">CPF: {selectedSale.cpf}</span>}
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">Vendedor(a)</span>
                  <span className="font-bold text-gray-900 block">{selectedSale.sellerName || 'Loja'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">Data / Hora</span>
                  <span className="font-mono text-gray-800 font-semibold block">
                    {getManausDate(selectedSale.createdAt || selectedSale.timestamp || selectedSale.date).split('-').reverse().join('/')} às {getManausTime(selectedSale.createdAt || selectedSale.timestamp || selectedSale.date)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">Forma de Pagamento</span>
                  <div className="mt-1">{getPaymentBadge(selectedSale.paymentMethod, selectedSale.installments)}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">Status da Venda</span>
                  <span className={`inline-block font-bold mt-1 ${selectedSale.status === 'CANCELLED' ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {selectedSale.status === 'CANCELLED' ? '⛔ Cancelada' : '✅ Concluída'}
                  </span>
                </div>
              </div>

              {/* Tabela de Peças com Grade Explícita (Tamanho / Cor) */}
              <div>
                <h4 className="font-black text-gray-900 mb-2 flex items-center gap-1.5 text-xs">
                  <ShoppingBag size={14} className="text-purple-600" />
                  Peças Compradas ({selectedSale.items?.length || 0})
                </h4>

                <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {(selectedSale.items || []).map((item, idx) => (
                    <div key={idx} className="p-3 bg-white flex justify-between items-center gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-xs leading-tight">{item.name}</p>
                        {item.selectedVariation ? (
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 inline-block mt-1">
                            Tam: {item.selectedVariation.size} — Cor: {item.selectedVariation.color}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 block mt-0.5">Tamanho Único / Padrão</span>
                        )}
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {item.quantity} un. x {formatCurrency(item.price || 0)}
                        </p>
                      </div>

                      <span className="font-black text-xs text-gray-900 shrink-0">
                        {formatCurrency((item.price || 0) * (item.quantity || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 font-semibold">
                  <span>Subtotal da Compra:</span>
                  <span>{formatCurrency(selectedSale.subtotal || 0)}</span>
                </div>

                {(selectedSale.discount || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Desconto Aplicado:</span>
                    <span>- {formatCurrency(selectedSale.discount || 0)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-purple-200">
                  <span>TOTAL PAGO:</span>
                  <span className="text-purple-900">{formatCurrency(selectedSale.total || 0)}</span>
                </div>

                {(selectedSale.change || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold pt-0.5">
                    <span>Troco Devolvido:</span>
                    <span>{formatCurrency(selectedSale.change || 0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  printer.printTicket(selectedSale, storeProfile);
                }}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> Reimprimir Cupom Térmico
              </button>

              {selectedSale.status !== 'CANCELLED' && onEditSale && (
                <button
                  type="button"
                  onClick={() => {
                    onEditSale(selectedSale);
                    setSelectedSale(null);
                  }}
                  className="py-3 px-3 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Pencil size={15} /> Editar
                </button>
              )}

              {selectedSale.status !== 'CANCELLED' && onCancelSale && (
                <button
                  type="button"
                  onClick={() => {
                    onCancelSale(selectedSale);
                    setSelectedSale(null);
                  }}
                  className="py-3 px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Undo2 size={15} /> Estornar
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
