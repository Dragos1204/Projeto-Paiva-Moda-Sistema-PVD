import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CartItem, Product, Customer, Sale } from '../types';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, ScanBarcode, Store, X, Camera, Calculator, User, FileText, Tag, CalendarDays, WalletCards, Printer, CheckCircle2, ArrowRight, CalendarClock, Calendar, ChevronDown, Check, ShoppingBag } from 'lucide-react';
import { printer } from '../printer';

interface POSProps {
  products: Product[];
  customers: Customer[];
  saleToEdit?: Sale | null;
  onClearSaleToEdit?: () => void;
  onFinalizeSale: (cart: CartItem[], customerId: string, paymentMethod: string, subtotal: number, discount: number, total: number, observation: string, change: number, installments: number, cpf: string, customDate?: string, customDueDate?: string) => Sale;
}

export const POS: React.FC<POSProps> = ({ products, customers, onFinalizeSale, saleToEdit, onClearSaleToEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CREDIT_CARD' | 'DEBIT_CARD' | 'MONEY' | 'PIX' | 'BEMOL' | 'STORE_CREDIT' | null>(null);
  const [installments, setInstallments] = useState(1);
  const [cashReceived, setCashReceived] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [observation, setObservation] = useState('');
  const [cpf, setCpf] = useState('');
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroDate, setRetroDate] = useState('');
  const [retroTime, setRetroTime] = useState('');
  const [storeCreditDueDate, setStoreCreditDueDate] = useState('');
  const [isExtendedGracePeriod, setIsExtendedGracePeriod] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('00');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const customer = customers.find(c => c.id === selectedCustomer);
    if (customer) { setCustomerSearchTerm(customer.id === '00' ? 'Cliente Não Identificado' : customer.name); }
  }, [selectedCustomer, customers]);

  useEffect(() => {
    if (saleToEdit) {
      setCart(saleToEdit.items);
      setSelectedCustomer(saleToEdit.customerId || '00');
      setDiscountValue(saleToEdit.discount > 0 ? saleToEdit.discount.toFixed(2) : '');
      setObservation(saleToEdit.observation || '');
      setCpf(saleToEdit.cpf || '');
      if (onClearSaleToEdit) onClearSaleToEdit();
    }
  }, [saleToEdit, onClearSaleToEdit]);

  useEffect(() => {
    if (showPaymentModal && selectedPaymentMethod === 'STORE_CREDIT') {
        const d = new Date();
        d.setDate(d.getDate() + (isExtendedGracePeriod ? 60 : 30));
        const offset = d.getTimezoneOffset() * 60000;
        setStoreCreditDueDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
  }, [showPaymentModal, isExtendedGracePeriod, selectedPaymentMethod]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(term) || p.barcode.includes(term) || (p.internalCode && p.internalCode.toLowerCase().includes(term)));
  }, [searchTerm, products]);

  const filteredCustomersForDropdown = useMemo(() => {
      if (!customerSearchTerm) return customers;
      const term = customerSearchTerm.toLowerCase();
      const current = customers.find(c => c.id === selectedCustomer);
      if (current && (current.name.toLowerCase() === term || (current.id === '00' && term === 'cliente não identificado'))) return customers;
      return customers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  }, [customerSearchTerm, customers, selectedCustomer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && searchTerm) {
        const exactMatch = products.find(p => p.barcode === searchTerm || (p.internalCode && p.internalCode.toLowerCase() === searchTerm.toLowerCase()));
        if (exactMatch) { addToCart(exactMatch); setSearchTerm(''); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, products]);

  const addToCart = (product: Product) => {
    const currentInCart = cart.find(i => i.id === product.id)?.quantity || 0;
    if (currentInCart + 1 > product.stock) { alert(`Estoque insuficiente!`); return; }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      return existing ? prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const numericDiscount = parseFloat(discountValue.replace(',', '.')) || 0;
  const baseTotal = Math.max(0, cartSubtotal - numericDiscount);
  let finalTotal = baseTotal;
  let interestAmount = 0; let gracePeriodFee = 0;

  if (selectedPaymentMethod === 'STORE_CREDIT') {
      if (isExtendedGracePeriod) { gracePeriodFee = baseTotal * 0.03; finalTotal += gracePeriodFee; }
      if (installments > 4) {
          const totalWithInterest = finalTotal * Math.pow((1 + 0.039), installments);
          interestAmount = totalWithInterest - finalTotal;
          finalTotal = totalWithInterest;
      }
  }

  const numericCashReceived = parseFloat(cashReceived.replace(',', '.')) || 0;
  const changeAmount = numericCashReceived - finalTotal;
  const isInsufficientFunds = selectedPaymentMethod === 'MONEY' && numericCashReceived < finalTotal;
  const currentCustomerObj = customers.find(c => c.id === selectedCustomer);
  const isCreditLimitExceeded = selectedPaymentMethod === 'STORE_CREDIT' && finalTotal > ((currentCustomerObj?.creditLimit || 0) - (currentCustomerObj?.usedCredit || 0));

  const handleConfirmSale = () => {
    if (!selectedPaymentMethod || isInsufficientFunds) return;
    if (selectedPaymentMethod === 'STORE_CREDIT' && (selectedCustomer === '00' || isCreditLimitExceeded || !storeCreditDueDate)) { alert("Verifique crediário."); return; }
    
    let customIso: string | undefined = undefined;
    if (isRetroactive && retroDate) customIso = new Date(`${retroDate}T${retroTime || '12:00'}`).toISOString();

    const newSale = onFinalizeSale(cart, selectedCustomer, selectedPaymentMethod, cartSubtotal, numericDiscount, finalTotal, observation, selectedPaymentMethod === 'MONEY' ? changeAmount : 0, installments, cpf, customIso, selectedPaymentMethod === 'STORE_CREDIT' ? storeCreditDueDate : undefined);
    setLastSale(newSale); setShowPaymentModal(false); setCart([]); setSelectedPaymentMethod(null); setCashReceived(''); setDiscountValue(''); setObservation(''); setCpf(''); setInstallments(1); setSelectedCustomer('00'); setIsRetroactive(false);
  };

  if (lastSale) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-green-50 animate-in fade-in zoom-in">
         <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full space-y-8 border-4 border-green-100">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600"><CheckCircle2 size={48} /></div>
            <div><h1 className="text-3xl font-black text-gray-800">Venda Realizada!</h1></div>
            <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border border-gray-100"><div className="flex justify-between items-center text-sm text-gray-500"><span>Total</span><span className="font-bold text-gray-800 text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastSale.total)}</span></div>{lastSale.change ? <div className="flex justify-between items-center text-green-600 pt-2 border-t"><span className="font-medium">Troco</span><span className="font-black text-2xl">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastSale.change)}</span></div> : null}</div>
            <button onClick={() => printer.printTicket(lastSale)} className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Printer size={24} /> IMPRIMIR COMPROVANTE</button>
            <button onClick={() => setLastSale(null)} className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2">Nova Venda <ArrowRight size={20} /></button>
         </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-gray-50 overflow-hidden relative">
      <div className="flex-1 flex flex-col h-1/2 lg:h-full overflow-hidden border-r border-gray-200">
        <div className="p-4 bg-white border-b border-gray-200 flex gap-2 shrink-0">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input ref={searchInputRef} type="text" placeholder="Buscar nome, código..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4"><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{filteredProducts.map(product => (<button key={product.id} onClick={() => addToCart(product)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex flex-col justify-between h-full"><div><div className="w-full aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">{product.image ? <img src={product.image} className="w-full h-full object-cover" /> : <ShoppingBag size={32} className="text-gray-300" />}<div className="absolute bottom-1 right-2 text-[10px] bg-gray-200 px-1 rounded">{product.barcode || 'S/N'}</div></div><h3 className="font-medium text-gray-800 line-clamp-2">{product.name}</h3></div><div className="mt-3 font-bold text-purple-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</div></button>))}</div></div>
      </div>
      <div className="w-full lg:w-[400px] h-1/2 lg:h-full bg-white flex flex-col shadow-xl z-10 border-t lg:border-t-0 border-gray-200">
        <div className="p-4 bg-purple-600 text-white flex justify-between items-center shadow-md shrink-0"><div className="flex items-center gap-2"><ShoppingCart size={20} /><h2 className="font-bold">Carrinho</h2></div><span className="bg-purple-700 px-2 py-1 rounded text-sm font-medium">{cart.length} itens</span></div>
        <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center gap-3 shrink-0 relative z-30">
           <User size={20} className="text-purple-600" />
           <div className="flex-1 relative">
             <label className="text-xs font-semibold text-purple-900 block mb-1">Cliente</label>
             {isCustomerDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>}
             <div className="relative z-20">
                <input ref={customerInputRef} type="text" value={customerSearchTerm} onChange={(e) => { setCustomerSearchTerm(e.target.value); setIsCustomerDropdownOpen(true); }} onFocus={() => setIsCustomerDropdownOpen(true)} placeholder="Buscar cliente..." className="w-full text-sm p-2 pr-8 rounded border border-purple-200" />
                <button onClick={() => { if (customerSearchTerm) { setCustomerSearchTerm(''); customerInputRef.current?.focus(); setIsCustomerDropdownOpen(true); } else { setIsCustomerDropdownOpen(!isCustomerDropdownOpen); } }} className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400">{customerSearchTerm ? <X size={14} /> : <ChevronDown size={14} />}</button>
                {isCustomerDropdownOpen && (<div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">{filteredCustomersForDropdown.map(c => (<button key={c.id} onClick={() => { setSelectedCustomer(c.id); setIsCustomerDropdownOpen(false); }} className={`w-full text-left p-2.5 text-sm hover:bg-purple-50 flex justify-between items-center ${selectedCustomer === c.id ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700'}`}><span>{c.name}</span>{selectedCustomer === c.id && <Check size={14} />}</button>))}</div>)}
             </div>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">{cart.map(item => (<div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100"><div className="flex-1"><h4 className="font-medium text-sm text-gray-800 line-clamp-1">{item.name}</h4><div className="text-xs text-gray-500 mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</div></div><div className="flex items-center gap-2"><span className="text-sm font-medium w-6 text-center">{item.quantity}</span></div><button onClick={() => { setCart(prev => prev.filter(i => i.id !== item.id)) }} className="text-red-400"><Trash2 size={16} /></button></div>))}</div>
        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4 shrink-0 pb-safe"><div className="flex justify-between items-end"><span className="text-gray-500">Subtotal</span><span className="text-3xl font-bold text-gray-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartSubtotal)}</span></div><button disabled={cart.length === 0} onClick={() => setShowPaymentModal(true)} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">FINALIZAR VENDA</button></div>
      </div>
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95dvh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold text-gray-800">Finalizar Venda</h3><button onClick={() => setShowPaymentModal(false)}><X size={24} /></button></div>
            <div className="p-6 flex flex-col md:flex-row gap-6 overflow-y-auto">
              <div className="flex-1 space-y-6">
                <div className="bg-purple-50 p-4 rounded-xl text-center space-y-2"><p className="text-gray-500 text-sm">Total Final</p><p className="text-4xl font-bold text-purple-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal)}</p></div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200"><label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" checked={isRetroactive} onChange={(e) => setIsRetroactive(e.target.checked)} className="w-4 h-4" /><span className="text-sm font-bold text-orange-800">Venda Retroativa</span></label>{isRetroactive && <input type="date" value={retroDate} onChange={(e) => setRetroDate(e.target.value)} className="w-full p-2 border rounded" />}</div>
                <div><label className="text-sm font-medium">Desconto (R$)</label><input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-full p-2 border rounded" /></div>
                <div><label className="text-sm font-medium">CPF (Opcional)</label><input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full p-2 border rounded" /></div>
              </div>
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                    {['DEBIT_CARD', 'CREDIT_CARD', 'MONEY', 'PIX', 'BEMOL', 'STORE_CREDIT'].map(m => (
                        <button key={m} onClick={() => { setSelectedPaymentMethod(m as any); setInstallments(1); }} className={`p-3 rounded-xl border-2 ${selectedPaymentMethod === m ? 'border-purple-500 bg-purple-50' : 'border-gray-100'}`}>{m}</button>
                    ))}
                </div>
                {selectedPaymentMethod === 'CREDIT_CARD' && (
                  <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-full p-2 border rounded">{Array.from({length:12},(_,i)=>i+1).map(i=><option key={i} value={i}>{i}x</option>)}</select>
                )}
                {selectedPaymentMethod === 'STORE_CREDIT' && (
                  <div className="bg-pink-50 p-4 rounded border border-pink-200 space-y-2">
                      <p className="text-xs text-pink-700 font-bold">Crediário Loja</p>
                      <label className="flex gap-2"><input type="checkbox" checked={isExtendedGracePeriod} onChange={e=>setIsExtendedGracePeriod(e.target.checked)} /> Pagar em 60 dias (+3%)</label>
                      <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-full p-2 border rounded">{Array.from({length:12},(_,i)=>i+1).map(i=><option key={i} value={i}>{i}x {i>4?'(c/ juros)':''}</option>)}</select>
                      <input type="date" value={storeCreditDueDate} onChange={e=>setStoreCreditDueDate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                )}
                {selectedPaymentMethod === 'MONEY' && (
                  <div><label>Valor Recebido</label><input type="number" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} className="w-full p-2 border rounded" /></div>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex gap-3 shrink-0 border-t border-gray-100"><button onClick={() => setShowPaymentModal(false)} className="flex-1 py-3 bg-gray-200 rounded">Cancelar</button><button onClick={handleConfirmSale} className="flex-1 py-3 bg-green-600 text-white rounded font-bold">Confirmar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};