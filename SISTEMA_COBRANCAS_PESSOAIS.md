## 💳 SISTEMA DE COBRANÇAS PESSOAIS — IMPLEMENTAÇÃO COMPLETA

### ✅ O QUE FOI IMPLEMENTADO

#### 1️⃣ **Campos no Model User** (`models/User.js`)
- `settlementDate: DATE` — Data de vencimento da cobrança para PESSOAL
- `settlementPaid: BOOLEAN` — Marca se o pagamento foi realizado (default: false)

#### 2️⃣ **Bloqueio de Acesso** (`middlewares/licenseMiddleware.js`)
- Se usuário PESSOAL tem `settlementDate` expirada e `settlementPaid = false`, painel fica **BLOQUEADO**
- Erro retornado: `PAGAMENTO_VENCIDO`
- Dashboard redireciona para página de acesso expirado

#### 3️⃣ **Controllers de Cobrança** (`controllers/renewalController.js`)
- **`createChargeForPersonal(userId)`** — Admin/Master cria cobrança com data de vencimento
  - Via: `POST /renewal/create-charge/:targetUserId`
  - Payload: `{ settlementDate, message }`
  - Cria RenewalRequest + atualiza settlementDate no User

- **`markChargePaid(requestId)`** — Marca cobrança como paga quando pagamento confirmado
  - Via: `POST /renewal/:id/mark-paid`
  - Marca `RenewalRequest.status = 'approved'` 
  - Marca `User.settlementPaid = true`

#### 4️⃣ **Rotas** (`routes/renewalRoutes.js`)
```
POST /renewal/create-charge/:targetUserId    — Criar cobrança
POST /renewal/:id/mark-paid                  — Marcar como pago
```

#### 5️⃣ **Endpoint auxiliar** (`routes/authRoutes.js`)
```
GET /users/:userId    — Obter dados de um usuário (nome, email, settlementDate, etc)
```

#### 6️⃣ **Interface de Admin** (`dashboard/index.html + dashboard.js`)
- **Nova seção:** 💳 COBRANÇAS PESSOAIS (aba ADMIN)
- **Formulário para criar cobrança:**
  - Dropdown: Selecionar usuário PESSOAL
  - Data picker: Data de vencimento
  - Campo textarea: Observação (opcional)
  - Botão: ➕ COBRAR

- **Tabela de cobranças:**
  - Colunas: Usuário | Data Vencimento | Valor | Observação | Status
  - Status: ✅ PAGO | ⏳ PENDENTE | ⚠ VENCIDO
  - Botão: Marcar como Pago (apenas pendentes)

#### 7️⃣ **Funções JavaScript** (`dashboard/dashboard.js`)
- `loadPersonalUsers()` — Carrega dropdown de personals
- `loadPersonalCharges()` — Carrega tabela de cobranças
- `createPersonalCharge()` — POST para criar cobrança
- `markPersonalChargePaid()` — POST para marcar como pago

---

### 🎯 FLUXO DE USO

#### **Cenário 1: Master/Admin criando cobrança**
1. Acessa painel → Aba ADMIN
2. Scroll para seção 💳 COBRANÇAS PESSOAIS
3. Seleciona usuário PESSOAL no dropdown
4. Define data de vencimento (ex: 2026-03-15)
5. Clica "➕ COBRAR"
6. Sistema cria RenewalRequest + atualiza `User.settlementDate`

#### **Cenário 2: PESSOAL tenta acessar com cobrança vencida**
1. Personal acessa `/dashboard`
2. Middleware `checkLicensePage` valida `settlementDate`
3. Se vencida e `settlementPaid = false`, redireciona para `/license-expired`
4. Painel bloqueado até pagamento

#### **Cenário 3: Master/Admin marca como pago**
1. Após receber pagamento, clica botão "💳 Pago" na tabela
2. Sistema executa `markChargePaid(requestId)`
3. `User.settlementPaid` é marcado como `true`
4. Personal consegue acessar painel novamente

---

### 📊 BANCO DE DADOS (Alterações)

**Tabela `Users` — Novos campos:**

| Campo | Tipo | Null | Default | Descrição |
|-------|------|------|---------|-----------|
| `settlementDate` | DATETIME | YES | - | Data de vencimento/acerto |
| `settlementPaid` | BOOLEAN | NO | false | Pagamento realizado? |

---

### 🔧 COMO TESTAR

1. **Criar novo PESSOAL**
   ```bash
   Aba USUARIOS → Preencher form → Criar novo personal
   ```

2. **Gerar cobrança**
   ```bash
   Aba ADMIN → Seção COBRANÇAS PESSOAIS
   Selecionar personal → Data: 2026-03-05 → ➕ COBRAR
   ```

3. **Verificar bloqueio**
   - Fazer logout
   - Login como aquele PESSOAL
   - Dashboard deve estar bloqueado (se data vencida)

4. **Marcar como pago**
   ```bash
   Aba ADMIN → Seção COBRANÇAS PESSOAIS
   Localizar cobrança → Clique em "💳 Pago"
   Login novamente como PESSOAL → Painel deve abrir
   ```

---

### 💡 DIFERENÇAS: PESSOAL vs REVENDA (MASTER)

| Aspecto | PESSOAL | REVENDA (Master/Admin) |
|--------|---------|----------------------|
| **Expiração** | Data de acerto (`settlementDate`) | Trial 7 dias ou licenseExpiration |
| **Bloqueio** | Se vencido E não pago | Se licença expirada |
| **Cobranças** | Criadas por admin/master | Renovam próprio painel (RenewalRequest) |
| **Admin Dashboard** | NÃO tem acesso | SIM tem acesso |
| **Quem cria cobranças** | Apenas admin/master | -- |
| **Solicita renovação** | NÃO | SIM (RenewalRequest) |

---

### 📝 NOTAS IMPORTANTES

✅ Sistema usa `RenewalRequest` tanto para cobranças de personal quanto para renovações de admin  
✅ Middleware bloqueia imediatamente se data vencida (validação em tempo real)  
✅ Email de aviso pode ser adicionado em `emailService.js` para avisar sobre vencimento próximo  
✅ Histórico de cobranças fica em `RenewalRequest` (pode ser consultado)  
✅ `settlementPaid` = true garante acesso mesmo com data passada  

---

**Salvo em:** `SISTEMA_COBRANCAS_PESSOAIS.md`
