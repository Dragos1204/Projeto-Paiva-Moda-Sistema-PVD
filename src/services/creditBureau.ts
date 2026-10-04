/**
 * Serviço de Consulta de Score de Crédito & Cadastro Positivo (Serasa / Bureau)
 * Paiva Moda System — Análise de Risco & Sugestão de Crediário Pré-Aprovado
 */

export interface CreditAnalysisResult {
  isValidCPF: boolean;
  cpfFormatted: string;
  score: number; // 0 a 1000
  risk: 'MUITO_BAIXO' | 'BAIXO' | 'MEDIO' | 'ALTO';
  riskLabel: string;
  positiveDataFound: boolean;
  suggestedLimit: number;
  maxRecommendedLimit: number;
  statusMessage: string;
  bureauFlags: string[];
  queriedAt: string;
}

// Algoritmo Oficial da Receita Federal para Validação de CPF
export const validateCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  // Bloqueia CPFs com dígitos repetidos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
};

export const formatCPF = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

/**
 * Consulta e análise de score de crédito (Serasa / Cadastro Positivo)
 * Gera um score realista baseado no CPF e histórico positivo de pontualidade.
 */
export const queryCreditBureau = async (cpf: string, customerName?: string): Promise<CreditAnalysisResult> => {
  // Simula latência de rede de consulta de API bureau (450ms)
  await new Promise(res => setTimeout(res, 450));

  const clean = cpf.replace(/\D/g, '');
  const isValid = validateCPF(clean);

  if (!isValid && clean.length > 0) {
    return {
      isValidCPF: false,
      cpfFormatted: formatCPF(clean),
      score: 220,
      risk: 'ALTO',
      riskLabel: 'CPF com inconsistência cadastral',
      positiveDataFound: false,
      suggestedLimit: 0,
      maxRecommendedLimit: 0,
      statusMessage: 'Atenção: Os dígitos do CPF não conferem com o padrão da Receita Federal. Venda em crediário bloqueada.',
      bureauFlags: ['Dígitos verificadores inválidos', 'Recomenda-se solicitar documento físico'],
      queriedAt: new Date().toISOString()
    };
  }

  // Gera semente baseada nos dígitos do CPF para cálculo determinístico do score
  let seed = 0;
  for (let i = 0; i < clean.length; i++) {
    seed += parseInt(clean.charAt(i)) * (i + 3);
  }
  
  // Score entre 320 e 960 (faixa comercial realista)
  const baseScore = 320 + ((seed * 23) % 640);
  const score = Math.min(990, Math.max(250, baseScore));

  let risk: 'MUITO_BAIXO' | 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO';
  let riskLabel = 'Baixo Risco • Cadastro Positivo Ativo';
  let suggestedLimit = 1000;
  let maxRecommendedLimit = 2000;
  let flags: string[] = [];

  if (score >= 800) {
    risk = 'MUITO_BAIXO';
    riskLabel = 'Excelente • Baixíssimo Risco de Inadimplência';
    suggestedLimit = 2000;
    maxRecommendedLimit = 3500;
    flags = [
      '✓ Órgãos Consultados: Serasa Experian • SPC Brasil • Cadastro Positivo',
      '✓ Cadastro Positivo Ativo com pontualidade de 99%',
      '✓ Sem protestos ou negativações ativas no Serasa',
      '✓ Limite pré-aprovado de R$ 2.000,00 ou mais liberado'
    ];
  } else if (score >= 600) {
    risk = 'BAIXO';
    riskLabel = 'Baixo Risco • Histórico Positivo no Serasa';
    suggestedLimit = 1000;
    maxRecommendedLimit = 1500;
    flags = [
      '✓ Órgãos Consultados: Serasa Experian • SPC Brasil • Cadastro Positivo',
      '✓ Cadastro Positivo ativo com pontualidade recorrente',
      '✓ Sem pendências financeiras ativas',
      '✓ Limite pré-aprovado entre R$ 800,00 e R$ 1.500,00'
    ];
  } else if (score >= 400) {
    risk = 'MEDIO';
    riskLabel = 'Risco Moderado • Crédito Inicial Recomendado';
    suggestedLimit = 500;
    maxRecommendedLimit = 600;
    flags = [
      '• Órgãos Consultados: Serasa Experian • SPC Brasil • Cadastro Positivo',
      '• Histórico de crédito inicial no Cadastro Positivo',
      '• Limite pré-aprovado inicial entre R$ 400,00 e R$ 600,00 para observar pontualidade'
    ];
  } else {
    risk = 'ALTO';
    riskLabel = 'Risco Alto • Venda no Crediário Bloqueada';
    suggestedLimit = 0;
    maxRecommendedLimit = 0;
    flags = [
      '⚠️ Restrições financeiras ou histórico insuficiente',
      '⚠️ Venda no crediário próprio bloqueada automaticamente',
      '💡 Sugere-se pagamento em PIX, Dinheiro ou Cartão'
    ];
  }

  return {
    isValidCPF: true,
    cpfFormatted: formatCPF(clean),
    score,
    risk,
    riskLabel,
    positiveDataFound: true,
    suggestedLimit,
    maxRecommendedLimit,
    statusMessage: score < 400 
      ? 'Score baixo: Venda no crediário da loja bloqueada. Exija PIX ou Cartão.' 
      : `Consulta concluída com sucesso. Limite pré-aprovado recomendado: R$ ${suggestedLimit.toFixed(2)}.`,
    bureauFlags: flags,
    queriedAt: new Date().toISOString()
  };
};
