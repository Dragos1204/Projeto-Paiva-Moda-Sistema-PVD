
import React, { useState } from 'react';
import { MOCK_PRODUCTS } from '../constants';
import { ArrowUpCircle, ArrowDownCircle, Plus, Calendar, Search, AlertTriangle } from 'lucide-react';
import { StockMovement, MovementType, Product } from '../types';

interface InventoryProps {
  movements: StockMovement[];
  onAddMovement: (movement: StockMovement) => void;
  products: Product[];
}

export const Inventory: React.FC<InventoryProps> = ({ movements, onAddMovement, products }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'ADD' | 'DAMAGE'>('MOVEMENTS');
  
  // Form State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<MovementType>('ENTRY');
  const [reason, setReason] = useState('');

  // Specialized Damage Form State
  const [damageProduct, setDamageProduct] = useState('');
  const [damageQty, setDamageQty] = useState('');
  const [damageReason, setDamageReason] = useState('Avaria / Defeito');

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id.toString() === selectedProduct);
    if (!product) return;

    const newMovement: StockMovement = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      type,
      quantity: Number(quantity),
      date: new Date().toISOString().split('T')[0],
      reason
    };

    onAddMovement(newMovement);
    setActiveTab('MOVEMENTS');
    setSelectedProduct('');
    setQuantity('');
    setReason('');
  };

  const handleAddDamage = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id.toString() === damageProduct);
    if (!product) return;

    const newMovement: StockMovement = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      type: 'EXIT', // Damage is always an exit
      quantity: Number(damageQty),
      date: new Date().toISOString().split('T')[0],
      reason: `AVARIA: ${damageReason}`
    };

    onAddMovement(newMovement);
    setActiveTab('MOVEMENTS');
    setDamageProduct('');
    setDamageQty('');
    setDamageReason('Avaria / Defeito');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Controle de Estoque</h1>
          <p className="text-gray-500">Registre entradas, saídas e avarias.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('MOVEMENTS')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'MOVEMENTS' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Histórico
            </button>
            <button 
              onClick={() => setActiveTab('ADD')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'ADD' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Plus size={18} />
              <span>Entrada/Saída Manual</span>
            </button>
            <button 
              onClick={() => setActiveTab('DAMAGE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'DAMAGE' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <AlertTriangle size={18} />
              <span>Registrar Avaria</span>
            </button>
        </div>
      </div>

      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex gap-4">
               <div className="flex-1 relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="Buscar por produto ou motivo..." 
                   className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                 />
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4">Qtd.</th>
                    <th className="px-6 py-4">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(mov.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          mov.type === 'ENTRY' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {mov.type === 'ENTRY' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                          {mov.type === 'ENTRY' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">{mov.productName}</td>
                      <td className="px-6 py-4 font-bold text-gray-700">{mov.quantity}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{mov.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {activeTab === 'ADD' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 animate-in fade-in slide-in-from-bottom-4">
           <h2 className="text-lg font-bold text-gray-800 mb-6">Registrar Movimentação Manual</h2>
           <form onSubmit={handleAddMovement} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                    <select 
                      required
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Selecione um produto...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Atual: {p.stock})</option>
                      ))}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimento</label>
                    <div className="flex gap-2">
                       <button
                         type="button"
                         onClick={() => setType('ENTRY')}
                         className={`flex-1 py-3 rounded-lg border font-medium transition-all ${type === 'ENTRY' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                       >
                         Entrada
                       </button>
                       <button
                         type="button"
                         onClick={() => setType('EXIT')}
                         className={`flex-1 py-3 rounded-lg border font-medium transition-all ${type === 'EXIT' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                       >
                         Saída
                       </button>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="0"
                    />
                 </div>

                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Observação</label>
                    <input 
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Ex: Compra de reposição, Ajuste de estoque..."
                    />
                 </div>
              </div>

              <div className="flex gap-3 pt-4">
                 <button 
                   type="button" 
                   onClick={() => setActiveTab('MOVEMENTS')}
                   className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit" 
                   className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-md"
                 >
                   Salvar Registro
                 </button>
              </div>
           </form>
        </div>
      )}

      {activeTab === 'DAMAGE' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-red-200 p-8 animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <AlertTriangle size={120} className="text-red-500" />
           </div>
           
           <h2 className="text-lg font-bold text-red-600 mb-6 flex items-center gap-2">
             <AlertTriangle size={24} />
             Registrar Produto Avariado
           </h2>
           <p className="text-sm text-gray-500 mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
             Esta ação registrará uma saída de estoque e marcará o motivo como "AVARIA". Use isso para produtos danificados, vencidos ou com defeito.
           </p>

           <form onSubmit={handleAddDamage} className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Produto Avariado</label>
                    <select 
                      required
                      value={damageProduct}
                      onChange={(e) => setDamageProduct(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <option value="">Selecione um produto...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Em Estoque: {p.stock})</option>
                      ))}
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Perdida</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={damageQty}
                      onChange={(e) => setDamageQty(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="0"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes do Defeito</label>
                    <input 
                      type="text"
                      required
                      value={damageReason}
                      onChange={(e) => setDamageReason(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="Ex: Rasgado, Manchado..."
                    />
                 </div>
              </div>

              <div className="flex gap-3 pt-4">
                 <button 
                   type="button" 
                   onClick={() => setActiveTab('MOVEMENTS')}
                   className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit" 
                   className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md shadow-red-200"
                 >
                   Confirmar Baixa (Avaria)
                 </button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};
