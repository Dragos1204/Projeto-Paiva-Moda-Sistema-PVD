# Paiva Moda — Sistema Integrado de Gestão, PDV e DRE em Tempo Real

<div align="center">

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase_Firestore-v12_Modular-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deploy_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)

**Plataforma completa de Frente de Caixa (PDV Multiusuário), Gestão de Varejo de Moda e Controle Financeiro/DRE em tempo real.**

</div>

---

## 1. Visão Geral do Sistema

O **Paiva Moda** é um sistema enterprise de frente de caixa e retaguarda desenhado sob medida para o varejo de confecção, calçados e vestuário (atacado e varejo). Combina extrema agilidade operacional no balcão com controle contábil rigoroso, crediário próprio (carnê) e sincronização na nuvem com tolerância a falhas de rede.

### Principais Funcionalidades:
- **Frente de Caixa (PDV Ágil):** Leitura de código de barras físico (USB/Bluetooth), leitor via câmera mobile (`html5-qrcode`), atalhos de teclado rápidos, aplicação de descontos autorizados e impressão de cupom térmico (58mm e 80mm).
- **Pré-Venda Móvel no Salão:** Atendimento simultâneo por dezenas de vendedoras gerando comandas sequenciais (`PV-001`, `PV-002`...), liberando o caixa apenas para fechamento e recebimento.
- **Crediário da Loja (Carnê Próprio):** Emissão de parcelas com cálculo automático de vencimentos, controle de limite de crédito por cliente, amortização de parcelas no balcão e histórico de adimplência.
- **Auditoria de Descontos e DRE em Tempo Real:** Segregação estrita entre faturamento bruto, descontos concedidos (campanhas promocionais ou manuais com senha gerencial) e faturamento líquido real.
- **Gestão de Grade e Etiquetas:** Catálogo de roupas por tamanho, cor e categoria, com impressão de etiquetas com código de barras e otimização automática de fotos (suportando imagens `.heic` de iPhone).
- **Resiliência Offline:** Sincronização em tempo real via Firestore com espelhamento imediato em cache local (`localStorage` + `IndexedDB`), garantindo operação mesmo com oscilações de internet.

---

## 2. Stack Tecnológica e Arquitetura

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Front-End** | React 18, TypeScript | Hooks modernos, Context API (`ToastContext`), Error Boundaries e tipagem estrita. |
| **Estilização** | Tailwind CSS | Design System responsivo, limpo e adaptado para telas touchscreen de PDV. |
| **Ícones** | Lucide React | Biblioteca de ícones vetoriais leves e consistentes. |
| **Banco de Dados** | Google Firebase Firestore | SDK Modular v9/v10 oficial, sincronização via `onSnapshot` e escritas em lote (`writeBatch`). |
| **Armazenamento** | Firebase Storage | Armazenamento de fotos de produtos com compressão client-side em WebP. |
| **Build & Deploy** | Vite 8 + Vercel | Build ultra-rápido otimizado para Single Page Application com roteamento por `vercel.json`. |

---

## 3. Regra Canônica de Fuso Horário (Manaus / UTC-4)

O sistema opera obrigatoriamente no fuso horário **`America/Manaus` (UTC-4)**:
- **Fechamento de Caixa:** O dia contábil e as vendas diárias são consolidados até exatamente as **23:59:59 locais** de Manaus.
- **Datas de Vencimento e Parcelas:** Todas as parcelas de carnê geradas no crediário utilizam a data ISO local calculada pelas funções canônicas `getManausDateString()` e `getManausDateTimeString()`.
- **Integridade Contábil:** Impede divergências em relatórios fiscais causadas por clientes ou navegadores operando no horário de Brasília (UTC-3) ou UTC internacional.

---

## 4. As 10 Coleções Oficiais do Cloud Firestore

Todas as operações de persistência do sistema estão mapeadas nas seguintes 10 coleções oficiais:

```
paiva-moda (Cloud Firestore)
 ├── products        -> Catálogo de roupas, custo, preço de venda, atacado e grade (tamanho/cor/estoque)
 ├── promotions      -> Campanhas ativas, radar de estoque parado (-10%, -15%) e vigência
 ├── pre_sales       -> Fila de comandas de pré-venda geradas pelas vendedoras no salão (PV-001...)
 ├── sales           -> Histórico imutável de vendas finalizadas no PDV (itens, operador, bruto e líquido)
 ├── movements       -> Kardex contábil de movimentações de estoque (entradas, saídas e ajustes manuais)
 ├── customers       -> Cadastro de clientes, score de crédito e limite pré-aprovado
 ├── credit_bills    -> Parcelas individuais de carnês próprios gerados no crediário ('PENDING'/'PAID')
 ├── financials      -> Livro-caixa e lançamentos DRE com segregação contábil
 ├── users           -> Controle de operadores e RBAC (Dono João Neto, Gerentes, Vendedores)
 └── settings        -> Perfil da loja (store_profile), cabeçalho do cupom e parâmetros operacionais
```

