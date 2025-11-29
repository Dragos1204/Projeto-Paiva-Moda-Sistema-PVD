
import React, { useState } from 'react';
import { Product } from '../types';
import { Edit2, Trash2, Plus, Filter, X, Image as ImageIcon, Upload } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ 
  products, 
  onUpdateProduct, 
  onAddProduct,
  onDeleteProduct
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    price: 0,
    stock: 0,
    barcode: '',
    description: '',
    image: ''
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setFormData(product);
      setPreviewImage(product.image || null);
    } else {
      setFormData({ name: '', category: '', price: 0, stock: 0, barcode: '', description: '', image: '' });
      setPreviewImage(null);
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setFormData(prev => ({ ...prev, image: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id) {
      // Edit
      onUpdateProduct(formData as Product);
    } else {
      // Create
      const newProduct = { ...formData, id: Date.now() } as Product;
      onAddProduct(newProduct);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <p className="text-gray-500">Gerencie o estoque e catálogo da sua loja.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
        >
          <Plus size={20} />
          <span>Novo Produto</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="flex-1 relative">
             <input 
               type="text" 
               placeholder="Pesquisar por nome, código..." 
               className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
             />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg flex items-center gap-2 text-gray-600 hover:bg-gray-50">
            <Filter size={18} />
            <span className="hidden md:inline">Filtros</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-center">Estoque</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                        {product.image ? (
                          <img src={product.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-400">Cód: {product.barcode || 'S/N'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`
                      font-bold
                      ${product.stock < 10 ? 'text-red-500' : 'text-green-600'}
                    `}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDeleteProduct(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {formData.id ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1"
              >
                <X size={24} /> 
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Image Upload Section */}
              <div className="flex gap-6 items-start">
                <div className="w-32 h-32 flex-shrink-0 relative group">
                  <div className={`w-full h-full rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer bg-gray-50
                    ${previewImage ? 'border-purple-300' : 'border-gray-300 hover:border-purple-400'}`}
                  >
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        <Upload className="mx-auto text-gray-400 mb-1" size={24} />
                        <span className="text-[10px] text-gray-500 font-medium">Adicionar Foto</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    
                    {/* Overlay on hover if image exists */}
                    {previewImage && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-white text-xs font-medium">Alterar</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                      <input 
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        placeholder="Ex: Vestido Longo..."
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                        <input 
                          type="text"
                          value={formData.barcode}
                          onChange={e => setFormData({...formData, barcode: e.target.value})}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="000000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                        <input 
                          type="text"
                          list="categories"
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Ex: Vestidos"
                        />
                        <datalist id="categories">
                          <option value="Vestidos" />
                          <option value="Calças" />
                          <option value="Blusas" />
                          <option value="Acessórios" />
                        </datalist>
                      </div>
                   </div>
                </div>
              </div>

              {/* Price and Stock */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="0,00"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                    <input 
                      type="number"
                      required
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="0"
                    />
                 </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada (Site)</label>
                <textarea 
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  placeholder="Descreva o material, caimento, detalhes da peça... Essa informação será usada na integração com o site."
                />
              </div>

            </form>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 transition-all active:scale-95"
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
