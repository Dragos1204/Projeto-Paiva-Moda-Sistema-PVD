
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

export const CustomerList: React.FC<CustomerListProps> = ({ customers, onAddCustomer, onUpdateCustomer, onDeleteCustomer, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Customer>({ id: '', name: '', phone: '', email: '', address: '', creditLimit: 0, usedCredit: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';

  const filteredCustomers = customers.filter(c => c.id !== '00' && (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)));

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    if (value.length > 10) value = `${value.slice(0, 10)}-${value.slice(10)}`;
    setFormData({...formData, phone: value});
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) { setFormData(customer); setIsEditing(true); } else { setFormData({ id: Date.now().toString(), name: '', phone: '', email: '', address: '', creditLimit: 0, usedCredit: 0 }); setIsEditing(false); }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) onUpdateCustomer(formData); else onAddCustomer({ ...formData, id: formData.id || Date.now().toString() });
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Clientes</h1><button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg"><Plus size={20} /> Novo</button></div>
      <div className="bg-white rounded-xl shadow overflow-hidden"><div className="p-4 border-b"><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar..." className="w-full p-2 border rounded" /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">{filteredCustomers.map(customer => (<div key={customer.id} className="bg-gray-50 p-4 border rounded relative group"><div className="flex justify-between"><h3 className="font-bold">{customer.name}</h3><div className="opacity-0 group-hover:opacity-100 flex gap-1"><button onClick={() => handleOpenModal(customer)} className="text-blue-600"><Edit2 size={16}/></button>{isAdmin && <button onClick={() => onDeleteCustomer(customer.id)} className="text-red-600"><Trash2 size={16}/></button>}</div></div><p>{customer.phone}</p><div className="mt-2 text-xs border-t pt-2"><p>Limite: {customer.creditLimit}</p><p>Disponível: {(customer.creditLimit||0)-(customer.usedCredit||0)}</p></div></div>))}</div></div>
      {isModalOpen && (<div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4"><div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4"><h3 className="font-bold">{isEditing?'Editar':'Novo'}</h3><form onSubmit={handleSubmit} className="space-y-4"><input required value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} placeholder="Nome" className="w-full p-2 border rounded" /><input value={formData.phone} onChange={handlePhoneChange} placeholder="Telefone" className="w-full p-2 border rounded" /><input type="number" value={formData.creditLimit} onChange={e=>setFormData({...formData,creditLimit:parseFloat(e.target.value)})} placeholder="Limite Crédito" className="w-full p-2 border rounded" /><div className="flex justify-end gap-2"><button type="button" onClick={()=>setIsModalOpen(false)} className="p-2 border rounded">Cancelar</button><button type="submit" className="p-2 bg-pink-600 text-white rounded">Salvar</button></div></form></div></div>)}
    </div>
  );
};
