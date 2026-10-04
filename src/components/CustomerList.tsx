import React, { useState } from 'react';
import { Customer, User } from '../types';
import { 
  Search, Plus, User as UserIcon, Phone, Mail, Edit2, Trash2, X, Save, 
  Wallet, ShieldCheck, RotateCw, Sparkles, CheckCircle2, AlertCircle, MapPin
} from 'lucide-react';
import { queryCreditBureau, formatCPF, CreditAnalysisResult } from '../services/creditBureau';
import { ConfirmModal } from './ConfirmModal';
import { db } from '../database';
import { useToast } from '../context/ToastContext';

interface CustomerListProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  currentUser: User | null;
}

export const CustomerList: React.FC<CustomerListProps> = ({ 
  customers, 
  onAddCustomer, 
  onUpdateCustomer, 
  onDeleteCustomer, 
  currentUser 
}) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Customer>({ 
    id: '', 
    name: '', 
    phone: '', 
    email: '', 
    cpf: '',
    address: '', 
    creditLimit: 600, 
    usedCredit: 0 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isQueryingBureau, setIsQueryingBureau] = useState(false);
  const [bureauResult, setBureauResult] = useState<CreditAnalysisResult | null>(null);

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' || currentUser?.isOwner;

  const filteredCustomers = customers.filter(c => 
    c.id !== '00' && 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (c.phone && c.phone.includes(searchTerm)) ||
     (c.cpf && c.cpf.includes(searchTerm)))
  );

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 2 && value.length <= 6) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    else if (value.length <= 10 && value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    else if (value.length > 10) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
    setFormData({ ...formData, phone: value });
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) { 
      setFormData(customer); 
      setIsEditing(true);
      setBureauResult(null);
    } else { 
      setFormData({ 
        id: 'cli_' + Date.now(), 
        name: '', 
        phone: '', 
        email: '', 
        cpf: '',
        address: '', 
        creditLimit: 600, 
        usedCredit: 0 
      }); 
      setIsEditing(false);
      setBureauResult(null);
    }
    setIsModalOpen(true);
  };

  const handleRunBureauQuery = async () => {
    if (!formData.cpf) return;
    const clean = formData.cpf.replace(/\D/g, '');
    if (clean.length !== 11) {
      alert('Informe um CPF com 11 dígitos para consultar.');
      return;
    }
    setIsQueryingBureau(true);
    try {
      const res = await queryCreditBureau(clean, formData.name);
      setBureauResult(res);
      if (res.isValidCPF) {
        setFormData(prev => ({ 
          ...prev, 
          creditLimit: res.suggestedLimit,
          creditScore: res.score,
          creditRisk: res.risk
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsQueryingBureau(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (isEditing) {
      onUpdateCustomer(formData);
      toast.success("Cliente Atualizado", "Cadastro alterado com sucesso.");
    } else {
      onAddCustomer(formData);
      toast.success("Cliente Cadastrado", "Novo cliente adicionado com sucesso.");
    }

    try {
      await db.save('customers', formData);
    } catch (err) {
      console.error("Erro ao salvar cliente no banco:", err);
    }

    setIsModalOpen(false);
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!customerToDelete) return;
    const targetId = String(customerToDelete.id);

    // 1. Fecha o modal imediatamente (Zero delay, some na hora!)
    setDeleteModalOpen(false);
    setCustomerToDelete(null);
    setIsDeleting(false);

    // 2. Dispara remoção local e notifica
    onDeleteCustomer(targetId);
    toast.success("Cliente Excluído", "O cadastro foi removido com sucesso.");

    // 3. Exclusão assíncrona no Firestore em segundo plano
    db.delete('customers', targetId).catch(err => {
      console.error("Erro ao excluir cliente:", err);
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-950">Gestão de Clientes & Crediário</h1>
          <p className="text-xs text-gray-500 mt-1">Base de clientes, consulta de score Serasa, limite de crédito e histórico.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-purple-900/10 flex items-center gap-2 transition cursor-pointer"
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou celular..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => {
            const availableCredit = Math.max(0, (customer.creditLimit || 0) - (customer.usedCredit || 0));
            return (
              <div key={customer.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center font-black text-sm shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-950 text-sm">{customer.name}</h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">CPF: {customer.cpf || 'Não cadastrado'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenModal(customer)} 
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="Editar cliente e limite"
                    >
                      <Edit2 size={15}/>
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteClick(customer)} 
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-600 pt-1">
                  {customer.phone && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone size={13} className="text-gray-400 shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-1.5 text-gray-500 truncate">
                      <MapPin size={13} className="text-gray-400 shrink-0" />
                      <span>{customer.address}</span>
                    </div>
                  )}
                </div>

                <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-100/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 font-semibold block uppercase">Crediário Loja</span>
                    <span className="font-black text-purple-900 text-sm">
                      {formatCurrency(availableCredit)}
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      Limite total: {formatCurrency(customer.creditLimit || 0)}
                    </span>
                  </div>

                  {customer.creditScore ? (
                    <div className="text-right">
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full inline-block">
                        Score {customer.creditScore}
                      </span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">Serasa / Positivo</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400">Score não consultado</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">
            Nenhum cliente cadastrado ou localizado com a pesquisa.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-base">
                  {isEditing ? 'Editar Cliente & Crediário' : 'Novo Cliente & Análise de Score'}
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Preencha os dados e consulte o score de crédito</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="Nome do Cliente" 
                  className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">CPF</label>
                    {formData.cpf && formData.cpf.replace(/\D/g, '').length === 11 && (
                      <button 
                        type="button" 
                        onClick={handleRunBureauQuery}
                        className="text-[10px] text-purple-600 hover:underline font-bold"
                      >
                        Consultar Score
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00"
                    value={formData.cpf || ''} 
                    onChange={e => setFormData({ ...formData, cpf: formatCPF(e.target.value) })} 
                    className="w-full px-3.5 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Celular / WhatsApp</label>
                  <input 
                    type="text" 
                    value={formData.phone} 
                    onChange={handlePhoneChange} 
                    placeholder="(92) 99999-9999" 
                    className="w-full px-3.5 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">E-mail</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    placeholder="cliente@email.com" 
                    className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Endereço Residencial</label>
                  <input 
                    type="text" 
                    value={formData.address || ''} 
                    onChange={e => setFormData({ ...formData, address: e.target.value })} 
                    placeholder="Bairro, Rua..." 
                    className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              <div className="border border-purple-200 bg-purple-50/70 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs font-black text-purple-950">
                    <ShieldCheck size={16} className="text-purple-600" />
                    <span>Consulta de Score Serasa & Cadastro Positivo</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleRunBureauQuery} 
                    disabled={isQueryingBureau || !formData.cpf || formData.cpf.replace(/\D/g, '').length !== 11}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    {isQueryingBureau ? <RotateCw size={12} className="animate-spin" /> : <Search size={12} />}
                    {isQueryingBureau ? 'Consultando...' : 'Consultar'}
                  </button>
                </div>

                {bureauResult && (
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-purple-100 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Score de Crédito:</span>
                      <span className={`text-base font-black ${
                        bureauResult.score >= 700 ? 'text-emerald-600' : bureauResult.score >= 500 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {bureauResult.score} / 1000
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-800 font-semibold">{bureauResult.riskLabel}</p>
                    <p className="text-[11px] text-emerald-700 font-bold">
                      Limite Pré-Aprovado Sugerido: {formatCurrency(bureauResult.suggestedLimit)}
                    </p>
                  </div>
                )}

                <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-800">Limite de Crediário Próprio (R$)</label>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                      Editável
                    </span>
                  </div>
                  <input 
                    type="number" 
                    step="50" 
                    value={formData.creditLimit} 
                    onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })} 
                    placeholder="0.00" 
                    className="w-full px-3 py-2 border rounded-xl text-sm font-black text-purple-700 font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                  <span className="text-[10px] text-gray-400 block">
                    O lojista pode alterar livremente este limite a qualquer momento.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Confirm Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir o cadastro de "${customerToDelete?.name || ''}"?`}
        confirmText="Sim, Excluir"
        cancelText="Não, Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCustomerToDelete(null);
          setIsDeleting(false);
        }}
        isLoading={false}
      />
    </div>
  );
};

export default CustomerList;
