/**
 * Camada Central de Formatação e Tradução do Fuso Horário de Manaus (UTC-4)
 */

export const formatPaymentMethod = (method: string): string => {
  const m = (method || '').toUpperCase().trim();
  switch (m) {
    case 'PIX':
      return 'Pix (Imediato)';
    case 'MONEY':
    case 'DINHEIRO':
      return 'Dinheiro em Espécie';
    case 'DEBIT_CARD':
    case 'DEBITO':
      return 'Cartão de Débito';
    case 'CREDIT_CARD':
    case 'CREDITO':
      return 'Cartão de Crédito';
    case 'STORE_CREDIT':
    case 'CREDIARIO':
    case 'CARNE':
      return 'Crediário Loja (Carnê)';
    case 'BEMOL':
    case 'BEMOL_CREDIT':
    case 'CREDIÁRIO PARCEIRO BEMOL':
      return 'Crediário Parceiro Bemol';
    default:
      return method || 'Não Informado';
  }
};

export const formatCurrency = (value: number): string => {
  const rounded = Math.round((value || 0) * 100) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
};

export const formatManausDate = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  // Se for YYYY-MM-DD sem hora, formata para DD/MM/YYYY diretamente sem deslocar fuso
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim().split('-').reverse().join('/');
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
};

export const getManausDate = (dateInput?: string | Date): string => {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  return `${year}-${month}-${day}`;
};

export const getManausTime = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Manaus',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(d);
};

export const getManausMonth = (dateInput?: string | Date): string => {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}/.test(dateInput.trim())) {
    return dateInput.trim().substring(0, 7);
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  return `${year}-${month}`;
};
