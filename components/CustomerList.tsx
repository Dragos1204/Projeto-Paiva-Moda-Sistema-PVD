
import React, { useState } from 'react';
import { Customer } from '../types';
import { Search, Plus, User, MapPin, Phone, Mail, Edit2, Trash2, X, Save } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export const CustomerList: React.FC<CustomerListProps> = ({ customers, setCustomers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Customer>({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  const filteredCustomers = customers.filter(c => 
    c.id !== '00' && // Don't show the default unidentified customer in the editable list
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm))
  );

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
        address: ''
      });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      setCustomers(prev => prev.map(c => c.id === formData.id ? formData : c));
    } else {
      setCustomers(prev => [...prev, formData]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500">Gerencie sua base de clientes.</p>
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
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow group relative">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                    <User size={20} />
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
                   <button onClick={() => handleDelete(customer.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                     <Trash2 size={16} />
                   </button>
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
                {customer.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-gray-400" />
                    <span className="truncate">{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredCustomers.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-400">
               <User size={48} className="mx-auto mb-2 opacity-20" />
               <p>Nenhum cliente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
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
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                      placeholder="(00) 00000-0000"
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
