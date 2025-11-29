
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CartItem, Product, Customer } from '../types';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, ScanBarcode, Store, X, Camera, Calculator, User, FileText, Tag, CalendarDays } from 'lucide-react';

interface POSProps {
  products: Product[];
  customers: Customer[];
  onFinalizeSale: (
    cart: CartItem[], 
    customerId: string, 
    paymentMethod: string, 
    subtotal: number, 
    discount: number, 
    total: number, 
    observation: string, 
    change: number,
    installments: number
  ) => void;
}

export const POS: React.FC<POSProps> = ({ products, customers, onFinalizeSale }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Payment States
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CREDIT_CARD' | 'DEBIT_CARD' | 'MONEY' | 'PIX' | 'BEMOL' | null>(null);
  const [installments, setInstallments] = useState(1);
  const [cashReceived, setCashReceived] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [observation, setObservation] = useState('');

  // Customer State - Default to '00' (Not Identified)
  const [selectedCustomer, setSelectedCustomer] = useState<string>('00');

  // Ref to handle auto-focus or keeping focus on search
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Logic to filter products or find exact match by barcode
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.category.toLowerCase().includes(term) ||
      p.barcode.includes(term)
    );
  }, [searchTerm, products]);

  // Effect to detect "Enter" key for barcode scanners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user presses Enter and there is text in search box
      if (e.key === 'Enter' && searchTerm) {
        const exactMatch = products.find(p => p.barcode === searchTerm);
        if (exactMatch) {
          addToCart(exactMatch);
          setSearchTerm(''); // Clear after adding
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, products]);

  // Effect to manage Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (showScanner && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          // We can silently fail here and just show the UI without video if permission denied
        }
      }
    };

    if (showScanner) {
      startCamera();
    }

    // Cleanup function to stop tracks when modal closes
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showScanner]);

  const addToCart = (product: Product) => {
    // Check stock if needed
    const currentInCart = cart.find(i => i.id === product.id)?.quantity || 0;
    if (currentInCart + 1 > product.stock) {
      alert(`Atenção: Estoque insuficiente! Disponível: ${product.stock}`);
      return; 
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleScanResult = (barcode: string) => {
     const product = products.find(p => p.barcode === barcode);
     if (product) {
       addToCart(product);
       setShowScanner(false); // Close scanner after success
     } else {
       alert("Produto não encontrado para o código: " + barcode);
     }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        if (delta > 0 && product && item.quantity + 1 > product.stock) {
             alert(`Limite de estoque atingido!`);
             return item;
        }
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const numericDiscount = parseFloat(discountValue.replace(',', '.')) || 0;
  const finalTotal = Math.max(0, cartSubtotal - numericDiscount);
  const discountPercentage = cartSubtotal > 0 ? (numericDiscount / cartSubtotal) * 100 : 0;

  // Change Calculation
  const numericCashReceived = parseFloat(cashReceived.replace(',', '.')) || 0;
  const changeAmount = numericCashReceived - finalTotal;
  const isInsufficientFunds = selectedPaymentMethod === 'MONEY' && numericCashReceived < finalTotal;

  const handleFinalizeSale = () => {
    if (!selectedPaymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    if (isInsufficientFunds) {
      alert("Valor recebido é menor que o total da venda!");
      return;
    }

    // Call parent to update logic
    onFinalizeSale(
      cart, 
      selectedCustomer, 
      selectedPaymentMethod, 
      cartSubtotal,
      numericDiscount,
      finalTotal,
      observation,
      selectedPaymentMethod === 'MONEY' ? changeAmount : 0,
      selectedPaymentMethod === 'CREDIT_CARD' ? installments : 1
    );

    let message = "Venda realizada com sucesso!";
    if (selectedPaymentMethod === 'MONEY' && changeAmount > 0) {
      message += `\n\n💰 TROCO: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(changeAmount)}`;
    }

    alert(message);
    setCart([]);
    setShowPaymentModal(false);
    setSelectedPaymentMethod(null);
    setCashReceived('');
    setDiscountValue('');
    setObservation('');
    setInstallments(1);
    setSelectedCustomer('00'); // Reset to default
  };

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col lg:flex-row bg-gray-50 overflow-hidden relative">
      
      {/* Mobile Camera Scanner Overlay */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
          <div className="p-4 flex justify-between items-center bg-black/50 z-10">
             <span className="font-bold text-lg">Escanear Código</span>
             <button onClick={() => setShowScanner(false)}><X size={24} /></button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative">
             <div className="w-full h-full absolute inset-0 bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover opacity-70"
                />
             </div>

             <div className="w-64 h-64 border-2 border-purple-500 rounded-2xl relative overflow-hidden flex items-center justify-center z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
             </div>
             
             <p className="mt-8 text-white font-medium text-center px-6 z-10 drop-shadow-md">Aponte a câmera para o código de barras</p>
             
             {/* Simulation Buttons for Demo (kept for testing without camera) */}
             <div className="mt-8 grid grid-cols-2 gap-4 z-10 px-4">
                {products.slice(0, 4).map(p => (
                   <button 
                     key={p.id}
                     onClick={() => handleScanResult(p.barcode)}
                     className="px-4 py-2 bg-gray-800/80 backdrop-blur rounded-lg text-xs hover:bg-gray-700 border border-gray-600"
                   >
                     Simular: {p.name}
                   </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Left Side: Products Catalog */}
      <div className="flex-1 flex flex-col h-1/2 lg:h-full overflow-hidden border-r border-gray-200">
        <div className="p-4 bg-white border-b border-gray-200 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar nome ou bipar código..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <button 
            onClick={() => setShowScanner(true)}
            className="w-12 h-12 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
            title="Abrir Câmera"
          >
             <Camera size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Search size={48} className="mb-2 opacity-20" />
                <p>Nenhum produto encontrado</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left flex flex-col justify-between group h-full"
                >
                  <div>
                    <div className="w-full aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-300 relative overflow-hidden">
                       {product.image ? (
                         <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                       ) : (
                         <ShoppingBagIcon className="w-8 h-8" />
                       )}
                       <div className="absolute bottom-1 right-2 text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                          {product.barcode}
                       </div>
                    </div>
                    <h3 className="font-medium text-gray-800 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-purple-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={16} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart */}
      <div className="w-full lg:w-[400px] h-1/2 lg:h-full bg-white flex flex-col shadow-xl z-10">
        <div className="p-4 bg-purple-600 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h2 className="font-bold">Carrinho</h2>
          </div>
          <span className="bg-purple-700 px-2 py-1 rounded text-sm font-medium">
            {cart.length} itens
          </span>
        </div>

        {/* Customer Selector Section */}
        <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center gap-3">
           <User size={20} className="text-purple-600" />
           <div className="flex-1">
             <label className="text-xs font-semibold text-purple-900 block mb-1">Cliente (Opcional)</label>
             <select 
               value={selectedCustomer}
               onChange={(e) => setSelectedCustomer(e.target.value)}
               className="w-full text-sm p-1.5 rounded border border-purple-200 bg-white focus:outline-none focus:border-purple-500"
             >
               {customers.map(c => (
                 <option key={c.id} value={c.id}>
                   {c.id === '00' ? c.name : `${c.name} (${c.phone || 'S/T'})`}
                 </option>
               ))}
             </select>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="relative">
                <ShoppingCart size={48} className="text-gray-200" />
                <ScanBarcode size={24} className="text-gray-300 absolute -bottom-2 -right-2" />
              </div>
              <p className="text-center px-6 text-sm">Use a busca ou bipe um produto para adicionar</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 animate-in slide-in-from-right-4 duration-300">
                {/* Cart Item Thumbnail */}
                <div className="w-12 h-12 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.image ? (
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <ShoppingBagIcon className="w-5 h-5 text-gray-300" />
                    )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-gray-800 line-clamp-1">{item.name}</h4>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-400 hover:text-red-600 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-3xl font-bold text-gray-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartSubtotal)}
            </span>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={() => {
              setSelectedPaymentMethod(null);
              setCashReceived('');
              setDiscountValue('');
              setObservation('');
              setInstallments(1);
              setShowPaymentModal(true);
            }}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>FINALIZAR VENDA</span>
            <ArrowUpRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Payment Modal Overlay */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-800">Finalizar Venda</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} /> 
              </button>
            </div>
            
            <div className="p-6 flex flex-col md:flex-row gap-6 overflow-y-auto">
              {/* Left Column: Totals & Discount */}
              <div className="flex-1 space-y-6">
                <div className="bg-purple-50 p-4 rounded-xl text-center space-y-2">
                   <p className="text-gray-500 text-sm">Total Final a Pagar</p>
                   <p className="text-4xl font-bold text-purple-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal)}</p>
                   {numericDiscount > 0 && (
                     <p className="text-xs text-purple-600 font-medium">Desconto aplicado: {discountPercentage.toFixed(1)}%</p>
                   )}
                </div>

                {/* Discount Input */}
                <div>
                   <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Tag size={16} /> Desconto (R$)
                   </label>
                   <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input 
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="0,00"
                      />
                   </div>
                </div>

                {/* Observation */}
                <div>
                   <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <FileText size={16} /> Observação (Interna)
                   </label>
                   <textarea 
                     rows={3}
                     value={observation}
                     onChange={(e) => setObservation(e.target.value)}
                     className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm"
                     placeholder="Ex: Troca, presente, cliente VIP..."
                   />
                </div>
              </div>

              {/* Right Column: Methods & Payment */}
              <div className="flex-1 space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Forma de Pagamento:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setSelectedPaymentMethod('DEBIT_CARD');
                        setInstallments(1);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1
                        ${selectedPaymentMethod === 'DEBIT_CARD' 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-blue-200 hover:bg-gray-50'}
                      `}
                    >
                      <CreditCard size={20} />
                      <span className="text-xs font-bold">Débito</span>
                    </button>

                    <button 
                      onClick={() => setSelectedPaymentMethod('CREDIT_CARD')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1
                        ${selectedPaymentMethod === 'CREDIT_CARD' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-indigo-200 hover:bg-gray-50'}
                      `}
                    >
                      <CreditCard size={20} />
                      <span className="text-xs font-bold">Crédito</span>
                    </button>

                    <button 
                      onClick={() => {
                        setSelectedPaymentMethod('MONEY');
                        setInstallments(1);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1
                        ${selectedPaymentMethod === 'MONEY' 
                          ? 'border-green-500 bg-green-50 text-green-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-green-200 hover:bg-gray-50'}
                      `}
                    >
                      <Banknote size={20} />
                      <span className="text-xs font-bold">Dinheiro</span>
                    </button>

                    <button 
                      onClick={() => {
                        setSelectedPaymentMethod('PIX');
                        setInstallments(1);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1
                        ${selectedPaymentMethod === 'PIX' 
                          ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-teal-200 hover:bg-gray-50'}
                      `}
                    >
                      <QrCode size={20} />
                      <span className="text-xs font-bold">PIX</span>
                    </button>

                    <button 
                      onClick={() => {
                        setSelectedPaymentMethod('BEMOL');
                        setInstallments(1);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 relative overflow-hidden col-span-2
                        ${selectedPaymentMethod === 'BEMOL' 
                          ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-gray-50'}
                      `}
                    >
                      <Store size={20} />
                      <span className="text-xs font-bold">Crediário Bemol</span>
                    </button>
                  </div>
                </div>

                {/* Credit Card Installments */}
                {selectedPaymentMethod === 'CREDIT_CARD' && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="flex items-center gap-2 text-indigo-900 font-medium text-sm">
                      <CalendarDays size={16} />
                      Parcelamento
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(parseInt(e.target.value))}
                      className="w-full p-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Array.from({length: 12}, (_, i) => i + 1).map(i => (
                        <option key={i} value={i}>
                          {i}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal / i)}
                          {i === 1 ? ' (À vista)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Money Details */}
                {selectedPaymentMethod === 'MONEY' && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                      <Calculator size={16} />
                      <span>Troco</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Valor Recebido</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <input 
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                            ${isInsufficientFunds ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-200'}
                          `}
                          placeholder="0,00"
                        />
                      </div>
                      {isInsufficientFunds && (
                        <p className="text-xs text-red-500 mt-1 font-medium">Valor inferior ao total!</p>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Troco:</span>
                      <span className={`text-xl font-bold ${changeAmount >= 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {changeAmount > 0 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(changeAmount)
                          : 'R$ 0,00'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex gap-3 shrink-0 border-t border-gray-100">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={!selectedPaymentMethod || isInsufficientFunds}
                onClick={handleFinalizeSale}
                className={`flex-1 py-3 text-white font-bold rounded-lg shadow-md transition-all
                  ${!selectedPaymentMethod || isInsufficientFunds
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'}
                `}
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper icons for this component
const ShoppingBagIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);

const ArrowUpRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
);
