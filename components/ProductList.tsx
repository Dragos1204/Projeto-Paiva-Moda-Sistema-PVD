
import React, { useState, useEffect } from 'react';
import { Product, User } from '../types';
import { Edit2, Trash2, Plus, Filter, X, Image as ImageIcon, Upload, DollarSign, Tag, Printer, Barcode, LayoutTemplate, StickyNote, ScrollText, Component, ShoppingBag, Minus, Search } from 'lucide-react';
import { printer, LabelModel, PrintQueueItem } from '../printer';

interface ProductListProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => void;
  currentUser: User | null;
}

export const ProductList: React.FC<ProductListProps> = ({ 
  products, 
  onUpdateProduct, 
  onAddProduct,
  onDeleteProduct,
  currentUser
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';
  
  // Tag Printing Modal State
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [tagModel, setTagModel] = useState<LabelModel>('STANDARD');
  const [tagCodeType, setTagCodeType] = useState<'GTIN' | 'INTERNAL'>('GTIN');
  const [previewHtml, setPreviewHtml] = useState('');
  
  // Search within Tag Modal
  const [tagSearchTerm, setTagSearchTerm] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    price: 0,
    costPrice: 0,
    stock: 0,
    barcode: '',
    internalCode: '',
    description: '',
    image: ''
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setFormData(product);
      setPreviewImage(product.image || null);
    } else {
      setFormData({ name: '', category: '', price: 0, costPrice: 0, stock: 0, barcode: '', internalCode: '', description: '', image: '' });
      setPreviewImage(null);
    }
    setIsModalOpen(true);
  };

  const handleOpenTagModal = (product?: Product) => {
    // If a specific product is clicked, start the queue with it
    if (product) {
        setPrintQueue([{ product, quantity: 1 }]);
        setTagCodeType(product.barcode ? 'GTIN' : 'INTERNAL');
    } else {
        setPrintQueue([]);
    }
    setTagModel('STANDARD');
    setIsTagModalOpen(true);
  };

  const addToPrintQueue = (product: Product) => {
    setPrintQueue(prev => {
        const existing = prev.find(i => i.product.id === product.id);
        if (existing) {
            return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQueueQuantity = (productId: number, delta: number) => {
      setPrintQueue(prev => prev.map(item => {
          if (item.product.id === productId) {
              const newQty = Math.max(0, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }).filter(item => item.quantity > 0));
  };

  // Live Preview Effect (Preview just the first item of the queue or a placeholder)
  useEffect(() => {
    if (isTagModalOpen) {
       // We generate HTML for the whole queue to check layout, or just the first item for speed?
       // Let's generate the whole thing so user sees exactly what will be printed
       const html = printer.generateBatchTagHTML(printQueue, tagCodeType, tagModel);
       setPreviewHtml(html);
    }
  }, [printQueue, tagModel, tagCodeType, isTagModalOpen]);

  const handlePrintTag = () => {
    if (printQueue.length > 0) {
      printer.printQueue(printQueue, tagCodeType, tagModel);
    }
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
      onUpdateProduct(formData as Product);
    } else {
      const newProduct = { ...formData, id: Date.now() } as Product;
      onAddProduct(newProduct);
    }
    setIsModalOpen(false);
  };

  const calculateMarkup = (price: number, cost: number) => {
    if (!cost || cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  // Filter products for the internal modal search
  const productsForTagSearch = products.filter(p => 
     tagSearchTerm && (
       p.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) ||
       p.barcode.includes(tagSearchTerm) ||
       (p.internalCode && p.internalCode.includes(tagSearchTerm))
     )
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <p className="text-gray-500">Gerencie o estoque, custos e catálogo da sua loja.</p>
        </div>
        <div className="flex gap-2">
            <button 
            onClick={() => handleOpenTagModal()}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
            <Tag size={20} />
            <span>Gerador de Etiquetas</span>
            </button>
            <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
            >
            <Plus size={20} />
            <span>Novo Produto</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="flex-1 relative">
             <input 
               type="text" 
               placeholder="Pesquisar por nome, código interno ou barras..." 
               className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
             />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg flex items-center gap-2 text-gray-600 hover:bg-gray-50">
            <Filter size={18} />
            <span className="hidden md:inline">Filtros</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Códigos</th>
                <th className="px-6 py-4 text-right">Custo</th>
                <th className="px-6 py-4 text-right">Venda</th>
                <th className="px-6 py-4 text-center">Margem</th>
                <th className="px-6 py-4 text-center">Estoque</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const cost = product.costPrice || 0;
                const markup = calculateMarkup(product.price, cost);

                return (
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
                      <div className="font-medium text-gray-900">{product.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs">
                       <span className="text-gray-500">GTIN: {product.barcode || '-'}</span>
                       {product.internalCode && (
                          <span className="font-bold text-purple-600">INT: {product.internalCode}</span>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 text-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cost)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] px-1.5 rounded font-bold ${markup >= 100 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {markup.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold ${product.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenTagModal(product)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Imprimir Etiqueta"
                      >
                        <Tag size={16} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      {isAdmin && (
                        <button 
                            onClick={() => onDeleteProduct(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Excluir"
                        >
                            <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Edit/Create Modal (Code remains same, hiding for brevity but it's essential to keep scrolling fixes) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
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
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                      <input 
                        type="text" required value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Código Interno</label>
                        <input 
                          type="text" value={formData.internalCode}
                          onChange={e => setFormData({...formData, internalCode: e.target.value.toUpperCase()})}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">GTIN / Barras</label>
                        <input 
                          type="text" value={formData.barcode}
                          onChange={e => setFormData({...formData, barcode: e.target.value})}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                      <input 
                        type="text" list="categories" value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Selecione ou digite..."
                      />
                      <datalist id="categories">
                        <option value="Vestidos" />
                        <option value="Calças" />
                        <option value="Blusas" />
                        <option value="Shorts" />
                        <option value="Saias" />
                        <option value="Conjuntos" />
                        <option value="Macacão" />
                        <option value="Moda Praia" />
                        <option value="Fitness" />
                        <option value="Lingerie" />
                        <option value="Acessórios" />
                        <option value="Infantil" />
                        <option value="Masculino" />
                        <option value="Calçados" />
                      </datalist>
                   </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><DollarSign size={16} /> Precificação</h4>
                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Preço de Custo (R$)</label>
                      <input 
                        type="number" step="0.01" value={formData.costPrice || ''}
                        onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value)})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Preço de Venda (R$)</label>
                      <input 
                        type="number" step="0.01" required value={formData.price}
                        onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-700"
                      />
                   </div>
                   <div className="flex flex-col justify-end">
                      <div className="p-2 bg-green-50 border border-green-100 rounded-lg text-center">
                         <span className="block text-[10px] text-gray-500 uppercase">Margem</span>
                         <span className="text-sm font-bold text-green-700">{calculateMarkup(formData.price || 0, formData.costPrice || 0).toFixed(0)}%</span>
                      </div>
                   </div>
                </div>
              </div>
              
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                    <input 
                        type="number" required value={formData.stock}
                        onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea 
                    rows={3}
                    value={formData.description || ''}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                    placeholder="Detalhes do produto, tecido, tamanho..."
                  />
               </div>
            </form>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSubmit} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700">Salvar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Label Studio Modal (Code remains same) */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
           {/* Modal Body */}
           <div className="bg-white w-full max-w-6xl max-h-[95vh] h-full md:h-[700px] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in flex flex-col md:flex-row">
              
              {/* Left Sidebar: Settings & Queue */}
              <div className="w-full md:w-[30%] bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-1/2 md:h-full">
                 <div className="p-4 border-b border-gray-200 shrink-0">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Printer size={20} className="text-purple-600" />
                        Estúdio de Etiquetas
                    </h3>
                 </div>

                 <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Model Selection */}
                    <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-3">1. Escolha o Modelo</label>
                       <div className="space-y-2 grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                          <button onClick={() => setTagModel('ADHESIVE_50x30')} className={`w-full flex items-center p-2 md:p-3 rounded-xl border-2 transition-all ${tagModel === 'ADHESIVE_50x30' ? 'border-purple-500 bg-white shadow-md' : 'border-gray-200 hover:bg-white'}`}>
                             <StickyNote className="text-gray-500 mr-2 md:mr-3" size={20} />
                             <div className="text-left"><span className="block font-bold text-gray-700 text-xs md:text-sm">Adesiva 50x30mm</span><span className="hidden md:block text-[10px] text-gray-400">Padrão Gôndola</span></div>
                          </button>
                          
                          <button onClick={() => setTagModel('STANDARD')} className={`w-full flex items-center p-2 md:p-3 rounded-xl border-2 transition-all ${tagModel === 'STANDARD' ? 'border-purple-500 bg-white shadow-md' : 'border-gray-200 hover:bg-white'}`}>
                             <ScrollText className="text-gray-500 mr-2 md:mr-3" size={20} />
                             <div className="text-left"><span className="block font-bold text-gray-700 text-xs md:text-sm">Bobina</span><span className="hidden md:block text-[10px] text-gray-400">Cupom Simples</span></div>
                          </button>

                          <button onClick={() => setTagModel('HANG_TAG')} className={`w-full flex items-center p-2 md:p-3 rounded-xl border-2 transition-all ${tagModel === 'HANG_TAG' ? 'border-purple-500 bg-white shadow-md' : 'border-gray-200 hover:bg-white'}`}>
                             <Tag className="text-gray-500 mr-2 md:mr-3" size={20} />
                             <div className="text-left"><span className="block font-bold text-gray-700 text-xs md:text-sm">Tag Roupa</span><span className="hidden md:block text-[10px] text-gray-400">Vertical (Furo)</span></div>
                          </button>

                          <button onClick={() => setTagModel('SHELF_LABEL')} className={`w-full flex items-center p-2 md:p-3 rounded-xl border-2 transition-all ${tagModel === 'SHELF_LABEL' ? 'border-purple-500 bg-white shadow-md' : 'border-gray-200 hover:bg-white'}`}>
                             <LayoutTemplate className="text-gray-500 mr-2 md:mr-3" size={20} />
                             <div className="text-left"><span className="block font-bold text-gray-700 text-xs md:text-sm">Plaquinha</span><span className="hidden md:block text-[10px] text-gray-400">Horizontal Grande</span></div>
                          </button>
                       </div>
                    </div>

                    {/* Code Type */}
                    <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-3">2. Código de Barras</label>
                       <div className="flex gap-2">
                          <button 
                             onClick={() => setTagCodeType('GTIN')}
                             className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${tagCodeType === 'GTIN' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                             GTIN / EAN
                          </button>
                          <button 
                             onClick={() => setTagCodeType('INTERNAL')}
                             className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${tagCodeType === 'INTERNAL' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                             Cód. Interno
                          </button>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Middle: Print Queue */}
              <div className="w-full md:w-[30%] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-1/3 md:h-full">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                      <h4 className="font-bold text-gray-700 text-sm uppercase mb-2">Fila de Impressão</h4>
                      <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                              type="text"
                              value={tagSearchTerm}
                              onChange={(e) => setTagSearchTerm(e.target.value)}
                              placeholder="Adicionar produto à fila..."
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-500"
                          />
                          {tagSearchTerm && (
                              <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-lg rounded-lg mt-1 max-h-48 overflow-y-auto z-20">
                                  {productsForTagSearch.map(p => (
                                      <button 
                                          key={p.id}
                                          onClick={() => {
                                              addToPrintQueue(p);
                                              setTagSearchTerm('');
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
                                      >
                                          {p.name}
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                      {printQueue.length === 0 ? (
                          <div className="text-center p-8 text-gray-400 text-sm">
                              A fila está vazia. Adicione produtos para imprimir.
                          </div>
                      ) : (
                          printQueue.map(item => (
                              <div key={item.product.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                                  <div className="flex-1 min-w-0 mr-2">
                                      <p className="font-bold text-sm text-gray-800 truncate">{item.product.name}</p>
                                      <p className="text-[10px] text-gray-500">{tagCodeType}: {tagCodeType === 'INTERNAL' ? item.product.internalCode : item.product.barcode}</p>
                                  </div>
                                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                      <button onClick={() => updateQueueQuantity(item.product.id, -1)} className="p-1 hover:bg-white rounded shadow-sm"><Minus size={12} /></button>
                                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                      <button onClick={() => updateQueueQuantity(item.product.id, 1)} className="p-1 hover:bg-white rounded shadow-sm"><Plus size={12} /></button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* Right Side: Preview */}
              <div className="flex-1 bg-gray-200 flex flex-col h-full overflow-hidden">
                 <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2">
                       <Component size={18} /> <span className="hidden md:inline">Visualização (Preview)</span>
                    </h4>
                    <button onClick={() => setIsTagModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                 </div>
                 
                 <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-auto relative">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

                    {/* IFRAME for Sandbox rendering */}
                    <div className="bg-white shadow-2xl p-0 overflow-hidden border-4 border-gray-300 rounded-sm relative z-10 max-w-full">
                       <iframe 
                         srcDoc={previewHtml}
                         title="Preview"
                         style={{ 
                            width: tagModel === 'SHELF_LABEL' ? '350px' : (tagModel === 'HANG_TAG' ? '200px' : (tagModel === 'ADHESIVE_50x30' ? '220px' : '250px')),
                            height: tagModel === 'SHELF_LABEL' ? '180px' : (tagModel === 'HANG_TAG' ? '300px' : (tagModel === 'ADHESIVE_50x30' ? '150px' : '300px')),
                            border: 'none',
                            background: 'white',
                            display: 'block',
                            maxWidth: '100%'
                         }}
                       />
                    </div>
                    {printQueue.length > 0 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs">
                            Mostrando 1ª etiqueta
                        </div>
                    )}
                 </div>

                 <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
                    <button 
                       disabled={printQueue.length === 0}
                       onClick={handlePrintTag}
                       className="flex items-center gap-2 px-6 py-3 bg-purple-600 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 hover:scale-105 transition-all text-sm md:text-base"
                    >
                       <Printer size={20} />
                       IMPRIMIR {printQueue.reduce((acc, i) => acc + i.quantity, 0)} TAGS
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
