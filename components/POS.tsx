
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CartItem, Product, Customer, Sale } from '../types';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, ScanBarcode, Store, X, Camera, Calculator, User, FileText, Tag, CalendarDays, WalletCards, Printer, CheckCircle2, ArrowRight, CalendarClock, Calendar, AlertTriangle, TrendingUp, ChevronDown, Check } from 'lucide-react';
import { printer } from '../printer';

interface POSProps {
  products: Product[];
  customers: Customer[];
  saleToEdit?: Sale | null;
  onClearSaleToEdit?: () => void;
  onFinalizeSale: (
    cart: CartItem[], 
    customerId: string, 
    paymentMethod: string, 
    subtotal: number, 
    discount: number, 
    total: number, 
    observation: string, 
    change: number,
    installments: number,
    cpf: string,
    customDate?: string, // ISO String for retroactive sales
    customDueDate?: string // YYYY-MM-DD for store credit
  ) => Sale;
}

export const POS: React.FC<POSProps> = ({ products, customers, onFinalizeSale, saleToEdit, onClearSaleToEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Success Screen State
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Payment States
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CREDIT_CARD' | 'DEBIT_CARD' | 'MONEY' | 'PIX' | 'BEMOL' | 'STORE_CREDIT' | null>(null);
  const [installments, setInstallments] = useState(1);
  const [cashReceived, setCashReceived] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [observation, setObservation] = useState('');
  const [cpf, setCpf] = useState('');

  // Retroactive Sale States
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroDate, setRetroDate] = useState('');
  const [retroTime, setRetroTime] = useState('');

  // Store Credit Specifics
  const [storeCreditDueDate, setStoreCreditDueDate] = useState('');
  const [isExtendedGracePeriod, setIsExtendedGracePeriod] = useState(false); // "Carência Estendida"

  // Customer State - Default to '00' (Not Identified)
  const [selectedCustomer, setSelectedCustomer] = useState<string>('00');
  
  // Customer Dropdown Search State
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Ref to handle auto-focus or keeping focus on search
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Update customer search text when selectedCustomer changes
  useEffect(() => {
    const customer = customers.find(c => c.id === selectedCustomer);
    if (customer) {
        setCustomerSearchTerm(customer.id === '00' ? 'Cliente Não Identificado' : customer.name);
    }
  }, [selectedCustomer, customers]);

  // Load Sale to Edit
  useEffect(() => {
    if (saleToEdit) {
      setCart(saleToEdit.items);
      setSelectedCustomer(saleToEdit.customerId || '00');
      setDiscountValue(saleToEdit.discount > 0 ? saleToEdit.discount.toFixed(2) : '');
      setObservation(saleToEdit.observation || '');
      setCpf(saleToEdit.cpf || '');
      // Payment method not pre-selected to force re-verification
      
      // Clear parent state so it doesn't loop
      if (onClearSaleToEdit) onClearSaleToEdit();
    }
  }, [saleToEdit, onClearSaleToEdit]);

  // Update Due Date based on Grace Period Selection
  useEffect(() => {
    if (showPaymentModal && selectedPaymentMethod === 'STORE_CREDIT') {
        const d = new Date();
        // Standard: 30 days. Extended: 60 days.
        const daysToAdd = isExtendedGracePeriod ? 60 : 30;
        d.setDate(d.getDate() + daysToAdd);
        
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset).toISOString().split('T')[0];
        setStoreCreditDueDate(localDate);
    }
  }, [showPaymentModal, isExtendedGracePeriod, selectedPaymentMethod]);

  // Logic to filter products or find exact match by barcode OR internal code
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.category.toLowerCase().includes(term) ||
      p.barcode.includes(term) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(term))
    );
  }, [searchTerm, products]);

  // Logic to filter customers for the dropdown
  const filteredCustomersForDropdown = useMemo(() => {
      if (!customerSearchTerm) return customers;
      const term = customerSearchTerm.toLowerCase();
      
      // If the term matches exactly the currently selected customer name, show all (assume user just opened the list)
      const currentCustomer = customers.find(c => c.id === selectedCustomer);
      if (currentCustomer && (currentCustomer.name.toLowerCase() === term || (currentCustomer.id === '00' && term === 'cliente não identificado'))) {
          return customers;
      }

      return customers.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.phone.includes(term) ||
        (c.id === '00' && 'cliente não identificado'.includes(term))
      );
  }, [customerSearchTerm, customers, selectedCustomer]);

  // Effect to detect "Enter" key for barcode scanners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user presses Enter and there is text in search box
      if (e.key === 'Enter' && searchTerm) {
        const term = searchTerm.toLowerCase();
        // Try exact match on barcode OR internal code
        const exactMatch = products.find(p => 
           p.barcode === searchTerm || 
           (p.internalCode && p.internalCode.toLowerCase() === term)
        );
        
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
        }
      }
    };

    if (showScanner) {
      startCamera();
    }

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

  // --- CALCULATION LOGIC ---
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const numericDiscount = parseFloat(discountValue.replace(',', '.')) || 0;
  
  // Base Total (after discount, before interests)
  const baseTotal = Math.max(0, cartSubtotal - numericDiscount);
  
  let finalTotal = baseTotal;
  let interestAmount = 0;
  let gracePeriodFee = 0;

  // Apply Interest Logic for STORE_CREDIT
  if (selectedPaymentMethod === 'STORE_CREDIT') {
      // 1. Grace Period Fee (Taxa de Carência) - 3% if extended
      if (isExtendedGracePeriod) {
          gracePeriodFee = baseTotal * 0.03;
          finalTotal += gracePeriodFee;
      }

      // 2. Installment Interest (Juros Parcelamento)
      // Rule: 1-4x Free. 5x-12x = 3.9% p.m. (Compound)
      if (installments > 4) {
          const rate = 0.039; // 3.9%
          // Compound Interest Formula: M = P * (1 + i)^n
          // We apply this to the (Base + GraceFee)
          const totalWithInterest = finalTotal * Math.pow((1 + rate), installments);
          interestAmount = totalWithInterest - finalTotal;
          finalTotal = totalWithInterest;
      }
  }

  const installmentValue = installments > 0 ? finalTotal / installments : 0;
  const discountPercentage = cartSubtotal > 0 ? (numericDiscount / cartSubtotal) * 100 : 0;

  // Change Calculation
  const numericCashReceived = parseFloat(cashReceived.replace(',', '.')) || 0;
  const changeAmount = numericCashReceived - finalTotal;
  const isInsufficientFunds = selectedPaymentMethod === 'MONEY' && numericCashReceived < finalTotal;

  // Credit Limit Check logic
  const currentCustomerObj = customers.find(c => c.id === selectedCustomer);
  const creditLimit = currentCustomerObj?.creditLimit || 0;
  const usedCredit = currentCustomerObj?.usedCredit || 0;
  const availableCredit = creditLimit - usedCredit;
  const isCreditLimitExceeded = selectedPaymentMethod === 'STORE_CREDIT' && finalTotal > availableCredit;

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(v);
  };

  const handleConfirmSale = () => {
    if (!selectedPaymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    if (isInsufficientFunds) {
      alert("Valor recebido é menor que o total da venda!");
      return;
    }

    if (selectedPaymentMethod === 'STORE_CREDIT') {
       if (selectedCustomer === '00') {
          alert("Não é possível realizar venda no Crediário para Cliente Não Identificado.");
          return;
       }
       if (isCreditLimitExceeded) {
          alert(`Limite de crédito insuficiente! Disponível: R$ ${availableCredit.toFixed(2)}`);
          return;
       }
       if (!storeCreditDueDate) {
          alert("Selecione uma data de vencimento para o crediário.");
          return;
       }
    }

    // Determine custom date/time if retroactive
    let customIsoString: string | undefined = undefined;
    if (isRetroactive && retroDate) {
       const time = retroTime || '12:00';
       customIsoString = new Date(`${retroDate}T${time}`).toISOString();
    }

    // Process Sale
    const newSale = onFinalizeSale(
      cart, 
      selectedCustomer, 
      selectedPaymentMethod, 
      cartSubtotal,
      numericDiscount,
      finalTotal,
      observation,
      selectedPaymentMethod === 'MONEY' ? changeAmount : 0,
      selectedPaymentMethod === 'CREDIT_CARD' || selectedPaymentMethod === 'STORE_CREDIT' ? installments : 1,
      cpf,
      customIsoString,
      selectedPaymentMethod === 'STORE_CREDIT' ? storeCreditDueDate : undefined
    );

    // Show Success Screen
    setLastSale(newSale);
    setShowPaymentModal(false);
    
    // Reset Form
    setCart([]);
    setSelectedPaymentMethod(null);
    setCashReceived('');
    setDiscountValue('');
    setObservation('');
    setCpf('');
    setInstallments(1);
    setSelectedCustomer('00');
    setIsRetroactive(false);
    setRetroDate('');
    setRetroTime('');
    setIsExtendedGracePeriod(false);
  };

  const handleNewSale = () => {
    setLastSale(null);
  };

  // SUCCESS SCREEN
  if (lastSale) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-green-50 animate-in fade-in zoom-in duration-300">
         <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full space-y-8 border-4 border-green-100">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-inner">
               <CheckCircle2 size={48} strokeWidth={3} />
            </div>
            
            <div>
               <h1 className="text-3xl font-black text-gray-800 mb-2">Venda Realizada!</h1>
               <p className="text-gray-500">A venda foi registrada no sistema com sucesso.</p>
               {isRetroactive && (
                 <span className="inline-block mt-2 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                    DATA RETROATIVA: {new Date(lastSale.timestamp).toLocaleString('pt-BR')}
                 </span>
               )}
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border border-gray-100">
               <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Total da Venda</span>
                  <span className="font-bold text-gray-800 text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastSale.total)}</span>
               </div>
               {lastSale.change && lastSale.change > 0 && (
                 <div className="flex justify-between items-center text-green-600 border-t border-gray-200 pt-2">
                    <span className="font-medium">Troco</span>
                    <span className="font-black text-2xl">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastSale.change)}</span>
                 </div>
               )}
            </div>

            <div className="flex flex-col gap-3">
               <button 
                 onClick={() => printer.printTicket(lastSale)}
                 className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
               >
                 <Printer size={24} />
                 IMPRIMIR COMPROVANTE
               </button>
               
               <button 
                 onClick={handleNewSale}
                 className="w-full py-4 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
               >
                 Nova Venda <ArrowRight size={20} />
               </button>
            </div>
         </div>
      </div>
    );
  }

  // --- UPDATED MAIN LAYOUT TO USE DVH (Dynamic Viewport Height) for Mobile ---
  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-gray-50 overflow-hidden relative">
      
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
          </div>
        </div>
      )}

      {/* Left Side: Products Catalog */}
      <div className="flex-1 flex flex-col h-1/2 lg:h-full overflow-hidden border-r border-gray-200">
        <div className="p-4 bg-white border-b border-gray-200 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar nome, código interno ou bipar código..."
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
                       {product.internalCode && (
                          <div className="absolute top-1 right-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold shadow-sm">
                             {product.internalCode}
                          </div>
                       )}
                       <div className="absolute bottom-1 right-2 text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                          {product.barcode || 'S/N'}
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
      <div className="w-full lg:w-[400px] h-1/2 lg:h-full bg-white flex flex-col shadow-xl z-10 border-t lg:border-t-0 border-gray-200">
        <div className="p-4 bg-purple-600 text-white flex justify-between items-center shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h2 className="font-bold">Carrinho</h2>
          </div>
          <span className="bg-purple-700 px-2 py-1 rounded text-sm font-medium">
            {cart.length} itens
          </span>
        </div>

        {/* Customer Selector Section (COMBOBOX REPLACEMENT) */}
        <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center gap-3 shrink-0 relative z-30">
           <User size={20} className="text-purple-600" />
           <div className="flex-1 relative">
             <label className="text-xs font-semibold text-purple-900 block mb-1">Cliente (Opcional)</label>
             
             {/* Backdrop to close dropdown on click outside */}
             {isCustomerDropdownOpen && (
               <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>
             )}

             <div className="relative z-20">
                <input
                    ref={customerInputRef}
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => {
                        setIsCustomerDropdownOpen(true);
                        // Optional: Clear if it's default to show full list easier
                        // if (customerSearchTerm === 'Cliente Não Identificado') setCustomerSearchTerm('');
                    }}
                    placeholder="Buscar cliente..."
                    className="w-full text-sm p-2 pr-8 rounded border border-purple-200 bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                
                {/* Clear / Chevron Button */}
                <button 
                    onClick={() => {
                        if (customerSearchTerm) {
                            setCustomerSearchTerm('');
                            customerInputRef.current?.focus();
                            setIsCustomerDropdownOpen(true);
                        } else {
                            setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                        }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-700"
                >
                    {customerSearchTerm ? <X size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Dropdown List */}
                {isCustomerDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-50">
                        {filteredCustomersForDropdown.length === 0 ? (
                            <div className="p-3 text-xs text-gray-500 text-center">Nenhum cliente encontrado</div>
                        ) : (
                            filteredCustomersForDropdown.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        setSelectedCustomer(c.id);
                                        // The useEffect will update the search term name automatically
                                        setIsCustomerDropdownOpen(false);
                                    }}
                                    className={`w-full text-left p-2.5 text-sm hover:bg-purple-50 flex justify-between items-center group
                                        ${selectedCustomer === c.id ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700'}
                                    `}
                                >
                                    <div>
                                        <span className="block">{c.name}</span>
                                        {c.id !== '00' && <span className="text-[10px] text-gray-400">{c.phone || 'Sem telefone'}</span>}
                                    </div>
                                    {selectedCustomer === c.id && <Check size={14} className="text-purple-600" />}
                                </button>
                            ))
                        )}
                    </div>
                )}
             </div>
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

        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4 shrink-0 pb-safe relative z-0">
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
              // Initialize date inputs with current time
              const now = new Date();
              const offset = now.getTimezoneOffset() * 60000;
              const localNow = new Date(now.getTime() - offset);
              setRetroDate(localNow.toISOString().split('T')[0]);
              setRetroTime(localNow.toISOString().split('T')[1].substring(0, 5));
              
              setInstallments(1);
              setIsExtendedGracePeriod(false);

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
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95dvh]">
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
                     <p className="text-xs text-purple-600 font-medium">Desconto: - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericDiscount)}</p>
                   )}
                   {selectedPaymentMethod === 'STORE_CREDIT' && (
                      <div className="text-[10px] space-y-1 pt-2 border-t border-purple-100 mt-2">
                          <p className="flex justify-between text-gray-500"><span>Produtos:</span> <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(baseTotal)}</span></p>
                          {gracePeriodFee > 0 && <p className="flex justify-between text-red-500 font-bold"><span>+ Taxa Carência (3%):</span> <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gracePeriodFee)}</span></p>}
                          {interestAmount > 0 && <p className="flex justify-between text-orange-600 font-bold"><span>+ Juros Parc. (3.9%):</span> <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(interestAmount)}</span></p>}
                      </div>
                   )}
                </div>

                {/* Retroactive Date Toggle */}
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input 
                          type="checkbox" 
                          checked={isRetroactive} 
                          onChange={(e) => setIsRetroactive(e.target.checked)}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-bold text-orange-800 flex items-center gap-1">
                            <CalendarClock size={16} /> Venda Retroativa / Data Manual
                        </span>
                    </label>
                    
                    {isRetroactive && (
                        <div className="grid grid-cols-2 gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                            <div>
                                <label className="block text-xs font-medium text-orange-700 mb-1">Data</label>
                                <input 
                                  type="date" 
                                  value={retroDate} 
                                  onChange={(e) => setRetroDate(e.target.value)}
                                  className="w-full p-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-orange-700 mb-1">Hora</label>
                                <input 
                                  type="time" 
                                  value={retroTime} 
                                  onChange={(e) => setRetroTime(e.target.value)}
                                  className="w-full p-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        </div>
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

                {/* CPF Input */}
                <div>
                   <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <FileText size={16} /> CPF na Nota (Opcional)
                   </label>
                   <input 
                      type="text"
                      value={cpf}
                      onChange={handleCpfChange}
                      maxLength={14}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="000.000.000-00"
                   />
                </div>

                {/* Observation */}
                <div>
                   <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <FileText size={16} /> Observação (Interna)
                   </label>
                   <textarea 
                     rows={2}
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
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 relative overflow-hidden
                        ${selectedPaymentMethod === 'BEMOL' 
                          ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-gray-50'}
                      `}
                    >
                      <Store size={20} />
                      <span className="text-xs font-bold">Bemol</span>
                    </button>

                    <button 
                      onClick={() => {
                        setSelectedPaymentMethod('STORE_CREDIT');
                        setInstallments(1);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 relative overflow-hidden
                        ${selectedPaymentMethod === 'STORE_CREDIT' 
                          ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-md' 
                          : 'border-gray-100 text-gray-600 hover:border-pink-200 hover:bg-gray-50'}
                      `}
                    >
                      <WalletCards size={20} />
                      <span className="text-xs font-bold">Crediário Loja</span>
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

                 {/* Store Credit Details */}
                 {selectedPaymentMethod === 'STORE_CREDIT' && (
                  <div className={`p-4 rounded-xl border space-y-3 animate-in fade-in slide-in-from-top-2
                      ${selectedCustomer === '00' ? 'bg-red-50 border-red-200' : 'bg-pink-50 border-pink-200'}
                  `}>
                    {selectedCustomer === '00' ? (
                       <p className="text-sm font-bold text-red-600 flex items-center gap-2">
                         <X size={16} /> 
                         Selecione um cliente identificado para usar o Crediário.
                       </p>
                    ) : (
                       <>
                          <div className="flex justify-between items-center text-pink-900">
                             <span className="text-sm font-medium">Limite Disponível</span>
                             <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(availableCredit)}</span>
                          </div>
                          {isCreditLimitExceeded && (
                             <p className="text-xs font-bold text-red-600">Limite insuficiente para esta venda.</p>
                          )}
                          
                          {/* Grace Period Toggle */}
                          <div className="bg-white p-2 rounded border border-pink-200">
                              <label className="flex items-start gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={isExtendedGracePeriod}
                                    onChange={(e) => setIsExtendedGracePeriod(e.target.checked)}
                                    className="mt-1 w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                                  />
                                  <div className="flex-1">
                                      <span className="block text-sm font-bold text-pink-800">
                                          Pagar 1ª parcela em 60 dias
                                      </span>
                                      <span className="block text-[10px] text-pink-600">
                                          Adiciona 3% ao valor total (Taxa de Carência)
                                      </span>
                                  </div>
                              </label>
                          </div>

                          {/* Installments Selector */}
                          <div>
                            <label className="block text-xs font-bold text-pink-700 mb-1">Parcelamento (Loja)</label>
                            <select
                              value={installments}
                              onChange={(e) => setInstallments(parseInt(e.target.value))}
                              className="w-full p-2 border border-pink-300 rounded text-sm focus:outline-none focus:border-pink-500"
                            >
                              {Array.from({length: 12}, (_, i) => i + 1).map(i => {
                                 // Simulation logic for dropdown text
                                 let simTotal = baseTotal;
                                 if (isExtendedGracePeriod) simTotal += (simTotal * 0.03);
                                 if (i > 4) simTotal = simTotal * Math.pow(1.039, i);
                                 const simInstallment = simTotal / i;

                                 return (
                                    <option key={i} value={i}>
                                      {i}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simInstallment)}
                                      {i > 4 ? ' (c/ juros)' : ''}
                                    </option>
                                 );
                              })}
                            </select>
                            <p className="text-[10px] text-pink-600 mt-1">1x a 4x (Sem juros) • 5x a 12x (3.9% a.m)</p>
                          </div>

                          <div>
                             <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1">
                                <Calendar size={12} /> Data da 1ª Parcela
                             </label>
                             <input 
                                type="date"
                                value={storeCreditDueDate}
                                onChange={(e) => setStoreCreditDueDate(e.target.value)}
                                className="w-full p-2 text-sm border border-pink-300 rounded focus:outline-none focus:border-pink-500"
                             />
                          </div>
                       </>
                    )}
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
                disabled={!selectedPaymentMethod || isInsufficientFunds || (selectedPaymentMethod === 'STORE_CREDIT' && (isCreditLimitExceeded || selectedCustomer === '00' || !storeCreditDueDate))}
                onClick={handleConfirmSale}
                className={`flex-1 py-3 text-white font-bold rounded-lg shadow-md transition-all
                  ${(!selectedPaymentMethod || isInsufficientFunds || (selectedPaymentMethod === 'STORE_CREDIT' && (isCreditLimitExceeded || selectedCustomer === '00' || !storeCreditDueDate)))
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
