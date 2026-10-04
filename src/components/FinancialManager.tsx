import React, { useState, useRef } from 'react';
import { FinancialRecord, FinancialType, FinancialStatus } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, Plus, X, 
  DollarSign, Calendar, WalletCards, Building2, FileSpreadsheet, Filter,
  Store, TrendingUp, AlertTriangle, Calculator, Sparkles, Pencil, Trash2
} from 'lucide-react';
import { db } from '../database';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from './ConfirmModal';

const sanitize = (obj: any): any => JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));

interface FinancialProps {
  records: FinancialRecord[];
  setRecords: React.Dispatch<React.SetStateAction<FinancialRecord[]>>;
}

export const Financial: React.FC<FinancialProps> = ({ records, setRecords }) => {
  const toast = useToast();
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'BEMOL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isSavingExpenseRef = useRef(false);

  const getLocalDateString = () => { 
    const d = new Date(); 
    const offset = d.getTimezoneOffset() * 60000; 
    const local = new Date(d.getTime() - offset); 
    return local.toISOString().split('T')[0]; 
  };

  const [formData, setFormData] = useState<Partial<FinancialRecord>>({ 
    description: '', 
    amount: 0, 
    type: 'EXPENSE', 
    category: 'Aluguel & Condomínio', 
    dueDate: getLocalDateString(), 
    status: 'PENDING' 
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  React.useEffect(() => {
    const today = getLocalDateString();
    records.forEach(async (r) => {
      if (r.paymentMethod === 'BEMOL' && r.status === 'PENDING' && r.dueDate && r.dueDate <= today) {
        const autoPaid: FinancialRecord = {
          ...r,
          status: 'PAID',
          paymentDate: r.dueDate
        };
        setRecords(prev => prev.map(item => item.id === r.id ? autoPaid : item));
        await db.save('financials', autoPaid);
      }
    });
  }, [records, setRecords]);

  const filteredRecords = records.filter(r => {
    if (filterType === 'INCOME' && r.type !== 'INCOME') return false;
    if (filterType === 'EXPENSE' && r.type !== 'EXPENSE') return false;
    if (filterType === 'BEMOL' && r.paymentMethod !== 'BEMOL') return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    return true;
  });

  const toggleStatus = async (id: any) => { 
    const today = getLocalDateString(); 
    const record = records.find(r => r.id === id);
    if (!record) return;

    const newStatus = record.status === 'PAID' || record.status === 'COMPLETED' ? 'PENDING' : 'PAID';
    const updated: FinancialRecord = { 
      ...record, 
      status: newStatus, 
      paymentDate: newStatus === 'PAID' ? today : undefined 
    };

    setRecords(records.map(r => r.id === id ? updated : r));
    await db.save('financials', updated);
  };

  const handleOpenNewModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      description: '', 
      amount: 0, 
      type: 'EXPENSE', 
      category: 'Aluguel & Condomínio', 
      dueDate: getLocalDateString(), 
      status: 'PENDING' 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: FinancialRecord) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      description: item.description,
      amount: item.amount,
      type: item.type,
      category: item.category,
      dueDate: item.dueDate || getLocalDateString(),
      status: item.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (item: FinancialRecord) => {
    if (!item.id) return;
    setRecordToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!recordToDelete || !recordToDelete.id) return;
    const targetId = String(recordToDelete.id);

    // 1. Fecha o modal imediatamente (Zero delay, some na hora!)
    setDeleteModalOpen(false);
    setRecordToDelete(null);
    setIsDeleting(false);

    // 2. Remove do estado local imediatamente (otimista)
    setRecords(prev => prev.filter(f => String(f.id) !== targetId));

    // 3. Feedback instantâneo
    toast.success("Lançamento Excluído", "O registro foi removido com sucesso.");

    // 4. Exclusão assíncrona no Firestore em segundo plano
    db.delete('financials', targetId).catch(err => {
      console.error("Erro ao excluir lançamento:", err);
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (isSavingExpenseRef.current) return;
    isSavingExpenseRef.current = true;

    const recordId = isEditing ? editingId! : `fin_exp_${Date.now()}`;
    const expenseEntry: FinancialRecord = { 
      id: recordId, 
      description: (formData.description || '').trim(), 
      amount: Number(formData.amount), 
      type: (formData.type || 'EXPENSE') as any, 
      category: formData.category || 'Despesas Gerais', 
      dueDate: formData.dueDate || getLocalDateString(), 
      status: (formData.status || 'PENDING') as any, 
      paymentDate: formData.status === 'PAID' ? (formData.dueDate || getLocalDateString()) : undefined 
    }; 

    setIsModalOpen(false); 

    setFormData({ 
      description: '', 
      amount: 0, 
      type: 'EXPENSE', 
      category: 'Aluguel & Condomínio', 
      dueDate: getLocalDateString(), 
      status: 'PENDING' 
    });

    if (isEditing) {
      setRecords(prev => prev.map(f => f.id === editingId ? expenseEntry : f));
    } else {
      setRecords(prev => [expenseEntry, ...prev]);
    }

    toast.success("Lançamento Salvo", "Lançamento registrado com sucesso!");

    db.save('financials', sanitize(expenseEntry))
      .catch(err => {
        console.error("Erro ao salvar lançamento manual no Firestore:", err);
        toast.error("Erro ao Sincronizar", "Erro ao gravar no banco em segundo plano.");
      })
      .finally(() => {
        isSavingExpenseRef.current = false;
      });
  };

  const realizedBalance = records
    .filter(f => (f.status as string) === 'COMPLETED' || f.status === 'PAID')
    .reduce((acc, f) => acc + (f.type === 'INCOME' ? f.amount : -f.amount), 0);

  const futureReceivables = records
    .filter(f => f.status === 'PENDING' && f.type === 'INCOME')
    .reduce((acc, f) => acc + f.amount, 0);

  const pendingPayables = records
    .filter(f => f.status === 'PENDING' && f.type === 'EXPENSE')
    .reduce((acc, f) => acc + f.amount, 0);

  const projectedBalance = realizedBalance + futureReceivables - pendingPayables;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Financeiro & Fluxo de Caixa</h1>
          <p className="text-xs text-gray-500">Contas a pagar de fornecedores (NFe), receitas, Crediário Parceiro Bemol e saldo projetado.</p>
        </div>
        <button 
          onClick={handleOpenNewModal} 
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/20 transition cursor-pointer"
        >
          <Plus size={16} /> Novo Lançamento Manual
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saldo Líquido Realizado</span>
          <p className={`text-2xl font-black mt-1 ${realizedBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatCurrency(realizedBalance)}
          </p>
          <span className="text-[11px] text-gray-400 mt-1">Entradas pagas - Saídas quitadas</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">A Receber Futuro (Projetado)</span>
          <p className="text-2xl font-black text-purple-700 mt-1">{formatCurrency(futureReceivables)}</p>
          <span className="text-[11px] text-purple-700 font-semibold mt-1">Crediário Parceiro Bemol + Carnê Loja</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contas a Pagar (Pendentes)</span>
          <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(pendingPayables)}</p>
          <span className="text-[11px] text-red-500 font-semibold mt-1">Boletos de fornecedores & despesas</span>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-5 rounded-3xl shadow-md text-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">Saldo Projetado Final</span>
            <Sparkles size={14} className="text-purple-300" />
          </div>
          <p className={`text-2xl font-black mt-1 ${projectedBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {formatCurrency(projectedBalance)}
          </p>
          <span className="text-[11px] text-purple-200 opacity-90 mt-1">Realizado + A Receber - Contas a Pagar</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs font-bold">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter size={14} className="text-gray-400 mr-1" />
          <button 
            onClick={() => setFilterType('ALL')} 
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === 'ALL' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Todos os Títulos
          </button>
          <button 
            onClick={() => setFilterType('INCOME')} 
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === 'INCOME' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Receitas
          </button>
          <button 
            onClick={() => setFilterType('EXPENSE')} 
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === 'EXPENSE' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Despesas / Contas
          </button>
          <button 
            onClick={() => setFilterType('BEMOL')} 
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === 'BEMOL' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Crediário Parceiro Bemol
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setStatusFilter('ALL')} 
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'ALL' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setStatusFilter('PENDING')} 
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'PENDING' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}
          >
            Pendentes
          </button>
          <button 
            onClick={() => setStatusFilter('PAID')} 
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'PAID' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
          >
            Liquidados
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-gray-900 text-sm">Extrato Consolidado & Lançamentos</h2>
          <span className="text-xs text-gray-400 font-semibold">{filteredRecords.length} registros encontrados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="p-4">Data / Vencimento</th>
                <th className="p-4">Tipo & Categoria</th>
                <th className="p-4">Descrição / Histórico</th>
                <th className="p-4 text-right">Valor (R$)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map(item => {
                const isPaid = item.status === 'PAID' || item.status === 'COMPLETED';
                const isExpense = item.type === 'EXPENSE';
                return (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 font-mono text-gray-600">
                      {item.dueDate ? item.dueDate.split('-').reverse().join('/') : (item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '-')}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                        isExpense ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {isExpense ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                        <span>{item.category || (isExpense ? 'Despesa' : 'Receita')}</span>
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-900">
                      {item.description}
                      {item.saleNumber && <span className="block text-[10px] font-normal text-purple-600">Venda PDV #{item.saleNumber}</span>}
                    </td>
                    <td className={`p-4 text-right font-black text-sm ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isExpense ? '-' : '+'}{formatCurrency(item.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isPaid ? 'LIQUIDADO' : 'PENDENTE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleStatus(item.id)}
                          className={`p-2 rounded-xl transition cursor-pointer ${
                            isPaid ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={isPaid ? 'Marcar como Pendente' : 'Liquidar / Pagar'}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                          title="Editar Lançamento"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                          title="Excluir Lançamento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 text-xs">
                    Nenhum lançamento financeiro encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-base">
                  {isEditing ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Controle manual de contas, despesas e receitas</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tipo de Lançamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE', category: 'Aluguel & Condomínio' })}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      formData.type === 'EXPENSE' ? 'bg-rose-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Saída / Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INCOME', category: 'Venda Manual' })}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      formData.type === 'INCOME' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Entrada / Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Descrição / Histórico</label>
                <input 
                  type="text" 
                  required 
                  value={formData.description || ''} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  placeholder="Ex: Aluguel da Loja, Compra de Embalagens..." 
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={formData.amount || ''} 
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} 
                    placeholder="0.00" 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vencimento / Data</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.dueDate || ''} 
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Categoria</label>
                <select 
                  value={formData.category || ''} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })} 
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {formData.type === 'EXPENSE' ? (
                    <>
                      <option value="Aluguel & Condomínio">Aluguel & Condomínio</option>
                      <option value="Fornecedores / NFe">Fornecedores / NFe</option>
                      <option value="Energia & Água">Energia & Água</option>
                      <option value="Internet & Telefone">Internet & Telefone</option>
                      <option value="Salários & Encargos">Salários & Encargos</option>
                      <option value="Marketing & Anúncios">Marketing & Anúncios</option>
                      <option value="Despesas Gerais">Despesas Gerais</option>
                    </>
                  ) : (
                    <>
                      <option value="Venda Manual">Venda Manual</option>
                      <option value="Aporte de Capital">Aporte de Capital</option>
                      <option value="Outras Receitas">Outras Receitas</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Status Inicial</label>
                <select 
                  value={formData.status || 'PENDING'} 
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })} 
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="PENDING">Pendente (A Pagar / Receber)</option>
                  <option value="PAID">Liquidado / Quitado</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Confirm Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja excluir a despesa "${recordToDelete?.description || ''}" no valor de ${formatCurrency(recordToDelete?.amount || 0)}?`}
        confirmText="Sim, Excluir"
        cancelText="Não, Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setRecordToDelete(null);
          setIsDeleting(false);
        }}
        isLoading={false}
      />
    </div>
  );
};

export default Financial;
