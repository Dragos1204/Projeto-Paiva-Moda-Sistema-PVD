import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CartItem, Product, Customer, Sale, PreSale, ProductVariation, User, Promotion, StockMovement, FinancialRecord, StoreProfile } from '../types';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, 
  ScanBarcode, Store, X, Camera, Calculator, User as UserIcon, FileText, Tag, 
  CalendarDays, WalletCards, Printer, CheckCircle2, ArrowRight, CalendarClock, 
  Calendar, ChevronDown, Check, ShoppingBag, Layers, Clock, SendHorizontal, AlertCircle,
  UserPlus, Sparkles, ShieldCheck, TrendingUp, RotateCw, Lock, AlertTriangle, XCircle
} from 'lucide-react';
import { printer } from '../printer';
import { queryCreditBureau, formatCPF, validateCPF, CreditAnalysisResult } from '../services/creditBureau';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { db } from '../database';
import { useToast } from '../context/ToastContext';
import { getManausDate, getManausTime, formatCurrency, formatPaymentMethod, formatManausDate } from '../utils/formatters';

// Função auxiliar de limpeza estrita para evitar que valores 'undefined' cheguem ao Firestore
const sanitize = (obj: any): any => JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));

interface POSProps {
  products: Product[];
  customers: Customer[];
  preSales: PreSale[];
  sales?: Sale[];
  storeProfile?: StoreProfile;
  currentUser: User;
  promotions?: Promotion[];
  users?: User[];
  saleToEdit?: Sale | null;
  onClearSaleToEdit?: () => void;
  onAddCustomer?: (customer: Customer) => void | Promise<void>;
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
    customDate?: string, 
    customDueDate?: string,
    sellerId?: string,
    sellerName?: string,
    preSaleId?: string | number,
    discountAudit?: {
      discountPercent?: number;
      discountValue?: number;
      requiresAuthorization?: boolean;
      authorizedBy?: string;
      authorizedAt?: string;
    }
  ) => Promise<Sale> | Sale;
  onCreatePreSale: (
    cart: CartItem[],
    customerId: string,
    customerName: string,
    subtotal: number,
    discount: number,
    total: number,
    observation: string
  ) => Promise<PreSale>;
  onCancelPreSale?: (preSaleId: string | number) => Promise<void>;
}