---

## 5. Máquina de Estados Financeira & Regras Contábeis

### 5.1 Classificação das Formas de Pagamento
1. **Pagamentos Imediatos (`PIX`, `MONEY`, `DINHEIRO`, `DEBIT_CARD`, `CREDIT_CARD` à vista):**
   - Registrados no módulo financeiro com `status: 'COMPLETED'` imediatamente no momento da venda.
   - Entram diretamente no card **"Saldo Líquido Realizado (Caixa Vivo)"**.
2. **Crediário da Loja (`STORE_CREDIT` / Carnê Próprio):**
   - Registrado inicialmente em `financials` com `status: 'PENDING'`. Não cai no caixa vivo no ato da venda.
   - Gera as parcelas correspondentes na coleção `credit_bills` e debita do limite do cliente.
   - Soma em **"A Receber Futuro (Projetado)"**.
   - Somente quando o cliente paga a prestação em `CreditManager.tsx`, o sistema liquida a parcela e gera uma entrada `status: 'COMPLETED'` no caixa daquele dia.
3. **Crediário Parceiro Bemol (`BEMOL_CREDIT`):**
   - Registrado como `status: 'PENDING'` com vencimento programado para 25 dias.
   - Aplica a dedução administrativa de 3% (`valorLiquido = total * 0.97`), gerando a conciliação contábil exata.

### 5.2 Fórmulas Contábeis Auditadas
$$\text{Saldo Líquido Realizado} = \sum \text{Receitas COMPLETED} - \sum \text{Despesas COMPLETED}$$
$$\text{A Receber Futuro} = \sum \text{Receitas PENDING (Carnês + Bemol)}$$
$$\text{Contas a Pagar} = \sum \text{Despesas PENDING}$$
$$\text{Faturamento Bruto} = \sum \text{grossTotal} \lor (\text{total} + \text{discountAmount})$$

---

## 6. Padrões de Interface e Estabilidade (UX/UI)

- **Eliminação Total de Pop-ups Nativos:** É estritamente proibido o uso de `window.confirm()` ou `window.alert()`, pois causam travamentos silenciosos em ambientes com iframe e navegadores modernos.
- **Modal Universal de Confirmação (`ConfirmModal.tsx`):** Todas as lixeiras do sistema (exclusão de promoções, despesas, clientes, produtos e cancelamentos) utilizam este modal padronizado com backdrop blur, ícone de alerta e proteção contra múltiplos cliques.
- **UI Otimista Obrigatória (0ms):** Ao excluir ou atualizar qualquer registro, a interface React atualiza o estado visual instantaneamente (0ms), garantindo fluidez antes mesmo da confirmação da rede.
- **Sessão Persistente de 15 Horas:** Armazenada sob a chave `'paiva_session_v1'` no `localStorage`, evitando que operadoras ou caixas sejam deslogados durante o turno de trabalho.
- **Zona de Perigo Blindada (`Settings.tsx`):**
  - **Ação A [Zerar Vendas e Reiniciar Operação]:** Apaga apenas vendas, financeiro, movimentações e pré-vendas de teste via `writeBatch` particionado (400 docs/lote). Mantém intactos o catálogo de produtos, clientes e usuários.
  - **Ação B [Reset Total de Fábrica]:** Limpeza bruta de todas as coleções, preservando unicamente o Dono (João Neto).

---

## 7. Instruções de Instalação e Execução Local

### Pré-requisitos:
- **Node.js:** Versão 18.x ou superior.
- **Gerenciador de Pacotes:** `npm` ou `yarn`.

### Passo a Passo:
```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/paiva-moda-system.git
cd paiva-moda-system

# 2. Instalar dependências
npm install

# 3. Executar o ambiente de desenvolvimento local (Porta 3000)
npm run dev

# 4. Validar tipagem e linting
npm run lint

# 5. Gerar build de produção
npm run build
```

---

## 8. Deploy Contínuo na Vercel

O projeto está 100% configurado para deploy automático na **Vercel**:
- O arquivo `vercel.json` garante o redirecionamento de todas as rotas para o `index.html` (SPA Routing).
- Não há necessidade de variáveis de ambiente secretas no lado do cliente: as credenciais do Firebase Client SDK utilizam regras de segurança ativas no Firestore.
- Para publicar manualmente via CLI da Vercel:
```bash
vercel --prod
```

---

## 9. Licença e Direitos Autorais

© 2026 **Paiva Moda e Cronos Tecnologia**. Todos os direitos reservados.  
Desenvolvido sob padrões de engenharia de software de alta performance para varejo de moda.
