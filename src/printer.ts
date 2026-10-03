
import { Sale, CartItem, Product, FinancialRecord, Customer } from './types';
import { STORE_NAME } from './constants';

export type LabelModel = 'STANDARD' | 'ADHESIVE_50x30' | 'HANG_TAG' | 'SHELF_LABEL';

export interface PrintQueueItem {
  product: Product;
  quantity: number;
}

// --- Code 128 Generator (Uses BORDERS instead of background for print safety) ---
const Code128Generator = (text: string) => {
  if (!text) return '';
  
  // Mapping for Code 128 B (Standard ASCII)
  const code128B = [
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
    "114131", "311141", "411131", "211412", "211214", "211232" 
  ];
  
  let pattern = code128B[104];
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32; 
    if (code >= 0 && code < code128B.length) {
      pattern += code128B[code];
      checksum += code * (i + 1);
    }
  }

  const checkVal = checksum % 103;
  pattern += code128B[checkVal];
  pattern += "2331112"; 

  // Using Border-Left ensures browsers print it even if "background graphics" is off
  let html = '<div style="display:flex; height: 100%; width: fit-content; margin: 0 auto; align-items: flex-end; overflow: hidden;">';
  let isBar = true;
  
  for (let i = 0; i < pattern.length; i++) {
    const width = parseInt(pattern[i]);
    if (isBar) {
        html += `<div style="width: 0; border-left: ${width * 1.3}px solid black; height: 100%;"></div>`;
    } else {
        html += `<div style="width: ${width * 1.3}px; height: 100%;"></div>`;
    }
    isBar = !isBar;
  }
  html += '</div>';
  
  return html;
};

// Helper for dynamic font size based on price length
const getPriceStyle = (price: number, model: LabelModel) => {
  const chars = price.toFixed(2).length; // e.g., "150.00" is 6 chars, "1250.00" is 7
  
  if (model === 'ADHESIVE_50x30') {
    if (chars > 7) return 'font-size: 16px;'; // > 1000.00
    if (chars > 5) return 'font-size: 20px;'; // > 100.00
    return 'font-size: 24px;'; // < 100.00
  }
  
  if (model === 'SHELF_LABEL') {
     // Shelf label is big
     if (chars > 7) return 'font-size: 28px;';
     return 'font-size: 36px;';
  }

  // Standard / Tag
  if (chars > 7) return 'font-size: 20px;';
  return 'font-size: 28px;';
};

// Helper for CSS Styles per model
const getModelStyles = (model: LabelModel) => {
  // Global print adjustment for all models
  const globalCSS = `
    * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        box-sizing: border-box;
    }
  `;

  switch (model) {
    case 'ADHESIVE_50x30':
      return `
        ${globalCSS}
        @page { size: 50mm 30mm; margin: 0; }
        body { width: 50mm; margin: 0; }
        .page-break { page-break-after: always; height: 30mm; width: 50mm; overflow: hidden; position: relative; }
        .container { 
           padding: 2mm 3mm; 
           width: 100%; height: 100%; 
           display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; 
        }
        .store-name { font-size: 7px; font-weight: bold; text-transform: uppercase; width: 100%; white-space: nowrap; overflow: hidden; }
        .product-name { font-size: 9px; font-weight: bold; line-height: 1.1; max-height: 2.2em; overflow: hidden; width: 100%; margin-top: 1px; }
        .price { font-weight: 900; line-height: 1; margin: 1px 0; }
        .barcode-container { height: 20px; width: 100%; display: flex; justify-content: center; }
        .barcode-num { font-size: 7px; font-family: monospace; letter-spacing: 1px; }
      `;
    case 'HANG_TAG':
      return `
        ${globalCSS}
        @page { size: 40mm 60mm; margin: 0; }
        body { width: 40mm; margin: 0; }
        .page-break { page-break-after: always; height: 60mm; width: 40mm; overflow: hidden; position: relative; }
        .container { 
           padding: 4mm; 
           width: 100%; height: 100%; 
           display: flex; flex-direction: column; align-items: center; text-align: center; 
        }
        .hole-circle { width: 4mm; height: 4mm; border: 1px solid #ccc; border-radius: 50%; margin-bottom: 2mm; }
        .store-name { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2mm; border-bottom: 1px solid black; width: 100%; padding-bottom: 1mm; }
        .product-name { font-size: 11px; font-weight: bold; margin-bottom: auto; }
        .price { font-weight: 900; margin: 4mm 0; }
        .barcode-container { height: 25px; width: 100%; display: flex; justify-content: center; }
        .barcode-num { font-size: 8px; font-family: monospace; margin-top: 2px; }
      `;
    case 'SHELF_LABEL':
      return `
        ${globalCSS}
        @page { size: 80mm 40mm; margin: 0; }
        body { width: 80mm; margin: 0; }
        .page-break { page-break-after: always; height: 40mm; width: 80mm; overflow: hidden; }
        .container { 
           padding: 2mm; 
           width: 100%; height: 100%; 
           border: 2px solid black;
           display: flex; flex-direction: row; 
        }
        .left-col { 
            width: 60%; 
            display: flex; flex-direction: column; justify-content: center; 
            border-right: 1px dashed black; padding-right: 2mm; text-align: center; 
            overflow: hidden;
        }
        .right-col { 
            width: 40%; 
            display: flex; flex-direction: column; justify-content: center; align-items: center; 
            padding-left: 2mm; overflow: hidden;
        }
        .product-name { font-size: 12px; font-weight: bold; line-height: 1.1; margin-bottom: 4px; max-height: 2.4em; overflow: hidden; }
        .price-label { font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
        .price { font-weight: 900; line-height: 1; }
        .barcode-container { height: 22px; margin-top: 4px; width: 100%; display: flex; justify-content: center; }
        .barcode-num { font-size: 8px; font-family: monospace; }
      `;
    case 'STANDARD':
    default:
      return `
        ${globalCSS}
        @page { margin: 0; }
        body { width: 58mm; padding: 0; text-align: center; margin: 0 auto; }
        .page-break { page-break-after: always; padding: 5px 0 15px 0; border-bottom: 1px dashed #eee; }
        .container { display: flex; flex-direction: column; align-items: center; width: 100%; }
        .store-name { font-size: 10px; margin-bottom: 2px; font-weight: bold; }
        .product-name { font-size: 12px; font-weight: bold; margin-bottom: 2px; max-width: 90%; }
        .price { font-weight: 900; margin: 2px 0; }
        .barcode-container { height: 35px; width: 100%; margin-top: 2px; display: flex; justify-content: center; }
        .barcode-num { font-size: 9px; margin-top: 2px; font-family: monospace; }
      `;
  }
};

