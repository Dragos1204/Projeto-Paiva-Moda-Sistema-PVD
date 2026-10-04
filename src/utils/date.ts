/**
 * Utilitários de Data no Fuso Horário de Manaus / Amazonas (UTC-4)
 * America/Manaus
 */

export const getManausDate = (dateInput?: string | Date): string => {
  // Se for uma string de data sem hora (ex: YYYY-MM-DD), retorna diretamente para evitar shifting
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

export const formatManausDateTime = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Manaus',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${dateFormatter.format(d)} às ${timeFormatter.format(d)}`;
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
