
import React, { useState } from 'react';
import { Sale } from '../types';
import { Search, Eye, X, Tag, FileText, Undo2, Printer, Pencil, TrendingUp } from 'lucide-react';
import { printer } from '../printer';

interface SalesHistoryProps {
  sales: Sale[];
  onCancelSale?: (sale: Sale) => void;
  onEditSale?: (sale: Sale) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onCancelSale, onEditSale }) => {
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('TODAY');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter Logic
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const now = new Date();
    
    // Period Filter
    let matchesPeriod = true;
    if (filterPeriod === 'TODAY') {
      matchesPeriod = sale.date === now.toISOString().split('T')[0];
    } else if (filterPeriod === 'MONTH') {
      matchesPeriod = saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    } else if (filterPeriod === 'YEAR') {
      matchesPeriod = saleDate.getFullYear() === now.getFullYear();
    } else if (filterPeriod === 'WEEK') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      matchesPeriod = saleDate >= oneWeekAgo;
    }

    const matchesSearch = 
      sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      sale.id.toString().includes(searchTerm) ||
      (sale.sequence && sale.sequence.toString().includes(searchTerm));

    return matchesPeriod && matchesSearch;
  });

  const totalFiltered = filteredSales
    .filter(s => s.status !== 'CANCELLED')
    .reduce((acc, curr) => acc + curr.total, 0);

  const getPaymentLabel = (method: string, installments?: number) => {
    switch (method) {
      case 'MONEY': return 'Dinheiro';
      case 'CREDIT_CARD': return `Crédito ${installments && installments > 1 ? `(${installments}x)` : '(À vista)'}`;
      case 'DEBIT_CARD': return 'Débito';
      case 'PIX': return 'Pix';
      case 'BEMOL': return 'Bemol';
      case 'STORE_CREDIT': return 'Crediário Loja';
      default: return method;
    }
  };

  const handleCancelClick = () => {
    if (!selectedSale || !onCancelSale) return;
    onCancelSale(selectedSale);
    setSelectedSale(null);
  };

  const handleEditClick = () => {
    if (!selectedSale || !onEditSale) return;
    onEditSale(selectedSale);
    setSelectedSale(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Histórico de Vendas</h1>
          <p className="text-gray-500">Relatório detalhado de transações e devoluções.</p>
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
           <button onClick={() => setFilterPeriod('TODAY')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterPeriod === 'TODAY' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}>Hoje</button>
           <button onClick={() => setFilterPeriod('WEEK')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterPeriod === 'WEEK' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}>Semana</button>
           <button onClick={() => setFilterPeriod('MONTH')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterPeriod === 'MONTH' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}>Mês</button>
           <button onClick={() => setFilterPeriod('YEAR')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterPeriod === 'YEAR' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}>Ano</button>
           <button onClick={() => setFilterPeriod('ALL')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterPeriod === 'ALL' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}>Tudo</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, ID ou Nº Sequencial..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="text-sm font-bold text-gray-700">
             Total (Válido): <span className="text-green-600 ml-1 text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFiltered)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Nº Venda</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Pagamento</th>
                <th className="px-6 py-4 text-right">Total (R$)</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className={`hover:bg-gray-50 transition-colors ${sale.status === 'CANCELLED' ? 'opacity-60 bg-red-50' : ''}`}>
                   <td className="px-6 py-4">
                     {sale.status === 'CANCELLED' ? (
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                         Cancelada
                       </span>
                     ) : (
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                         Concluída
                       </span>
                     )}
                   </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    <div className="flex flex-col">
                       <span className="font-medium text-gray-900">{new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                       <span className="text-xs text-gray-500">{new Date(sale.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-800">
                     #{String(sale.sequence || sale.id).padStart(6, '0')}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {sale.customerName}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold border
                      ${sale.paymentMethod === 'MONEY' ? 'bg-green-50 text-green-700 border-green-200' : 
                        (sale.paymentMethod === 'CREDIT_CARD' || sale.paymentMethod === 'DEBIT_CARD') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        sale.paymentMethod === 'PIX' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                        'bg-orange-50 text-orange-700 border-orange-200'
                      }
                    `}>
                      {getPaymentLabel(sale.paymentMethod, sale.installments)}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${sale.status === 'CANCELLED' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Ver Detalhes"
                    >
                      <Eye size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                   <td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma venda encontrada no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className={`p-5 border-b border-gray-100 flex justify-between items-center ${selectedSale.status === 'CANCELLED' ? 'bg-red-50' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-bold ${selectedSale.status === 'CANCELLED' ? 'text-red-700' : 'text-gray-800'}`}>
                {selectedSale.status === 'CANCELLED' ? 'Venda Cancelada' : `Venda #${String(selectedSale.sequence || selectedSale.id).padStart(6, '0')}`}
              </h3>
              <button 
                onClick={() => setSelectedSale(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} /> 
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                 <div>
                    <span className="block text-gray-500">Cliente</span>
                    <span className="font-semibold text-gray-800">{selectedSale.customerName}</span>
                 </div>
                 <div>
                    <span className="block text-gray-500">Data</span>
                    <span className="font-semibold text-gray-800">{new Date(selectedSale.timestamp).toLocaleString('pt-BR')}</span>
                 </div>
                 <div>
                    <span className="block text-gray-500">Pagamento</span>
                    <span className="font-semibold text-gray-800">{getPaymentLabel(selectedSale.paymentMethod, selectedSale.installments)}</span>
                 </div>
                 <div>
                    <span className="block text-gray-500">Status</span>
                    <span className={`font-semibold ${selectedSale.status === 'CANCELLED' ? 'text-red-600' : 'text-green-600'}`}>
                       {selectedSale.status === 'CANCELLED' ? 'CANCELADA / ESTORNADA' : 'Concluída'}
                    </span>
                 </div>
              </div>

              <div className="border rounded-lg border-gray-100 overflow-hidden">
                 <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                       <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-center">Qtd</th>
                          <th className="px-3 py-2 text-right">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {selectedSale.items.map((item, idx) => (
                          <tr key={idx}>
                             <td className="px-3 py-2 text-gray-800">{item.name}</td>
                             <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                             <td className="px-3 py-2 text-right font-medium">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedSale.subtotal)}</span>
                 </div>
                 {selectedSale.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                       <span className="flex items-center gap-1"><Tag size={12}/> Desconto</span>
                       <span className="font-medium">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedSale.discount)}</span>
                    </div>
                 )}
                 {selectedSale.interestAndFines && selectedSale.interestAndFines > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                       <span className="flex items-center gap-1"><TrendingUp size={12}/> Juros/Multas Recebidos</span>
                       <span className="font-medium">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedSale.interestAndFines)}</span>
                    </div>
                 )}
                 <div className={`flex justify-between text-lg font-bold pt-2 ${selectedSale.status === 'CANCELLED' ? 'text-gray-500 line-through' : 'text-purple-900'}`}>
                    <span>Total Final</span>
                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedSale.total)}</span>
                 </div>
              </div>

              {selectedSale.observation && (
                 <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                    <span className="flex items-center gap-1 font-bold text-yellow-700 mb-1"><FileText size={14} /> Observação:</span>
                    <p className="text-yellow-800">{selectedSale.observation}</p>
                 </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
               {selectedSale.status !== 'CANCELLED' && (
                  <button 
                     onClick={() => printer.printTicket(selectedSale)}
                     className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-purple-200 text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition-colors shadow-sm"
                  >
                     <Printer size={18} />
                     Imprimir Comprovante
                  </button>
               )}

               {selectedSale.status !== 'CANCELLED' && onEditSale && (
                  <button 
                     onClick={handleEditClick}
                     className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-blue-200 text-blue-600 font-bold rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
                  >
                     <Pencil size={18} />
                     Editar / Reabrir Venda
                  </button>
               )}

               {selectedSale.status !== 'CANCELLED' && onCancelSale && (
                  <button 
                     onClick={handleCancelClick}
                     className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                  >
                     <Undo2 size={18} />
                     Cancelar Venda e Estornar
                  </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};