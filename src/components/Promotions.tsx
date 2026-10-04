import React, { useState, useMemo, useEffect } from 'react';
import { Product, Sale, Promotion, User } from '../types';
import { 
  Tag, Plus, Search, Calendar, AlertCircle, Percent, 
  Trash2, X, Check, Flame, ArrowRight, DollarSign,
  Clock, CheckCircle2, AlertTriangle, Layers
} from 'lucide-react';
import { db } from '../database';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from './ConfirmModal';

const sanitize = (obj: any): any => JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));

interface PromotionsProps {
  products: Product[];
  sales: Sale[];
  promotions: Promotion[];
  onSavePromotion: (promotion: Promotion) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  currentUser: User | null;
}

export const Promotions: React.FC<PromotionsProps> = ({
  products = [],
  sales = [],
  promotions = [],
  onSavePromotion,
  onDeletePromotion,
  currentUser: _currentUser
}) => {
  const toast = useToast();
  const [localPromotions, setLocalPromotions] = useState<Promotion[]>(promotions);

  useEffect(() => {
    setLocalPromotions(promotions);
  }, [promotions]);

  const setPromotions = setLocalPromotions;

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulário de Nova Promoção
  const [promoTitle, setPromoTitle] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_PRICE'>('PERCENTAGE');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [promotionalPrice, setPromotionalPrice] = useState<number>(0);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedProductIds, setSelectedProductIds] = useState<(string | number)[]>([]);

  // Radar Inteligente de Estoque Parado (> 30 dias sem venda)
  const stagnantProducts = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const limitDateStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

    const lastSaleDateMap: { [productId: string]: string } = {};
    sales.forEach(s => {
      const sDate = s.date || (s.timestamp ? s.timestamp.substring(0, 10) : '');
      (s.items || []).forEach(item => {
        const idStr = String(item.id);
        if (!lastSaleDateMap[idStr] || sDate > lastSaleDateMap[idStr]) {
          lastSaleDateMap[idStr] = sDate;
        }
      });
    });

    return products.filter(p => {
      if ((p.stock || 0) <= 0) return false;
      const lastDate = lastSaleDateMap[String(p.id)];
      return !lastDate || lastDate < limitDateStr;
    });
  }, [products, sales]);

  const handleBatchPromoteStagnant = (discountPct: number) => {
    const ids = stagnantProducts.slice(0, 10).map(p => p.id);
    if (ids.length === 0) return;

    const promoId = `promo_${Date.now()}`;
    const newPromotion: Promotion = {
      id: promoId,
      name: `Liquidação Estoque Parado (-${discountPct}%)`,
      title: `Liquidação Estoque Parado (-${discountPct}%)`,
      discountType: 'PERCENTAGE',
      discountPercent: discountPct,
      startDate: todayStr,
      endDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      productIds: ids,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    setPromotions(prev => [newPromotion, ...prev]);
    toast.success("Promoção Ativada", "Campanha rápida de estoque parado ativa no caixa!");

    db.save('promotions', sanitize(newPromotion))
      .then(() => {
        if (onSavePromotion) {
          onSavePromotion(newPromotion).catch(() => {});
        }
      })
      .catch(err => console.error("Erro background sync radar:", err));
  };

  const handleConfirmDelete = () => {
    if (!promoToDelete) return;
    const targetId = promoToDelete.id;

    // 1. Fecha o modal imediatamente (Zero delay, some na hora!)
    setDeleteModalOpen(false);
    setPromoToDelete(null);
    setIsDeleting(false);

    // 2. Atualização otimista imediata na interface
    setPromotions(prev => prev.filter(p => (p.id || (p as any)._id) !== targetId));

    // 3. Notificação de sucesso
    toast.success("Promoção excluída com sucesso!");

    // 4. Exclusão assíncrona em segundo plano
    db.delete('promotions', targetId).then(() => {
      if (onDeletePromotion) {
        onDeletePromotion(targetId).catch(() => {});
      }
    }).catch(err => {
      console.error("Erro ao deletar promoção:", err);
    });
  };

  const enrichedPromotions = useMemo(() => {
    return localPromotions.map(p => {
      let status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' = 'ACTIVE';
      if (todayStr < p.startDate) {
        status = 'SCHEDULED';
      } else if (todayStr > p.endDate) {
        status = 'EXPIRED';
      }
      return {
        ...p,
        calculatedStatus: status
      };
    });
  }, [localPromotions, todayStr]);

  const filteredModalProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(modalSearch)) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(modalSearch.toLowerCase()))
    );
  }, [products, modalSearch]);

  const handleOpenNewModal = () => {
    setPromoTitle('');
    setDiscountType('PERCENTAGE');
    setDiscountPercent(10);
    setPromotionalPrice(0);
    setStartDate(todayStr);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setEndDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setSelectedProductIds([]);
    setModalSearch('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim()) {
      toast.warning("Título Obrigatório", "Dê um nome ou título para a promoção.");
      return;
    }
    if (selectedProductIds.length === 0) {
      toast.warning("Produtos Necessários", "Selecione ao menos um produto para participar da promoção.");
      return;
    }

    const promoId = `promo_${Date.now()}`;
    const newPromotion: Promotion = {
      id: promoId,
      name: promoTitle.trim(),
      title: promoTitle.trim(),
      discountType,
      discountPercent: discountType === 'PERCENTAGE' ? discountPercent : undefined,
      promotionalPrice: discountType === 'FIXED_PRICE' ? promotionalPrice : undefined,
      startDate,
      endDate,
      productIds: selectedProductIds,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    setIsModalOpen(false);
    setPromotions(prev => [newPromotion, ...prev]);
    toast.success("Promoção Criada", "Campanha cadastrada com sucesso!");

    try {
      await db.save('promotions', sanitize(newPromotion));
      if (onSavePromotion) {
        onSavePromotion(newPromotion).catch(() => {});
      }
    } catch (err) {
      console.error("Erro ao salvar promoção:", err);
      toast.error("Erro ao Salvar", "Não foi possível gravar no banco.");
    }
  };

  const toggleSelectProduct = (id: string | number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllProducts = () => {
    setSelectedProductIds(filteredModalProducts.map(p => p.id));
  };

  const clearSelectedProducts = () => {
    setSelectedProductIds([]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Título & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Tag size={22} className="text-purple-600" />
            <span>Gestão de Promoções & Liquidações</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            Crie campanhas de desconto percentual ou preço fixo para o PDV e monitore o estoque parado.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition cursor-pointer"
        >
          <Plus size={16} /> <span>Nova Promoção</span>
        </button>
      </div>

      {/* Radar Inteligente de Estoque Parado */}
      {stagnantProducts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                <Flame size={16} />
              </span>
              <div>
                <h3 className="text-sm font-black text-amber-900 flex items-center gap-1.5">
                  <span>Radar Inteligente: Estoque Parado (+30 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-bold">
                    {stagnantProducts.length} itens sugeridos
                  </span>
                </h3>
                <p className="text-xs text-amber-800">
                  Peças com estoque positivo que não registraram nenhuma saída nos últimos 30 dias.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleBatchPromoteStagnant(10)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>Liquidar com -10%</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchPromoteStagnant(15)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Liquidar com -15%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
            {stagnantProducts.slice(0, 5).map(p => (
              <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                <span className="text-[10px] font-mono text-gray-400 block">{p.internalCode || `#${p.id}`}</span>
                <span className="text-xs font-bold text-gray-900 truncate block mt-0.5" title={p.name}>
                  {p.name}
                </span>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100 text-xs">
                  <span className="text-gray-500 font-medium">{p.stock} un</span>
                  <span className="font-bold text-gray-800">R$ {p.price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listagem Geral de Campanhas */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 lg:p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <Tag size={17} className="text-purple-600" />
            <span>Campanhas Cadastradas ({enrichedPromotions.length})</span>
          </h2>
          <span className="text-xs text-gray-400 font-medium">Hoje: {todayStr.split('-').reverse().join('/')}</span>
        </div>

        {enrichedPromotions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs space-y-2">
            <Tag size={32} className="mx-auto text-gray-300 mb-1" />
            <p className="font-bold text-gray-600">Nenhuma campanha cadastrada</p>
            <p>Clique em "+ Nova Promoção" para criar sua primeira liquidação.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrichedPromotions.map(promo => {
              const promoId = promo.id || (promo as any)._id;
              const isActive = promo.calculatedStatus === 'ACTIVE';
              const isScheduled = promo.calculatedStatus === 'SCHEDULED';
              const isExpired = promo.calculatedStatus === 'EXPIRED';

              const promoProducts = products.filter(p => promo.productIds.includes(p.id));

              return (
                <div key={promoId} className="p-4 lg:p-5 hover:bg-gray-50/60 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          isActive 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isScheduled
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}>
                          {isActive && <CheckCircle2 size={12} />}
                          {isScheduled && <Clock size={12} />}
                          {isExpired && <AlertTriangle size={12} />}
                          <span>{isActive ? 'Ativa no Caixa' : isScheduled ? 'Agendada' : 'Encerrada'}</span>
                        </span>

                        <h3 className="text-sm font-black text-gray-900">{promo.title || promo.name}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" />
                          <span>
                            {promo.startDate.split('-').reverse().join('/')} até {promo.endDate.split('-').reverse().join('/')}
                          </span>
                        </span>

                        <span className="text-gray-300">•</span>

                        <span className="font-bold text-purple-700">
                          {promo.discountType === 'PERCENTAGE' 
                            ? `${promo.discountPercent}% de Desconto`
                            : `Preço Fixo: R$ ${promo.promotionalPrice?.toFixed(2)}`}
                        </span>

                        <span className="text-gray-300">•</span>

                        <span>{promo.productIds.length} produtos participantes</span>
                      </div>
                    </div>

                    {/* Excluir Campanha */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!promoId) return;
                        setPromoToDelete({ id: String(promoId), title: promo.title || promo.name || 'Promoção' });
                        setDeleteModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Excluir campanha"
                    >
                      <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {promoProducts.slice(0, 8).map(p => (
                      <span key={p.id} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200">
                        {p.name}
                      </span>
                    ))}
                    {promoProducts.length > 8 && (
                      <span className="text-[11px] text-gray-400 font-bold px-1.5 py-0.5">
                        +{promoProducts.length - 8} outros
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Cadastro de Promoção */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 lg:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900">Nova Campanha Promocional</h3>
                <p className="text-xs text-gray-500">Defina o tipo de desconto e selecione as peças participantes</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Título da Campanha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Liquidação de Inverno (-20%)"
                  value={promoTitle}
                  onChange={e => setPromoTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Tipo de Desconto</label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="PERCENTAGE">Desconto Percentual (%)</option>
                    <option value="FIXED_PRICE">Preço Fixo Promocional (R$)</option>
                  </select>
                </div>

                {discountType === 'PERCENTAGE' ? (
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Percentual (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Preço Fixo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={promotionalPrice}
                      onChange={e => setPromotionalPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Data de Início</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Data de Término</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Seleção de Produtos */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-gray-900">
                    Selecionar Produtos Participantes ({selectedProductIds.length} selecionados)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllProducts}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearSelectedProducts}
                      className="text-[11px] font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar produto por nome ou código de barras..."
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {filteredModalProducts.map(p => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelectProduct(p.id)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected ? 'bg-purple-50/70 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded-sm text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-gray-900 block">{p.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">Estoque: {p.stock} un</span>
                          </div>
                        </div>
                        <span className="font-bold text-gray-800">R$ {p.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {filteredModalProducts.length === 0 && (
                    <div className="p-6 text-center text-gray-400 text-xs">
                      Nenhum produto encontrado.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition shadow-lg shadow-purple-900/20 cursor-pointer"
                >
                  Salvar Campanha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Confirm Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Excluir Promoção"
        message={`Tem certeza que deseja excluir a promoção "${promoToDelete?.title || ''}"?`}
        confirmText="Sim, Excluir"
        cancelText="Não, Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setPromoToDelete(null);
          setIsDeleting(false);
        }}
        isLoading={false}
      />
    </div>
  );
};

export default Promotions;