const generateSingleLabelHTML = (product: Product, type: 'GTIN' | 'INTERNAL', model: LabelModel) => {
  const codeToPrint = type === 'INTERNAL' ? product.internalCode : product.barcode;
  const barcodeHtml = codeToPrint ? Code128Generator(codeToPrint) : '';
  const formatPrice = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const priceStyle = getPriceStyle(product.price, model);

  if (model === 'ADHESIVE_50x30') {
    return `
      <div class="page-break">
        <div class="container">
          <div class="store-name">${STORE_NAME}</div>
          <div class="product-name">${product.name.substring(0, 35)}</div>
          <div class="price" style="${priceStyle}">${formatPrice(product.price)}</div>
          <div style="width: 100%">
             <div class="barcode-container">${barcodeHtml}</div>
             <div class="barcode-num">${codeToPrint || ''}</div>
          </div>
        </div>
      </div>
    `;
  } 
  
  if (model === 'HANG_TAG') {
    return `
      <div class="page-break">
        <div class="container">
           <div class="hole-circle"></div>
           <div class="store-name">${STORE_NAME}</div>
           <div class="product-name">${product.name}</div>
           <div style="font-size: 9px;">${type === 'INTERNAL' && codeToPrint ? 'REF: ' + codeToPrint : ''}</div>
           <div class="price" style="${priceStyle}">${formatPrice(product.price)}</div>
           <div class="barcode-container">${barcodeHtml}</div>
           <div class="barcode-num">${codeToPrint || ''}</div>
        </div>
      </div>
    `;
  } 
  
  if (model === 'SHELF_LABEL') {
    return `
      <div class="page-break">
        <div class="container">
           <div class="left-col">
              <div class="product-name">${product.name}</div>
              <div class="barcode-container">${barcodeHtml}</div>
              <div class="barcode-num">${codeToPrint || ''}</div>
           </div>
           <div class="right-col">
              <div class="price-label">Oferta</div>
              <div class="price" style="${priceStyle}">${formatPrice(product.price)}</div>
           </div>
        </div>
      </div>
    `;
  }

  // STANDARD
  return `
    <div class="page-break">
      <div class="container">
        <div class="store-name">${STORE_NAME}</div>
        <div class="product-name">${product.name}</div>
        <div class="price" style="${priceStyle}">${formatPrice(product.price)}</div>
        <div class="barcode-container">${barcodeHtml}</div>
        <div class="barcode-num">${codeToPrint || ''}</div>
      </div>
    </div>
  `;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const generateTicketHTML = (sale: Sale) => {
    const date = new Date(sale.timestamp).toLocaleDateString('pt-BR');
    const time = new Date(sale.timestamp).toLocaleTimeString('pt-BR');
    const itemsHtml = sale.items.map(item => `
      <div class="item-row">
        <div class="item-name">${item.quantity}x ${item.name}</div>
        <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
      </div>
    `).join('');
    
    return `
    <html>
      <head>
        <title>Cupom - ${STORE_NAME}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; font-size: 12px; color: black; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed black; margin: 8px 0; }
          .flex { display: flex; justify-content: space-between; }
          .item-row { margin-bottom: 4px; }
          .item-name { font-size: 11px; }
          .item-price { text-align: right; }
          .footer { font-size: 10px; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px;">${STORE_NAME}</div>
        <div class="center" style="font-size: 10px;">Comprovante de Venda</div>
        <div class="divider"></div>
        <div class="flex"><span>Data: ${date}</span><span>Hora: ${time}</span></div>
        <div class="bold">Venda Nº: ${String(sale.sequence || sale.id).padStart(6, '0')}</div>
        <div>Cliente: ${sale.customerName.substring(0, 25)}</div>
        ${sale.cpf ? `<div>CPF: ${sale.cpf}</div>` : ''}
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 5px;">ITENS</div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="flex total-section bold"><span>TOTAL:</span><span>${formatCurrency(sale.total)}</span></div>
        <div class="divider"></div>
        <div class="footer">*** NÃO É DOCUMENTO FISCAL ***</div>
      </body>
    </html>`;
};

const generateDebtReceiptHTML = (record: FinancialRecord, customer: Customer, totalPaid: number, calculationDetails: any) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const now = new Date().toLocaleTimeString('pt-BR');
    
    return `
    <html>
      <head>
        <title>Recibo - ${STORE_NAME}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; font-size: 12px; color: black; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed black; margin: 8px 0; }
          .flex { display: flex; justify-content: space-between; }
          .footer { font-size: 10px; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px;">${STORE_NAME}</div>
        <div class="center" style="font-size: 10px;">Recibo de Pagamento - Crediário</div>
        <div class="divider"></div>
        <div class="flex"><span>Data Pagto:</span><span>${today} ${now}</span></div>
        <div>Cliente: ${customer.name.substring(0, 25)}</div>
        <div class="divider"></div>
        <div class="bold">Ref: ${record.description}</div>
        <div class="flex"><span>Vencimento Orig:</span><span>${new Date(record.dueDate).toLocaleDateString('pt-BR')}</span></div>
        <div class="divider"></div>
        
        <div class="flex"><span>Valor Original:</span><span>${formatCurrency(calculationDetails.originalAmount)}</span></div>
        ${calculationDetails.fine > 0 ? `<div class="flex"><span>Multa (2%):</span><span>+ ${formatCurrency(calculationDetails.fine)}</span></div>` : ''}
        ${calculationDetails.interest > 0 ? `<div class="flex"><span>Juros (1% a.m):</span><span>+ ${formatCurrency(calculationDetails.interest)}</span></div>` : ''}
        
        <div class="divider"></div>
        <div class="flex bold" style="font-size: 14px;"><span>TOTAL PAGO:</span><span>${formatCurrency(totalPaid)}</span></div>
        ${record.paymentMethod ? `<div class="center" style="margin-top:5px;">Forma: ${record.paymentMethod === 'MONEY' ? 'Dinheiro' : record.paymentMethod}</div>` : ''}
        
        <div class="divider"></div>
        <div class="footer">Obrigado pela preferência!</div>
      </body>
    </html>`;
};

