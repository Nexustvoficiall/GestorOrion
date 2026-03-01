## 🎯 CONFIGURAÇÃO DE MERCADO PAGO E PAGAMENTOS

Seus dados foram perdidos porque o banco SQLite foi resetado. Aqui está como restaurar:

### 1️⃣ **CRIAR UMA NOVA CONTA DE REVENDA**

Acesse: `http://localhost:3000/registro?plano=REVENDA`

Preencha:
- **Nome da Empresa:** Demo Revenda (ou seu nome)
- **Usuário:** admin
- **Senha:** Admin@123456
- **Email:** admin@demo.com

Clique em "COMEÇAR AGORA"

---

### 2️⃣ **FAZER LOGIN NO PAINEL**

Acesse: `http://localhost:3000/dashboard`

Use o usuário/senha que criou acima.

---

### 3️⃣ **CONFIGURAR MERCADO PAGO**

Após fazer login:

1. Clique em **PERFIL** (canto superior direito) 
2. Procure a seção **💳 CONFIGURAÇÃO DE PAGAMENTOS** (está em `tab-admin` → Perfil)
3. Vá na aba **MERCADO PAGO**
4. Siga os passos:
   - Entre em https://www.mercadopago.com.br
   - Vá em **Conta** → **Configurações** → **Credenciais**
   - Copie sua **ACCESS TOKEN DE PRODUÇÃO** (começa com `APP_`)
   - Cole aqui e clique em **✅ SALVAR MERCADO PAGO**

---

### 4️⃣ **ALTERNATIVAMENTE: CONFIGURAR PIX**

Na mesma seção, vá na aba **PIX MANUAL**:

1. Abra seu banco e vá em **PIX** → **MINHAS CHAVES**
2. Copie uma das suas chaves (CPF, CNPJ, email ou aleatória)
3. Cole no campo "SUA CHAVE PIX"
4. Clique em **✅ SALVAR PIX**

---

### 5️⃣ **AGORA VOCÊ PODE:**

- ✅ Colocar clientes na aba **CLIENTES**
- ✅ Gerar cobranças (botão 💳 "Gerar Cobrança" na tabela de clientes)
- ✅ Ver MRR e receitas (aba **FINANCEIRO**)
- ✅ Se for master, ver analytics em `http://localhost:3000/master/revenue`

---

## 📌 ONDE ESTÁ TUDO

| Funcionalidade | Local |
|---|---|
| 🔐 Configurar Mercado Pago | PERFIL → CONFIGURAÇÃO DE PAGAMENTOS → MERCADO PAGO |
| 💰 Configurar PIX | PERFIL → CONFIGURAÇÃO DE PAGAMENTOS → PIX MANUAL |
| 💳 Colocar Clientes | CLIENTES → NOVO CLIENTE |
| 📊 Gerar Cobrança | CLIENTES → botão 💳 (ações) |
| 📈 Ver Receitas | FINANCEIRO |
| 👑 Master Analytics | Acesso Master → `/master/revenue` |

---

## ✅ CHECKLIST DE TESTES

- [ ] Criar nova conta REVENDA
- [ ] Fazer login na conta
- [ ] Configurar API do Mercado Pago (ou PIX)
- [ ] Criar um cliente de teste
- [ ] Gerar cobrança para o cliente
- [ ] Verificar dados salvos (recarregar página → dados devem permanecer)

---

**Salvo em:** `DATABASE_SETUP.md`
