import React, { useState, useMemo, useRef } from 'react';
import { Product, ProductVariation, Promotion } from '../types';
import { 
  X, Printer, Tag, Barcode, Check, Copy, CheckCircle2, 
  Layers, ChevronDown, Sparkles, RefreshCw, ZoomIn
} from 'lucide-react';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  promotions?: Promotion[];
}

type LabelSizeModel = '50x30' | '40x25' | '60x40';

/**
 * Gerador Nativo de Código de Barras Code 128 (Subset B) em SVG Vetorial
 * Sem dependências externas de pacotes npm. 100% compatível com leitoras e cabeças térmicas.
 */
export function generateCode128Bars(text: string): { svgBars: { x: number; width: number }[]; totalWidth: number } {
  const safeText = (text || '000000').trim();

  // Tabela Oficial de Padrões Code 128 (107 caracteres, larguras de módulos alternadas barra/espaço)
  const patterns: string[] = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
  ];

  const startCode = 104; // Start B
  let checksum = startCode;
  const codes: number[] = [startCode];

  for (let i = 0; i < safeText.length; i++) {
    const charCode = safeText.charCodeAt(i);
    let code = charCode - 32;
    if (code < 0 || code > 95) {
      code = 0; // Espaço em branco como fallback
    }
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(106); // Stop Code

  const svgBars: { x: number; width: number }[] = [];
  const moduleWidth = 1.35;
  let currentX = 6; // Margem de silêncio esquerda

  for (const c of codes) {
    const pattern = patterns[c] || patterns[0];
    for (let p = 0; p < pattern.length; p++) {
      const barWidth = parseInt(pattern[p], 10) * moduleWidth;
      const isBar = p % 2 === 0;
      if (isBar) {
        svgBars.push({ x: currentX, width: barWidth });
      }
      currentX += barWidth;
    }
  }

  currentX += 6; // Margem de silêncio direita
  return { svgBars, totalWidth: currentX };
}

/**
 * Componente de Código de Barras Vetorial em SVG
 */
