import React, { useState, useMemo } from 'react';
import { 
  ArrowUpCircle, ArrowDownCircle, Plus, Calendar, Search, AlertTriangle, 
  Package, PackagePlus, ClipboardList, Filter, CheckCircle2, X, RefreshCw,
  Layers, User as UserIcon, Tag
} from 'lucide-react';
import { StockMovement, MovementType, Product, ProductVariation, User } from '../types';

interface InventoryProps {
  movements: StockMovement[];
  onAddMovement: (movement: StockMovement) => void;
  products: Product[];
  onUpdateProduct?: (product: Product) => void;
  currentUser?: User | null;
}

export const Inventory: React.FC<InventoryProps> = ({ 
  movements, 
  onAddMovement, 
  products,
  onUpdateProduct,
  currentUser
}) => {
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.isOwner === true;
  const isManager = currentUser?.role === 'MANAGER';
  const canManage = isOwner || isManager || currentUser?.role === 'ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ENTRY' | 'EXIT' | 'DAMAGE'>('ALL');

  // Modais
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);

  // Estados do Modal de Nova Entrada Manual
  const [selectedProductId, setSelectedProductId] = useState('');
  const [entryReason, setEntryReason] = useState('Reposição de Fornecedor');
  const [entrySupplier, setEntrySupplier] = useState('');
  const [entryUnitCost, setEntryUnitCost] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [simpleQuantity, setSimpleQuantity] = useState('1');
  // Para produtos com grade: mapa de variationId -> quantidade
  const [variationQtys, setVariationQtys] = useState<{ [varId: string]: number }>({});

  // Estados do Modal de Avaria
  const [damageProductId, setDamageProductId] = useState('');
  const [damageVariationId, setDamageVariationId] = useState('');
  const [damageQty, setDamageQty] = useState('1');
  const [damageReason, setDamageReason] = useState('Defeito / Peça Rasgada');

  const selectedProductForEntry = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProductId));
  }, [products, selectedProductId]);

  const selectedProductForDamage = useMemo(() => {
    return products.find(p => String(p.id) === String(damageProductId));
  }, [products, damageProductId]);

  // Ao selecionar produto na entrada, inicializa variações
  const handleSelectProductForEntry = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => String(p.id) === String(id));
    if (prod && prod.variations && prod.variations.length > 0) {
      const initial: { [key: string]: number } = {};
      prod.variations.forEach(v => { initial[v.id] = 0; });
      setVariationQtys(initial);
    } else {
      setVariationQtys({});
      setSimpleQuantity('1');
    }
  };

  // Submissão de Nova Entrada Manual
  const handleConfirmEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForEntry) return;

    const opName = currentUser?.firstName && currentUser?.lastName 
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser?.name || 'Administrador';

    const fullReason = entrySupplier.trim() 
      ? `ENTRADA MANUAL: ${entryReason} (${entrySupplier.trim()})`
      : `ENTRADA MANUAL: ${entryReason}`;

    if (selectedProductForEntry.variations && selectedProductForEntry.variations.length > 0) {
      // Entrada em grade
      let totalAdded = 0;
      const updatedVariations = selectedProductForEntry.variations.map(v => {
        const qtyToAdd = variationQtys[v.id] || 0;
        if (qtyToAdd > 0) {
          totalAdded += qtyToAdd;
          // Registra movimentação individual por variação
          const mov: StockMovement = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            productId: selectedProductForEntry.id,
            productName: `${selectedProductForEntry.name} (${v.size} / ${v.color})`,
            variationId: v.id,
            type: 'ENTRY',
            quantity: qtyToAdd,
            date: entryDate,
            reason: `${fullReason} [Tam: ${v.size}, Cor: ${v.color}]`,
            sellerId: currentUser?.id,
            sellerName: opName
          };
          onAddMovement(mov);
          return { ...v, stock: v.stock + qtyToAdd };
        }
        return v;
      });

      if (totalAdded === 0) {
        alert('Por favor, informe a quantidade de entrada para pelo menos uma das variações.');
        return;
      }

      if (onUpdateProduct) {
        const newTotalStock = updatedVariations.reduce((sum, v) => sum + v.stock, 0);
        onUpdateProduct({
          ...selectedProductForEntry,
          stock: newTotalStock,
          variations: updatedVariations,
          costPrice: entryUnitCost ? parseFloat(entryUnitCost) : selectedProductForEntry.costPrice
        });
      }
    } else {
      // Produto simples sem grade
      const qtyToAdd = parseInt(simpleQuantity) || 0;
      if (qtyToAdd <= 0) {
        alert('Informe uma quantidade válida.');
        return;
      }

      const mov: StockMovement = {
        id: Date.now(),
        productId: selectedProductForEntry.id,
        productName: selectedProductForEntry.name,
        type: 'ENTRY',
        quantity: qtyToAdd,
        date: entryDate,
        reason: fullReason,
        sellerId: currentUser?.id,
        sellerName: opName
      };
      onAddMovement(mov);

      if (onUpdateProduct) {
        onUpdateProduct({
          ...selectedProductForEntry,
          stock: selectedProductForEntry.stock + qtyToAdd,
          costPrice: entryUnitCost ? parseFloat(entryUnitCost) : selectedProductForEntry.costPrice
        });
      }
    }

    setIsEntryModalOpen(false);
    setSelectedProductId('');
    setEntrySupplier('');
    setEntryUnitCost('');
    setSimpleQuantity('1');
    setVariationQtys({});
  };

  // Submissão de Avaria
  const handleConfirmDamage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForDamage) return;

    const lostQty = parseInt(damageQty) || 0;
    if (lostQty <= 0) {
      alert('Informe uma quantidade válida para a avaria.');
      return;
    }

    const opName = currentUser?.firstName && currentUser?.lastName 
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser?.name || 'Administrador';

    let itemDesc = selectedProductForDamage.name;
    let updatedVars = selectedProductForDamage.variations;

    if (damageVariationId && updatedVars) {
      const targetVar = updatedVars.find(v => v.id === damageVariationId);
      if (targetVar) {
        itemDesc += ` (${targetVar.size} / ${targetVar.color})`;
        updatedVars = updatedVars.map(v => 
          v.id === damageVariationId ? { ...v, stock: Math.max(0, v.stock - lostQty) } : v
        );
      }
    }

    const mov: StockMovement = {
      id: Date.now(),
      productId: selectedProductForDamage.id,
      productName: itemDesc,
      variationId: damageVariationId || undefined,
      type: 'EXIT',
      quantity: lostQty,
      date: new Date().toISOString().split('T')[0],
      reason: `AVARIA / DEFEITO: ${damageReason}`,
      sellerId: currentUser?.id,
      sellerName: opName
    };
    onAddMovement(mov);

    if (onUpdateProduct) {
      const newStock = updatedVars 
        ? updatedVars.reduce((sum, v) => sum + v.stock, 0)
        : Math.max(0, selectedProductForDamage.stock - lostQty);
      onUpdateProduct({
        ...selectedProductForDamage,
        stock: newStock,
        variations: updatedVars
      });
    }

    setIsDamageModalOpen(false);
    setDamageProductId('');
    setDamageVariationId('');
    setDamageQty('1');
    setDamageReason('Defeito / Peça Rasgada');
  };

  // Estatísticas Rápidas
  const totalStockCount = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.stock || 0), 0);
  }, [products]);

  const recentMovementsCount = useMemo(() => movements.length, [movements]);

  // Filtro de Movimentações
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = (m.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (filterType === 'ENTRY') return m.type === 'ENTRY';
      if (filterType === 'EXIT') return m.type === 'EXIT';
      if (filterType === 'DAMAGE') return m.type === 'EXIT' && (m.reason || '').includes('AVARIA');

      return true;
    });
  }, [movements, searchTerm, filterType]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Superior com Botões de Ação */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Gestão de Estoque & Movimentações</h1>
            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full border border-purple-200">
              Admin
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle de inventário físico, cadastro de entradas manuais, perdas e auditoria de movimentações.
          </p>
        </div>

        {/* Botões de Ação em Destaque (Apenas Dono / Gerente) */}
        {canManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button 
              onClick={() => {
                setSelectedProductId('');
                setIsEntryModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/10 transition"
            >
              <PackagePlus size={16} /> Nova Entrada de Estoque
            </button>

            <button 
              onClick={() => {
                setDamageProductId('');
                setIsDamageModalOpen(true);
              }}
              className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-2 transition"
            >
              <AlertTriangle size={15} /> Registrar Avaria
            </button>
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total em Estoque</span>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{totalStockCount} peças</h3>
            <span className="text-[11px] text-gray-500">Distribuídas em {products.length} produtos</span>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center font-bold">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico de Movimentações</span>
            <h3 className="text-2xl font-black text-purple-900 mt-1">{recentMovementsCount} registros</h3>
            <span className="text-[11px] text-emerald-600 font-semibold">Auditoria em tempo real</span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <ClipboardList size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avarias Registradas</span>
            <h3 className="text-2xl font-black text-rose-700 mt-1">
              {movements.filter(m => (m.reason || '').includes('AVARIA')).length} baixas
            </h3>
            <span className="text-[11px] text-gray-500">Peças com defeito/descartadas</span>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por produto ou motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold w-full md:w-auto overflow-x-auto">
          <button 
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'ALL' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Todas
          </button>
          <button 
            onClick={() => setFilterType('ENTRY')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'ENTRY' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Entradas
          </button>
          <button 
            onClick={() => setFilterType('EXIT')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'EXIT' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Saídas / Vendas
          </button>
          <button 
            onClick={() => setFilterType('DAMAGE')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'DAMAGE' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Avarias
          </button>
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Data / Hora</th>
                <th className="px-6 py-3.5">Tipo</th>
                <th className="px-6 py-3.5">Produto / Grade</th>
                <th className="px-6 py-3.5 text-center">Quantidade</th>
                <th className="px-6 py-3.5">Motivo / Origem</th>
                <th className="px-6 py-3.5">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredMovements.length > 0 ? (
                filteredMovements.map((m) => {
                  const isEntry = m.type === 'ENTRY';
                  const isDamage = (m.reason || '').includes('AVARIA');

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-mono text-gray-600">
                        {m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          isDamage 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : isEntry 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {isDamage ? (
                            <AlertTriangle size={12} />
                          ) : isEntry ? (
                            <ArrowDownCircle size={12} />
                          ) : (
                            <ArrowUpCircle size={12} />
                          )}
                          {isDamage ? 'Avaria' : isEntry ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {m.productName}
                      </td>
                      <td className="px-6 py-4 text-center font-black">
                        <span className={`px-2 py-0.5 rounded-lg ${isEntry ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                          {isEntry ? `+${m.quantity}` : `-${m.quantity}`} un.
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {m.reason}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {m.sellerName || 'Sistema'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma movimentação localizada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL: NOVA ENTRADA DE ESTOQUE (CADASTRO MANUAL COM SUPORTE A GRADE) */}
      {/* ================================================================= */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 lg:p-7 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <PackagePlus size={20} className="text-emerald-600" /> Nova Entrada de Estoque (Manual)
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Cadastre a entrada de mercadoria avulsa ou reposição de grade</p>
              </div>
              <button onClick={() => setIsEntryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmEntry} className="space-y-4">
              {/* Seleção do Produto */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Selecione o Produto <span className="text-red-500">*</span>
                </label>
                <select 
                  required
                  value={selectedProductId}
                  onChange={e => handleSelectProductForEntry(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="">Selecione o produto na lista...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Estoque atual: {p.stock} un. • {p.variations ? `${p.variations.length} variações` : 'Sem grade'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Se o produto possuir grade: Lista de variações para preencher quantidades */}
              {selectedProductForEntry && selectedProductForEntry.variations && selectedProductForEntry.variations.length > 0 ? (
                <div className="border border-purple-100 bg-purple-50/40 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Layers size={15} /> Grade de Variações do Produto (Informe a quantidade de entrada)
                    </span>
                    <span className="text-[10px] text-purple-600 font-semibold">Total a somar</span>
                  </div>

                  <div className="divide-y divide-purple-100 bg-white rounded-xl border border-purple-100 overflow-hidden">
                    {selectedProductForEntry.variations.map((v) => (
                      <div key={v.id} className="p-3 flex items-center justify-between gap-3 hover:bg-purple-50/30 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">Tam: {v.size}</span>
                            <span className="text-xs text-gray-500">• Cor: {v.color}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono">
                            SKU: {v.sku || 'N/A'} • Estoque atual: <strong>{v.stock} un</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-bold">+</span>
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={variationQtys[v.id] || ''}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              setVariationQtys(prev => ({ ...prev, [v.id]: val }));
                            }}
                            className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-xs text-gray-400">un.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedProductForEntry ? (
                /* Produto Simples */
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Quantidade de Entrada <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={simpleQuantity}
                    onChange={e => setSimpleQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ) : null}

              {/* Informações Complementares da Entrada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Motivo / Tipo de Entrada</label>
                  <select 
                    value={entryReason}
                    onChange={e => setEntryReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="Reposição de Fornecedor">Reposição de Fornecedor</option>
                    <option value="Ajuste / Conferência de Balanço">Ajuste / Conferência de Balanço</option>
                    <option value="Devolução de Cliente">Devolução de Cliente</option>
                    <option value="Bonificação / Brinde">Bonificação / Brinde</option>
                    <option value="Entrada Avulsa">Entrada Avulsa</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Fornecedor / Ref. Nota (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Confecções Silva / NF 4051"
                    value={entrySupplier}
                    onChange={e => setEntrySupplier(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Custo Unitário (R$ Opcional)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Ex: 45.00"
                    value={entryUnitCost}
                    onChange={e => setEntryUnitCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Data da Entrada</label>
                  <input 
                    type="date" 
                    required
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={!selectedProductForEntry}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirmar Entrada no Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: REGISTRAR AVARIA / PERDA                                   */}
      {/* ================================================================= */}
      {isDamageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 border-l-4 border-rose-500">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-rose-700 text-base flex items-center gap-2">
                  <AlertTriangle size={18} /> Registrar Avaria / Defeito
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Dá baixa de peças danificadas no estoque</p>
              </div>
              <button onClick={() => setIsDamageModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDamage} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Selecione o Produto <span className="text-red-500">*</span>
                </label>
                <select 
                  required
                  value={damageProductId}
                  onChange={e => {
                    setDamageProductId(e.target.value);
                    setDamageVariationId('');
                  }}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Estoque atual: {p.stock} un.)
                    </option>
                  ))}
                </select>
              </div>

              {/* Variação se houver */}
              {selectedProductForDamage && selectedProductForDamage.variations && selectedProductForDamage.variations.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Variação Específica (Tamanho / Cor)
                  </label>
                  <select 
                    value={damageVariationId}
                    onChange={e => setDamageVariationId(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Todas as variações / Produto Pai</option>
                    {selectedProductForDamage.variations.map(v => (
                      <option key={v.id} value={v.id}>
                        Tam: {v.size} • Cor: {v.color} (Estoque: {v.stock} un.)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Qtd Avariada <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={damageQty}
                    onChange={e => setDamageQty(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Motivo do Defeito</label>
                  <select 
                    value={damageReason}
                    onChange={e => setDamageReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Defeito / Peça Rasgada">Peça Rasgada / Descosturada</option>
                    <option value="Zíper / Botão Quebrado">Zíper / Botão Quebrado</option>
                    <option value="Mancha Irremovível">Mancha Irremovível</option>
                    <option value="Perda / Extravio">Perda / Extravio</option>
                    <option value="Vencimento / Desgaste">Desgaste de Mostruário</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsDamageModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={!selectedProductForDamage}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirmar Baixa por Avaria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
