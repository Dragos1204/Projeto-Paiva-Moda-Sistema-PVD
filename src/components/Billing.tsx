
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
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<FinancialRecord | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MONEY' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'BEMOL' | null>(null);
  const [cashReceived, setCashReceived] = useState('');

  const getLocalDate = (dateStr: string) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d); };
  const customersWithDebt = customers.filter(c => c.id !== '00' && financialRecords.some(r => r.customerId === c.id && r.status === 'PENDING' && r.type === 'INCOME'));
  const filteredCustomers = customersWithDebt.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));

  const calculateDebtValues = (record: FinancialRecord) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const dueDate = getLocalDate(record.dueDate);
    let isLate = today > dueDate;
    let fine = isLate ? record.amount * 0.02 : 0;
    let daysLate = isLate ? Math.ceil(Math.abs(today.getTime() - dueDate.getTime()) / (86400000)) : 0;
    let interest = isLate ? record.amount * (0.01 / 30) * daysLate : 0;
    return { isLate, daysLate, originalAmount: record.amount, fine, interest, total: record.amount + fine + interest };
  };

  const handleConfirmPayment = () => {
      if (!selectedDebt || !paymentMethod || !selectedCustomer) return;
      const calc = calculateDebtValues(selectedDebt);
      onReceiveDebt(selectedDebt, calc.total, paymentMethod);
      printer.printDebtReceipt({ ...selectedDebt, paymentMethod }, selectedCustomer, calc.total, calc);
      setPaymentModalOpen(false); setSelectedDebt(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Cobranças</h1><p className="text-gray-500">Gestão de dívidas.</p></div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50"><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar cliente..." className="w-full p-2 border rounded" /></div>
        <div className="divide-y divide-gray-100">
           {filteredCustomers.map(customer => {
              const customerDebts = financialRecords.filter(r => r.customerId === customer.id && r.status === 'PENDING');
              const isExpanded = expandedCustomer === customer.id;
              return (
                 <div key={customer.id}>
                    <div onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)} className="p-4 flex justify-between cursor-pointer hover:bg-gray-50">
                       <h3 className="font-bold">{customer.name}</h3><div className="font-bold text-red-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(customerDebts.reduce((acc,curr)=>acc+curr.amount,0))}</div>
                    </div>
                    {isExpanded && (
                       <div className="bg-gray-50 p-4 space-y-3">
                          {customerDebts.map(debt => {
                             const calc = calculateDebtValues(debt);
                             return (
                                <div key={debt.id} className="bg-white p-4 rounded border flex justify-between items-center">
                                   <div><span className="font-bold">{debt.description}</span> {calc.isLate && <span className="text-red-600 text-xs font-bold">ATRASADO ({calc.daysLate}d)</span>}</div>
                                   <div className="flex gap-2">
                                      {onDeleteDebt && <button onClick={() => onDeleteDebt(debt)} className="p-2 text-red-600 border rounded"><Trash2 size={16} /></button>}
                                      <button onClick={() => { setSelectedDebt(debt); setSelectedCustomer(customer); setPaymentModalOpen(true); }} className="px-4 py-2 bg-green-600 text-white rounded">Receber {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.total)}</button>
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    )}
                 </div>
              );
           })}
        </div>
      </div>
      {paymentModalOpen && selectedDebt && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-bold">Receber Pagamento</h3>
                  <div className="grid grid-cols-2 gap-2">{['MONEY','PIX','DEBIT_CARD','CREDIT_CARD','BEMOL'].map(m=><button key={m} onClick={()=>setPaymentMethod(m as any)} className={`p-2 border rounded ${paymentMethod===m?'bg-blue-100 border-blue-500':''}`}>{m}</button>)}</div>
                  {paymentMethod === 'MONEY' && <input type="number" placeholder="Valor entregue" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} className="w-full p-2 border rounded" />}
                  <div className="flex gap-2"><button onClick={()=>setPaymentModalOpen(false)} className="flex-1 py-2 border rounded">Cancelar</button><button onClick={handleConfirmPayment} className="flex-1 py-2 bg-green-600 text-white rounded">Confirmar</button></div>
              </div>
          </div>
      )}
    </div>
  );
};
