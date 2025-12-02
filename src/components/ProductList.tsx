
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

export const ProductList: React.FC<ProductListProps> = ({ products, onUpdateProduct, onAddProduct, onDeleteProduct, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [tagModel, setTagModel] = useState<LabelModel>('STANDARD');
  const [tagCodeType, setTagCodeType] = useState<'GTIN' | 'INTERNAL'>('GTIN');
  const [previewHtml, setPreviewHtml] = useState('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({ name: '', category: '', price: 0, costPrice: 0, stock: 0, barcode: '', internalCode: '', description: '', image: '' });

  const handleOpenModal = (product?: Product) => {
    if (product) { setFormData(product); setPreviewImage(product.image || null); } 
    else { setFormData({ name: '', category: '', price: 0, costPrice: 0, stock: 0, barcode: '', internalCode: '', description: '', image: '' }); setPreviewImage(null); }
    setIsModalOpen(true);
  };

  const handleOpenTagModal = (product?: Product) => {
    if (product) { setPrintQueue([{ product, quantity: 1 }]); setTagCodeType(product.barcode ? 'GTIN' : 'INTERNAL'); } else { setPrintQueue([]); }
    setTagModel('STANDARD'); setIsTagModalOpen(true);
  };

  useEffect(() => { if (isTagModalOpen) setPreviewHtml(printer.generateBatchTagHTML(printQueue, tagCodeType, tagModel)); }, [printQueue, tagModel, tagCodeType, isTagModalOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => { const result = reader.result as string; setPreviewImage(result); setFormData(prev => ({ ...prev, image: result })); }; reader.readAsDataURL(file); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id) onUpdateProduct(formData as Product); else onAddProduct({ ...formData, id: Date.now() } as Product);
    setIsModalOpen(false);
  };

  const calculateMarkup = (price: number, cost: number) => (!cost || cost === 0) ? 0 : ((price - cost) / cost) * 100;
  const productsForTagSearch = products.filter(p => tagSearchTerm && (p.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) || p.barcode.includes(tagSearchTerm)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Produtos</h1><div className="flex gap-2"><button onClick={() => handleOpenTagModal()} className="px-4 py-2 border rounded flex gap-2"><Tag size={20}/> Etiquetas</button><button onClick={() => handleOpenModal()} className="px-4 py-2 bg-purple-600 text-white rounded flex gap-2"><Plus size={20}/> Novo</button></div></div>
      <div className="bg-white rounded-xl shadow overflow-hidden"><table className="w-full text-left"><thead className="bg-gray-50 uppercase text-sm"><tr><th className="px-6 py-4">Produto</th><th className="px-6 py-4">Códigos</th><th className="px-6 py-4 text-right">Venda</th><th className="px-6 py-4 text-center">Ações</th></tr></thead><tbody>{products.map(product => (<tr key={product.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-medium">{product.name}</td><td className="px-6 py-4 text-xs">GTIN: {product.barcode}</td><td className="px-6 py-4 text-right">{product.price.toFixed(2)}</td><td className="px-6 py-4 flex justify-center gap-2"><button onClick={() => handleOpenTagModal(product)} className="p-2 text-gray-600"><Tag size={16}/></button><button onClick={() => handleOpenModal(product)} className="p-2 text-blue-600"><Edit2 size={16}/></button>{isAdmin && <button onClick={() => onDeleteProduct(product.id)} className="p-2 text-red-600"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div>
      {isModalOpen && (<div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4"><div className="bg-white w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"><h3 className="font-bold">Produto</h3><div className="flex gap-4"><div className="w-32 h-32 border-2 border-dashed flex justify-center items-center relative">{previewImage ? <img src={previewImage} className="w-full h-full object-cover" /> : <Upload />}<input type="file" onChange={handleImageChange} className="absolute inset-0 opacity-0" /></div><div className="flex-1 space-y-2"><input placeholder="Nome" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="w-full p-2 border rounded" /><input placeholder="Preço Venda" type="number" value={formData.price} onChange={e=>setFormData({...formData, price:parseFloat(e.target.value)})} className="w-full p-2 border rounded" /></div></div><div className="flex justify-end gap-2"><button onClick={()=>setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancelar</button><button onClick={handleSubmit} className="px-4 py-2 bg-purple-600 text-white rounded">Salvar</button></div></div></div>)}
      {isTagModalOpen && (<div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-4"><div className="bg-white w-full max-w-6xl h-[700px] rounded-2xl flex"><div className="w-1/3 border-r p-4 space-y-4"><h3>Estúdio</h3><button onClick={()=>setTagModel('ADHESIVE_50x30')} className="w-full p-2 border rounded">Adesiva</button><button onClick={()=>setTagModel('STANDARD')} className="w-full p-2 border rounded">Bobina</button><input placeholder="Adicionar produto..." value={tagSearchTerm} onChange={e=>setTagSearchTerm(e.target.value)} className="w-full p-2 border rounded" />{tagSearchTerm && <div className="border max-h-40 overflow-y-auto">{productsForTagSearch.map(p=><div key={p.id} onClick={()=>{setPrintQueue(prev=>[...prev,{product:p,quantity:1}]); setTagSearchTerm('');}} className="p-2 hover:bg-gray-100 cursor-pointer">{p.name}</div>)}</div>}<div className="flex-1 overflow-y-auto border p-2">{printQueue.map(i=> <div key={i.product.id} className="flex justify-between">{i.product.name} ({i.quantity})</div>)}</div></div><div className="flex-1 bg-gray-200 flex justify-center items-center p-4"><iframe srcDoc={previewHtml} style={{width:'300px', height:'300px', background:'white'}} /></div><div className="absolute top-4 right-4"><button onClick={()=>setIsTagModalOpen(false)}><X/></button></div><div className="absolute bottom-4 right-4"><button onClick={()=>printer.printQueue(printQueue, tagCodeType, tagModel)} className="px-6 py-3 bg-purple-600 text-white rounded shadow">IMPRIMIR</button></div></div></div>)}
    </div>
  );
};
