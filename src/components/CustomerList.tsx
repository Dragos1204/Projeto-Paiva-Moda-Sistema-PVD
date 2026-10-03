
import React, { useState } from 'react';
import { Customer, User } from '../types';
import { Search, Plus, User as UserIcon, Phone, Mail, Edit2, Trash2, X, Save, Wallet } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Customer>({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: 0,
    usedCredit: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';

  const filteredCustomers = customers.filter(c => 
    c.id !== '00' && 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm))
  );

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    
    // Limita tamanho (11 dígitos para celular com DDD)
    if (value.length > 11) value = value.slice(0, 11);

    // Aplica a máscara (XX) XXXXX-XXXX
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`; // Formato 9 dígitos
    } else if (value.length > 9) { // Ajuste para 8 dígitos se necessário
       value = `${value.slice(0, 9)}-${value.slice(9)}`;
    }

    setFormData({...formData, phone: value});
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setFormData(customer);
      setIsEditing(true);
    } else {
      setFormData({
        id: Date.now().toString(),
        name: '',
        phone: '',
        email: '',
        address: '',
        creditLimit: 0,
        usedCredit: 0
      });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      onUpdateCustomer(formData);
    } else {
      const newCustomer = { ...formData, id: formData.id || Date.now().toString() };
      onAddCustomer(newCustomer);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500">Gerencie sua base de clientes e limites de crédito.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"
        >
          <Plus size={20} />
          <span>Novo Cliente</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome ou telefone..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredCustomers.map(customer => {
             const limit = customer.creditLimit || 0;
             const used = customer.usedCredit || 0;
             const available = limit - used;
             
             return (
            <div key={customer.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow group relative">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{customer.name}</h3>
                    <p className="text-xs text-gray-500">ID: {customer.id}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleOpenModal(customer)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                     <Edit2 size={16} />
                   </button>
                   {isAdmin && (
                    <button onClick={() => onDeleteCustomer(customer.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                        <Trash2 size={16} />
                    </button>
                   )}
                </div>
              </div>
              
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                )}
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                   <div className="flex items-center gap-2 mb-2 font-medium text-gray-700">
                      <Wallet size={14} />
                      <span>Crediário Loja</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded border border-gray-200">
                         <span className="block text-gray-400">Limite Total</span>
                         <span className="font-bold text-gray-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limit)}</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-gray-200">
                         <span className="block text-gray-400">Disponível</span>
                         <span className={`font-bold ${available < 0 ? 'text-red-500' : 'text-green-600'}`}>
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(available)}
                         </span>
                      </div>
                   </div>
                   {used > 0 && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                         <div 
                           className="bg-pink-500 h-1.5 rounded-full" 
                           style={{ width: `${Math.min((used/limit)*100, 100)}%` }}
                         />
                      </div>
                   )}
                </div>
              </div>
            </div>
          )})}
          
          {filteredCustomers.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-400">
               <UserIcon size={48} className="mx-auto mb-2 opacity-20" />
               <p>Nenhum cliente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-lg font-bold text-gray-800">
                 {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
               </h3>
               <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400" /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                 <input 
                   type="text" required
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                   className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                   placeholder="Ex: Ana Silva"
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                    <input 
                      type="text"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                      placeholder="(92) 99123-4567"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                      placeholder="exemplo@email.com"
                    />
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                 <textarea 
                   rows={2}
                   value={formData.address}
                   onChange={e => setFormData({...formData, address: e.target.value})}
                   className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                   placeholder="Rua, Número, Bairro, Cidade"
                 />
               </div>

               <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
                  <label className="block text-sm font-bold text-pink-700 mb-1">Limite de Crédito (Loja)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 font-bold">R$</span>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value)})}
                      className="w-full pl-10 pr-3 py-3 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-xs text-pink-600 mt-1">Defina o valor máximo para compras no crediário.</p>
               </div>

               <button 
                 type="submit"
                 className="w-full bg-pink-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-pink-700 transition-all flex justify-center items-center gap-2 mt-4"
               >
                 <Save size={18} />
                 Salvar Cliente
               </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