export const printer = {
  // Generates HTML string but allows returning it for previewing
  generateBatchTagHTML: (queue: PrintQueueItem[], type: 'GTIN' | 'INTERNAL', model: LabelModel) => {
    const styles = getModelStyles(model);
    
    let allLabelsHtml = '';
    
    queue.forEach(item => {
        // Generate X copies of this label
        for (let i = 0; i < item.quantity; i++) {
            allLabelsHtml += generateSingleLabelHTML(item.product, type, model);
        }
    });

    return `
      <html>
        <head>
          <style>
            ${styles}
            body { font-family: sans-serif; margin: 0; padding: 0; background: white; }
          </style>
        </head>
        <body>
          ${allLabelsHtml}
        </body>
      </html>
    `;
  },

  printQueue: (queue: PrintQueueItem[], type: 'GTIN' | 'INTERNAL', model: LabelModel) => {
    // Window sizing based on model
    let w = 400;
    let h = 400;
    
    if (model === 'ADHESIVE_50x30') { w = 300; h = 300; }
    if (model === 'HANG_TAG') { w = 300; h = 400; }
    if (model === 'SHELF_LABEL') { w = 400; h = 300; }

    const content = printer.generateBatchTagHTML(queue, type, model);
    const printWindow = window.open('', '', `width=${w},height=${h}`);
    
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      
      // Allow images/styles to load
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  },

  printTicket: (sale: Sale) => {
    const width = 300; 
    const content = generateTicketHTML(sale);
    const printWindow = window.open('', '', `width=${width},height=600`);
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      alert('Bloqueador de pop-ups detectado.');
    }
  },

  printDebtReceipt: (record: FinancialRecord, customer: Customer, totalPaid: number, calculationDetails: any) => {
    const width = 300; 
    const content = generateDebtReceiptHTML(record, customer, totalPaid, calculationDetails);
    const printWindow = window.open('', '', `width=${width},height=500`);
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  },

  printTest: () => {
     const testSale: any = {
      id: 999, sequence: 1, date: '2023-01-01', timestamp: new Date().toISOString(),
      customerId: '00', customerName: 'TESTE', items: [], subtotal: 10, discount:0, total: 10, paymentMethod:'MONEY', change:0, status:'COMPLETED'
     };
     printer.printTicket(testSale);
  },
  
  // Kept for backward compatibility if needed, but we use batch now
  printProductTag: (product: Product, type: 'GTIN' | 'INTERNAL', model: LabelModel) => {
      printer.printQueue([{ product, quantity: 1 }], type, model);
  }
};