export const BarcodeSVG: React.FC<{ code: string; height?: number; showText?: boolean }> = ({ 
  code, 
  height = 36,
  showText = true 
}) => {
  const { svgBars, totalWidth } = useMemo(() => generateCode128Bars(code), [code]);

  return (
    <div className="flex flex-col items-center justify-center w-full select-none">
      <svg 
        viewBox={`0 0 ${totalWidth} ${height}`} 
        className="w-full max-w-[200px] h-[34px] sm:h-[38px] overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
      >
        {svgBars.map((bar, idx) => (
          <rect 
            key={idx} 
            x={bar.x} 
            y={0} 
            width={bar.width} 
            height={height} 
            fill="#000000" 
          />
        ))}
      </svg>
      {showText && (
        <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-black text-center mt-0.5 leading-none">
          {code}
        </span>
      )}
    </div>
  );
};

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
  promotions = []
}) => {
  if (!isOpen || !product) return null;

  const hasVariations = Boolean(product.variations && product.variations.length > 0);

  // Estados do Modal
  const [selectedVariationId, setSelectedVariationId] = useState<string>('ALL');
  const [codeType, setCodeType] = useState<'INTERNAL' | 'GTIN'>('INTERNAL');
  const [quantity, setQuantity] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<LabelSizeModel>('50x30');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Data atual para cálculo de promoção ativa
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Busca se há promoção ativa para o produto
  const activePromoInfo = useMemo(() => {
    if (!promotions || promotions.length === 0) return null;
    for (const promo of promotions) {
      if (promo.startDate <= todayStr && todayStr <= promo.endDate) {
        if (promo.productIds.some(id => String(id) === String(product.id))) {
          let promoPrice = product.price;
          let discPct = 0;
          if (promo.discountType === 'PERCENTAGE' && promo.discountPercent) {
            discPct = promo.discountPercent;
            promoPrice = Math.max(0, product.price * (1 - discPct / 100));
          } else if (promo.discountType === 'FIXED_PRICE' && promo.promotionalPrice) {
            promoPrice = promo.promotionalPrice;
            discPct = product.price > 0 ? Math.round(((product.price - promoPrice) / product.price) * 100) : 0;
          }
          return { promo, promotionalPrice: promoPrice, discountPercent: discPct };
        }
      }
    }
    return null;
  }, [product, promotions, todayStr]);

  // Variação selecionada para prévia
  const currentVariation: ProductVariation | null = useMemo(() => {
    if (!hasVariations || selectedVariationId === 'ALL') {
      return product.variations && product.variations.length > 0 ? product.variations[0] : null;
    }
    return product.variations?.find(v => v.id === selectedVariationId) || null;
  }, [product, hasVariations, selectedVariationId]);

  // Determina o código a ser impresso
  const getBarcodeForTarget = (v?: ProductVariation | null) => {
    if (codeType === 'GTIN') {
      return (v && v.barcode) || product.barcode || product.internalCode || `PM-${product.id}`;
    }
    return (v && v.sku) || product.internalCode || (v && v.barcode) || product.barcode || `PM-${product.id}`;
  };

  const previewCode = getBarcodeForTarget(currentVariation);

  // Preço para exibição
  const originalPrice = currentVariation?.price || product.price;
  const finalPrice = activePromoInfo ? activePromoInfo.promotionalPrice : originalPrice;

  // Grade/Tamanho/Cor formatada
  const sizeColorText = currentVariation
    ? `TAM: ${currentVariation.size.toUpperCase()} | COR: ${currentVariation.color.toUpperCase()}`
    : 'TAM: ÚNICO';

  // Lista de itens a serem impressos
  const itemsToPrint = useMemo(() => {
    const list: {
      name: string;
      sizeColor: string;
      originalPrice: number;
      finalPrice: number;
      isPromo: boolean;
      code: string;
      ref: string;
    }[] = [];

    const isPromo = Boolean(activePromoInfo);

    if (hasVariations && selectedVariationId === 'ALL') {
      // Imprime todas as variações (1 ou mais cópias por variação)
      product.variations?.forEach(v => {
        const itemCode = getBarcodeForTarget(v);
        const itemOrigPrice = v.price || product.price;
        const itemFinalPrice = isPromo && activePromoInfo ? activePromoInfo.promotionalPrice : itemOrigPrice;
        for (let i = 0; i < quantity; i++) {
          list.push({
            name: product.name,
            sizeColor: `TAM: ${v.size.toUpperCase()} | COR: ${v.color.toUpperCase()}`,
            originalPrice: itemOrigPrice,
            finalPrice: itemFinalPrice,
            isPromo,
            code: itemCode,
            ref: v.sku || product.internalCode || ''
          });
        }
      });
    } else {
      // Imprime variação específica ou produto simples
      const targetVar = currentVariation;
      const itemCode = getBarcodeForTarget(targetVar);
      for (let i = 0; i < quantity; i++) {
        list.push({
          name: product.name,
          sizeColor: sizeColorText,
          originalPrice,
          finalPrice,
          isPromo,
          code: itemCode,
          ref: targetVar?.sku || product.internalCode || ''
        });
      }
    }

    return list;
  }, [product, hasVariations, selectedVariationId, currentVariation, codeType, quantity, activePromoInfo, originalPrice, finalPrice, sizeColorText]);

  // Função que engatilha a impressão nativa
  const handleTriggerPrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(previewCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      {/* =================================================================== */}
      {/* 1. CONTAINER OCULTO DE IMPRESSÃO TÉRMICA (@media print)            */}
      {/* Exclusivo para cabeças térmicas Zebra, Argox, Elgin, Xprinter, etc  */}
      {/* =================================================================== */}
      <div id="paiva-thermal-print-zone" className="hidden print:block font-sans text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: ${labelSize === '40x25' ? '40mm 25mm' : labelSize === '60x40' ? '60mm 40mm' : '50mm 30mm'};
              margin: 0mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body * {
              visibility: hidden;
            }
            #paiva-thermal-print-zone, #paiva-thermal-print-zone * {
              visibility: visible;
            }
            #paiva-thermal-print-zone {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            .thermal-label-unit {
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              width: ${labelSize === '40x25' ? '40mm' : labelSize === '60x40' ? '60mm' : '50mm'};
              height: ${labelSize === '40x25' ? '25mm' : labelSize === '60x40' ? '40mm' : '30mm'};
              box-sizing: border-box;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              overflow: hidden;
              background: #fff;
              border: none;
            }
          }
        ` }} />

        {itemsToPrint.map((item, index) => {
          const { svgBars, totalWidth } = generateCode128Bars(item.code);
          return (
            <div key={index} className="thermal-label-unit">
              {/* TOPO: NOME DA LOJA */}
              <div className="w-full flex justify-between items-center border-b border-black pb-0.5 mb-0.5">
                <span className="font-black text-[11px] tracking-wider uppercase">PAIVA MODA</span>
                {item.ref && <span className="text-[8px] font-mono font-bold">{item.ref}</span>}
              </div>

              {/* CENTRO: NOME DO PRODUTO & TAMANHO/COR */}
              <div className="w-full leading-tight">
                <p className="font-bold text-[9px] uppercase truncate max-w-full">
                  {item.name.length > 28 ? `${item.name.slice(0, 28)}...` : item.name}
                </p>
                <p className="font-black text-[10px] tracking-tight bg-black text-white px-1 py-0.2 rounded mt-0.5 inline-block">
                  {item.sizeColor}
                </p>
              </div>

              {/* PREÇO: DE / POR OU PREÇO CHEIO */}
              <div className="w-full flex items-baseline justify-center gap-1.5 my-0.5">
                {item.isPromo ? (
                  <>
                    <span className="text-[8px] text-gray-700 line-through">
                      De: {formatCurrency(item.originalPrice)}
                    </span>
                    <span className="font-black text-[12px]">
                      Por: {formatCurrency(item.finalPrice)}
                    </span>
                  </>
                ) : (
                  <span className="font-black text-[12px]">
                    {formatCurrency(item.finalPrice)}
                  </span>
                )}
              </div>

              {/* CÓDIGO DE BARRAS VETORIAL DE ALTA DENSIDADE */}
              <div className="w-full flex flex-col items-center">
                <svg 
                  viewBox={`0 0 ${totalWidth} 34`} 
                  className="w-full max-h-[22px] overflow-visible"
                  preserveAspectRatio="xMidYMid meet"
                  shapeRendering="crispEdges"
                >
                  {svgBars.map((b, bIdx) => (
                    <rect key={bIdx} x={b.x} y={0} width={b.width} height={34} fill="#000000" />
                  ))}
                </svg>
                <span className="text-[8px] font-mono font-bold tracking-widest mt-0.5">
                  {item.code}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* 2. MODAL INTERATIVO NA TELA (INTERFACE DO USUÁRIO)                  */}
      {/* =================================================================== */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
        <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-gray-100">
          
          {/* Header do Modal */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white flex justify-between items-center shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-purple-200 border border-white/10 shadow-inner">
                <Barcode size={22} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  Imprimir Etiquetas de Código de Barras
                </h3>
                <p className="text-xs text-purple-200">
                  Compatível com impressoras térmicas (Zebra, Argox, Elgin, Bobinas 50x30mm)
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUNA ESQUERDA: CONFIGURAÇÕES DA ETIQUETA */}
            <div className="space-y-4">
              
              {/* Card Resumo do Produto */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-center gap-3">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-12 h-12 rounded-xl object-cover border border-purple-200 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                    <Tag size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.2 rounded-full uppercase">
                    {product.category || 'Geral'}
                  </span>
                  <h4 className="font-bold text-sm text-gray-900 truncate mt-0.5">{product.name}</h4>
                  <p className="text-xs text-gray-500 font-mono">
                    Ref: <strong>{product.internalCode || 'S/N'}</strong> • Base: <strong>{formatCurrency(product.price)}</strong>
                  </p>
                </div>
              </div>

              {/* Seleção de Variação (se houver grade) */}
              {hasVariations && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center gap-1">
                    <Layers size={14} className="text-purple-600" /> Grade / Variação da Peça
                  </label>
                  <select
                    value={selectedVariationId}
                    onChange={(e) => setSelectedVariationId(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="ALL">📦 Todas as Variações ({product.variations?.length} peças na grade)</option>
                    {product.variations?.map(v => (
                      <option key={v.id} value={v.id}>
                        Tam: {v.size} | Cor: {v.color} {v.sku ? `(SKU: ${v.sku})` : ''} - Estoque: {v.stock} un.
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tipo de Código */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Tipo de Código nas Barras
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCodeType('INTERNAL')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      codeType === 'INTERNAL'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>SKU / Ref Loja</span>
                    <span className="text-[10px] font-mono text-purple-700">{currentVariation?.sku || product.internalCode || 'Padrão'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCodeType('GTIN')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      codeType === 'GTIN'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>EAN-13 / GTIN</span>
                    <span className="text-[10px] font-mono text-purple-700 truncate max-w-[120px]">
                      {currentVariation?.barcode || product.barcode || 'Fabricante'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Seletor de Quantidade de Cópias */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-700">Quantidade de Etiquetas</label>
                  <span className="text-[11px] text-gray-400">
                    Total: <strong>{itemsToPrint.length} etiquetas</strong>
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden shadow-sm">
                    <button 
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100 font-bold active:bg-gray-200 cursor-pointer"
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      min="1"
                      max="500"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center font-black text-sm text-gray-900 border-none outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100 font-bold active:bg-gray-200 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {[1, 2, 5, 10, 20].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          quantity === q 
                            ? 'bg-purple-600 text-white border-purple-600' 
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {q}x
                      </button>
                    ))}
                    {currentVariation && currentVariation.stock > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuantity(currentVariation.stock)}
                        className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer"
                        title="Imprimir quantidade exata em estoque"
                      >
                        Estoque ({currentVariation.stock})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Formato da Etiqueta Térmica */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Tamanho da Bobina / Etiqueta
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                  {[
                    { id: '50x30', label: '50x30 mm', desc: 'Padrão Rolo' },
                    { id: '40x25', label: '40x25 mm', desc: 'Adesiva Mini' },
                    { id: '60x40', label: '60x40 mm', desc: 'Tag de Roupa' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLabelSize(m.id as LabelSizeModel)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        labelSize === m.id
                          ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div>{m.label}</div>
                      <div className="text-[9px] text-gray-400 font-normal">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO AO VIVO EM TEMPO REAL */}
            <div className="flex flex-col items-center justify-between bg-slate-900 p-5 rounded-3xl text-white space-y-4 shadow-inner">
              
              <div className="w-full flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ZoomIn size={14} className="text-purple-400" /> Pré-visualização Real
                </span>
                <span className="text-[10px] text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-700/50">
                  {labelSize} mm
                </span>
              </div>

              {/* FÔRMA DA ETIQUETA FÍSICA (BRANCA COM BARRAS PRETAS) */}
              <div className="w-full max-w-[270px] bg-white text-black rounded-xl p-3.5 shadow-2xl border-2 border-slate-300 flex flex-col justify-between items-center text-center space-y-1.5 select-none transition-transform hover:scale-105">
                
                {/* TOPO: PAIVA MODA */}
                <div className="w-full flex justify-between items-center border-b border-black pb-1">
                  <span className="font-black text-xs tracking-wider uppercase">PAIVA MODA</span>
                  <span className="text-[9px] font-mono font-bold text-gray-600 truncate max-w-[100px]">
                    {currentVariation?.sku || product.internalCode || 'REF-PM'}
                  </span>
                </div>

                {/* PRODUTO & TAMANHO / COR */}
                <div className="w-full">
                  <p className="font-bold text-[11px] uppercase text-gray-900 line-clamp-1">
                    {product.name}
                  </p>
                  <div className="mt-1">
                    <span className="font-black text-[11px] tracking-tight bg-black text-white px-2 py-0.5 rounded shadow-sm inline-block">
                      {sizeColorText}
                    </span>
                  </div>
                </div>

                {/* PREÇO: DE / POR */}
                <div className="w-full py-0.5 flex items-baseline justify-center gap-2">
                  {activePromoInfo ? (
                    <>
                      <span className="text-[10px] text-gray-500 line-through">
                        De: {formatCurrency(originalPrice)}
                      </span>
                      <span className="font-black text-base text-rose-600">
                        Por: {formatCurrency(finalPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="font-black text-base text-black">
                      {formatCurrency(finalPrice)}
                    </span>
                  )}
                </div>

                {/* CÓDIGO DE BARRAS NATIVO */}
                <div className="w-full pt-1 border-t border-gray-100">
                  <BarcodeSVG code={previewCode} height={32} showText={true} />
                </div>
              </div>

              {/* Botão para Copiar Código */}
              <div className="flex items-center gap-2 w-full max-w-[270px]">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copiado!' : `Copiar: ${previewCode}`}</span>
                </button>
              </div>

              {/* Rodapé da Prévia */}
              <p className="text-[11px] text-slate-400 text-center leading-tight">
                ⚡ Pronta para impressão térmica direta sem perda de nitidez.
              </p>
            </div>

          </div>

          {/* Rodapé com Ações */}
          <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <div className="text-xs text-gray-500 text-center sm:text-left">
              Total a imprimir: <strong className="text-gray-900 font-black">{itemsToPrint.length} etiqueta(s)</strong>
              {hasVariations && selectedVariationId === 'ALL' && (
                <span> ({quantity} cópia(s) de cada variação da grade)</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTriggerPrint}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer size={16} /> Imprimir {itemsToPrint.length} Etiqueta(s)
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default BarcodeLabelModal;
