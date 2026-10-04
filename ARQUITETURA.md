# Dossiê de Arquitetura e Engenharia de Software — Paiva Moda

Este documento descreve detalhadamente os padrões arquiteturais, o fluxo de dados, a máquina de estados contábil e a camada de resiliência implementados no sistema **Paiva Moda**.

---

## 1. Visão Arquitetural

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|  React 18 + TypeScript + Vite                                                     |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |     Frente PDV     |   |   Retaguarda / DRE    |   |  Pré-Venda Mobile       |  |
|  |    (POS.tsx)       |   |    (Reports.tsx)      |   |   (Atendimento Salão)  |  |
|  +---------+----------+   +-----------+-----------+   +-----------+------------+  |
|            |                          |                           |               |
|            +--------------------------+---------------------------+               |
|                                       |                                           |
|                           +-----------v-----------+                               |
|                           |      App.tsx          |                               |
|                           |  (State Coordinator)  |                               |
|                           +-----------+-----------+                               |
+---------------------------------------|-------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                           INFRASTRUCTURE LAYER (database.ts)                      |
|                                                                                   |
|   +-----------------------+     +-----------------------+   +------------------+  |
|   |   Sanitizer Engine    |     |    Batch Partitioner  |   | Manaus Timezone  |  |
|   | (anti-undefined pipe) |     |  (400 ops per chunk)  |   |   (America/Manaus)| |
|   +-----------------------+     +-----------------------+   +------------------+  |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       Resilient Cache Manager                             |   |
|   |       Optimistic UI Invalidation (0ms) + LocalStorage Fallback            |   |
|   +---------------------------------------------------------------------------+   |
+---------------------------------------|-------------------------------------------+
                                        |
                     +------------------+------------------+
                     | (HTTPS / WSS)                       | (Local Contingency)
                     v                                     v
+------------------------------------+   +------------------------------------------+
|       GOOGLE CLOUD FIRESTORE       |   |       BROWSER PERSISTENCE ENGINE         |
|                                    |   |                                          |
| - products        - customers      |   | - paiva_moda_cache_* (Coleções)          |
| - promotions      - credit_bills   |   | - paiva_session_v1 (15h User Auth)       |
| - pre_sales       - financials     |   | - paiva_moda_system_backup_snapshot      |
| - sales           - users          |   |                                          |
| - movements       - settings       |   |                                          |
+------------------------------------+   +------------------------------------------+
```

---

## 2. Camada de Persistência e Sincronização em Tempo Real

### 2.1 Padrão Listener Unificado (`db.listen`)
Cada uma das 10 coleções oficiais do Firestore é escutada via `onSnapshot`. Para evitar re-renderizações desnecessárias e vazamentos de memória:
- As assinaturas são gerenciadas dentro de um único `useEffect` no componente raiz `App.tsx`.
- Ao desmontar a aplicação, todas as funções `Unsubscribe` são executadas.
- Qualquer erro transitório de conexão comuta automaticamente para o cache local sem bloquear a interface do usuário nem apresentar telas em branco.

### 2.2 Sanitização Recursiva (`sanitizeForFirestore`)
O Cloud Firestore rejeita escritas contendo chaves com valor `undefined`. Para assegurar a integridade:
- Todo objeto que entra no método `db.save()` passa pelo sanitizador recursivo.
- Campos com valor `undefined` são convertidos para `null` (ou string vazia no caso específico de CPF).
- Objetos aninhados e arrays são limpos recursivamente em profundidade.

### 2.3 Particionamento de Lotes (`writeBatch`)
A API do Firestore impõe o limite rígido de **500 operações por lote**. Quando operações de grande escala ocorrem (ex: Zerar Vendas ou Importar Backup de 2.000 itens):
- O método `clearFirestoreCollection` fatia o conjunto de documentos em blocos de **400 itens**.
- Cada bloco é commitado atomicamente de forma sequencial.
- Evita o erro `FirebaseError: Value for argument "document" exceeds maximum batch limit of 500`.

---

## 3. Máquina de Estados Contábil do PDV

```
                                 [Nova Venda no PDV]
                                          |
                                          v
                      Qual a forma de pagamento selecionada?
                     /                    |                 \
                    /                     |                  \
  [PIX / DINHEIRO / DÉBITO / CRÉDITO]     |           [CREDIÁRIO DA LOJA]
                   |                      |                    |
                   v                      |                    v
    Status: 'COMPLETED' imediato          |      Status: 'PENDING' inicial
    Categoria: 'SALES'                    |      Categoria: 'ACCOUNTS_RECEIVABLE'
    Entra no Caixa Vivo do dia            |      Gera parcelas em 'credit_bills'
                                          |      Debita do limite do cliente
                                          |                    |
                                          |                    v
                                          |      [Baixa no Balcão em CreditManager]
                                          |                    |
                                          |                    v
                                          |      Gera entrada 'INCOME' COMPLETED
                                          |      no dia do pagamento efetivo
                                          v
                                 [CREDIÁRIO BEMOL]
                                          |
                                          v
                               Status: 'PENDING'
                               Previsão: 25 dias corridos
                               Taxa administrativa: -3% retida
                               Liquidação automática programada
```

---

## 4. Controle de Acesso Baseado em Perfis (RBAC)

O sistema implementa 4 níveis de permissão em `users`:

| Papel (`role`) | Permissões |
| :--- | :--- |
| **`OWNER`** (Dono João Neto) | Acesso irrestrito a todas as telas, DRE financeiro, edição de equipe, comissões e Zona de Perigo de reset. |
| **`MANAGER`** (Gerente) | Acesso ao PDV, estoque, clientes, financeiro e cancelamento de vendas com senha gerencial. |
| **`ADMIN`** (Administrador) | Gestão de cadastros, catálogo de produtos, promoções e auditoria de vendas. |
| **`SELLER`** (Vendedor / Balcão) | Frente de Caixa (PDV), emissão de pré-vendas e consulta simplificada de produtos/clientes. |

---

## 5. Sessão Persistente de Longa Duração

Para evitar que vendedoras e operadores percam o foco durante o horário comercial:
- A autenticação gera um token de sessão com vigência de **15 horas** armazenado sob `'paiva_session_v1'` no `localStorage`.
- No ciclo de montagem de `App.tsx`, o sistema verifica a assinatura temporal (`expiresAt > Date.now()`) e restaura a identidade instantaneamente.
- O listener da coleção `users` foi desacoplado para não interferir na sessão ativa mesmo que a lista de usuários sofra alterações por outro terminal.
