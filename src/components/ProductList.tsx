import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductVariation, User, Promotion } from '../types';
import { 
  Edit2, Trash2, Plus, X, Upload, DollarSign, Tag, Printer, Barcode, 
  Layers, ShoppingBag, Minus, Search, CheckCircle2, Sparkles, Copy, 
  RefreshCw, Check, AlertCircle, Eye
} from 'lucide-react';
import { compressImageToBase64Webp, isHeicFile } from '../imageOptimizer';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../context/ToastContext';
import { db } from '../database';

interface ProductListProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: any) => void;
  currentUser: User | null;
  promotions?: Promotion[];
}

export const ProductList: React.FC<ProductListProps> = ({ 
  products, 
  onUpdateProduct, 
  onAddProduct, 
  onDeleteProduct, 
  currentUser,
  promotions = []
}) => {
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.isOwner === true;
  const isManager = currentUser?.role === 'MANAGER';
  const canManage = isOwner || isManager || currentUser?.role === 'ADMIN';
  const toast = useToast();

  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [viewProductDetails, setViewProductDetails] = useState<Product | null>(null);

  // Busca e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Estados do Produto Base (Pai) e Grade (Filhos)
  const [formData, setFormData] = useState<Partial<Product>>({ 
    name: '', 
    category: '', 
    price: 0, 
    costPrice: 0, 
    stock: 0, 
    barcode: '', 
    internalCode: '', 
    description: '', 
    image: '',
    variations: []
  });
  const [variationsList, setVariationsList] = useState<ProductVariation[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Estados da Etiquetadora de Código de Barras
  const [selectedProductForTags, setSelectedProductForTags] = useState<Product | null>(null);

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    const targetId = productToDelete.id;
    const prodName = productToDelete.name;

    // 1. Fecha o modal imediatamente (Zero delay, some na hora!)
    setDeleteModalOpen(false);
    setProductToDelete(null);
    setIsDeleting(false);

    // 2. Dispara remoção local e notifica
    onDeleteProduct(targetId);
    toast.success("Produto Excluído", `Peça "${prodName}" removida do catálogo.`);

    // 3. Exclusão assíncrona no Firestore em segundo plano
    db.delete('products', targetId).catch(err => {
      console.error("Erro ao excluir produto:", err);
    });
  };

  // Categorias únicas existentes
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  // Filtro de produtos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm)) ||
                          (p.internalCode && p.internalCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.variations && p.variations.some(v => 
                            (v.sku && v.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (v.barcode && v.barcode.includes(searchTerm)) ||
                            (v.size && v.size.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (v.color && v.color.toLowerCase().includes(searchTerm.toLowerCase()))
                          ));
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Abertura do Modal de Cadastro / Edição Pai e Filho
  const handleOpenModal = (product?: Product) => {
    if (product) { 
      setFormData(product); 
      setPreviewImage(product.image || null); 
      setVariationsList(product.variations || []);
    } else { 
      const newBaseCode = 'PM-' + Math.floor(1000 + Math.random() * 9000);
      setFormData({ 
        name: '', 
        category: 'Vestuário', 
        price: 0, 
        costPrice: 0, 
        stock: 0, 
        barcode: '', 
        internalCode: newBaseCode, 
        description: '', 
        image: '',
        variations: []
      }); 
      setPreviewImage(null); 
      // Variações iniciais sugeridas para o produto pai
      setVariationsList([
        { 
          id: `var_${Date.now()}_1`, 
          size: '38', 
          color: 'Azul', 
          stock: 5, 
          barcode: '', 
          sku: `${newBaseCode}-38-AZ` 
        },
        { 
          id: `var_${Date.now()}_2`, 
          size: '40', 
          color: 'Azul', 
          stock: 5, 
          barcode: '', 
          sku: `${newBaseCode}-40-AZ` 
        }
      ]);
    }
    setIsModalOpen(true);
  };

  // Adicionar Variação Dinâmica (Filho)
  const handleAddVariationRow = () => {
    const base = formData.internalCode || 'PM';
    const count = variationsList.length + 1;
    setVariationsList(prev => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        size: 'M',
        color: 'Única',
        stock: 5,
        barcode: '',
        sku: `${base}-${count}`
      }
    ]);
  };

  // Remover Variação
  const handleRemoveVariationRow = (index: number) => {
    setVariationsList(prev => prev.filter((_, i) => i !== index));
  };

  // Modificar Campo de Variação
  const handleVariationChange = (index: number, field: keyof ProductVariation, value: any) => {
    setVariationsList(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  // Gerar SKU Automático para uma variação
  const handleAutoGenerateSku = (index: number) => {
    const v = variationsList[index];
    const base = formData.internalCode || formData.name?.substring(0, 3).toUpperCase() || 'PM';
    const s = (v.size || 'U').replace(/\s+/g, '').toUpperCase();
    const c = (v.color || 'UN').substring(0, 2).toUpperCase();
    const autoSku = `${base}-${s}-${c}`;
    handleVariationChange(index, 'sku', autoSku);
  };

  // Upload Inteligente Autônomo (Base64 WebP direto no Firestore)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadingImage(true);
    setUploadProgress(10);
    setUploadStatusText('Lendo arquivo de imagem...');

    // Preview preliminar imediato
    const isHeic = isHeicFile(file);
    if (!isHeic) {
      const tempPreviewUrl = URL.createObjectURL(file);
      setPreviewImage(tempPreviewUrl);
    } else {
      setUploadStatusText('Foto do iPhone (HEIC) detectada. Convertendo...');
    }

    try {
      const base64Url = await compressImageToBase64Webp(
        file,
        (pct, statusMsg) => {
          setUploadProgress(pct);
          setUploadStatusText(statusMsg);
        }
      );

      // Salva Base64 WebP diretamente no estado do produto
      setPreviewImage(base64Url);
      setFormData(prev => ({ ...prev, image: base64Url }));
      setUploadProgress(100);
      setUploadStatusText('Foto otimizada com sucesso!');
      toast.success("Foto Otimizada", "Imagem convertida em WebP e pronta para salvar.");

      setTimeout(() => {
        setUploadingImage(false);
        setUploadProgress(0);
        setUploadStatusText('');
      }, 400);
    } catch (err: any) {
      console.error("Erro no processamento da imagem:", err);
      const errMsg = err.message || 'Erro ao processar imagem.';
      setUploadError(errMsg);
      toast.error("Erro na Foto", errMsg);
      setUploadingImage(false);
      setUploadProgress(0);
    } finally {
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewImage(null);
    setFormData(prev => ({ ...prev, image: '' }));
    setUploadError(null);
    setUploadStatusText('');
  };

  // Salvar Produto Pai e Filhos (Grade)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadingImage) {
      toast.warning("Processamento em Andamento", "Aguarde a otimização da foto antes de salvar.");
      return;
    }

    if (!formData.name?.trim() || !formData.category?.trim() || (Number(formData.price) || 0) <= 0) {
      toast.warning("Dados Incompletos", "Preencha o nome, categoria, preço e pelo menos uma variação da grade.");
      return;
    }

    if (variationsList.length === 0) {
      toast.warning("Grade Obrigatória", "Adicione pelo menos uma variação (tamanho/cor) para compor a grade do produto.");
      return;
    }

    // Calcula estoque total como soma de todas as variações
    const calculatedStock = variationsList.length > 0 
      ? variationsList.reduce((acc, v) => acc + (Number(v.stock) || 0), 0)
      : Number(formData.stock) || 0;

    const finalProductData: Product = {
      ...formData,
      id: formData.id || Date.now(),
      name: formData.name.trim(),
      price: Number(formData.price) || 0,
      costPrice: Number(formData.costPrice) || 0,
      category: formData.category || 'Geral',
      stock: calculatedStock,
      barcode: formData.barcode || (variationsList[0]?.barcode || ''),
      internalCode: formData.internalCode || `PM-${Date.now().toString().slice(-4)}`,
      description: formData.description || '',
      image: previewImage || undefined,
      variations: variationsList
    };

    if (formData.id) { 
      onUpdateProduct(finalProductData); 
      toast.success("Produto Atualizado", `Peça "${finalProductData.name}" atualizada com sucesso no catálogo.`);
    } else { 
      onAddProduct(finalProductData); 
      toast.success("Produto Cadastrado", `Peça "${finalProductData.name}" cadastrada com sucesso com ${variationsList.length} variações.`);
    }

    setIsModalOpen(false);
  };

  // Abertura do Modal de Impressão de Etiquetas com Código de Barras
  const handleOpenTagModal = (product: Product) => {
    setSelectedProductForTags(product);
    setIsTagModalOpen(true);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Catálogo de Produtos & Grade</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de produtos, grade de variações (Tamanho/Cor) e emissão de etiquetas térmicas com SKU.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleOpenModal()} 
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-purple-900/10 flex items-center gap-2 transition"
            >
              <Plus size={16} /> Cadastrar Produto com Grade
            </button>
          </div>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por nome, SKU interno ou código de barras..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
          />
        </div>

        {/* Filtro por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-bold">
          <button 
            onClick={() => setSelectedCategory('ALL')} 
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${selectedCategory === 'ALL' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todas ({products.length})
          </button>
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)} 
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${selectedCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Produtos com Estrutura Pai & Filho */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Produto Base</th>
                <th className="px-6 py-4">Categoria / Ref</th>
                <th className="px-6 py-4">Grade de Variações</th>
                <th className="px-6 py-4 text-center">Estoque Total</th>
                <th className="px-6 py-4 text-right">Preço de Venda</th>
                <th className="px-6 py-4 text-center">Ações & Etiquetas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const totalStock = product.stock || (product.variations ? product.variations.reduce((acc, v) => acc + v.stock, 0) : 0);
                  const hasVariations = product.variations && product.variations.length > 0;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition">
                      {/* Foto e Nome Pai */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 overflow-hidden flex items-center justify-center shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag size={20} className="text-purple-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 text-sm block">{product.name}</span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              SKU Base: {product.internalCode || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-[11px] font-semibold">
                          {product.category || 'Geral'}
                        </span>
                      </td>

                      {/* Grade de Variações (Tamanhos e Cores) */}
                      <td className="px-6 py-4">
                        {hasVariations ? (
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {product.variations!.map((v) => (
                              <span 
                                key={v.id} 
                                className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200/70 rounded-md text-[10px] font-bold flex items-center gap-1"
                                title={`SKU: ${v.sku || 'Sem SKU'} • EAN: ${v.barcode || 'Sem EAN'}`}
                              >
                                <span>{v.size}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-gray-600">{v.color}</span>
                                <span className="bg-purple-200/80 text-purple-950 px-1 rounded text-[9px]">{v.stock} un</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Produto sem grade de variações</span>
                        )}
                      </td>

                      {/* Estoque Total */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${totalStock <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {totalStock} un.
                        </span>
                      </td>

                      {/* Preço de Venda */}
                      <td className="px-6 py-4 text-right font-black text-gray-900 text-sm">
                        {formatCurrency(product.price)}
                      </td>

                      {/* Ações: Imprimir Etiquetas + Editar + Excluir */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          {/* Botão Dedicado de Imprimir Etiquetas Térmicas com Código de Barras */}
                          <button 
                            type="button"
                            onClick={() => handleOpenTagModal(product)} 
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                            title="Imprimir Etiquetas com Código de Barras (Zebra, Argox, Elgin, Bobinas 50x30)"
                          >
                            <Barcode size={14} className="text-purple-600" /> Etiquetas
                          </button>

                          {canManage ? (
                            <>
                              <button 
                                onClick={() => handleOpenModal(product)} 
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                                title="Editar produto e grade"
                              >
                                <Edit2 size={15}/>
                              </button>
                              <button 
                                onClick={() => {
                                  setProductToDelete(product);
                                  setDeleteModalOpen(true);
                                }} 
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                title="Excluir produto"
                              >
                                <Trash2 size={15}/>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setViewProductDetails(product)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition"
                              title="Visualizar detalhes e variações da peça"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    Nenhum produto cadastrado ou localizado com a busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO NO MODELO PAI & FILHO (GRADE)            */}
      {/* Produto Base + N Variações Dinâmicas (Tamanho, Cor, Qtd, EAN, SKU)*/}
      {/* ================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Grade de Variações • Tamanhos e Cores
                </span>
                <h3 className="text-xl font-black text-gray-900 mt-1">
                  {formData.id ? 'Editar Produto & Grade' : 'Cadastrar Novo Produto com Grade'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informações Básicas do Produto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Foto da Peça com Suporte Universal (iPhone HEIC, Android, PC) */}
                <div className="md:col-span-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">Foto da Peça</label>
                    {previewImage && !uploadingImage && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-[11px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    )}
                  </div>

                  <div className={`w-full aspect-square border-2 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden transition ${
                    uploadingImage 
                      ? 'border-purple-300 bg-purple-50/50' 
                      : previewImage 
                      ? 'border-gray-200 bg-white' 
                      : 'border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-purple-300 cursor-pointer'
                  }`}>
                    {previewImage ? (
                      <div className="relative w-full h-full group">
                        <img src={previewImage} alt="Foto do Produto" className="w-full h-full object-cover" />
                        
                        {/* Overlay hover para trocar foto */}
                        {!uploadingImage && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold p-3 text-center cursor-pointer">
                            <Upload size={24} className="mb-1.5 text-white" />
                            <span>Trocar Foto</span>
                            <span className="text-[10px] text-gray-200 font-normal mt-0.5">iPhone (HEIC), WebP, JPG, PNG</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center p-4 text-gray-400">
                        <Upload size={28} className="mx-auto mb-2 text-purple-500" />
                        <span className="text-xs font-semibold block text-gray-700">Enviar Foto</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">iPhone (HEIC), JPG, PNG, WebP</span>
                        <span className="text-[9px] text-purple-600 font-bold block mt-1">Otimizada em WebP (Máx 800px)</span>
                      </div>
                    )}

                    {/* Feedback e Progresso de Upload / Otimização */}
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 text-center animate-in fade-in">
                        <RefreshCw size={26} className="text-purple-600 animate-spin mb-2" />
                        <span className="text-xs font-black text-gray-900 leading-tight mb-1">{uploadStatusText}</span>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2 border">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-full transition-all duration-300 rounded-full" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-purple-700 mt-1">{uploadProgress}%</span>
                      </div>
                    )}

                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,image/*" 
                      disabled={uploadingImage}
                      onChange={handleImageChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
                    />
                  </div>

                  {uploadError && (
                    <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle size={14} className="shrink-0 text-red-500" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </div>

                {/* Dados Principais do Produto */}
                <div className="md:col-span-2 space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Nome do Produto <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ex: Calça Jeans Flare Elegance" 
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })} 
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500" 
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        Preço de Venda (R$) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        placeholder="0.00"
                        value={formData.price || ''} 
                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} 
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Preço de Custo (R$)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        value={formData.costPrice || ''} 
                        onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })} 
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Categoria</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Calças, Vestidos..." 
                        value={formData.category} 
                        onChange={e => setFormData({ ...formData, category: e.target.value })} 
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Código de Referência Base</label>
                      <input 
                        type="text" 
                        placeholder="Ex: CJF-01" 
                        value={formData.internalCode} 
                        onChange={e => setFormData({ ...formData, internalCode: e.target.value })} 
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Subcoleção de Variações Dinâmicas (Grade: Tamanho, Cor, Qtd, EAN, SKU) */}
              <div className="border border-purple-100 bg-purple-50/30 p-5 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <Layers size={18} className="text-purple-600" />
                      Grade de Variações Dinâmicas ({variationsList.length} variações)
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Adicione 'N' variações com Tamanho, Cor, Quantidade, Código de Barras (EAN) e SKU Próprio da Loja.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddVariationRow} 
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/10 transition"
                  >
                    <Plus size={14} /> Adicionar Variação
                  </button>
                </div>

                <div className="space-y-2.5">
                  {variationsList.map((v, idx) => (
                    <div key={v.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                      {/* Tamanho */}
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-400 font-bold block mb-0.5">Tamanho</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="38, P..." 
                          value={v.size} 
                          onChange={e => handleVariationChange(idx, 'size', e.target.value)} 
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      {/* Cor */}
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-400 font-bold block mb-0.5">Cor</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Azul, Preto..." 
                          value={v.color} 
                          onChange={e => handleVariationChange(idx, 'color', e.target.value)} 
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-400 font-bold block mb-0.5">Quantidade</label>
                        <input 
                          type="number" 
                          min="0"
                          required 
                          placeholder="0"
                          value={v.stock} 
                          onChange={e => handleVariationChange(idx, 'stock', parseInt(e.target.value) || 0)} 
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-center font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      {/* Código de Barras (Fábrica / EAN) */}
                      <div className="col-span-3">
                        <label className="text-[10px] text-gray-400 font-bold block mb-0.5">Código de Barras (EAN)</label>
                        <input 
                          type="text" 
                          placeholder="789... (Fábrica)" 
                          value={v.barcode || ''} 
                          onChange={e => handleVariationChange(idx, 'barcode', e.target.value)} 
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      {/* Código Interno (SKU Próprio da Loja) */}
                      <div className="col-span-2">
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] text-gray-400 font-bold">SKU Loja</label>
                          <button 
                            type="button" 
                            onClick={() => handleAutoGenerateSku(idx)}
                            className="text-[9px] text-purple-600 font-bold hover:underline"
                            title="Gerar código baseado na referência, tamanho e cor"
                          >
                            Gerar
                          </button>
                        </div>
                        <input 
                          type="text" 
                          placeholder="SKU Próprio" 
                          value={v.sku || ''} 
                          onChange={e => handleVariationChange(idx, 'sku', e.target.value)} 
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      {/* Botão de Excluir Variação */}
                      <div className="col-span-1 text-center pt-3 md:pt-4">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveVariationRow(idx)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Remover esta variação"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações do Formulário */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={uploadingImage}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingImage && <RefreshCw size={14} className="animate-spin" />}
                  <span>Salvar Produto com Grade</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL DE IMPRESSÃO DE ETIQUETAS COM CÓDIGO DE BARRAS              */}
      {/* ================================================================= */}
      <BarcodeLabelModal 
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        product={selectedProductForTags}
        promotions={promotions}
      />

      {/* MODAL: VISUALIZAÇÃO DE DETALHES (MODO LEITURA / VENDEDOR) */}
      {viewProductDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl overflow-hidden flex items-center justify-center shrink-0">
                  {viewProductDetails.image ? (
                    <img src={viewProductDetails.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={24} className="text-purple-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">{viewProductDetails.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">
                    SKU: {viewProductDetails.internalCode || 'N/A'} • Cat: {viewProductDetails.category || 'Geral'}
                  </p>
                  <p className="text-sm font-black text-purple-700 mt-0.5">{formatCurrency(viewProductDetails.price)}</p>
                </div>
              </div>
              <button onClick={() => setViewProductDetails(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Grade de Variações em Estoque</h4>
              {viewProductDetails.variations && viewProductDetails.variations.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {viewProductDetails.variations.map(v => (
                    <div key={v.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-200/70 text-xs">
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>Tam: {v.size}</span>
                        <span className="text-purple-700">{v.stock} un.</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">Cor: {v.color}</p>
                      {v.sku && <p className="text-[10px] text-gray-400 font-mono mt-1">SKU: {v.sku}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                  Estoque Geral: <strong>{viewProductDetails.stock} unidades</strong>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {/* Botão de Imprimir Etiqueta da Peça no Modal do Vendedor */}
              <button
                type="button"
                onClick={() => {
                  handleOpenTagModal(viewProductDetails);
                }}
                className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs border border-purple-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Barcode size={15} /> Imprimir Etiquetas com Código de Barras
              </button>

              <button
                onClick={() => setViewProductDetails(null)}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Confirm Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Excluir Produto"
        message={`Tem certeza que deseja remover "${productToDelete?.name || ''}" do catálogo?`}
        confirmText="Sim, Excluir"
        cancelText="Não, Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
          setIsDeleting(false);
        }}
        isLoading={false}
      />
    </div>
  );
};

export default ProductList;
