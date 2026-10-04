import React, { useState, useMemo } from 'react';
import { Customer } from '../types';
import { 
  Search, Wallet, AlertCircle, CheckCircle2, Calendar, ChevronDown, 
  ChevronUp, Clock, AlertTriangle, Trash2, X, Calculator, CreditCard, 
  Banknote, QrCode, ArrowRight, ShieldCheck, Printer
} from 'lucide-react';
import { printer } from '../printer';

export interface CreditBill {
  id: string;
  saleId: string | number;
  customerId: string;
  customerName: string;
  customerCpf?: string;
  cpf?: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  createdAt: string;
  sellerId?: string;
  sellerName?: string;
  paymentDate?: string;
  paymentMethod?: string;
}

interface CreditManagerProps {
  customers: Customer[];
  creditBills: CreditBill[];
  onReceiveInstallment: (billId: string, paymentMethod: string, amountPaid: number) => void | Promise<void>;
  onDeleteInstallment?: (billId: string) => void | Promise<void>;
}

export const CreditManager: React.FC<CreditManagerProps> = ({ 
  customers, 
  creditBills = [], 
  onReceiveInstallment, 
  onDeleteInstallment 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<CreditBill | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MONEY' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | null>(null);
  const [cashReceived, setCashReceived] = useState('');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const getLocalDate = (dateStr: string) => { 
    const datePart = dateStr ? dateStr.substring(0, 10) : '';
    const [y, m, d] = datePart.split('-').map(Number); 
    return new Date(y, m - 1, d); 
  };

  // REGRA DE NEGÓCIO CRÍTICA:
  // APENAS parcelas do Crediário Próprio da Loja (Carnê) entram em Cobranças!
  // Crediário Parceiro BEMOL NÃO entra nesta tela.
  const storeCreditDebts = useMemo(() => {
    return creditBills;
  }, [creditBills]);

  // Clientes com Carnê (tanto ativo quanto quitado)
  const customersWithDebt = useMemo(() => {
    const customerIdsWithBills = Array.from(new Set(storeCreditDebts.map(b => b.customerId)));
    return customers.filter(c => 
      c.id !== '00' && 
      customerIdsWithBills.includes(c.id)
    );
  }, [customers, storeCreditDebts]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return customersWithDebt;
    return customersWithDebt.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.phone && c.phone.includes(term)) ||
      (c.cpf && c.cpf.includes(term))
    );
  }, [customersWithDebt, searchTerm]);

  const calculateDebtValues = (record: CreditBill) => {
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    const dueDate = getLocalDate(record.dueDate);
    let isLate = today > dueDate && record.status !== 'PAID';
    let fine = isLate ? record.amount * 0.02 : 0; // Multa 2%
    let daysLate = isLate ? Math.ceil(Math.abs(today.getTime() - dueDate.getTime()) / (86400000)) : 0;
    let interest = isLate ? record.amount * (0.01 / 30) * daysLate : 0; // Juros 1% ao mês pro-rata
    return { 
      isLate, 
      daysLate, 
      originalAmount: record.amount, 
      fine: Number(fine.toFixed(2)), 
      interest: Number(interest.toFixed(2)), 
      total: record.status === 'PAID' ? record.amount : Number((record.amount + fine + interest).toFixed(2)) 
    };
  };

  // TOTAL CARNÊ EM ABERTO: soma de todas as parcelas com status 'PENDING' ou 'OVERDUE'
  const totalStoreDebtPending = useMemo(() => {
    return storeCreditDebts
      .filter(b => b.status === 'PENDING' || b.status === 'OVERDUE')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [storeCreditDebts]);

  const handleOpenPaymentModal = (debt: CreditBill, customer: Customer) => {
    setSelectedDebt(debt);
    setSelectedCustomer(customer);
    setPaymentMethod('MONEY');
    setCashReceived('');
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedDebt || !paymentMethod || !selectedCustomer) return;
    const calc = calculateDebtValues(selectedDebt);
    
    // Dispara recebimento da parcela no Firestore
    onReceiveInstallment(selectedDebt.id, paymentMethod, calc.total);
    
    try {
      // Cria objeto compatível para impressão de recibo
      const printedRecord = {
        ...selectedDebt,
        description: `Parcela Carnê ${selectedDebt.installmentNumber}/${selectedDebt.totalInstallments} (Venda #${selectedDebt.saleId})`,
        paymentMethod
      };
      printer.printDebtReceipt(printedRecord as any, selectedCustomer, calc.total, calc);
    } catch (e) {
      console.warn("Erro ao gerar recibo de carnê:", e);
    }
    
    setPaymentModalOpen(false); 
    setSelectedDebt(null);
  };

  // Mapeamento e Estilização de Badges Coloridos das Formas de Pagamento
  const getPaymentBadge = (method: string, installments?: number) => {
    const m = (method || '').toUpperCase();
    if (m === 'PIX') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          Pix
        </span>
      );
    }
    if (m === 'MONEY' || m === 'DINHEIRO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
          Dinheiro
        </span>
      );
    }
    if (m === 'CREDIT_CARD' || m === 'CREDITO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
          Crédito {installments && installments > 1 ? `(${installments}x)` : ''}
        </span>
      );
    }
    if (m === 'DEBIT_CARD' || m === 'DEBITO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
          Débito
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
        {method}
      </span>
    );
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Cobranças & Crediário Próprio</h1>
            <span className="text-xs bg-pink-100 text-pink-800 font-bold px-2.5 py-1 rounded-full border border-pink-200">
              Carnê da Loja
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Recebimento de parcelas e juros de clientes do carnê próprio. Vendas no <strong>Crediário Parceiro BEMOL</strong> são pagas diretamente à Bemol e repassadas à loja em 25 dias no Financeiro.
          </p>
        </div>

        {/* Resumo do Carnê a Receber */}
        <div className="bg-pink-50 border border-pink-200 px-4 py-3 rounded-2xl text-right">
          <span className="text-[10px] uppercase font-bold text-pink-700 tracking-wider block">Total Carnê em Aberto</span>
          <span className="text-xl font-black text-pink-900">{formatCurrency(totalStoreDebtPending)}</span>
        </div>
      </div>

      {/* Caixa Informativa sobre a Diferenciação Bemol vs Loja */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900 shadow-sm">
        <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-blue-950">Aviso Operacional sobre o Crediário Parceiro BEMOL:</strong>
          <p className="text-blue-800 mt-0.5">
            As vendas feitas via <strong>Crediário Parceiro BEMOL</strong> não geram carnê ou cobrança para você realizar ao cliente nesta tela. A Bemol assume o risco, cobra as parcelas do cliente e realiza o repasse bancário garantido para a sua conta em exatamente <strong>25 dias</strong> (com taxa de 3% deduzida). Acompanhe esses créditos na aba <em>Financeiro & Fluxo de Caixa</em>.
          </p>
        </div>
      </div>

      {/* Busca e Lista de Devedores do Carnê */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Buscar por nome, telefone ou CPF do cliente em débito no carnê..." 
            className="w-full bg-transparent focus:outline-none text-sm text-gray-800" 
          />
        </div>

        <div className="divide-y divide-gray-100">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map(customer => {
              const customerDebts = storeCreditDebts.filter(r => r.customerId === customer.id);
              const activeDebts = customerDebts.filter(b => b.status === 'PENDING' || b.status === 'OVERDUE');
              const totalCustomerDebtActive = activeDebts.reduce((acc, curr) => acc + curr.amount, 0);
              const isExpanded = expandedCustomer === customer.id;
              const hasLate = activeDebts.some(d => calculateDebtValues(d).isLate);

              return (
                <div key={customer.id} className="transition-colors">
                  <div 
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)} 
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${hasLate ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'}`}>
                        {hasLate ? '⚠️' : '📒'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{customer.name}</h3>
                          {hasLate && (
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                              Parcela Atrasada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {customer.phone || 'Sem telefone'} • CPF: {customer.cpf || 'Não informado'} • {customerDebts.length} parcela(s) no total ({activeDebts.length} ativa(s))
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Saldo Ativo em Aberto</span>
                        <span className="font-black text-rose-600 text-lg">{formatCurrency(totalCustomerDebtActive)}</span>
                      </div>
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Parcelas em Aberto e Histórico */}
                  {isExpanded && (
                    <div className="bg-gray-50/70 p-4 sm:p-6 border-t border-gray-100 space-y-3">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Carnê e Histórico de Parcelas:
                      </h4>

                      <div className="space-y-2">
                        {customerDebts
                          .sort((a, b) => {
                            // Sort unpaid first, then by installment number
                            if (a.status === 'PAID' && b.status !== 'PAID') return 1;
                            if (a.status !== 'PAID' && b.status === 'PAID') return -1;
                            return a.installmentNumber - b.installmentNumber;
                          })
                          .map(debt => {
                            const calc = calculateDebtValues(debt);
                            const isPaid = debt.status === 'PAID';

                            return (
                              <div key={debt.id} className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-sm">
                                      Parcela {debt.installmentNumber}/{debt.totalInstallments} (Venda #{debt.saleId})
                                    </span>
                                    {isPaid ? (
                                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                        ✓ PAGO ({getPaymentBadge(debt.paymentMethod || 'MONEY')})
                                      </span>
                                    ) : calc.isLate ? (
                                      <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                                        ATRASADA ({calc.daysLate} dias)
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                        Pendente
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                    <span>Vencimento: <strong>{new Date(debt.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
                                    <span>Valor Original: <strong>{formatCurrency(calc.originalAmount)}</strong></span>
                                    {!isPaid && calc.fine > 0 && <span className="text-rose-600 font-bold">Multa (2%): +{formatCurrency(calc.fine)}</span>}
                                    {!isPaid && calc.interest > 0 && <span className="text-rose-600 font-bold">Juros (1% a.m): +{formatCurrency(calc.interest)}</span>}
                                    {isPaid && debt.paymentDate && (
                                      <span className="text-emerald-700 font-medium">Pago em: <strong>{new Date(debt.paymentDate).toLocaleDateString('pt-BR')}</strong></span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                  {onDeleteInstallment && (
                                    <button 
                                      onClick={() => onDeleteInstallment(debt.id)} 
                                      title="Excluir Parcela"
                                      className="p-2.5 text-gray-400 hover:text-rose-600 border border-gray-200 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                  {!isPaid && (
                                    <button 
                                      onClick={() => handleOpenPaymentModal(debt, customer)} 
                                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <Banknote size={16} /> Receber Parcela ({formatCurrency(calc.total)})
                                    </button>
                                  )}
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
          ) : (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 opacity-60" />
              <p className="font-bold text-gray-600 text-base">Nenhum carnê ou parcela registrada no crediário.</p>
              <p className="text-xs text-gray-400">Todos os carnês quitados ou em dia.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pagamento de Parcela */}
      {paymentModalOpen && selectedDebt && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 lg:p-8 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">Receber Parcela de Carnê</h3>
                <p className="text-xs text-gray-500">Cliente: <strong>{selectedCustomer.name}</strong></p>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Detalhes com Juros e Multas */}
            {(() => {
              const calc = calculateDebtValues(selectedDebt);
              const numericReceived = parseFloat(cashReceived.replace(',', '.')) || 0;
              const change = Math.max(0, numericReceived - calc.total);

              return (
                <>
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-xs border border-gray-100">
                    <div className="flex justify-between text-gray-600">
                      <span>Valor Original da Parcela:</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calc.originalAmount)}</span>
                    </div>
                    {calc.fine > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Multa por Atraso (2%):</span>
                        <span className="font-bold">+{formatCurrency(calc.fine)}</span>
                      </div>
                    )}
                    {calc.interest > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Juros de Mora (1% a.m.):</span>
                        <span className="font-bold">+{formatCurrency(calc.interest)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                      <span>Total a Cobrar:</span>
                      <span className="text-emerald-700">{formatCurrency(calc.total)}</span>
                    </div>
                  </div>

                  {/* Forma de Recebimento no Caixa */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 block">Forma de Recebimento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'MONEY', label: '💵 Dinheiro' },
                        { id: 'PIX', label: '⚡ PIX' },
                        { id: 'DEBIT_CARD', label: '💳 Cartão Débito' },
                        { id: 'CREDIT_CARD', label: '💳 Cartão Crédito' }
                      ].map(m => (
                        <button 
                          key={m.id} 
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)} 
                          className={`p-3 border rounded-2xl text-xs font-bold transition-all text-center cursor-pointer ${
                            paymentMethod === m.id 
                              ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-sm font-black' 
                              : 'bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo de Troco para Dinheiro */}
                  {paymentMethod === 'MONEY' && (
                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-bold text-gray-700 block">Valor Entregue pelo Cliente</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 100,00" 
                        value={cashReceived} 
                        onChange={e => setCashReceived(e.target.value)} 
                        className="w-full p-3 border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-purple-500 bg-white" 
                        autoFocus
                      />
                      {numericReceived > calc.total && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between text-emerald-800 text-xs font-bold">
                          <span>Troco a devolver:</span>
                          <span className="text-sm">{formatCurrency(change)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button 
                      type="button" 
                      onClick={() => setPaymentModalOpen(false)} 
                      className="flex-1 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      onClick={handleConfirmPayment} 
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckCircle2 size={16} /> Confirmar & Imprimir Recibo
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManager;