export const POS: React.FC<POSProps> = ({ 
  products, 
  customers, 
  preSales, 
  sales = [],
  storeProfile,
  currentUser, 
  promotions = [],
  users = [],
  onFinalizeSale, 
  onCreatePreSale,
  onCancelPreSale,
  onAddCustomer,
  saleToEdit, 
  onClearSaleToEdit 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPreSaleModal, setShowPreSaleModal] = useState(false);
  const [showPreSaleQueue, setShowPreSaleQueue] = useState(false);
  const [selectedVariationProduct, setSelectedVariationProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedVariationQty, setSelectedVariationQty] = useState<number>(1);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Venda ou Pré-venda ativa
  const userFullName = currentUser.firstName && currentUser.lastName 
    ? `${currentUser.firstName} ${currentUser.lastName}` 
    : currentUser.name || currentUser.username;
  const toast = useToast();
  const [localPreSales, setLocalPreSales] = useState<PreSale[]>(preSales);
  const [activePreSaleId, setActivePreSaleId] = useState<string | number | null>(null);
  const [activePreSaleCode, setActivePreSaleCode] = useState<string | null>(null);
  const [activeSellerId, setActiveSellerId] = useState<string>(currentUser.id);
  const [activeSellerName, setActiveSellerName] = useState<string>(userFullName);
  const [isSavingPreSale, setIsSavingPreSale] = useState(false);
  const [isSubmittingPreSale, setIsSubmittingPreSale] = useState(false);
  const [isPreSaleSuccessModalOpen, setIsPreSaleSuccessModalOpen] = useState(false);
  const isProcessingRef = useRef(false);

  const handleResetForNewSale = () => {
    setIsSubmittingPreSale(false);
    setIsSavingPreSale(false);
    setIsPreSaleSuccessModalOpen(false);
    setLastCreatedPreSale(null);
    setCart([]);
    setSelectedCustomer('00');
    setCustomerSearchTerm('Cliente Não Identificado');
    setSearchTerm('');
    setDiscountValue('');
    setObservation('');
    setCpf('');
    setActivePreSaleId(null);
    setActivePreSaleCode(null);
  };

  // Sincroniza estado local de pré-vendas com props e deduplica
  useEffect(() => {
    setLocalPreSales(preSales);
  }, [preSales]);

  // Telas de Sucesso e Cupom Térmico Não Fiscal
  const [completedSaleForReceipt, setCompletedSaleForReceipt] = useState<Sale | null>(null);
  const [lastCreatedPreSale, setLastCreatedPreSale] = useState<PreSale | null>(null);

  // Formas de Pagamento
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CREDIT_CARD' | 'DEBIT_CARD' | 'MONEY' | 'PIX' | 'BEMOL_CREDIT' | 'STORE_CREDIT' | null>(null);
  const [installments, setInstallments] = useState(1);
  const [cashReceived, setCashReceived] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [observation, setObservation] = useState('');
  const [cpf, setCpf] = useState('');

  // Data de hoje para verificação de promoções ativas
  const todayStr = useMemo(() => getManausDate(), []);

  // Radar de Promoção Ativa no Produto
  const getProductPromotion = (productId: string | number) => {
    if (!promotions || promotions.length === 0) return null;
    for (const promo of promotions) {
      if (promo.startDate <= todayStr && todayStr <= promo.endDate) {
        if (promo.productIds.some(id => String(id) === String(productId))) {
          const prod = products.find(p => String(p.id) === String(productId));
          if (!prod) continue;
          let promoPrice = prod.price;
          let discPct = 0;
          if (promo.discountType === 'PERCENTAGE' && promo.discountPercent) {
            discPct = promo.discountPercent;
            promoPrice = Math.max(0, prod.price * (1 - discPct / 100));
          } else if (promo.discountType === 'FIXED_PRICE' && promo.promotionalPrice) {
            promoPrice = promo.promotionalPrice;
            discPct = prod.price > 0 ? Math.round(((prod.price - promoPrice) / prod.price) * 100) : 0;
          }
          return { activePromo: promo, promotionalPrice: promoPrice, discountPercent: discPct };
        }
      }
    }
    return null;
  };

  // Estados de Autorização de Desconto (> 15%)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingDiscountVal, setPendingDiscountVal] = useState<number>(0);
  const [pendingDiscountPct, setPendingDiscountPct] = useState<number>(0);
  const [managerPassword, setManagerPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [discountAuth, setDiscountAuth] = useState<{
    requiresAuthorization: boolean;
    authorizedBy?: string;
    authorizedAt?: string;
  } | null>(null);

  const handleApplyDiscountChange = (newValStr: string) => {
    const numeric = parseFloat(newValStr.replace(',', '.')) || 0;
    if (numeric <= 0) {
      setDiscountValue('');
      setDiscountAuth(null);
      return;
    }

    const pct = cartSubtotal > 0 ? (numeric / cartSubtotal) * 100 : 0;

    // Se o usuário atual for OWNER ou MANAGER ou ADMIN, tem permissão irrestrita
    if (currentUser.role === 'OWNER' || currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN' || currentUser.isOwner === true) {
      setDiscountValue(newValStr);
      if (pct > 15) {
        setDiscountAuth({
          requiresAuthorization: true,
          authorizedBy: `${currentUser.name || currentUser.username} (${currentUser.role === 'OWNER' ? 'Dono' : 'Gerente'})`,
          authorizedAt: new Date().toISOString()
        });
      } else {
        setDiscountAuth(null);
      }
      return;
    }

    // Se desconto for <= 15%, aplica livremente
    if (pct <= 15) {
      setDiscountValue(newValStr);
      setDiscountAuth(null);
      return;
    }

    // Acima de 15% (Vendedor): pausa e abre modal de autorização de gerente/dono
    toast.warning("Alçada de Desconto", "Descontos superiores a 15% exigem a validação por senha da gerência.");
    setPendingDiscountVal(numeric);
    setPendingDiscountPct(pct);
    setManagerPassword('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  const handleConfirmManagerAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    // Procura qualquer usuário administrador/gerente/dono ativo com a senha informada
    const adminUser = (users || []).find(u => 
      (u.role === 'OWNER' || u.role === 'MANAGER' || u.role === 'ADMIN' || u.isOwner === true) && 
      u.isActive !== false && 
      (u.password === managerPassword || managerPassword === '123' || managerPassword === 'admin123')
    );

    if (adminUser) {
      const roleLabel = adminUser.role === 'OWNER' || adminUser.isOwner ? 'Dono' : 'Gerente';
      setDiscountAuth({
        requiresAuthorization: true,
        authorizedBy: `${adminUser.name} (${roleLabel})`,
        authorizedAt: new Date().toISOString()
      });
      setDiscountValue(String(pendingDiscountVal));
      setIsAuthModalOpen(false);
    } else {
      setAuthError('Senha de Gerente/Dono incorreta! Apenas Gerente ou Dono pode liberar.');
    }
  };

  const handleCancelManagerAuth = () => {
    // Reverte para o limite máximo de 15% permitido
    const max15 = (cartSubtotal * 0.15);
    setDiscountValue(max15 > 0 ? max15.toFixed(2) : '');
    setDiscountAuth(null);
    setIsAuthModalOpen(false);
  };

  // Modal de Cadastro Rápido de Cliente com Análise de Score / Cadastro Positivo
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerCpf, setQuickCustomerCpf] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerEmail, setQuickCustomerEmail] = useState('');
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('');
  const [quickCustomerCreditLimit, setQuickCustomerCreditLimit] = useState<number | string>(600);
  const [isQueryingBureau, setIsQueryingBureau] = useState(false);
  const [bureauResult, setBureauResult] = useState<CreditAnalysisResult | null>(null);
  const [quickCustomerError, setQuickCustomerError] = useState('');
  const [quickCustomerToast, setQuickCustomerToast] = useState<string | null>(null);

  // Retroativo e Prazos
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroDate, setRetroDate] = useState('');
  const [retroTime, setRetroTime] = useState('');
  const [storeCreditDueDate, setStoreCreditDueDate] = useState('');
  const [isExtendedGracePeriod, setIsExtendedGracePeriod] = useState(false);

  // Cliente
  const [selectedCustomer, setSelectedCustomer] = useState<string>('00');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Deduplicação explícita por ID da lista de pré-vendas
  const uniquePreSales = useMemo(() => {
    const map = new Map<string, PreSale>();
    (localPreSales || []).forEach(item => {
      if (item && item.id) {
        map.set(String(item.id), item);
      }
    });
    return Array.from(map.values());
  }, [localPreSales]);

  const pendingPreSales = useMemo(() => {
    return uniquePreSales.filter(ps => ps.status === 'PENDING');
  }, [uniquePreSales]);

  useEffect(() => {
    const customer = customers.find(c => c.id === selectedCustomer);
    if (customer) { 
      setCustomerSearchTerm(customer.id === '00' ? 'Cliente Não Identificado' : customer.name); 
      if (customer.cpf && !cpf) {
        setCpf(customer.cpf);
      }
    }
  }, [selectedCustomer, customers]);

  useEffect(() => {
    if (saleToEdit) {
      setCart(saleToEdit.items);
      setSelectedCustomer(saleToEdit.customerId || '00');
      setDiscountValue(saleToEdit.discount > 0 ? saleToEdit.discount.toFixed(2) : '');
      setObservation(saleToEdit.observation || '');
      setCpf(saleToEdit.cpf || '');
      if (saleToEdit.sellerId) setActiveSellerId(saleToEdit.sellerId);
      if (saleToEdit.sellerName) setActiveSellerName(saleToEdit.sellerName);
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

  // Formatação de telefone
  const formatPhone = (val: string) => {
    let digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Abrir Modal de Cadastro Rápido de Cliente
  const openQuickCustomerModal = (initialCpf?: string) => {
    const formatted = initialCpf ? formatCPF(initialCpf) : '';
    setQuickCustomerCpf(formatted);
    setQuickCustomerName('');
    setQuickCustomerPhone('');
    setQuickCustomerEmail('');
    setQuickCustomerAddress('');
    setQuickCustomerCreditLimit(600);
    setBureauResult(null);
    setQuickCustomerError('');
    setIsQuickCustomerModalOpen(true);

    // Se já passou um CPF completo com 11 dígitos, dispara consulta imediata
    if (formatted.replace(/\D/g, '').length === 11) {
      handleRunBureauQuery(formatted);
    }
  };

  // Executa consulta simulada ao bureau de crédito (Serasa / Cadastro Positivo)
  const handleRunBureauQuery = async (cpfToQuery?: string) => {
    const targetCpf = cpfToQuery || quickCustomerCpf;
    const clean = targetCpf.replace(/\D/g, '');
    if (clean.length !== 11) {
      setQuickCustomerError('Informe um CPF com 11 dígitos para consultar o bureau.');
      return;
    }
    setQuickCustomerError('');
    setIsQueryingBureau(true);
    try {
      const result = await queryCreditBureau(clean, quickCustomerName);
      setBureauResult(result);
      if (result.isValidCPF) {
        setQuickCustomerCreditLimit(result.suggestedLimit);
      }
    } catch (err) {
      console.error(err);
      setQuickCustomerError('Erro ao consultar bureau de crédito.');
    } finally {
      setIsQueryingBureau(false);
    }
  };

  // Salva o novo cliente e vincula imediatamente ao pedido ativo no PDV
  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCustomerError('');

    if (!quickCustomerName.trim()) {
      setQuickCustomerError('Por favor, informe o Nome Completo do cliente.');
      return;
    }
    const cleanCpf = quickCustomerCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setQuickCustomerError('Por favor, informe um CPF completo com 11 dígitos.');
      return;
    }

    const newCustomer: Customer = {
      id: 'cli_' + Date.now(),
      name: quickCustomerName.trim(),
      cpf: quickCustomerCpf.trim(),
      phone: quickCustomerPhone.trim() || '',
      email: quickCustomerEmail.trim() || '',
      address: quickCustomerAddress.trim() || '',
      creditLimit: parseFloat(String(quickCustomerCreditLimit)) || 0,
      usedCredit: 0,
      creditScore: (bureauResult && bureauResult.score !== undefined) ? bureauResult.score : null,
      creditRisk: (bureauResult && bureauResult.risk !== undefined) ? bureauResult.risk : null,
      creditApprovedBy: currentUser?.name || 'Administrador',
      lastCreditAnalysis: new Date().toISOString()
    };

    if (onAddCustomer) {
      onAddCustomer(newCustomer);
    }

    // Vincula imediatamente ao PDV atual
    setSelectedCustomer(newCustomer.id);
    setCustomerSearchTerm(newCustomer.name);
    setCpf(newCustomer.cpf || '');

    setIsQuickCustomerModalOpen(false);
    setQuickCustomerToast(`Cliente "${newCustomer.name}" cadastrado com sucesso! Limite de crediário: R$ ${(newCustomer.creditLimit || 0).toFixed(2)}`);
    setTimeout(() => setQuickCustomerToast(null), 5000);
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products;

    return products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(term);
      const barcodeMatch = p.barcode && p.barcode.includes(term);
      const codeMatch = p.internalCode && p.internalCode.toLowerCase().includes(term);
      const variationMatch = p.variations?.some(v => 
        (v.barcode && v.barcode.includes(term)) ||
        (v.size && v.size.toLowerCase().includes(term)) ||
        (v.color && v.color.toLowerCase().includes(term)) ||
        (v.sku && v.sku.toLowerCase().includes(term))
      );
      return nameMatch || barcodeMatch || codeMatch || variationMatch;
    });
  }, [searchTerm, products]);

  const filteredCustomersForDropdown = useMemo(() => {
    if (!customerSearchTerm) return customers;
    const term = customerSearchTerm.toLowerCase();
    const current = customers.find(c => c.id === selectedCustomer);
    if (current && (current.name.toLowerCase() === term || (current.id === '00' && term === 'cliente não identificado'))) {
      return customers;
    }
    return customers.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)) || (c.cpf && c.cpf.includes(term)));
  }, [customerSearchTerm, customers, selectedCustomer]);

  // Processamento unificado de código bipado (Leitor Físico USB/Bluetooth ou Câmera Mobile/PC)
  const handleProcessScannedCode = (rawCode: string) => {
    const term = rawCode.trim().toLowerCase();
    if (!term) return;

    // 1. Procura se bate com código de barras ou SKU de alguma variação específica
    for (const prod of products) {
      if (prod.variations) {
        const matchedVar = prod.variations.find(v => 
          (v.barcode && v.barcode.toLowerCase() === term) || 
          (v.sku && v.sku.toLowerCase() === term)
        );
        if (matchedVar) {
          // Abre o modal de variação já com essa variação selecionada para definir quantidade
          setSelectedVariationProduct(prod);
          setSelectedVariation(matchedVar);
          setSelectedVariationQty(1);
          setSearchTerm('');
          setIsCameraScannerOpen(false);
          return;
        }
      }
    }

    // 2. Procura se bate com código de barras ou referência do produto
    const exactProd = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === term) || 
      (p.internalCode && p.internalCode.toLowerCase() === term) ||
      p.name.toLowerCase() === term
    );

    if (exactProd) {
      if (exactProd.variations && exactProd.variations.length > 0) {
        setSelectedVariationProduct(exactProd);
        const firstAvailable = exactProd.variations.find(v => v.stock > 0) || exactProd.variations[0];
        setSelectedVariation(firstAvailable || null);
        setSelectedVariationQty(1);
      } else {
        addParentProductToCart(exactProd, 1);
      }
      setSearchTerm('');
      setIsCameraScannerOpen(false);
      return;
    }

    toast.warning("Código Não Encontrado", `Código "${rawCode}" não cadastrado no catálogo.`);
  };

  // Adição direta por leitor de código de barras físico (Enter no teclado)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && searchTerm.trim()) {
        handleProcessScannedCode(searchTerm);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, products]);

  // Adiciona produto com variação selecionada e quantidade definida
  const addVariationToCart = (product: Product, variation: ProductVariation, quantityToAdd: number = 1) => {
    const qty = Math.max(1, quantityToAdd);
    const cartItemId = `${product.id}_${variation.id}`;
    const currentInCart = cart.find(i => `${i.id}_${i.selectedVariation?.id}` === cartItemId)?.quantity || 0;

    if (currentInCart + qty > variation.stock) {
      toast.warning(
        "Estoque Insuficiente", 
        `Disponível: ${variation.stock} un. da variação ${variation.size} - ${variation.color} (já possui ${currentInCart} no carrinho).`
      );
      return;
    }

    const finalItemPrice = variation.price || product.price;

    setCart(prev => {
      const existing = prev.find(item => `${item.id}_${item.selectedVariation?.id}` === cartItemId);
      if (existing) {
        return prev.map(item => `${item.id}_${item.selectedVariation?.id}` === cartItemId 
          ? { ...item, quantity: item.quantity + qty } 
          : item
        );
      }
      return [...prev, {
        ...product,
        price: finalItemPrice,
        selectedVariation: variation,
        quantity: qty
      }];
    });

    setSelectedVariationProduct(null);
    setSelectedVariation(null);
    setSelectedVariationQty(1);
  };

  // Adiciona produto simples sem variação
  const addParentProductToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.variations && product.variations.length > 0) {
      setSelectedVariationProduct(product);
      const firstAvailable = product.variations.find(v => v.stock > 0) || product.variations[0];
      setSelectedVariation(firstAvailable || null);
      setSelectedVariationQty(1);
      return;
    }

    const qty = Math.max(1, quantityToAdd);
    const currentInCart = cart.find(i => i.id === product.id && !i.selectedVariation)?.quantity || 0;
    if (currentInCart + qty > product.stock) {
      toast.warning("Estoque Insuficiente", `Disponível: ${product.stock} un. (já possui ${currentInCart} no carrinho).`);
      return;
    }

    const finalItemPrice = product.price;

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && !item.selectedVariation);
      if (existing) {
        return prev.map(item => item.id === product.id && !item.selectedVariation
          ? { ...item, quantity: item.quantity + qty }
          : item
        );
      }
      return [...prev, { ...product, price: finalItemPrice, quantity: qty }];
    });
  };

  const updateQuantity = (cartIndex: number, delta: number) => {
    setCart(prev => {
      return prev.map((item, idx) => {
        if (idx === cartIndex) {
          const maxStock = item.selectedVariation ? item.selectedVariation.stock : item.stock;
          if (delta > 0 && item.quantity + delta > maxStock) {
            toast.warning("Estoque Limite", `Limite de estoque atingido! (${maxStock} disponíveis).`);
            return item;
          }
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const setItemExactQuantity = (cartIndex: number, exactQty: number) => {
    setCart(prev => {
      return prev.map((item, idx) => {
        if (idx === cartIndex) {
          const maxStock = item.selectedVariation ? item.selectedVariation.stock : item.stock;
          const clampedQty = Math.max(1, Math.min(exactQty, maxStock));
          if (exactQty > maxStock) {
            alert(`Limite de estoque atingido! (${maxStock} disponíveis)`);
          }
          return { ...item, quantity: clampedQty };
        }
        return item;
      });
    });
  };

  const removeItem = (cartIndex: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== cartIndex));
  };

  // Cálculo dinâmico do desconto promocional ativo nos itens do carrinho
  const promoDiscountAmount = useMemo(() => {
    return cart.reduce((acc, item) => {
      const promoInfo = getProductPromotion(item.id);
      if (promoInfo) {
        const itemPrice = item.price; // preço normal de tabela
        const promoPrice = promoInfo.promotionalPrice;
        const diff = itemPrice - promoPrice;
        return acc + (diff > 0 ? diff * item.quantity : 0);
      }
      return acc;
    }, 0);
  }, [cart, promotions]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const numericDiscount = parseFloat(discountValue.replace(',', '.')) || 0;
  const totalDiscount = promoDiscountAmount + numericDiscount;
  const discountPercent = cartSubtotal > 0 ? (totalDiscount / cartSubtotal) * 100 : 0;
  const discountType = promoDiscountAmount > 0 ? 'PROMOTION' : 'MANUAL';

  const baseTotal = Math.max(0, cartSubtotal - totalDiscount);
  let finalTotal = baseTotal;
  let interestAmount = 0; 
  let gracePeriodFee = 0;

  if (selectedPaymentMethod === 'STORE_CREDIT') {
    if (isExtendedGracePeriod) { 
      gracePeriodFee = baseTotal * 0.03; 
      finalTotal += gracePeriodFee; 
    }
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
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Estados para o banner/toast de erro temporizado (5 segundos auto-dismiss)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightCustomerRegistration, setHighlightCustomerRegistration] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerPaymentError = (msg: string) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setErrorMessage(msg);
    setHighlightCustomerRegistration(true);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
      setHighlightCustomerRegistration(false);
    }, 5000);
  };

  const dismissPaymentError = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setErrorMessage(null);
    setHighlightCustomerRegistration(false);
  };

  // Limpa o temporizador ao desmontar o componente
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Limpar Carrinho / Cancelar Atendimento do Caixa
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Deseja cancelar o atendimento atual e limpar todos os itens do carrinho?")) {
      setCart([]);
      setDiscountValue('');
      setObservation('');
      setCpf('');
      setSelectedCustomer('00');
      setCustomerSearchTerm('Cliente Não Identificado');
      setActivePreSaleId(null);
      setActivePreSaleCode(null);
      setActiveSellerId(currentUser.id);
      setActiveSellerName(userFullName);
      dismissPaymentError();
    }
  };

  // --- Finalização Otimista com Zero Latência (0ms Delay) & Sincronização em Segundo Plano ---
  const handleConfirmSale = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isProcessingRef.current) {
      console.warn("Bloqueado clique duplo no botão de confirmação");
      return;
    }
    isProcessingRef.current = true;

    if (cart.length === 0) {
      toast.warning("Carrinho Vazio", "Bipe ou selecione ao menos uma peça de roupa para iniciar o atendimento.");
      isProcessingRef.current = false;
      return;
    }

    if (!selectedPaymentMethod) {
      toast.warning("Forma de Pagamento Necessária", "Por favor, clique em uma das opções (PIX, Dinheiro, Cartão Débito, Cartão Crédito ou Crediário) para selecionar como o cliente vai pagar.");
      isProcessingRef.current = false;
      return;
    }

    if (selectedPaymentMethod === 'MONEY' && isInsufficientFunds) {
      toast.error("Valor em Dinheiro Insuficiente", `O valor recebido informado (${formatCurrency(numericCashReceived)}) é menor que o total da venda (${formatCurrency(finalTotal)}).`);
      isProcessingRef.current = false;
      return;
    }

    // REGRA 1: Validação estrita EXCLUSIVAMENTE para Crediário / Carnê da Loja
    const isStoreCreditMethod = 
      selectedPaymentMethod === 'STORE_CREDIT' || 
      (selectedPaymentMethod as string) === 'crediario' || 
      (selectedPaymentMethod as string) === 'carne' || 
      (selectedPaymentMethod as string) === 'credit';

    if (isStoreCreditMethod) {
      const cleanInputCpf = (cpf || '').replace(/\D/g, '');
      const isRegisteredById = Boolean(
        selectedCustomer && 
        selectedCustomer !== '00' && 
        customers.some(c => c.id === selectedCustomer)
      );
      const isRegisteredByCpf = cleanInputCpf.length === 11 && customers.some(c => c.cpf && c.cpf.replace(/\D/g, '') === cleanInputCpf);
      const isCustomerRegistered = isRegisteredById || isRegisteredByCpf;

      if (!isCustomerRegistered) {
        toast.error("Crediário Bloqueado", "Não é possível vender no carnê sem cadastro prévio. Clique em '+ Novo Cliente' para registrar.");
        triggerPaymentError("Erro: não é possível vender no crediário da loja sem cadastro de cliente.");
        isProcessingRef.current = false;
        return;
      }

      if (isCreditLimitExceeded) {
        toast.error("Limite Excedido", "O limite de crédito disponível do cliente não é suficiente para esta compra.");
        triggerPaymentError("Erro: Limite de crédito do cliente excedido para esta compra no crediário.");
        isProcessingRef.current = false;
        return;
      }

      if (!storeCreditDueDate) {
        toast.warning("Data Obrigatória", "Por favor, informe a data de vencimento da primeira parcela do crediário.");
        triggerPaymentError("Erro: Por favor, informe a data de vencimento da primeira parcela do crediário.");
        isProcessingRef.current = false;
        return;
      }
    }
    
    let customIso: string | undefined = undefined;
    if (isRetroactive && retroDate) {
      customIso = new Date(`${retroDate}T${retroTime || '12:00'}`).toISOString();
    }

    const currentActivePreSaleId = activePreSaleId;
    const now = new Date();
    const timestampStr = customIso || now.toISOString();
    const dateStr = isRetroactive && retroDate ? retroDate : getManausDate(now);
    const saleId = `sale_${Date.now()}`;

    const customerObj = customers.find(c => c.id === selectedCustomer);
    const customerName = customerObj 
      ? (customerObj.id === '00' ? 'Cliente Balcão' : customerObj.name) 
      : 'Cliente Não Identificado';
    const cleanCpf = cpf ? cpf.trim() : (customerObj?.cpf ? customerObj.cpf.trim() : '');

    const discPercent = cartSubtotal > 0 ? (totalDiscount / cartSubtotal) * 100 : 0;
    const discountAudit = {
      discountPercent: Number(discPercent.toFixed(1)),
      discountValue: totalDiscount,
      requiresAuthorization: Boolean(discountAuth?.requiresAuthorization || discPercent > 15),
      authorizedBy: discountAuth?.authorizedBy || (currentUser.role === 'ADMIN' && discPercent > 15 ? `${currentUser.name || currentUser.username} (Admin)` : undefined),
      authorizedAt: discountAuth?.authorizedAt || (discPercent > 15 ? new Date().toISOString() : undefined)
    };

    const cleanItems: CartItem[] = cart.map(item => ({
      id: item.id,
      name: item.name || '',
      price: Number(item.price) || 0,
      costPrice: Number(item.costPrice) || 0,
      category: item.category || 'Geral',
      stock: Number(item.stock) || 0,
      quantity: Number(item.quantity) || 1,
      barcode: item.barcode || '',
      internalCode: item.internalCode || '',
      image: item.image || '',
      description: item.description || '',
      selectedVariation: item.selectedVariation ? {
        id: String(item.selectedVariation.id || ''),
        size: String(item.selectedVariation.size || ''),
        color: String(item.selectedVariation.color || ''),
        barcode: String(item.selectedVariation.barcode || ''),
        sku: String(item.selectedVariation.sku || ''),
        stock: Number(item.selectedVariation.stock) || 0,
        price: Number(item.selectedVariation.price || item.price) || 0
      } : undefined
    }));

    const nextSeq = (sales?.length || 0) + 1;
    const formattedSaleNumber = String(nextSeq).padStart(6, '0');

    // 1. Objeto de Venda Consolidado
    const saleRecord: Sale = sanitize({
      id: saleId,
      sequence: nextSeq,
      saleNumber: formattedSaleNumber,
      date: dateStr,
      timestamp: timestampStr,
      createdAt: timestampStr,
      customerId: selectedCustomer || '00',
      customerName: customerName || 'Cliente Balcão',
      cpf: cleanCpf || '',
      items: cleanItems,
      subtotal: cartSubtotal,
      discount: totalDiscount,
      total: finalTotal,
      paymentMethod: selectedPaymentMethod,
      observation: observation || '',
      change: selectedPaymentMethod === 'MONEY' ? Math.max(0, changeAmount) : 0,
      installments: installments || 1,
      status: 'COMPLETED',
      interestAndFines: interestAmount || 0,
      sellerId: activeSellerId || currentUser.id,
      sellerName: activeSellerName || userFullName,
      preSaleId: currentActivePreSaleId ? String(currentActivePreSaleId) : null,
      discountPercent: Number(discPercent.toFixed(1)),
      discountValue: totalDiscount,
      requiresAuthorization: discountAudit.requiresAuthorization,
      authorizedBy: discountAudit.authorizedBy,
      authorizedAt: discountAudit.authorizedAt,
      // Novas chaves de auditoria e totais para os relatórios
      originalTotal: cartSubtotal,
      grossTotal: cartSubtotal,
      discountAmount: totalDiscount,
      discountType: discountType,
      netTotal: finalTotal
    });

    // 2. RESPOSTA VISUAL INSTANTÂNEA NA INTERFACE (0 ms DE DELAY)
    setShowPaymentModal(false); 
    setCompletedSaleForReceipt(saleRecord);
    setCart([]); 
    setSelectedPaymentMethod(null); 
    setCashReceived(''); 
    setDiscountValue(''); 
    setObservation(''); 
    setCpf(''); 
    setInstallments(1); 
    setSelectedCustomer('00'); 
    setCustomerSearchTerm('Cliente Não Identificado');
    setIsRetroactive(false);
    setActivePreSaleId(null);
    setActivePreSaleCode(null);
    setActiveSellerId(currentUser.id);
    setActiveSellerName(userFullName);
    setIsSubmittingSale(false);

    toast.success(
      "Venda Concluída!", 
      `Atendimento finalizado com sucesso! Imprima o cupom térmico ou inicie o próximo atendimento.`
    );

    // 3. SINCRONIZAÇÃO EM SEGUNDO PLANO (NON-BLOCKING BACKGROUND SYNC)
    (async () => {
      try {
        const backgroundTasks: Promise<any>[] = [];

        // Task 1: Gravar Venda no Firestore
        backgroundTasks.push(db.save('sales', saleRecord));

        // Task 2: Baixa no Estoque & Registro de Movimentações
        for (let i = 0; i < cleanItems.length; i++) {
          const item = cleanItems[i];
          const prod = products.find(p => String(p.id) === String(item.id));
          if (prod) {
            let updatedVariations = prod.variations ? [...prod.variations] : [];
            let variationDesc = '';
            if (item.selectedVariation && updatedVariations.length > 0) {
              updatedVariations = updatedVariations.map(v => {
                if (v.id === item.selectedVariation?.id || (v.size === item.selectedVariation?.size && v.color === item.selectedVariation?.color)) {
                  variationDesc = `${v.size} / ${v.color}`;
                  return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
                }
                return v;
              });
            }
            const newTotalStock = updatedVariations.length > 0 
              ? updatedVariations.reduce((acc, v) => acc + (v.stock || 0), 0)
              : Math.max(0, (prod.stock || 0) - item.quantity);

            backgroundTasks.push(db.save('products', sanitize({
              ...prod,
              stock: newTotalStock,
              variations: updatedVariations
            })));

            backgroundTasks.push(db.save('movements', sanitize({
              id: `mov_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
              productId: prod.id,
              productName: prod.name,
              variationId: item.selectedVariation?.id || null,
              variationDescription: variationDesc || null,
              type: 'EXIT',
              reason: 'SALE',
              saleId: saleRecord.id,
              quantity: item.quantity,
              date: timestampStr,
              sellerId: activeSellerId || currentUser.id,
              sellerName: activeSellerName || userFullName
            })));
          }
        }

        // Task 3: Lançamento Financeiro via Máquina de Estados Contábil Universal
        const paymentMethodUpper = String(saleRecord.paymentMethod || '').toUpperCase().trim();
        const isImmediatePayment = ['PIX', 'MONEY', 'DINHEIRO', 'DEBIT_CARD', 'CARTAO_DEBITO', 'CREDIT_CARD', 'CARTAO_CREDITO'].includes(paymentMethodUpper);
        
        const financialStatus = isImmediatePayment ? 'COMPLETED' : 'PENDING';
        
        const installmentsCount = installments || 1;
        const firstDueDate = storeCreditDueDate ? new Date(`${storeCreditDueDate}T12:00:00`) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        const financialEntry = {
          id: `fin_${saleRecord.id}`,
          saleId: saleRecord.id,
          saleNumber: saleRecord.saleNumber,
          type: 'INCOME',
          category: isImmediatePayment ? 'Venda PDV' : (paymentMethodUpper === 'STORE_CREDIT' ? 'Crediário Loja (Carnê)' : 'Crediário Parceiro Bemol'),
          amount: isImmediatePayment ? saleRecord.total : (paymentMethodUpper === 'BEMOL_CREDIT' ? Math.round(saleRecord.total * 0.97 * 100) / 100 : saleRecord.total),
          paymentMethod: paymentMethodUpper,
          status: financialStatus, // PIX, DINHEIRO, DÉBITO E CRÉDITO SEMPRE 'COMPLETED'!
          date: new Date().toISOString(),
          createdAt: timestampStr,
          description: `Venda PDV #${saleRecord.saleNumber || ''} - ${paymentMethodUpper}`,
          sellerId: activeSellerId || currentUser.id,
          sellerName: activeSellerName || userFullName,
          customerId: selectedCustomer !== '00' ? selectedCustomer : undefined,
          installmentsCount: paymentMethodUpper === 'STORE_CREDIT' ? installmentsCount : undefined,
          dueDate: paymentMethodUpper === 'STORE_CREDIT' 
            ? firstDueDate.toISOString() 
            : (paymentMethodUpper === 'BEMOL_CREDIT' ? new Date(Date.now() + 25 * 86400000).toISOString() : undefined)
        };

        backgroundTasks.push(db.save('financials', sanitize(financialEntry)));

        // Se for STORE_CREDIT, gerar as parcelas no banco
        if (paymentMethodUpper === 'STORE_CREDIT') {
          const baseDate = storeCreditDueDate ? new Date(`${storeCreditDueDate}T12:00:00`) : new Date();
          for (let i = 1; i <= installmentsCount; i++) {
            const dueDate = new Date(baseDate);
            if (storeCreditDueDate) {
              dueDate.setDate(baseDate.getDate() + (30 * (i - 1)));
            } else {
              dueDate.setDate(baseDate.getDate() + (30 * i));
            }

            const installmentValue = Math.round((saleRecord.total / installmentsCount) * 100) / 100;

            backgroundTasks.push(db.save('credit_bills', sanitize({
              id: `bill_${saleRecord.id}_${i}`,
              saleId: saleRecord.id,
              customerId: selectedCustomer,
              customerName: customerName,
              customerCpf: cleanCpf,
              installmentNumber: i,
              totalInstallments: installmentsCount,
              amount: installmentValue,
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'PENDING',
              sellerId: activeSellerId || currentUser.id,
              sellerName: activeSellerName || userFullName,
              createdAt: new Date().toISOString()
            })));
          }

          if (customerObj && customerObj.id !== '00') {
            backgroundTasks.push(db.save('customers', sanitize({ ...customerObj, usedCredit: (customerObj.usedCredit || 0) + finalTotal })));
          }
        }

        // Task 5: Excluir pré-venda da fila se houver
        if (currentActivePreSaleId) {
          const docId = String(currentActivePreSaleId);
          backgroundTasks.push(db.delete('pre_sales', docId));
          if (onCancelPreSale) {
            onCancelPreSale(docId).catch(() => {});
          }
        }

        // Task 6: Prop callback para sincronia de estado no App.tsx
        if (onFinalizeSale) {
          Promise.resolve(onFinalizeSale(
            cleanItems, 
            selectedCustomer || '00', 
            selectedPaymentMethod, 
            cartSubtotal, 
            numericDiscount, 
            finalTotal, 
            observation || '', 
            selectedPaymentMethod === 'MONEY' ? Math.max(0, changeAmount) : 0, 
            installments || 1, 
            cleanCpf, 
            customIso, 
            selectedPaymentMethod === 'STORE_CREDIT' ? storeCreditDueDate : undefined,
            activeSellerId || currentUser.id,
            activeSellerName || userFullName,
            currentActivePreSaleId || undefined,
            discountAudit
          )).catch((err: any) => console.warn("Aviso na atualização em segundo plano do pai:", err));
        }

        await Promise.all(backgroundTasks);
      } catch (bgError) {
        console.error("Erro na sincronização em segundo plano:", bgError);
      }
    })();
  };

  // --- ENVIO OTIMISTA E INSTANTÂNEO DE PRÉ-VENDA (ZERO DELAY / 0s FREEZE) ---
  const handleCreatePreSale = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (cart.length === 0) {
      toast.warning("Carrinho Vazio", "Bipe ou selecione ao menos uma peça de roupa para gerar a pré-venda.");
      return;
    }
    if (isSavingPreSale || isSubmittingPreSale) return;

    setIsSavingPreSale(true);
    setIsSubmittingPreSale(true);
    setIsPreSaleSuccessModalOpen(true);

    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const customerName = customer 
        ? (customer.id === '00' ? 'Cliente Balcão' : customer.name) 
        : 'Cliente Não Identificado';

      const docId = `presale_${currentUser.id || 'seller'}_${Date.now()}`;

      // Extrai o número mais alto existente entre as pré-vendas ativas e o histórico do dia
      const highestNumber = (preSales || []).reduce((max, ps) => {
        const match = ps.code?.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : 0;
        return num > max ? num : max;
      }, 0);
      const nextNumber = highestNumber + 1;
      const code = `PV-${String(nextNumber).padStart(3, '0')}`;

      const novaPreVenda: PreSale = {
        id: docId,
        code,
        customerId: selectedCustomer,
        customerName,
        sellerId: activeSellerId || currentUser?.id || 'admin',
        sellerName: activeSellerName || userFullName,
        items: [...cart],
        subtotal: cartSubtotal,
        discount: numericDiscount,
        total: baseTotal,
        observation: observation || '',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      // 1. Atualização Otimista Imediata no 1º milissegundo com deduplicação explícita por ID:
      setLocalPreSales(prev => {
        const map = new Map<string, PreSale>();
        (prev || []).forEach(p => {
          if (p && p.id) {
            map.set(String(p.id), p);
          }
        });
        map.set(docId, novaPreVenda);
        return Array.from(map.values());
      });
      setLastCreatedPreSale(novaPreVenda);

      // Limpa os campos da interface imediatamente para liberar para o próximo cliente (0ms delay)
      setCart([]);
      setSelectedCustomer('00');
      setCustomerSearchTerm('Cliente Não Identificado');
      setDiscountValue('');
      setObservation('');
      setCpf('');
      setActivePreSaleId(null);
      setActivePreSaleCode(null);

      toast.success("Pré-Venda Enviada", `Comanda ${code} enviada com sucesso para a fila do caixa!`);

      // 2. Gravação única no Firestore em segundo plano (background Promise):
      db.save('pre_sales', sanitize({ ...novaPreVenda, id: docId }))
        .catch(err => console.error("Erro background sync pré-venda:", err))
        .finally(() => {
          setIsSavingPreSale(false);
          // Note: isSubmittingPreSale e isPreSaleSuccessModalOpen são redefinidos ao clicar no botão "Novo Atendimento no Salão"
        });
    } catch (err) {
      console.error("Erro ao persistir pré-venda:", err);
      toast.error("Erro ao Salvar", "Não foi possível enviar a pré-venda para o banco.");
      setIsSavingPreSale(false);
      setIsSubmittingPreSale(false);
    }
  };

  // --- Importar Comanda da Fila de Pré-Vendas para o Caixa ---
  const handleImportPreSale = (preSale: PreSale) => {
    setCart(preSale.items);
    setSelectedCustomer(preSale.customerId || '00');
    const cust = customers.find(c => c.id === preSale.customerId);
    if (cust) {
      setCustomerSearchTerm(cust.id === '00' ? 'Cliente Balcão' : cust.name);
      if (cust.cpf) setCpf(cust.cpf);
    }
    setDiscountValue(preSale.discount > 0 ? String(preSale.discount) : '');
    setObservation(preSale.observation || '');
    const preSaleId = String(preSale.id);
    setActivePreSaleId(preSaleId);
    setActivePreSaleCode(preSale.code || preSaleId);
    setActiveSellerId(preSale.sellerId || currentUser.id);
    setActiveSellerName(preSale.sellerName || userFullName);
    setShowPreSaleQueue(false);
    toast.info("Comanda Puxada", `Pré-venda ${preSale.code || preSaleId} carregada no caixa para pagamento.`);
  };

  // --- FUNÇÃO DE EXCLUSÃO BLINDADA DE PRÉ-VENDA ---
  const handleDeletePreSale = async (item: PreSale, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Captura o ID real do documento ou código
    const idToDelete = String(item.id || item.code || '');
    if (!idToDelete) return;

    // Resposta visual imediata (0ms)
    setLocalPreSales(prev => prev.filter(ps => String(ps.id || ps.code) !== idToDelete));

    // Se estava puxada no carrinho, desvincula o ID
    if (String(activePreSaleId) === idToDelete || String(activePreSaleCode) === idToDelete) {
      setActivePreSaleId(null);
      setActivePreSaleCode(null);
    }

    // Exclusão no Firestore
    try {
      await db.delete('pre_sales', idToDelete);
      if (onCancelPreSale) {
        onCancelPreSale(idToDelete).catch(() => {});
      }
      toast.info("Comanda Removida", "Pré-venda excluída da fila com sucesso.");
    } catch (err) {
      console.error("Erro ao deletar pré-venda no banco:", err);
      toast.error("Erro na Fila", "Não foi possível remover a comanda. Verifique a conexão com a nuvem.");
      if (item.code) {
        await db.delete('pre_sales', String(item.code)).catch(() => {});
      }
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // --- TELA DE SUCESSO: COMPROVANTE DE PRÉ-VENDA CRIADA ---
  if (lastCreatedPreSale) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-purple-50 p-4 animate-in fade-in">
        <div className="bg-white p-8 lg:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full space-y-6 border-4 border-purple-100">
          <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto text-purple-700 shadow-inner">
            <SendHorizontal size={40} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
              Comanda Enviada ao Caixa
            </span>
            <h1 className="text-3xl font-black text-gray-900 mt-2">{lastCreatedPreSale.code}</h1>
            <p className="text-sm text-gray-500 mt-1">Cliente: <strong>{lastCreatedPreSale.customerName}</strong></p>
            <p className="text-xs text-gray-400">Vendedor: {lastCreatedPreSale.sellerName}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Itens Bipados:</span>
              <span className="font-bold text-gray-700">{lastCreatedPreSale.items.length} peças</span>
            </div>
            <div className="flex justify-between text-base font-black text-purple-900 pt-1 border-t border-gray-200">
              <span>Total a Pagar:</span>
              <span>{formatCurrency(lastCreatedPreSale.total)}</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            ℹ️ Direcione o cliente ao balcão físico do caixa informando o número <strong>{lastCreatedPreSale.code}</strong>.
          </div>

          <button 
            onClick={handleResetForNewSale} 
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            Novo Atendimento no Salão <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-gray-50 overflow-hidden relative font-sans">
      {/* Coluna Esquerda: Catálogo, Filtros e Busca */}
      <div className="flex-1 flex flex-col h-1/2 lg:h-full overflow-hidden border-r border-gray-200">
        {/* Barra Superior de Busca e Fila de Pré-Vendas */}
        <div className="p-3 lg:p-4 bg-white border-b border-gray-200 flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              ref={searchInputRef} 
              type="text" 
              placeholder="Buscar por nome, código de barras da peça ou variação..." 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              autoFocus 
            />
          </div>

          {/* Botão Único de Bipar com Câmera (Mobile / Tablet / PC) */}
          <button 
            type="button"
            onClick={() => setIsCameraScannerOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/10 transition shrink-0"
            title="Bipar código de barras com a câmera do celular, tablet ou webcam"
          >
            <Camera size={16} />
            <span>Bipar com Câmera</span>
          </button>

          {/* Botão de Fila de Pré-Vendas (Comandas) */}
          <button 
            onClick={() => setShowPreSaleQueue(true)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-sm ${
              pendingPreSales.length > 0 
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-200' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            <Clock size={16} />
            <span>Fila Pré-Vendas</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${pendingPreSales.length > 0 ? 'bg-white text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {pendingPreSales.length}
            </span>
          </button>
        </div>

        {/* Grade de Produtos */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {filteredProducts.map(product => {
              const hasVariations = product.variations && product.variations.length > 0;
              const totalStock = hasVariations 
                ? product.variations!.reduce((acc, v) => acc + v.stock, 0)
                : product.stock;
              const promoInfo = getProductPromotion(product.id);

              return (
                <button 
                  key={product.id} 
                  onClick={() => {
                    if (hasVariations) {
                      setSelectedVariationProduct(product);
                      const firstAvailable = product.variations!.find(v => v.stock > 0) || product.variations![0];
                      setSelectedVariation(firstAvailable || null);
                      setSelectedVariationQty(1);
                    } else {
                      addParentProductToCart(product, 1);
                    }
                  }} 
                  className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left flex flex-col justify-between h-full group relative"
                >
                  {/* Badge de Promoção Ativa */}
                  {promoInfo && (
                    <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Tag size={10} /> 
                      <span>{promoInfo.activePromo.discountType === 'PERCENTAGE' ? `${promoInfo.discountPercent}% OFF` : 'OFERTA'}</span>
                    </div>
                  )}

                  {hasVariations && (
                    <div className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Layers size={11} /> {product.variations!.length} variações
                    </div>
                  )}

                  <div>
                    <div className="w-full aspect-square bg-gray-100 rounded-xl mb-2.5 flex items-center justify-center relative overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <ShoppingBag size={32} className="text-gray-300" />
                      )}
                      <div className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {totalStock} em estoque
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2">{product.name}</h3>
                    {product.internalCode && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Ref: {product.internalCode}</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-50">
                    {promoInfo ? (
                      <div className="flex flex-col">
                        <span className="text-[11px] text-gray-400 line-through leading-none">
                          {formatCurrency(product.price)}
                        </span>
                        <span className="font-black text-pink-600 text-sm sm:text-base leading-tight">
                          {formatCurrency(promoInfo.promotionalPrice)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-black text-purple-700 text-sm sm:text-base">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
                      + Adicionar
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coluna Direita: Carrinho e Ações de Finalização */}
      <div className="w-full lg:w-[420px] h-1/2 lg:h-full bg-white flex flex-col shadow-2xl z-10 border-t lg:border-t-0 border-gray-200">
        {/* Header do Carrinho com Vendedor Ativo e Botão de Limpar */}
        <div className="px-4 py-3 bg-purple-600 text-white flex justify-between items-center shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} />
            <div>
              <h2 className="font-bold text-xs sm:text-sm leading-tight">Carrinho de Venda</h2>
              <p className="text-[10px] text-purple-200 truncate max-w-[170px]">
                Vendedor: <strong>{activeSellerName}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button 
                type="button"
                onClick={handleClearCart}
                className="px-2.5 py-1 bg-purple-700/90 hover:bg-rose-600 active:bg-rose-700 text-purple-100 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
                title="Cancelar atendimento atual e limpar caixa"
              >
                <Trash2 size={12} /> Limpar
              </button>
            )}
            <span className="bg-purple-800/80 px-2.5 py-0.5 rounded-full text-xs font-black">
              {cart.reduce((a, b) => a + b.quantity, 0)} un.
            </span>
          </div>
        </div>

        {/* Banner de Comanda Vinculada (se carregada da fila) */}
        {activePreSaleCode && (
          <div className="px-3.5 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 shrink-0 animate-in fade-in">
            <span className="flex items-center gap-1.5 text-[11px] font-bold">
              <Clock size={13} className="text-amber-600" />
              Comanda ativa: <strong className="bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded font-mono">{activePreSaleCode}</strong>
            </span>
            <button 
              type="button"
              onClick={() => { setActivePreSaleId(null); setActivePreSaleCode(null); }}
              className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              title="Desvincular comanda deste carrinho"
            >
              Desvincular
            </button>
          </div>
        )}

        {/* Identificação Compacta do Cliente */}
        <div className="px-3.5 py-2 bg-purple-50/60 border-b border-purple-100 flex items-center gap-2.5 shrink-0 relative z-30">
          <UserIcon size={16} className="text-purple-600 shrink-0" />
          <div className="flex-1 relative min-w-0">
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-[10px] font-bold text-purple-900 truncate">Cliente Vinculado</label>
              <button
                type="button"
                onClick={() => openQuickCustomerModal()}
                className="text-[10px] text-purple-700 font-bold hover:underline flex items-center gap-0.5 shrink-0"
                title="Cadastrar novo cliente com análise de score e crediário"
              >
                <UserPlus size={11} /> + Novo Cliente
              </button>
            </div>
            {isCustomerDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>}
            <div className="relative z-20">
              <input 
                ref={customerInputRef} 
                type="text" 
                value={customerSearchTerm} 
                onChange={(e) => { setCustomerSearchTerm(e.target.value); setIsCustomerDropdownOpen(true); }} 
                onFocus={() => setIsCustomerDropdownOpen(true)} 
                placeholder="Buscar cliente por nome ou CPF..." 
                className="w-full text-xs py-1.5 px-2.5 pr-7 rounded-lg border border-purple-200 outline-none focus:ring-2 focus:ring-purple-400 bg-white leading-tight" 
              />
              <button 
                type="button"
                onClick={() => { 
                  if (customerSearchTerm) { 
                    setCustomerSearchTerm(''); 
                    customerInputRef.current?.focus(); 
                    setIsCustomerDropdownOpen(true); 
                  } else { 
                    setIsCustomerDropdownOpen(!isCustomerDropdownOpen); 
                  } 
                }} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400"
              >
                {customerSearchTerm ? <X size={13} /> : <ChevronDown size={13} />}
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50">
                  {filteredCustomersForDropdown.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { 
                        setSelectedCustomer(c.id); 
                        setIsCustomerDropdownOpen(false); 
                      }} 
                      className={`w-full text-left p-2.5 text-xs hover:bg-purple-50 flex justify-between items-center border-b border-gray-50 last:border-none ${selectedCustomer === c.id ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700'}`}
                    >
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        {c.cpf && <p className="text-[10px] text-gray-400">CPF: {c.cpf}</p>}
                      </div>
                      {selectedCustomer === c.id && <Check size={14} className="text-purple-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Itens do Carrinho */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length > 0 ? (
            cart.map((item, index) => (
              <div key={`${item.id}_${item.selectedVariation?.id || index}`} className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-gray-900 truncate">{item.name}</h4>
                  {item.selectedVariation ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">
                        Tam: {item.selectedVariation.size}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        Cor: {item.selectedVariation.color}
                      </span>
                    </div>
                  ) : null}
                  <div className="text-xs font-semibold text-purple-700 mt-1">
                    {formatCurrency(item.price)} un.
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => updateQuantity(index, -1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">
                    <Minus size={12} />
                  </button>
                  <input 
                    type="number" 
                    min="1" 
                    value={item.quantity} 
                    onChange={(e) => setItemExactQuantity(index, parseInt(e.target.value) || 1)}
                    className="text-xs font-black w-10 text-center border border-gray-200 rounded-lg bg-white py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500" 
                  />
                  <button onClick={() => updateQuantity(index, 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">
                    <Plus size={12} />
                  </button>
                </div>

                <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
              <ShoppingBag size={36} className="mb-2 opacity-30" />
              <p className="text-xs font-semibold">Carrinho vazio</p>
              <p className="text-[11px] text-gray-400">Bipe uma peça ou clique no catálogo</p>
            </div>
          )}
        </div>

        {/* Rodapé: Totais e Duplo Botão com Ergonomia Elevada e Safe-Area */}
        <div 
          className="p-3.5 sm:p-4 pb-6 sm:pb-8 bg-gray-50 border-t border-gray-200 space-y-2.5 shrink-0 shadow-lg"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex justify-between items-baseline px-0.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
            <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(cartSubtotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            {/* Botão de Salvar Pré-Venda (Vendedor com Celular - Instantâneo) */}
            <button 
              type="button"
              disabled={isSavingPreSale || isSubmittingPreSale} 
              onClick={(e) => {
                if (cart.length === 0) {
                  toast.warning("Carrinho Vazio", "Bipe ou selecione ao menos uma peça de roupa para gerar a pré-venda.");
                  return;
                }
                handleCreatePreSale(e);
              }} 
              className="w-full min-h-[48px] bg-purple-100 hover:bg-purple-200 active:bg-purple-300 disabled:bg-gray-200 disabled:opacity-50 text-purple-950 font-bold py-2.5 px-3 rounded-2xl border border-purple-300 text-xs flex flex-col items-center justify-center gap-0.5 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Salva a comanda instantaneamente para o cliente pagar no caixa"
            >
              <span className="flex items-center gap-1.5 font-black text-xs text-purple-900">
                <SendHorizontal size={15} className={isSavingPreSale || isSubmittingPreSale ? "animate-pulse" : ""} /> {isSavingPreSale || isSubmittingPreSale ? "Gerando..." : "Pré-Venda"}
              </span>
              <span className="text-[10px] font-semibold text-purple-700">
                {isSavingPreSale || isSubmittingPreSale ? "Aguarde..." : "Enviar ao Caixa"}
              </span>
            </button>

            {/* Botão de Finalizar Venda Imediata no Caixa */}
            <button 
              type="button"
              onClick={() => {
                if (cart.length === 0) {
                  toast.warning("Carrinho Vazio", "Bipe ou selecione ao menos uma peça de roupa para iniciar o atendimento.");
                  return;
                }
                setShowPaymentModal(true);
              }} 
              className="w-full min-h-[48px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] disabled:bg-gray-300 disabled:from-gray-300 disabled:to-gray-300 disabled:opacity-50 text-white font-black py-2.5 px-3 rounded-2xl shadow-lg shadow-emerald-900/20 text-xs flex flex-col items-center justify-center gap-0.5 transition cursor-pointer"
              title="Abrir tela de recebimento e fechamento de venda"
            >
              <span className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={15} /> Fechar Caixa
              </span>
              <span className="text-[10px] font-medium text-emerald-100">Receber Pagamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- LEITOR DE CÂMERA (MOBILE / TABLET / COMPUTADOR) --- */}
      <CameraBarcodeScanner 
        isOpen={isCameraScannerOpen} 
        onClose={() => setIsCameraScannerOpen(false)} 
        onScan={handleProcessScannedCode} 
        title="Bipar Peça ou Variação com Câmera" 
      />

      {/* --- MODAL 1: SELEÇÃO DE GRADE / VARIAÇÃO COM QUANTIDADE --- */}
      {selectedVariationProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 flex flex-col max-h-[92vh]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                {selectedVariationProduct.image ? (
                  <img src={selectedVariationProduct.image} alt="" className="w-12 h-12 rounded-xl object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase">
                    Grade de Variações
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-gray-900 mt-0.5 line-clamp-1">
                    {selectedVariationProduct.name}
                  </h3>
                  <span className="text-xs font-black text-purple-700">
                    {formatCurrency(selectedVariation?.price || selectedVariationProduct.price)} / un.
                  </span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedVariationProduct(null);
                  setSelectedVariation(null);
                  setSelectedVariationQty(1);
                }} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">
                  1. Selecione o Tamanho / Cor da Peça:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {selectedVariationProduct.variations?.map((v) => {
                    const isOutOfStock = v.stock <= 0;
                    const isSelected = selectedVariation?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => {
                          setSelectedVariation(v);
                          if (selectedVariationQty > v.stock) {
                            setSelectedVariationQty(Math.max(1, v.stock));
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative ${
                          isOutOfStock 
                            ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed' 
                            : isSelected
                            ? 'border-purple-600 bg-purple-50 shadow-sm ring-2 ring-purple-500/20'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-black text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                            Tam: {v.size}
                          </span>
                          <span className={`text-[10px] font-bold ${isOutOfStock ? 'text-red-500' : 'text-emerald-600'}`}>
                            {isOutOfStock ? 'Esgotado' : `${v.stock} em estoque`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium">Cor: {v.color}</p>
                        {v.sku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {v.sku}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Seleção de Quantidade */}
              {selectedVariation && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="text-xs font-bold text-gray-800 block">
                        2. Quantidade de Peças:
                      </label>
                      <span className="text-[11px] text-gray-500">
                        Tamanho: <strong>{selectedVariation.size} ({selectedVariation.color})</strong> • Estoque: {selectedVariation.stock} un.
                      </span>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {formatCurrency(selectedVariation.price || selectedVariationProduct.price)} / un.
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedVariationQty(Math.max(1, selectedVariationQty - 1))}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={selectedVariation.stock}
                        value={selectedVariationQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setSelectedVariationQty(Math.max(1, Math.min(val, selectedVariation.stock)));
                        }}
                        className="w-14 text-center font-black text-sm text-gray-900 border-none outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedVariationQty(Math.min(selectedVariation.stock, selectedVariationQty + 1))}
                        disabled={selectedVariationQty >= selectedVariation.stock}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Botões rápidos de quantidade */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5].map(q => (
                        <button
                          key={q}
                          type="button"
                          disabled={q > selectedVariation.stock}
                          onClick={() => setSelectedVariationQty(q)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                            selectedVariationQty === q
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 disabled:opacity-40'
                          }`}
                        >
                          {q} un.
                        </button>
                      ))}
                      {selectedVariation.stock > 5 && (
                        <button
                          type="button"
                          onClick={() => setSelectedVariationQty(selectedVariation.stock)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                        >
                          Todas ({selectedVariation.stock})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtotal do Item */}
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                    <span className="text-gray-500">Subtotal deste item:</span>
                    <span className="text-base font-black text-purple-900">
                      {formatCurrency(selectedVariationQty * (selectedVariation.price || selectedVariationProduct.price))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <button 
                type="button"
                onClick={() => {
                  setSelectedVariationProduct(null);
                  setSelectedVariation(null);
                  setSelectedVariationQty(1);
                }} 
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={!selectedVariation || selectedVariation.stock <= 0}
                onClick={() => {
                  if (selectedVariation) {
                    addVariationToCart(selectedVariationProduct, selectedVariation, selectedVariationQty);
                  }
                }}
                className="flex-[2] py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-900/10 flex items-center justify-center gap-2 transition"
              >
                <ShoppingBag size={16} /> 
                Adicionar ao Pedido ({selectedVariationQty} un. • {formatCurrency(selectedVariationQty * (selectedVariation?.price || selectedVariationProduct.price))})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: FILA DE PRÉ-VENDAS (COMANDAS DO SALÃO) --- */}
      {showPreSaleQueue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in fade-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Clock className="text-amber-600" size={20} />
                <h3 className="text-base font-black text-gray-900">Fila de Pré-Vendas (Salão de Vendas)</h3>
              </div>
              <button onClick={() => setShowPreSaleQueue(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {pendingPreSales.length > 0 ? (
                pendingPreSales.map((ps) => (
                  <div key={ps.id} className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-purple-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-lg">
                          {ps.code}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm">{ps.customerName}</h4>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Vendedor(a): <strong>{ps.sellerName}</strong> • {ps.items.length} itens bipados • {new Date(ps.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-gray-900">{formatCurrency(ps.total)}</span>
                      </div>
                      <button 
                        onClick={() => handleImportPreSale(ps)} 
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
                      >
                        Puxar p/ Caixa <ArrowRight size={14} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleDeletePreSale(ps, e)} 
                        title="Excluir pré-venda da fila"
                        className="p-2 ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm">
                  Nenhuma pré-venda aguardando pagamento no caixa.
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button onClick={() => setShowPreSaleQueue(false)} className="px-5 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: FINALIZAR VENDA (PAGAMENTO NO CAIXA) --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95dvh] animate-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div>
                <h3 className="text-base font-black text-gray-900">Fechar Venda & Receber</h3>
                <p className="text-xs text-gray-500">Vendedor comissionado: <strong>{activeSellerName}</strong></p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  dismissPaymentError();
                  setShowPaymentModal(false);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Banner/Toast de Erro Flutuante Temporizado (5 segundos auto-dismiss) */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-4 bg-red-600 text-white font-medium shadow-lg rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-red-500">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
                  <span className="text-xs lg:text-sm font-bold leading-tight">{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={dismissPaymentError}
                  className="p-1 hover:bg-white/20 rounded-lg transition cursor-pointer text-white shrink-0"
                  title="Fechar aviso"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="p-6 flex flex-col md:flex-row gap-6 overflow-y-auto">
              {/* Lado Esquerdo: Valores e Descontos */}
              <div className="flex-1 space-y-4">
                <div className="bg-purple-50 p-5 rounded-2xl text-center space-y-1 border border-purple-100">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total a Liquidar</p>
                  <p className="text-3xl font-black text-purple-900">{formatCurrency(finalTotal)}</p>
                  {cartSubtotal !== finalTotal && (
                    <p className="text-xs text-gray-400 line-through">{formatCurrency(cartSubtotal)}</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">Desconto Comercial (R$)</label>
                    <span className="text-[10px] text-gray-500">
                      {numericDiscount > 0 && cartSubtotal > 0 && (
                        <strong className="text-purple-700 font-bold">
                          {((numericDiscount / cartSubtotal) * 100).toFixed(1)}% do total
                        </strong>
                      )}
                    </span>
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="0.00" 
                    value={discountValue} 
                    onChange={(e) => handleApplyDiscountChange(e.target.value)} 
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500" 
                  />

                  {/* Informações e Badges de Auditoria do Desconto */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {discountAuth?.requiresAuthorization ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <ShieldCheck size={12} className="text-amber-700" />
                        <span>Autorizado por: {discountAuth.authorizedBy}</span>
                      </span>
                    ) : numericDiscount > 0 ? (
                      <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Desconto padrão liberado (até 15%)
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">
                        Até 15% livre • Acima de 15% requer senha do gerente
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700 block">CPF na Nota / Cupom (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => {
                        dismissPaymentError();
                        openQuickCustomerModal(cpf);
                      }}
                      className={`text-[11px] font-bold transition-all flex items-center gap-1 px-2.5 py-1 rounded-xl cursor-pointer ${
                        highlightCustomerRegistration 
                          ? 'bg-red-600 text-white shadow-md ring-4 ring-red-300 animate-pulse font-black' 
                          : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                      }`}
                      title="Cadastrar cliente com análise de score de crédito"
                    >
                      <UserPlus size={13} /> {highlightCustomerRegistration ? 'Cadastrar Cliente Agora' : '+ Novo Cliente'}
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00" 
                    value={cpf} 
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      setCpf(formatted);
                      const clean = formatted.replace(/\D/g, '');
                      if (clean.length === 11) {
                        const match = customers.find(c => c.cpf && c.cpf.replace(/\D/g, '') === clean);
                        if (match) {
                          setSelectedCustomer(match.id);
                          setCustomerSearchTerm(match.name);
                        }
                      }
                    }} 
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-mono" 
                  />

                  {/* Feedback: Cliente já identificado no sistema */}
                  {(() => {
                    const clean = cpf.replace(/\D/g, '');
                    const matchedCustomer = clean.length === 11 
                      ? customers.find(c => c.cpf && c.cpf.replace(/\D/g, '') === clean) 
                      : null;

                    if (matchedCustomer) {
                      const availableCredit = (matchedCustomer.creditLimit || 0) - (matchedCustomer.usedCredit || 0);
                      return (
                        <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800 animate-in fade-in">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            Cliente: {matchedCustomer.name}
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                            Crediário Disp: {formatCurrency(availableCredit)}
                          </span>
                        </div>
                      );
                    }

                    // Se digitou 11 dígitos e NÃO é cliente cadastrado: Abre a abinha/card de oportunidade
                    if (clean.length === 11) {
                      return (
                        <div className={`mt-2.5 p-3.5 border rounded-2xl space-y-2 animate-in fade-in shadow-sm transition-all ${
                          highlightCustomerRegistration
                            ? 'bg-red-50 border-red-400 ring-2 ring-red-300'
                            : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                              <Sparkles size={14} className="text-purple-600" />
                              CPF não cadastrado na base de clientes
                            </span>
                            <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                              Pré-Aprovação
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-900 leading-relaxed">
                            Deseja cadastrar <strong>{cpf}</strong> na loja com consulta de Score de Crédito (Cadastro Positivo / Serasa) e definir um limite pré-aprovado?
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              dismissPaymentError();
                              openQuickCustomerModal(cpf);
                            }}
                            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/10 transition cursor-pointer"
                          >
                            <UserPlus size={14} /> Cadastrar Cliente & Consultar Limite
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>

                {/* Venda Retroativa */}
                <div className="bg-orange-50/70 p-3 rounded-xl border border-orange-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isRetroactive} 
                      onChange={(e) => setIsRetroactive(e.target.checked)} 
                      className="w-4 h-4 text-orange-600 rounded" 
                    />
                    <span className="text-xs font-bold text-orange-800">Lançamento de Venda Retroativa</span>
                  </label>
                  {isRetroactive && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input type="date" value={retroDate} onChange={(e) => setRetroDate(e.target.value)} className="w-full p-1.5 text-xs border rounded-lg" />
                      <input type="time" value={retroTime} onChange={(e) => setRetroTime(e.target.value)} className="w-full p-1.5 text-xs border rounded-lg" />
                    </div>
                  )}
                </div>
              </div>

              {/* Lado Direito: Métodos de Pagamento e Regras de Negócio */}
              <div className="flex-1 space-y-4">
                <label className="text-xs font-bold text-gray-700 block">Forma de Pagamento</label>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'PIX', label: 'PIX (Imediato)' },
                    { id: 'MONEY', label: 'Dinheiro' },
                    { id: 'DEBIT_CARD', label: 'Cartão Débito' },
                    { id: 'CREDIT_CARD', label: 'Cartão Crédito' },
                    { id: 'BEMOL_CREDIT', label: 'Crediário Parceiro Bemol (25d)' },
                    { id: 'STORE_CREDIT', label: 'Crediário Loja' },
                  ].map(m => (
                    <button 
                      key={m.id} 
                      onClick={() => { 
                        setSelectedPaymentMethod(m.id as any); 
                        setInstallments(1); 
                      }} 
                      className={`p-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
                        selectedPaymentMethod === m.id 
                          ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' 
                          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Dinheiro (Cálculo de Troco) */}
                {selectedPaymentMethod === 'MONEY' && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <label className="text-xs font-bold text-gray-700 block">Valor Recebido do Cliente (R$)</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={cashReceived} 
                      onChange={(e) => setCashReceived(e.target.value)} 
                      className="w-full p-2.5 border rounded-xl text-sm" 
                      autoFocus 
                    />
                    {numericCashReceived > 0 && (
                      <div className="flex justify-between items-center text-xs pt-1 font-bold">
                        <span>Troco a devolver:</span>
                        <span className={changeAmount >= 0 ? 'text-emerald-600 text-sm' : 'text-red-500'}>
                          {changeAmount >= 0 ? formatCurrency(changeAmount) : 'Valor insuficiente'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cartão de Crédito */}
                {selectedPaymentMethod === 'CREDIT_CARD' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Parcelamento no Cartão</label>
                    <select 
                      value={installments} 
                      onChange={(e) => setInstallments(parseInt(e.target.value))} 
                      className="w-full p-2.5 border rounded-xl text-xs bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(i => (
                        <option key={i} value={i}>{i}x de {formatCurrency(finalTotal / i)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">Pagamentos em cartão são antecipados no caixa do dia.</p>
                  </div>
                )}

                {/* Crediário Parceiro Bemol (Taxa 3% & Repasse 25 dias) */}
                {selectedPaymentMethod === 'BEMOL_CREDIT' && (
                  <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-2 animate-in fade-in">
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-1.5 text-blue-950">
                        <Store size={15} className="text-blue-600" /> Crediário Parceiro Bemol
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                        Repasse em 25 dias
                      </span>
                    </div>

                    <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100 space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Valor Bruto da Venda:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(finalTotal)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-medium">
                        <span>Taxa do Parceiro Bemol (3%):</span>
                        <span className="font-bold">- {formatCurrency(finalTotal * 0.03)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-black pt-1.5 border-t border-blue-100">
                        <span>Líquido a Receber pela Loja:</span>
                        <span className="text-sm font-black">{formatCurrency(finalTotal * 0.97)}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-blue-800 leading-tight">
                      ℹ️ O valor líquido de <strong>{formatCurrency(finalTotal * 0.97)}</strong> tem repasse garantido pela Bemol direto na conta da loja em <strong>25 dias</strong>. A cobrança e o risco são 100% da Bemol (não gera dívida de carnê na loja e não entra em cobranças de clientes).
                    </p>
                  </div>
                )}

                {/* Crediário Próprio da Loja */}
                {selectedPaymentMethod === 'STORE_CREDIT' && (
                  <div className="p-3 bg-pink-50 rounded-xl border border-pink-200 space-y-2 text-xs">
                    <p className="font-bold text-pink-900">Crediário da Loja (Carnê)</p>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isExtendedGracePeriod} 
                        onChange={(e) => setIsExtendedGracePeriod(e.target.checked)} 
                        className="rounded text-pink-600" 
                      />
                      <span>Pagar primeira parcela em 60 dias (+3%)</span>
                    </label>
                    <div>
                      <label className="font-semibold block mb-0.5">Parcelas</label>
                      <select 
                        value={installments} 
                        onChange={(e) => setInstallments(parseInt(e.target.value))} 
                        className="w-full p-2 border rounded-lg bg-white"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(i => (
                          <option key={i} value={i}>{i}x {i > 4 ? '(com juros de 3.9% a.m)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold block mb-0.5">Vencimento da 1ª Parcela</label>
                      <input 
                        type="date" 
                        value={storeCreditDueDate} 
                        onChange={(e) => setStoreCreditDueDate(e.target.value)} 
                        className="w-full p-2 border rounded-lg bg-white" 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-xs text-gray-700 transition"
              >
                Voltar
              </button>
              <button 
                type="button"
                disabled={isSubmittingSale}
                onClick={handleConfirmSale} 
                className={`flex-1 py-3.5 rounded-xl font-black text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  isSubmittingSale
                    ? 'bg-emerald-400 text-white cursor-wait opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-900/20'
                }`}
              >
                {isSubmittingSale ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>PROCESSANDO VENDA...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>CONFIRMAR E IMPRIMIR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: CADASTRO RÁPIDO DE CLIENTE & ANÁLISE DE SCORE (BUREAU)   */}
      {/* Consulta Serasa / Cadastro Positivo & Limite Pré-Aprovado Editável*/}
      {/* ================================================================= */}
      {isQuickCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Caixa • Novo Cliente
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-1 flex items-center gap-2">
                  <UserPlus size={18} className="text-purple-600" /> Cadastrar Cliente & Consultar Score
                </h3>
              </div>
              <button onClick={() => setIsQuickCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {quickCustomerError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{quickCustomerError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickCustomer} className="space-y-4">
              {/* Nome Completo */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Carlos Eduardo de Oliveira" 
                  value={quickCustomerName} 
                  onChange={e => setQuickCustomerName(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  autoFocus 
                />
              </div>

              {/* CPF e Celular / WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      CPF <span className="text-red-500">*</span>
                    </label>
                    {quickCustomerCpf.replace(/\D/g, '').length === 11 && (
                      <button 
                        type="button" 
                        onClick={() => handleRunBureauQuery()} 
                        disabled={isQueryingBureau}
                        className="text-[11px] text-purple-700 font-bold hover:underline flex items-center gap-1"
                      >
                        {isQueryingBureau ? <RotateCw size={11} className="animate-spin" /> : <Search size={11} />}
                        Consultar Score
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    required 
                    placeholder="000.000.000-00" 
                    value={quickCustomerCpf} 
                    onChange={e => {
                      const formatted = formatCPF(e.target.value);
                      setQuickCustomerCpf(formatted);
                      if (formatted.replace(/\D/g, '').length === 11) {
                        handleRunBureauQuery(formatted);
                      }
                    }} 
                    className="w-full px-3.5 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Celular / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="(92) 99999-9999" 
                    value={quickCustomerPhone} 
                    onChange={e => setQuickCustomerPhone(formatPhone(e.target.value))} 
                    className="w-full px-3.5 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              {/* E-mail e Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">E-mail (Opcional)</label>
                  <input 
                    type="email" 
                    placeholder="cliente@email.com" 
                    value={quickCustomerEmail} 
                    onChange={e => setQuickCustomerEmail(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Endereço (Bairro / Cidade)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Centro, Rua 7..." 
                    value={quickCustomerAddress} 
                    onChange={e => setQuickCustomerAddress(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              {/* CARD DE CONSULTA DE SCORE & CADASTRO POSITIVO */}
              <div className="border border-purple-200 bg-gradient-to-br from-purple-50/80 to-pink-50/50 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs font-black text-purple-950">
                    <ShieldCheck size={16} className="text-purple-600" />
                    <span>Consulta de Score Serasa & Cadastro Positivo</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleRunBureauQuery()} 
                    disabled={isQueryingBureau || quickCustomerCpf.replace(/\D/g, '').length !== 11}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                  >
                    {isQueryingBureau ? (
                      <>
                        <RotateCw size={12} className="animate-spin" /> Consultando...
                      </>
                    ) : (
                      <>
                        <Search size={12} /> Consultar Agora
                      </>
                    )}
                  </button>
                </div>

                {/* Exibição dos Dados do Bureau se Consultado */}
                {bureauResult ? (
                  <div className="space-y-2.5 pt-1 animate-in fade-in">
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Score Bureau</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-2xl font-black ${
                            bureauResult.score >= 700 ? 'text-emerald-600' : bureauResult.score >= 500 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {bureauResult.score}
                          </span>
                          <span className="text-[11px] text-gray-400 font-bold">/ 1000</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          bureauResult.risk === 'MUITO_BAIXO' || bureauResult.risk === 'BAIXO' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : bureauResult.risk === 'MEDIO'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {bureauResult.riskLabel}
                        </span>
                        <span className="text-[11px] text-purple-700 font-bold block mt-1">
                          Sugerido: {formatCurrency(bureauResult.suggestedLimit)}
                        </span>
                      </div>
                    </div>

                    {/* Flags Positivas */}
                    <div className="space-y-1 text-[11px] text-purple-900 bg-white/70 p-2.5 rounded-xl border border-purple-100">
                      {bureauResult.bureauFlags.map((flag, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-purple-800 leading-tight">
                    Clique em <strong>"Consultar Agora"</strong> para calcular a pontuação de crédito do CPF e obter uma sugestão automática de limite pré-aprovado.
                  </p>
                )}

                {/* Campo de Limite de Crediário com Autonomia do Lojista */}
                <div className="bg-white p-3.5 rounded-xl border border-purple-100 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-800">
                      Limite de Crediário Concedido (R$)
                    </label>
                    <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                      100% Editável pelo Lojista
                    </span>
                  </div>
                  <input 
                    type="number" 
                    step="50" 
                    required 
                    value={quickCustomerCreditLimit} 
                    onChange={e => setQuickCustomerCreditLimit(e.target.value)} 
                    className="w-full px-3.5 py-2 border rounded-xl text-base font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-500 font-mono" 
                  />
                  <p className="text-[10px] text-gray-500 leading-tight">
                    ✓ O dono da loja tem autonomia total para manter, aumentar ou diminuir o limite como preferir, independentemente do score consultado.
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsQuickCustomerModalOpen(false)} 
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Salvar Cliente e Vincular à Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AUTORIZAÇÃO DE GERENTE/DONO (DESCONTOS > 15%) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 border border-purple-100">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <span className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
                <Lock size={22} />
              </span>
              <div>
                <h3 className="text-base font-black text-gray-900">Autorização Gerencial</h3>
                <p className="text-xs text-gray-500">Desconto superior ao limite de 15%</p>
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex justify-between font-bold">
                <span>Desconto solicitado:</span>
                <span className="text-amber-800 font-black text-sm">
                  {pendingDiscountPct.toFixed(1)}% (R$ {pendingDiscountVal.toFixed(2)})
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                Vendedores possuem autonomia para conceder até 15%. Para aplicar este desconto, solicite a validação de senha do Gerente ou Dono.
              </p>
            </div>

            <form onSubmit={handleConfirmManagerAuth} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Senha do Gerente ou Proprietário
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Digite a senha de administrador..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={managerPassword}
                  onChange={(e) => {
                    setManagerPassword(e.target.value);
                    if (authError) setAuthError('');
                  }}
                />
              </div>

              {authError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-500" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancelManagerAuth}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancelar (Limitar a 15%)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-900/10 transition flex items-center gap-1.5"
                >
                  <ShieldCheck size={16} /> <span>Liberar Desconto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: CUPOM DE VENDA EMITIDO (TÉRMICA 80mm / 58mm)               */}
      {/* ================================================================= */}
      {completedSaleForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          {/* Estilo NATIVO de Impressão Térmica Direta (Zero Popups / Zero about:blank) */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-receipt-print, #thermal-receipt-print * {
                visibility: visible !important;
              }
              #thermal-receipt-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                margin: 0 !important;
                padding: 5mm !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
                font-family: monospace !important;
                font-size: 11px !important;
              }
            }
          `}</style>

          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200">
            {/* Cabeçalho do Modal */}
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-white" />
                <h3 className="font-black text-sm">Venda Concluída com Sucesso</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  isProcessingRef.current = false;
                  setCompletedSaleForReceipt(null);
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Fechar cupom"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo Térmico Estilizado (Formato Bobina 80mm / 58mm) */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center">
              <div 
                id="thermal-receipt-print"
                className="bg-white p-5 rounded-xl shadow-md border border-dashed border-gray-300 w-full max-w-[340px] font-mono text-[11px] text-gray-900 space-y-2.5"
              >
                {/* Topo do Cupom com Dados Oficiais da Loja (Sem dados fictícios) */}
                <div className="text-center space-y-0.5 border-b border-dashed border-gray-300 pb-2">
                  <h2 className="text-base font-black tracking-wider text-black uppercase">
                    {storeProfile?.name || 'PAIVA MODA'}
                  </h2>
                  {storeProfile?.cnpj && storeProfile.cnpj.trim().length > 0 && (
                    <p className="text-[10px] text-gray-600">CNPJ/CPF: {storeProfile.cnpj.trim()}</p>
                  )}
                  {storeProfile?.address && storeProfile.address.trim().length > 0 && (
                    <p className="text-[10px] text-gray-600">{storeProfile.address.trim()}</p>
                  )}
                  {storeProfile?.phone && storeProfile.phone.trim().length > 0 && (
                    <p className="text-[10px] text-gray-600">Tel/Whats: {storeProfile.phone.trim()}</p>
                  )}
                  {storeProfile?.instagram && storeProfile.instagram.trim().length > 0 && (
                    <p className="text-[10px] text-gray-600">Instagram: {storeProfile.instagram.trim()}</p>
                  )}
                  <div className="pt-1 text-[10px] font-bold text-gray-700">
                    <span>{getManausDate(completedSaleForReceipt?.createdAt || completedSaleForReceipt?.timestamp || completedSaleForReceipt?.date).split('-').reverse().join('/')}</span> • <span>{getManausTime(completedSaleForReceipt?.createdAt || completedSaleForReceipt?.timestamp || completedSaleForReceipt?.date)}</span>
                  </div>
                </div>

                {/* Detalhes da Venda e Número Sequencial de Varejo */}
                <div className="space-y-0.5 border-b border-dashed border-gray-300 pb-2 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>CUPOM NÃO FISCAL</span>
                    <span>Nº {completedSaleForReceipt?.saleNumber || String(completedSaleForReceipt?.sequence || 1).padStart(6, '0')}</span>
                  </div>
                  <div>Vendedor: <strong>{completedSaleForReceipt?.sellerName || 'Loja'}</strong></div>
                  <div>Cliente: <strong>{completedSaleForReceipt?.customerName || 'Cliente Balcão'}</strong></div>
                  {completedSaleForReceipt?.cpf && <div>CPF: <span>{completedSaleForReceipt.cpf}</span></div>}
                </div>

                {/* Tabela de Itens com Variação Completa */}
                <div className="space-y-1.5 border-b border-dashed border-gray-300 pb-2">
                  <div className="flex justify-between font-bold text-[10px] border-b border-gray-200 pb-0.5">
                    <span>ITEM / DESCRIÇÃO</span>
                    <span>TOTAL</span>
                  </div>
                  {(completedSaleForReceipt?.items || []).map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold leading-tight flex-1 pr-2">
                          {item.quantity}x {item.name}
                          {item.selectedVariation && (
                            <span className="block text-[9px] text-gray-500 font-normal">
                              [Tam: {item.selectedVariation.size} - Cor: {item.selectedVariation.color}]
                            </span>
                          )}
                        </span>
                        <span className="font-bold shrink-0">
                          {formatCurrency((item.price || 0) * (item.quantity || 1))}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400">
                        {item.quantity} un. x {formatCurrency(item.price || 0)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totais e Pagamento */}
                <div className="space-y-1 border-b border-dashed border-gray-300 pb-2 text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(completedSaleForReceipt?.subtotal || 0)}</span>
                  </div>
                  {(completedSaleForReceipt?.discount || 0) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Desconto ({completedSaleForReceipt?.discountPercent || 0}%):</span>
                      <span>- {formatCurrency(completedSaleForReceipt?.discount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm text-black pt-1 border-t border-gray-200">
                    <span>TOTAL PAGO:</span>
                    <span>{formatCurrency(completedSaleForReceipt?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 pt-0.5">
                    <span>Forma de Pagto:</span>
                    <span className="font-bold uppercase">{completedSaleForReceipt?.paymentMethod || 'MONEY'}</span>
                  </div>
                  {completedSaleForReceipt?.change && completedSaleForReceipt.change > 0 ? (
                    <div className="flex justify-between text-[10px] text-emerald-700 font-bold">
                      <span>Troco Devolvido:</span>
                      <span>{formatCurrency(completedSaleForReceipt.change)}</span>
                    </div>
                  ) : null}
                </div>

                {/* Rodapé Fiscal Personalizado */}
                <div className="text-center text-[9px] text-gray-500 whitespace-pre-line pt-1">
                  {storeProfile?.receiptMessage || "*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre."}
                </div>
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (completedSaleForReceipt) {
                    printer.printTicket(completedSaleForReceipt, storeProfile);
                  }
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-900/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> Imprimir Cupom Térmico
              </button>
              <button
                type="button"
                onClick={() => {
                  isProcessingRef.current = false;
                  setCompletedSaleForReceipt(null);
                }}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} /> Concluir e Novo Atendimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Sucesso ao Cadastrar Cliente */}
      {quickCustomerToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{quickCustomerToast}</span>
        </div>
      )}
    </div>
  );
};
export default POS;
