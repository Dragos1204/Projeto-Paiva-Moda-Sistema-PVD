
import React, { useState } from 'react';
import { Customer, FinancialRecord } from '../types';
import { Search, Wallet, AlertCircle, CheckCircle2, Calendar, ChevronDown, ChevronUp, Clock, AlertTriangle, Trash2, X, Calculator, CreditCard, Banknote, QrCode, Store } from 'lucide-react';
import { printer } from '../printer';

interface BillingProps {
  customers: Customer[];
  financialRecords: FinancialRecord[];
  onReceiveDebt: (record: FinancialRecord, totalReceived: number, paymentMethod: string) => void;
  onDeleteDebt?: (record: FinancialRecord) => void;
}

export const Billing: React.FC<BillingProps> = ({ customers, financialRecords, onReceiveDebt, onDeleteDebt }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<FinancialRecord | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MONEY' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'BEMOL' | null>(null);
  const [cashReceived, setCashReceived] = useState('');

  // Helper date function
  const getLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // Local date
  };

  // 1. Filter customers who have pending debts
  const customersWithDebt = customers.filter(c => {
    if (c.id === '00') return false; // Skip unidentified
    const debts = financialRecords.filter(r => 
        r.customerId === c.id && 
        r.status === 'PENDING' && 
        r.type === 'INCOME'
    );
    return debts.length > 0;
  });

  // 2. Filter by search
  const filteredCustomers = customersWithDebt.filter(c => 
     c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.phone.includes(searchTerm)
  );

  // 3. Calculation Logic for Interest/Fine
  const calculateDebtValues = (record: FinancialRecord) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = getLocalDate(record.dueDate);
    
    let isLate = today > dueDate;
    let fine = 0; // Multa 2%
    let interest = 0; // Juros 1% a.m.
    let daysLate = 0;

    if (isLate) {
       const diffTime = Math.abs(today.getTime() - dueDate.getTime());
       daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       
       fine = record.amount * 0.02; // 2% Fixed
       // 1% per month = 0.01 / 30 per day
       const dailyInterestRate = 0.01 / 30;
       interest = record.amount * dailyInterestRate * daysLate;
    }

    return {
        isLate,
        daysLate,
        originalAmount: record.amount,
        fine,
        interest,
        total: record.amount + fine + interest
    };
  };

  const handleOpenPaymentModal = (debt: FinancialRecord, customer: Customer) => {
      setSelectedDebt(debt);
      setSelectedCustomer(customer);
      setPaymentMethod(null);
      setCashReceived('');
      setPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
      if (!selectedDebt || !paymentMethod || !selectedCustomer) return;
      
      const calc = calculateDebtValues(selectedDebt);
      const totalToPay = calc.total;
      
      // Validation for Cash
      if (paymentMethod === 'MONEY') {
          const cash = parseFloat(cashReceived.replace(',', '.') || '0');
          if (cash < totalToPay) {
              alert('Valor recebido insuficiente.');
              return;
          }
      }

      onReceiveDebt(selectedDebt, totalToPay, paymentMethod);
      
      // Print Receipt
      const recordWithMethod = { ...selectedDebt, paymentMethod };
      printer.printDebtReceipt(recordWithMethod, selectedCustomer, totalToPay, calc);

      setPaymentModalOpen(false);
      setSelectedDebt(null);
      setSelectedCustomer(null);
  };

  // Render Modal Calculation
  let modalCalc = null;
  let changeAmount = 0;
  if (selectedDebt) {
      modalCalc = calculateDebtValues(selectedDebt);
      if (paymentMethod === 'MONEY') {
          const cash = parseFloat(cashReceived.replace(',', '.') || '0');
          changeAmount = Math.max(0, cash - modalCalc.total);
      }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cobranças e Crediário</h1>
          <p className="text-gray-500">Gestão de dívidas, multas e juros de clientes.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Buscar cliente por nome ou telefone..." 
               className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
             />
           </div>
        </div>

        <div className="divide-y divide-gray-100">
           {filteredCustomers.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                 <Wallet size={48} className="mx-auto mb-3 opacity-20" />
                 <p>Nenhum cliente com pendências encontrado.</p>
              </div>
           ) : (
              filteredCustomers.map(customer => {
                 const customerDebts = financialRecords.filter(r => r.customerId === customer.id && r.status === 'PENDING');
                 const totalDebt = customerDebts.reduce((acc, curr) => acc + curr.amount, 0);
                 const isExpanded = expandedCustomer === customer.id;

                 return (
                    <div key={customer.id} className="group transition-colors hover:bg-gray-50">
                       <div 
                         onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                         className="p-4 flex items-center justify-between cursor-pointer"
                       >
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                                {customer.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className="font-bold text-gray-800">{customer.name}</h3>
                                <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                             <div className="text-right">
                                <p className="text-xs text-gray-500">Total Devido (Origem)</p>
                                <p className="text-lg font-bold text-red-600">
                                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDebt)}
                                </p>
                             </div>
                             <div className="text-gray-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                             </div>
                          </div>
                       </div>

                       {isExpanded && (
                          <div className="bg-gray-50 p-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                             <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Faturas em Aberto</h4>
                             <div className="space-y-3">
                                {customerDebts.map(debt => {
                                   const calc = calculateDebtValues(debt);
                                   
                                   return (
                                      <div key={debt.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-center">
                                         <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                               <span className="font-bold text-gray-800">{debt.description}</span>
                                               {calc.isLate ? (
                                                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">
                                                     <AlertTriangle size={10} /> ATRASADO ({calc.daysLate} dias)
                                                  </span>
                                               ) : (
                                                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">
                                                     <Clock size={10} /> Em dia
                                                  </span>
                                               )}
                                            </div>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                               <Calendar size={12} /> Vencimento: {new Date(debt.dueDate).toLocaleDateString('pt-BR')}
                                            </p>
                                         </div>

                                         <div className="flex gap-4 text-sm text-right">
                                            <div>
                                               <p className="text-xs text-gray-400">Valor Original</p>
                                               <p className="font-medium text-gray-700">
                                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.originalAmount)}
                                               </p>
                                            </div>
                                            {calc.isLate && (
                                               <>
                                                  <div>
                                                     <p className="text-xs text-gray-400">Multa (2%)</p>
                                                     <p className="font-medium text-red-600">
                                                        + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.fine)}
                                                     </p>
                                                  </div>
                                                  <div>
                                                     <p className="text-xs text-gray-400">Juros (1% a.m)</p>
                                                     <p className="font-medium text-red-600">
                                                        + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.interest)}
                                                     </p>
                                                  </div>
                                               </>
                                            )}
                                            <div className="pl-4 border-l border-gray-200">
                                               <p className="text-xs text-gray-400 font-bold">Total a Pagar</p>
                                               <p className="font-bold text-lg text-purple-700">
                                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.total)}
                                               </p>
                                            </div>
                                         </div>

                                         <div className="flex gap-2">
                                            {onDeleteDebt && (
                                                <button 
                                                    onClick={() => onDeleteDebt(debt)}
                                                    className="p-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Excluir Dívida (Estornar)"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleOpenPaymentModal(debt, customer)}
                                                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <CheckCircle2 size={16} /> Receber
                                            </button>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                    </div>
                 );
              })
           )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && selectedDebt && modalCalc && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <div>
                          <h3 className="text-lg font-bold text-gray-800">Receber Pagamento</h3>
                          <p className="text-xs text-gray-500">{selectedDebt.description}</p>
                      </div>
                      <button onClick={() => setPaymentModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>

                  <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                      <div className="bg-purple-50 p-4 rounded-xl text-center">
                          <p className="text-sm text-gray-500">Total a Receber (Atualizado)</p>
                          <p className="text-3xl font-bold text-purple-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(modalCalc.total)}
                          </p>
                          {modalCalc.isLate && (
                              <p className="text-xs text-red-500 font-bold mt-1">
                                  Inclui Multa e Juros ({modalCalc.daysLate} dias de atraso)
                              </p>
                          )}
                      </div>

                      <div>
                          <p className="text-sm font-medium text-gray-700 mb-3">Forma de Pagamento</p>
                          <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setPaymentMethod('MONEY')} className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${paymentMethod === 'MONEY' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                  <Banknote size={20} /> <span className="text-xs font-bold">Dinheiro</span>
                              </button>
                              <button onClick={() => setPaymentMethod('PIX')} className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${paymentMethod === 'PIX' ? 'bg-teal-50 border-teal-500 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                  <QrCode size={20} /> <span className="text-xs font-bold">Pix</span>
                              </button>
                              <button onClick={() => setPaymentMethod('DEBIT_CARD')} className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${paymentMethod === 'DEBIT_CARD' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                  <CreditCard size={20} /> <span className="text-xs font-bold">Débito</span>
                              </button>
                              <button onClick={() => setPaymentMethod('CREDIT_CARD')} className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${paymentMethod === 'CREDIT_CARD' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                  <CreditCard size={20} /> <span className="text-xs font-bold">Crédito</span>
                              </button>
                              <button onClick={() => setPaymentMethod('BEMOL')} className={`p-3 rounded-lg border flex flex-col items-center gap-1 col-span-2 ${paymentMethod === 'BEMOL' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                  <Store size={20} /> <span className="text-xs font-bold">Bemol</span>
                              </button>
                          </div>
                      </div>

                      {paymentMethod === 'MONEY' && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                              <div className="flex items-center gap-2 text-gray-700 font-medium text-sm mb-2">
                                  <Calculator size={16} /> Troco
                              </div>
                              <div className="relative mb-2">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                  <input 
                                      type="number"
                                      value={cashReceived}
                                      onChange={(e) => setCashReceived(e.target.value)}
                                      className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                                      placeholder="0,00"
                                  />
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-500">Troco:</span>
                                  <span className={`font-bold text-lg ${changeAmount >= 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(changeAmount)}
                                  </span>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                      <button onClick={() => setPaymentModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancelar</button>
                      <button 
                          onClick={handleConfirmPayment}
                          disabled={!paymentMethod || (paymentMethod === 'MONEY' && parseFloat(cashReceived || '0') < modalCalc.total)}
                          className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                          Confirmar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
