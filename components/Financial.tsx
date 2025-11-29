
import React, { useState } from 'react';
import { FinancialRecord, FinancialType, FinancialStatus } from '../types';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock, 
  Plus,
  X,
  Save,
  Calendar,
  Calendar as CalendarIcon
} from 'lucide-react';

interface FinancialProps {
  records: FinancialRecord[];
  setRecords: React.Dispatch<React.SetStateAction<FinancialRecord[]>>;
}

export const Financial: React.FC<FinancialProps> = ({ records, setRecords }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    // Create a new date adjusted for timezone to ensure we get the correct local YYYY-MM-DD
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  // Form State
  const [formData, setFormData] = useState<Partial<FinancialRecord>>({
    description: '',
    amount: 0,
    type: 'EXPENSE',
    category: '',
    dueDate: getLocalDateString(),
    status: 'PENDING'
  });

  // --- Date Logic (String Based for Safety) ---
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Helper to check if a record falls in Current Month/Year based on string comparison
  const checkPeriod = (r: FinancialRecord, period: 'MONTH' | 'YEAR') => {
    if (r.status !== 'PAID') return false;
    
    // Use paymentDate if exists, otherwise dueDate
    const dateStr = r.paymentDate || r.dueDate;
    if (!dateStr) return false;

    const [rYear, rMonth] = dateStr.split('-').map(Number);

    if (period === 'YEAR') {
      return rYear === currentYear;
    } else {
      return rYear === currentYear && rMonth === currentMonth;
    }
  };

  // --- Calculations ---

  // 1. Monthly Balance (Realized)
  const monthlyRecords = records.filter(r => checkPeriod(r, 'MONTH'));
  
  const monthlyIncome = monthlyRecords.filter(r => r.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyExpense = monthlyRecords.filter(r => r.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyBalance = monthlyIncome - monthlyExpense;

  // 2. Yearly Balance (Realized)
  const yearlyRecords = records.filter(r => checkPeriod(r, 'YEAR'));

  const yearlyIncome = yearlyRecords.filter(r => r.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
  const yearlyExpense = yearlyRecords.filter(r => r.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
  const yearlyBalance = yearlyIncome - yearlyExpense;

  // 3. Pending Payables (Global)
  const pendingPayable = records
    .filter(r => r.type === 'EXPENSE' && r.status === 'PENDING')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // --- Filter List ---
  const filteredRecords = records.filter(r => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const toggleStatus = (id: number) => {
    const today = getLocalDateString();
    
    setRecords(records.map(r => 
      r.id === id 
        ? { 
            ...r, 
            status: r.status === 'PAID' ? 'PENDING' : 'PAID',
            // If becoming PAID, set paymentDate to TODAY. If becoming PENDING, clear it.
            paymentDate: r.status === 'PAID' ? undefined : today 
          } 
        : r
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || !formData.category) return;

    const isPaid = formData.status === 'PAID';
    
    const newRecord: FinancialRecord = {
      id: Date.now(),
      description: formData.description,
      amount: Number(formData.amount),
      type: formData.type as FinancialType,
      category: formData.category,
      dueDate: formData.dueDate!,
      status: formData.status as FinancialStatus,
      paymentDate: isPaid ? formData.dueDate : undefined
    };

    setRecords(prev => [newRecord, ...prev]);
    setIsModalOpen(false);
    
    // Reset Form
    setFormData({
        description: '',
        amount: 0,
        type: 'EXPENSE',
        category: '',
        dueDate: getLocalDateString(),
        status: 'PENDING'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
        <p className="text-gray-500">Planejamento e controle de contas.</p>
      </div>

      {/* Financial Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Card 1: Saldo Mensal */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <CalendarIcon size={80} className="text-blue-600" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Saldo Mensal</p>
          <h3 className={`text-2xl font-bold mt-2 ${monthlyBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyBalance)}
          </h3>
          <div className="mt-4 flex flex-col gap-1 text-xs font-medium">
             <span className="text-green-600 flex items-center"><ArrowUpRight size={14} className="mr-1"/> Ent: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyIncome)}</span>
             <span className="text-red-500 flex items-center"><ArrowDownRight size={14} className="mr-1"/> Saí: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyExpense)}</span>
          </div>
        </div>

        {/* Card 2: Saldo Anual */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Calendar size={80} className="text-purple-600" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Saldo Anual</p>
          <h3 className={`text-2xl font-bold mt-2 ${yearlyBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyBalance)}
          </h3>
          <div className="mt-4 flex flex-col gap-1 text-xs font-medium">
             <span className="text-green-600 flex items-center"><ArrowUpRight size={14} className="mr-1"/> Ent: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyIncome)}</span>
             <span className="text-red-500 flex items-center"><ArrowDownRight size={14} className="mr-1"/> Saí: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyExpense)}</span>
          </div>
        </div>

        {/* Card 3: Contas a Pagar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">A Pagar (Pendente)</p>
                <h3 className="text-2xl font-bold text-orange-600 mt-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingPayable)}
                </h3>
             </div>
             <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                <Clock size={24} />
             </div>
           </div>
           <p className="text-xs text-gray-400 mt-4">Contas não pagas (Total)</p>
        </div>

        {/* Card 4: Action Button */}
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-center items-center text-center cursor-pointer hover:scale-[1.02] transition-transform active:scale-[0.98]"
        >
           <Plus size={32} className="mb-2" />
           <span className="font-bold text-lg">Nova Conta</span>
           <span className="text-purple-200 text-sm">Receita ou Despesa</span>
        </button>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-center">
           <h2 className="font-bold text-gray-700">Lançamentos e Planejamento</h2>
           <div className="flex gap-2">
              <button 
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'ALL' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Pendentes
              </button>
              <button 
                onClick={() => setFilter('PAID')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'PAID' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Pagos
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase">
                <tr>
                   <th className="px-6 py-4">Descrição</th>
                   <th className="px-6 py-4">Categoria</th>
                   <th className="px-6 py-4">Vencimento</th>
                   <th className="px-6 py-4">Valor</th>
                   <th className="px-6 py-4 text-center">Status</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                   const [year, month, day] = record.dueDate.split('-');
                   // Format manually to avoid timezone shift
                   const dateDisplay = `${day}/${month}/${year}`;
                   
                   let paidDateDisplay = '';
                   if (record.paymentDate) {
                      const [py, pm, pd] = record.paymentDate.split('-');
                      paidDateDisplay = `${pd}/${pm}/${py}`;
                   }

                   return (
                   <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                         <div className="font-medium text-gray-900">{record.description}</div>
                         <div className="text-xs text-gray-400">
                           {record.type === 'INCOME' ? 'Receita' : 'Despesa'}
                           {record.status === 'PAID' && record.paymentDate && record.paymentDate !== record.dueDate && (
                              <span className="ml-1 text-gray-400">• Pago: {paidDateDisplay}</span>
                           )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                            {record.category}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                         {dateDisplay}
                      </td>
                      <td className={`px-6 py-4 font-bold ${record.type === 'INCOME' ? 'text-green-600' : 'text-gray-800'}`}>
                         {record.type === 'EXPENSE' ? '-' : '+'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(record.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                         {record.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                               <CheckCircle2 size={12} /> Pago
                            </span>
                         ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
                               <Clock size={12} /> Pendente
                            </span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <button 
                           onClick={() => toggleStatus(record.id)}
                           className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                             record.status === 'PENDING' 
                               ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' 
                               : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                           }`}
                         >
                           {record.status === 'PENDING' ? 'Dar Baixa' : 'Reabrir'}
                         </button>
                      </td>
                   </tr>
                )})}
             </tbody>
          </table>
        </div>
      </div>

      {/* Add New Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-lg font-bold text-gray-800">
                 Novo Lançamento Financeiro
               </h3>
               <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               {/* Type Selector */}
               <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'EXPENSE'})}
                    className={`flex-1 py-2.5 rounded-lg font-bold border transition-all ${
                      formData.type === 'EXPENSE' 
                        ? 'bg-red-50 border-red-500 text-red-600' 
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Despesa / Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'INCOME'})}
                    className={`flex-1 py-2.5 rounded-lg font-bold border transition-all ${
                      formData.type === 'INCOME' 
                        ? 'bg-green-50 border-green-500 text-green-600' 
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Receita / Entrada
                  </button>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                 <input 
                   type="text" required
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                   placeholder={formData.type === 'EXPENSE' ? 'Ex: Conta de Luz, Aluguel...' : 'Ex: Venda Extra, Aporte...'}
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                    <input 
                      type="number" step="0.01" required
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="0,00"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <input 
                      type="text" list="categories" required
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Selecione..."
                    />
                    <datalist id="categories">
                      <option value="Custos Fixos" />
                      <option value="Fornecedores" />
                      <option value="Funcionários" />
                      <option value="Marketing" />
                      <option value="Impostos" />
                      <option value="Vendas" />
                      <option value="Investimentos" />
                    </datalist>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Vencimento</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                      <input 
                        type="date" required
                        value={formData.dueDate}
                        onChange={e => setFormData({...formData, dueDate: e.target.value})}
                        className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Inicial</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as FinancialStatus})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    >
                      <option value="PENDING">Pendente (Agendar)</option>
                      <option value="PAID">Pago (Realizado)</option>
                    </select>
                  </div>
               </div>

               <button 
                 type="submit"
                 className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-purple-700 transition-all flex justify-center items-center gap-2 mt-4 active:scale-95"
               >
                 <Save size={18} />
                 Salvar Lançamento
               </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
