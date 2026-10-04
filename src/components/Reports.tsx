import React, { useState, useMemo } from 'react';
import { Sale, StockMovement, Product, Customer, User, FinancialRecord } from '../types';
import { 
  BarChart3, Calendar, DollarSign, TrendingUp, Percent, CreditCard, 
  Printer, Download, FileSpreadsheet, FileText, ArrowUpRight, 
  Users, Package, AlertTriangle, ShieldCheck, CheckCircle2, 
  ChevronRight, RefreshCw, ShoppingBag, Sparkles, PieChart
} from 'lucide-react';
import { getManausDate, getManausMonth } from '../utils/date';

interface ReportsProps {
  sales?: Sale[];
  movements?: StockMovement[];
  products?: Product[];
  customers?: Customer[];
  users?: User[];
  financials?: FinancialRecord[];
}

type TimeFilterType = 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';
type TabType = 'SALES_DISCOUNTS' | 'PROFIT_MARGIN' | 'ABC_CURVE' | 'PAYMENTS_CREDIT' | 'STOCK_TURNOVER' | 'SELLERS_PERFORMANCE';

export const Reports: React.FC<ReportsProps> = ({
  sales = [],
  movements = [],
  products = [],
  customers = [],
  users = [],
  financials = []
}) => {
  // Defensive defaults
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeMovements = Array.isArray(movements) ? movements : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const _safeCustomers = Array.isArray(customers) ? customers : [];
  const _safeUsers = Array.isArray(users) ? users : [];
  const safeFinancials = Array.isArray(financials) ? financials : [];

  // Estados de Filtro
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('THIS_MONTH');
  const [activeTab, setActiveTab] = useState<TabType>('SALES_DISCOUNTS');
  
  const todayStr = useMemo(() => getManausDate(), []);

  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Faixa de Datas Efetiva
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const end = todayStr;
    let start = todayStr;
    let label = 'Hoje';

    if (timeFilter === 'TODAY') {
      start = todayStr;
      label = 'Hoje';
    } else if (timeFilter === 'LAST_7_DAYS') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      start = getManausDate(past);
      label = 'Últimos 7 Dias';
    } else if (timeFilter === 'THIS_MONTH') {
      const currentMonth = getManausMonth();
      start = `${currentMonth}-01`;
      label = 'Este Mês';
    } else if (timeFilter === 'THIS_YEAR') {
      const currentYear = todayStr.split('-')[0];
      start = `${currentYear}-01-01`;
      label = 'Ano Atual';
    } else if (timeFilter === 'CUSTOM') {
      start = customStartDate || todayStr;
      label = `Personalizado (${start} até ${customEndDate || todayStr})`;
      return { startDate: start, endDate: customEndDate || todayStr, periodLabel: label };
    }

    return { startDate: start, endDate: end, periodLabel: label };
  }, [timeFilter, customStartDate, customEndDate, todayStr]);

  // Vendas filtradas no período (Apenas não canceladas)
  const filteredSales = useMemo(() => {
    return safeSales.filter(s => {
      if (!s || s.status === 'CANCELLED') return false;
      const sDate = getManausDate(s.createdAt || s.timestamp || s.date);
      return sDate >= startDate && sDate <= endDate;
    });
  }, [safeSales, startDate, endDate]);

  // Movimentações no período
  const filteredMovements = useMemo(() => {
    return safeMovements.filter(m => {
      if (!m) return false;
      const mDate = m.date ? getManausDate(m.date) : '';
      return mDate >= startDate && mDate <= endDate;
    });
  }, [safeMovements, startDate, endDate]);

  // Financeiro no período
  const filteredFinancials = useMemo(() => {
    return safeFinancials.filter(f => {
      if (!f) return false;
      const fDate = f.paymentDate || f.dueDate || (f.createdAt ? getManausDate(f.createdAt) : '');
      return fDate >= startDate && fDate <= endDate;
    });
  }, [safeFinancials, startDate, endDate]);

  // Mapeamento de Custos de Produtos para Margem de Lucro Real
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    safeProducts.forEach(p => {
      if (p && p.id !== undefined) {
        map.set(String(p.id), p);
      }
    });
    return map;
  }, [safeProducts]);

  // --- KPIs Principais ---
  const kpis = useMemo(() => {
    const totalNet = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalDiscountValue = filteredSales.reduce((acc, s) => acc + (Number(s.discountAmount || 0)), 0);
    const totalGross = filteredSales.reduce((acc, s) => acc + (Number(s.grossTotal || (Number(s.total) + (Number(s.discountAmount || 0))))), 0);
    const count = filteredSales.length;
    const averageTicket = count > 0 ? totalNet / count : 0;
    
    const avgDiscountPercent = totalGross > 0 ? (totalDiscountValue / totalGross) * 100 : 0;
    const authorizedDiscountsCount = filteredSales.filter(s => s.requiresAuthorization || (s.discountPercent && s.discountPercent > 15)).length;

    // Cálculo da Margem de Lucro e CMV (Custo das Mercadorias Vendidas)
    let totalCostEstimated = 0;
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const prod = productsMap.get(String(it.id));
        const unitCost = Number(prod?.costPrice || it.costPrice || 0);
        // Se não houver custo cadastrado, estima custo base padrão de 45% do preço
        const effectiveCost = unitCost > 0 ? unitCost : (Number(it.price) || 0) * 0.45;
        totalCostEstimated += effectiveCost * (Number(it.quantity) || 1);
      });
    });

    const estimatedGrossProfit = Math.max(0, totalNet - totalCostEstimated);
    const profitMarginPercent = totalNet > 0 ? (estimatedGrossProfit / totalNet) * 100 : 0;

    // Bemol
    const bemolSales = filteredSales.filter(s => s.paymentMethod === 'BEMOL' || s.paymentMethod === 'BEMOL_CREDIT');
    const bemolTotal = bemolSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const bemolPending = filteredFinancials
      .filter(f => ['BEMOL_CREDIT', 'BEMOL'].includes(f.paymentMethod || '') && f.status === 'PENDING')
      .reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    const bemolPaid = filteredFinancials
      .filter(f => ['BEMOL_CREDIT', 'BEMOL'].includes(f.paymentMethod || '') && f.status === 'PAID')
      .reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

    return {
      totalNet,
      totalGross,
      count,
      averageTicket,
      totalDiscountValue,
      avgDiscountPercent,
      authorizedDiscountsCount,
      totalCostEstimated,
      estimatedGrossProfit,
      profitMarginPercent,
      bemolTotal,
      bemolPending,
      bemolPaid
    };
  }, [filteredSales, filteredFinancials, productsMap]);

  // --- Desempenho por Dia (gráfico de evolução) ---
  const dailyPerformance = useMemo(() => {
    const map: { [dateStr: string]: { date: string; net: number; gross: number; discount: number; count: number } } = {};
    
    filteredSales.forEach(s => {
      const d = s.date || (s.timestamp ? s.timestamp.substring(0, 10) : todayStr);
      if (!map[d]) {
        map[d] = { date: d, net: 0, gross: 0, discount: 0, count: 0 };
      }
      map[d].net += Number(s.total) || 0;
      map[d].gross += Number(s.subtotal) || Number(s.total) || 0;
      map[d].discount += Number(s.discount) || 0;
      map[d].count += 1;
    });

    const list = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    const maxNet = Math.max(...list.map(i => i.net), 1);

    return { list, maxNet };
  }, [filteredSales, todayStr]);

  // --- Curva ABC de Produtos Mais Vendidos ---
  const abcCurveData = useMemo(() => {
    const productStats: { [id: string]: { id: string; name: string; category: string; qty: number; totalRevenue: number; totalCost: number } } = {};

    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const id = String(item.id);
        const prod = productsMap.get(id);
        if (!productStats[id]) {
          productStats[id] = {
            id,
            name: item.name,
            category: prod?.category || item.category || 'Geral',
            qty: 0,
            totalRevenue: 0,
            totalCost: 0
          };
        }
        const qty = Number(item.quantity) || 1;
        const revenue = (Number(item.price) || 0) * qty;
        const unitCost = Number(prod?.costPrice || item.costPrice || (Number(item.price) || 0) * 0.45);
        productStats[id].qty += qty;
        productStats[id].totalRevenue += revenue;
        productStats[id].totalCost += unitCost * qty;
      });
    });

    const list = Object.values(productStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const totalAllRevenue = list.reduce((acc, p) => acc + p.totalRevenue, 0) || 1;

    let accumulatedRevenue = 0;
    return list.map((p, index) => {
      accumulatedRevenue += p.totalRevenue;
      const accumulatedPct = (accumulatedRevenue / totalAllRevenue) * 100;
      const individualPct = (p.totalRevenue / totalAllRevenue) * 100;
      const profit = Math.max(0, p.totalRevenue - p.totalCost);
      const marginPct = p.totalRevenue > 0 ? (profit / p.totalRevenue) * 100 : 0;

      // Classificação Curva ABC:
      // Classe A: até 70% do faturamento acumulado
      // Classe B: de 70% a 90% do faturamento acumulado
      // Classe C: de 90% a 100% do faturamento acumulado
      let classification: 'A' | 'B' | 'C' = 'C';
      if (accumulatedPct <= 70 || index === 0) {
        classification = 'A';
      } else if (accumulatedPct <= 90) {
        classification = 'B';
      } else {
        classification = 'C';
      }

      return {
        ...p,
        ranking: index + 1,
        individualPct,
        accumulatedPct,
        classification,
        profit,
        marginPct
      };
    });
  }, [filteredSales, productsMap]);

  // --- Formas de Pagamento ---
  const paymentBreakdown = useMemo(() => {
    const methods: { [key: string]: { name: string; total: number; count: number } } = {
      PIX: { name: 'PIX', total: 0, count: 0 },
      CREDIT_CARD: { name: 'Cartão de Crédito', total: 0, count: 0 },
      DEBIT_CARD: { name: 'Cartão de Débito', total: 0, count: 0 },
      MONEY: { name: 'Dinheiro em Espécie', total: 0, count: 0 },
      STORE_CREDIT: { name: 'Crediário Loja (Carnê)', total: 0, count: 0 },
      BEMOL_CREDIT: { name: 'Crediário Parceiro BEMOL', total: 0, count: 0 },
      OTHER: { name: 'Outros Métodos', total: 0, count: 0 }
    };

    filteredSales.forEach(s => {
      let m = s.paymentMethod || 'OTHER';
      if (m === 'BEMOL') m = 'BEMOL_CREDIT';
      const target = methods[m] || methods.OTHER;
      target.total += Number(s.total) || 0;
      target.count += 1;
    });

    const totalAll = kpis.totalNet || 1;
    return Object.entries(methods)
      .map(([key, item]) => ({
        key,
        ...item,
        percentage: (item.total / totalAll) * 100
      }))
      .filter(i => i.total > 0 || i.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredSales, kpis.totalNet]);

  // --- Giro de Estoque & Peças Mais Vendidas ---
  const stockAnalytics = useMemo(() => {
    const itemMap: { [key: string]: { name: string; variation: string; qty: number; total: number } } = {};
    const soldProductIds = new Set<string | number>();

    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        soldProductIds.add(item.id);
        const varLabel = item.selectedVariation 
          ? `${item.selectedVariation.size || ''} - ${item.selectedVariation.color || ''}`.trim()
          : 'Padrão';
        const key = `${item.id}_${varLabel}`;
        
        if (!itemMap[key]) {
          itemMap[key] = {
            name: item.name,
            variation: varLabel,
            qty: 0,
            total: 0
          };
        }
        itemMap[key].qty += Number(item.quantity) || 1;
        itemMap[key].total += (Number(item.price) || 0) * (Number(item.quantity) || 1);
      });
    });

    const topSold = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 15);

    // Produtos sem saída no período
    const zeroSalesProducts = safeProducts.filter(p => !soldProductIds.has(p.id) && (Number(p.stock) > 0)).slice(0, 15);

    // Motivos de Saída (Movements)
    const exitReasons: { [reason: string]: number } = {};
    filteredMovements.filter(m => m.type === 'EXIT').forEach(m => {
      const r = m.reason || 'Venda ou Saída Geral';
      exitReasons[r] = (exitReasons[r] || 0) + (Number(m.quantity) || 1);
    });

    return { topSold, zeroSalesProducts, exitReasons };
  }, [filteredSales, safeProducts, filteredMovements]);

  // --- Desempenho por Vendedor ---
  const sellerPerformance = useMemo(() => {
    const map: { [id: string]: { id: string; name: string; total: number; salesCount: number; itemsCount: number } } = {};

    filteredSales.forEach(s => {
      const id = s.sellerId || 'nao_identificado';
      const name = s.sellerName || 'Vendedor Não Identificado';
      if (!map[id]) {
        map[id] = { id, name, total: 0, salesCount: 0, itemsCount: 0 };
      }
      map[id].total += Number(s.total) || 0;
      map[id].salesCount += 1;
      const itemsInSale = (s.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
      map[id].itemsCount += itemsInSale;
    });

    return Object.values(map)
      .map(s => ({
        ...s,
        ticket: s.salesCount > 0 ? s.total / s.salesCount : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // --- Exportações ---
  const handlePrintA4 = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Sequência', 'Cliente', 'CPF', 'Vendedor', 'Forma Pagamento', 'Subtotal (R$)', 'Desconto (R$)', 'Total Líquido (R$)', 'Autorizado Por'];
    const rows = filteredSales.map(s => [
      s.date || '',
      s.sequence ? `#${s.sequence}` : '',
      `"${(s.customerName || '').replace(/"/g, '""')}"`,
      s.cpf || '',
      `"${(s.sellerName || '').replace(/"/g, '""')}"`,
      s.paymentMethod || '',
      (s.subtotal || s.total || 0).toFixed(2),
      (s.discount || 0).toFixed(2),
      (s.total || 0).toFixed(2),
      `"${(s.authorizedBy || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Vendas_PaivaModa_${startDate}_a_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcelXML = () => {
    const rowsXml = filteredSales.map(s => `
      <Row>
        <Cell><Data ss:Type="String">${s.date || ''}</Data></Cell>
        <Cell><Data ss:Type="Number">${s.sequence || 0}</Data></Cell>
        <Cell><Data ss:Type="String">${s.customerName || ''}</Data></Cell>
        <Cell><Data ss:Type="String">${s.sellerName || ''}</Data></Cell>
        <Cell><Data ss:Type="String">${s.paymentMethod || ''}</Data></Cell>
        <Cell><Data ss:Type="Number">${(s.subtotal || s.total || 0).toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${(s.discount || 0).toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${(s.total || 0).toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${s.authorizedBy || 'N/A'}</Data></Cell>
      </Row>
    `).join('');

    const xmlTemplate = `<?xml version="1.0"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Relatório Vendas">
        <Table>
          <Row>
            <Cell><Data ss:Type="String">Data</Data></Cell>
            <Cell><Data ss:Type="String">Sequência</Data></Cell>
            <Cell><Data ss:Type="String">Cliente</Data></Cell>
            <Cell><Data ss:Type="String">Vendedor</Data></Cell>
            <Cell><Data ss:Type="String">Forma Pagamento</Data></Cell>
            <Cell><Data ss:Type="String">Subtotal</Data></Cell>
            <Cell><Data ss:Type="String">Desconto</Data></Cell>
            <Cell><Data ss:Type="String">Total Líquido</Data></Cell>
            <Cell><Data ss:Type="String">Autorizado Por</Data></Cell>
          </Row>
          ${rowsXml}
        </Table>
      </Worksheet>
    </Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Excel_PaivaModa_${startDate}_a_${endDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt80mm = () => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cupom Conferência - Paiva Moda</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              font-family: 'Courier New', monospace; 
              width: 72mm; 
              margin: 4mm auto; 
              font-size: 11px; 
              color: #000;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .bold { font-weight: bold; }
            .flex-between { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="text-center bold" style="font-size: 14px;">PAIVA MODA</div>
          <div class="text-center">RESUMO GERENCIAL / CONFERÊNCIA</div>
          <div class="text-center">${periodLabel}</div>
          <div class="text-center" style="font-size: 9px;">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
          <div class="divider"></div>

          <div class="flex-between"><span>Vendas Concluídas:</span><span class="bold">${kpis.count}</span></div>
          <div class="flex-between"><span>Faturamento Bruto:</span><span class="bold">R$ ${kpis.totalGross.toFixed(2)}</span></div>
          <div class="flex-between"><span>Total Descontos:</span><span class="bold">R$ ${kpis.totalDiscountValue.toFixed(2)}</span></div>
          <div class="flex-between" style="font-size: 12px; margin: 4px 0;">
            <span class="bold">TOTAL LÍQUIDO:</span>
            <span class="bold">R$ ${kpis.totalNet.toFixed(2)}</span>
          </div>
          <div class="flex-between"><span>Margem de Lucro Est.:</span><span class="bold">${kpis.profitMarginPercent.toFixed(1)}%</span></div>
          <div class="flex-between"><span>Ticket Médio:</span><span class="bold">R$ ${kpis.averageTicket.toFixed(2)}</span></div>

          <div class="divider"></div>
          <div class="bold text-center">FORMAS DE PAGAMENTO</div>
          <div class="divider"></div>
          ${paymentBreakdown.map(p => `
            <div class="flex-between">
              <span>${p.name.substring(0, 16)}:</span>
              <span>R$ ${p.total.toFixed(2)}</span>
            </div>
          `).join('')}

          <div class="divider"></div>
          <div class="flex-between"><span>Total Bemol:</span><span class="bold">R$ ${kpis.bemolTotal.toFixed(2)}</span></div>
          <div class="flex-between"><span>Bemol Liquidado:</span><span>R$ ${kpis.bemolPaid.toFixed(2)}</span></div>
          <div class="flex-between"><span>Bemol a Liquidar:</span><span>R$ ${kpis.bemolPending.toFixed(2)}</span></div>

          <div class="divider"></div>
          <div class="text-center bold" style="margin-top: 8px;">* FIM DO RELATÓRIO *</div>
          <script>
            window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Barra de Título & Exportações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <BarChart3 size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black text-gray-900">Relatórios & Inteligência Comercial</h1>
              <p className="text-xs text-gray-500 font-medium">Análise financeira consolidada, margem de lucro, curva ABC e vendedores</p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrintA4}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Imprimir relatório completo em folha A4"
          >
            <Printer size={15} /> <span>Imprimir A4</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReceipt80mm}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Imprimir resumo para impressora térmica de bobina 80mm"
          >
            <FileText size={15} /> <span>Cupom 80mm</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Exportar arquivo CSV com os registros de venda"
          >
            <Download size={15} /> <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcelXML}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Exportar planilha formatada em Excel"
          >
            <FileSpreadsheet size={15} /> <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 1. BARRA SUPERIOR DE FILTRO TEMPORAL */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'THIS_YEAR', 'CUSTOM'] as TimeFilterType[]).map((f) => {
            const labels: { [k in TimeFilterType]: string } = {
              TODAY: 'Hoje',
              LAST_7_DAYS: 'Últimos 7 Dias',
              THIS_MONTH: 'Este Mês',
              THIS_YEAR: 'Ano Atual',
              CUSTOM: 'Personalizado'
            };
            const isSelected = timeFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/20 font-black'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {timeFilter === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs font-medium bg-gray-50 p-2 rounded-xl border border-gray-200">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-gray-400">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
          <span>Período selecionado:</span>
          <strong className="text-gray-800">{periodLabel}</strong>
        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS GERAIS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Líquido e Bruto */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento Líquido</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={18} />
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900">
            R$ {kpis.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>Faturamento Bruto:</span>
            <span className="font-bold text-gray-700">R$ {kpis.totalGross.toFixed(2)}</span>
          </div>
        </div>

        {/* Margem de Lucro Estimada */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Margem de Lucro</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-700">
            {kpis.profitMarginPercent.toFixed(1)}%
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>Lucro Bruto Est.:</span>
            <span className="font-bold text-emerald-700">R$ {kpis.estimatedGrossProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingBag size={18} />
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900">
            R$ {kpis.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>Volume de Vendas:</span>
            <span className="font-bold text-gray-700">{kpis.count} atendimentos</span>
          </div>
        </div>

        {/* Descontos Concedidos */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Descontos Concedidos</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Percent size={18} />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600">
            R$ {kpis.totalDiscountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>Média de Abatimento:</span>
            <span className="font-bold text-rose-600">{kpis.avgDiscountPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* 3. ABAS ANALÍTICAS INTERNAS */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {/* Navegação das Abas */}
        <div className="flex border-b border-gray-200 overflow-x-auto print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('SALES_DISCOUNTS')}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'SALES_DISCOUNTS'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 font-black'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <DollarSign size={16} />
            <span>Vendas & Descontos</span>
            {kpis.authorizedDiscountsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-200 text-purple-800 font-bold">
                {kpis.authorizedDiscountsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ABC_CURVE')}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'ABC_CURVE'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 font-black'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <PieChart size={16} />
            <span>Curva ABC (Mais Vendidos)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PAYMENTS_CREDIT')}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'PAYMENTS_CREDIT'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 font-black'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <CreditCard size={16} />
            <span>Formas de Pagamento & BEMOL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STOCK_TURNOVER')}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'STOCK_TURNOVER'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 font-black'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Package size={16} />
            <span>Saídas & Giro de Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SELLERS_PERFORMANCE')}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'SELLERS_PERFORMANCE'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 font-black'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users size={16} />
            <span>Desempenho por Vendedor</span>
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-5 lg:p-6">
          {/* ABA 1: VENDAS & DESCONTOS */}
          {activeTab === 'SALES_DISCOUNTS' && (
            <div className="space-y-6">
              {/* Gráfico de Barras em Tailwind */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Evolução do Faturamento Diário</h3>
                    <p className="text-xs text-gray-500">Comparativo de vendas brutas e líquidas no período</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-600">
                      <span className="w-3 h-3 rounded-xs bg-purple-600 inline-block"></span> Total Líquido
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <span className="w-3 h-3 rounded-xs bg-pink-400 inline-block"></span> Descontos
                    </span>
                  </div>
                </div>

                {dailyPerformance.list.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    Nenhuma venda registrada no período selecionado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dailyPerformance.list.map(d => {
                      const netPct = (d.net / dailyPerformance.maxNet) * 100;
                      return (
                        <div key={d.date} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-gray-700">
                              {d.date.split('-').reverse().join('/')}
                            </span>
                            <span className="font-bold text-gray-900">
                              R$ {d.net.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">({d.count} vendas)</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
                            <div 
                              className="bg-purple-600 h-full rounded-full transition-all" 
                              style={{ width: `${Math.min(100, Math.max(3, netPct))}%` }} 
                              title={`Líquido: R$ ${d.net.toFixed(2)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Auditoria de Descontos e Autorizações */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <ShieldCheck size={17} className="text-purple-600" />
                      <span>Auditoria de Descontos Concedidos</span>
                    </h3>
                    <p className="text-xs text-gray-500">Vendas com abatimento e registro de autorização gerencial (&gt;15%)</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <tr>
                        <th className="p-3">Data/Hora</th>
                        <th className="p-3">Sequência</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Vendedor</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3 text-right">Desconto</th>
                        <th className="p-3 text-right">Líquido</th>
                        <th className="p-3">Autorização</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSales.filter(s => (s.discountAmount || 0) > 0).map(s => {
                        const isSpecial = s.requiresAuthorization || (s.discountPercent && s.discountPercent > 15);
                        const discVal = Number(s.discountAmount || 0);
                        const grossVal = Number(s.grossTotal || (Number(s.total) + discVal));
                        return (
                          <tr key={s.id} className={isSpecial ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50'}>
                            <td className="p-3 text-gray-600 whitespace-nowrap">
                              {s.timestamp ? new Date(s.timestamp).toLocaleString('pt-BR') : s.date}
                            </td>
                            <td className="p-3 font-bold text-gray-900">#{s.sequence || s.id}</td>
                            <td className="p-3 font-medium text-gray-800">{s.customerName}</td>
                            <td className="p-3 text-gray-600">{s.sellerName}</td>
                            <td className="p-3 text-right text-gray-500">R$ {grossVal.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-purple-700">
                              - R$ {discVal.toFixed(2)}
                              {s.discountPercent ? ` (${s.discountPercent}%)` : ''}
                            </td>
                            <td className="p-3 text-right font-black text-gray-900">R$ {s.total.toFixed(2)}</td>
                            <td className="p-3">
                              {s.authorizedBy ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <ShieldCheck size={11} />
                                  <span>{s.authorizedBy}</span>
                                </span>
                              ) : isSpecial ? (
                                <span className="text-red-600 font-bold text-[10px]">Pendente Registro</span>
                              ) : (
                                <span className="text-gray-400 text-[10px]">Padrão (&lt;=15%)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSales.filter(s => (s.discountAmount || 0) > 0).length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-gray-400 text-xs">
                            Nenhuma venda com desconto registrada no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: CURVA ABC DE PRODUTOS */}
          {activeTab === 'ABC_CURVE' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <PieChart size={17} className="text-purple-600" />
                    <span>Curva ABC de Vendas & Rentabilidade</span>
                  </h3>
                  <p className="text-xs text-gray-500">Classificação dos produtos por volume financeiro e margem gerada</p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    Classe A (70% Faturamento)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-300">
                    Classe B (20% Faturamento)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
                    Classe C (10% Faturamento)
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <tr>
                      <th className="p-3 text-center">Rank</th>
                      <th className="p-3 text-center">Classe</th>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3 text-center">Qtd Vendida</th>
                      <th className="p-3 text-right">Faturamento</th>
                      <th className="p-3 text-right">% Individual</th>
                      <th className="p-3 text-right">% Acumulada</th>
                      <th className="p-3 text-right">Margem Est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {abcCurveData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 text-center font-bold text-gray-600">#{item.ranking}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs ${
                            item.classification === 'A'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : item.classification === 'B'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {item.classification}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.name}</td>
                        <td className="p-3 text-gray-600">{item.category}</td>
                        <td className="p-3 text-center font-bold text-purple-700">{item.qty} un</td>
                        <td className="p-3 text-right font-black text-gray-900">
                          R$ {item.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-medium text-gray-700">{item.individualPct.toFixed(1)}%</td>
                        <td className="p-3 text-right font-bold text-purple-800">{item.accumulatedPct.toFixed(1)}%</td>
                        <td className="p-3 text-right font-bold text-emerald-700">{item.marginPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {abcCurveData.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400">
                          Nenhum produto vendido no período selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: FORMAS DE PAGAMENTO & CREDIÁRIOS */}
          {activeTab === 'PAYMENTS_CREDIT' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900">Distribuição por Forma de Pagamento</h3>
                  <div className="space-y-2">
                    {paymentBreakdown.map(p => (
                      <div key={p.key} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-bold text-gray-800">{p.name}</span>
                          <span className="text-xs font-black text-gray-900">
                            R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span>{p.count} transações</span>
                          <span className="font-bold text-purple-700">{p.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-purple-600 h-full rounded-full" 
                            style={{ width: `${Math.min(100, Math.max(2, p.percentage))}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Destaque BEMOL & Crediário Loja */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Central do Crediário Parceiro BEMOL</h3>
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Total Transacionado</span>
                      <CreditCard size={18} className="text-amber-700" />
                    </div>
                    <div className="text-2xl font-black text-amber-900">
                      R$ {kpis.bemolTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      O crediário Bemol possui liquidação automática após 25 dias corridos da venda. O valor cai diretamente na conta da loja.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-gray-500 font-bold block">Repassado / Liquidado</span>
                        <span className="text-sm font-black text-emerald-700">
                          R$ {kpis.bemolPaid.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-gray-500 font-bold block">A Repassar (Até 25d)</span>
                        <span className="text-sm font-black text-amber-700">
                          R$ {kpis.bemolPending.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: SAÍDAS & GIRO DE ESTOQUE */}
          {activeTab === 'STOCK_TURNOVER' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Peças Mais Vendidas */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <ShoppingBag size={16} className="text-purple-600" />
                  <span>Peças Mais Vendidas (Tamanho & Cor)</span>
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <tr>
                        <th className="p-2.5">Produto</th>
                        <th className="p-2.5">Grade</th>
                        <th className="p-2.5 text-center">Qtd</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stockAnalytics.topSold.map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2.5 font-bold text-gray-900">{it.name}</td>
                          <td className="p-2.5 text-gray-600">{it.variation}</td>
                          <td className="p-2.5 text-center font-black text-purple-700">{it.qty}</td>
                          <td className="p-2.5 text-right font-medium text-gray-800">R$ {it.total.toFixed(2)}</td>
                        </tr>
                      ))}
                      {stockAnalytics.topSold.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-gray-400">Nenhuma saída de produto no período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Peças Paradas (Sem saída no período) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>Produtos sem Saída no Período (Estoque Parado)</span>
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <tr>
                        <th className="p-2.5">Código</th>
                        <th className="p-2.5">Produto</th>
                        <th className="p-2.5">Categoria</th>
                        <th className="p-2.5 text-right">Estoque</th>
                        <th className="p-2.5 text-right">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stockAnalytics.zeroSalesProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-2.5 font-mono text-[11px] text-gray-500">{p.internalCode || `#${p.id}`}</td>
                          <td className="p-2.5 font-bold text-gray-900">{p.name}</td>
                          <td className="p-2.5 text-gray-600">{p.category}</td>
                          <td className="p-2.5 text-right font-bold text-amber-700">{p.stock} un</td>
                          <td className="p-2.5 text-right text-gray-700">R$ {p.price.toFixed(2)}</td>
                        </tr>
                      ))}
                      {stockAnalytics.zeroSalesProducts.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-gray-400">Todos os produtos tiveram movimentação no período!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 5: DESEMPENHO POR VENDEDOR */}
          {activeTab === 'SELLERS_PERFORMANCE' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Produtividade da Equipe de Atendimento</h3>
                <p className="text-xs text-gray-500">Ranking individual por faturamento, ticket médio e volume de peças</p>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <tr>
                      <th className="p-3">Colaborador / Vendedor</th>
                      <th className="p-3 text-center">Atendimentos</th>
                      <th className="p-3 text-center">Peças Vendidas</th>
                      <th className="p-3 text-right">Ticket Médio</th>
                      <th className="p-3 text-right">Faturamento Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerPerformance.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span>{s.name}</span>
                        </td>
                        <td className="p-3 text-center font-medium text-gray-700">{s.salesCount}</td>
                        <td className="p-3 text-center font-bold text-purple-700">{s.itemsCount}</td>
                        <td className="p-3 text-right text-gray-700">R$ {s.ticket.toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-gray-900">
                          R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {sellerPerformance.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum atendimento registrado no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Área de Impressão Executiva A4 (Oculta na tela via print:block) */}
      <div id="report-a4-area" className="hidden print:block font-sans text-black bg-white p-8 space-y-6">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body * { visibility: hidden !important; }
            #report-a4-area, #report-a4-area * { visibility: visible !important; }
            #report-a4-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; color: black !important; background: white !important; display: block !important; }
          }
        `}</style>

        {/* Cabeçalho Paiva Moda */}
        <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black tracking-widest text-black uppercase">PAIVA MODA</h1>
            <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">Relatório Executivo de Vendas & Resultados</p>
          </div>
          <div className="text-right text-[10px] text-gray-500 font-mono">
            <div>Período: <span className="font-bold">{periodLabel}</span></div>
            <div>Emissão: {new Date().toLocaleString('pt-BR')}</div>
          </div>
        </div>

        {/* Resumo do Período & DRE Sintético */}
        <div className="grid grid-cols-2 gap-4">
          {/* Resumo do Período */}
          <div className="border border-gray-300 p-4 rounded-xl space-y-2">
            <h3 className="text-xs font-black uppercase border-b pb-1 border-gray-300 text-gray-800">Resumo Operacional</h3>
            <div className="flex justify-between text-xs"><span>Vendas Emitidas:</span><span className="font-bold">{kpis.count}</span></div>
            <div className="flex justify-between text-xs"><span>Faturamento Bruto:</span><span className="font-bold">R$ {kpis.totalGross.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span>Descontos Aplicados:</span><span className="font-bold text-rose-600">- R$ {kpis.totalDiscountValue.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200"><span>Faturamento Líquido:</span><span>R$ {kpis.totalNet.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span>Ticket Médio:</span><span className="font-bold">R$ {kpis.averageTicket.toFixed(2)}</span></div>
          </div>

          {/* DRE Sintético */}
          <div className="border border-gray-300 p-4 rounded-xl space-y-2">
            <h3 className="text-xs font-black uppercase border-b pb-1 border-gray-300 text-gray-800">DRE Sintético</h3>
            <div className="flex justify-between text-xs"><span>Faturamento Líquido:</span><span className="font-bold">R$ {kpis.totalNet.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span>Custo de Mercadoria (CMV):</span><span className="font-bold text-rose-600">- R$ {kpis.totalCostEstimated.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200"><span>Lucro Bruto Estimado:</span><span>R$ {kpis.estimatedGrossProfit.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span>Margem de Lucro (%):</span><span className="font-bold text-emerald-700">{kpis.profitMarginPercent.toFixed(1)}%</span></div>
          </div>
        </div>

        {/* Formas de Pagamento no Período */}
        <div className="border border-gray-300 p-4 rounded-xl space-y-2">
          <h3 className="text-xs font-black uppercase border-b pb-1 border-gray-300 text-gray-800">Faturamento por Forma de Pagamento</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {paymentBreakdown.map(p => (
              <div key={p.key} className="flex justify-between border-b border-gray-100 py-1">
                <span>{p.name}:</span>
                <span className="font-bold">R$ {p.total.toFixed(2)} ({p.percentage.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking de Vendas por Vendedor */}
        <div className="border border-gray-300 p-4 rounded-xl space-y-2">
          <h3 className="text-xs font-black uppercase border-b pb-1 border-gray-300 text-gray-800">Ranqueamento de Colaboradores</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b font-bold text-gray-600">
                <th className="pb-1">Colaborador</th>
                <th className="pb-1 text-right">Faturamento</th>
                <th className="pb-1 text-center">Atendimentos</th>
                <th className="pb-1 text-right">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sellerPerformance.map(seller => (
                <tr key={seller.id} className="py-1">
                  <td className="py-1.5 font-bold">{seller.name}</td>
                  <td className="py-1.5 text-right font-black">R$ {seller.total.toFixed(2)}</td>
                  <td className="py-1.5 text-center">{seller.salesCount}</td>
                  <td className="py-1.5 text-right">R$ {seller.ticket.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grade de Peças Mais Vendidas (Top 10) */}
        <div className="border border-gray-300 p-4 rounded-xl space-y-2">
          <h3 className="text-xs font-black uppercase border-b pb-1 border-gray-300 text-gray-800">Peças Mais Vendidas (Top 10)</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b font-bold text-gray-600">
                <th className="pb-1">Produto</th>
                <th className="pb-1">Grade / Variação</th>
                <th className="pb-1 text-center">Qtd. Saídas</th>
                <th className="pb-1 text-right font-bold">Total Faturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockAnalytics.topSold.slice(0, 10).map((p, idx) => (
                <tr key={idx} className="py-1">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 font-bold">{p.variation}</td>
                  <td className="py-1.5 text-center font-bold">{p.qty} un.</td>
                  <td className="py-1.5 text-right font-black">R$ {p.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé Executivo */}
        <div className="pt-8 text-center text-[10px] text-gray-400 border-t border-dashed border-gray-200">
          Relatório Executivo confidencial gerado pelo ERP do sistema Paiva Moda.
        </div>
      </div>
    </div>
  );
};

export default Reports;
