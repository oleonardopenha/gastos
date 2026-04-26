# Gastos Pessoais — Documentação de Desenvolvimento

## Visão Geral

App de controle de gastos pessoais desenvolvido em React Native + Expo.
Dados armazenados no Supabase (PostgreSQL na nuvem) com autenticação por e-mail e senha.
Uso pessoal — um único usuário.

**Plataformas:** Web (browser, desenvolvimento atual) e Android (produção futura via APK).
**Pasta local do projeto:** `C:\Projetos\gastos-clean`
**Branch de desenvolvimento:** `claude/fix-expense-app-DuRrN`

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Mobile/Web | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (e-mail + senha) |
| Navegação | React Navigation 6 (Bottom Tabs + Native Stack) |
| Gráficos | react-native-chart-kit + react-native-svg |
| Datas | date-fns v3 (locale ptBR) |
| Exportação/Import | Blob download (web) / expo-file-system + expo-sharing (Android) |
| Web | react-native-web + react-dom + @expo/metro-runtime |

---

## Credenciais Supabase

```
Project URL: https://unxrdkesolclndmstjbh.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueHJka2Vzb2xjbG5kbXN0amJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDU5MDIsImV4cCI6MjA5MjM4MTkwMn0.-h8AT_PuipSOOt5NuGqViRx7QsXAwI2tcY8KQ_ShAos
```

A anon key é pública por design (segurança controlada por RLS no Supabase).

---

## Banco de Dados (Supabase)

### Tabelas

#### `wallets` — Carteiras
```sql
id                  UUID PRIMARY KEY
user_id             UUID → auth.users
name                TEXT
color               TEXT (hex, ex: '#6C63FF')
icon                TEXT (nome do Ionicons, ex: 'wallet')
cash_flow_start_day INTEGER (dia início ciclo caixa, ex: 6)
cash_flow_end_day   INTEGER (dia fim ciclo caixa, ex: 5)
created_at          TIMESTAMPTZ
```

#### `categories` — Categorias
```sql
id         UUID PRIMARY KEY
user_id    UUID → auth.users
name       TEXT
color      TEXT (hex)
icon       TEXT (nome do Ionicons)
created_at TIMESTAMPTZ
```

#### `transactions` — Transações
```sql
id                   UUID PRIMARY KEY
user_id              UUID → auth.users
wallet_id            UUID → wallets (ON DELETE SET NULL)
category_id          UUID → categories (ON DELETE SET NULL)
name                 TEXT
amount               DECIMAL(10,2)
date                 DATE
is_recurring         BOOLEAN
recurrence_end_date  DATE (nullable)
total_installments   INTEGER (1 = à vista)
current_installment  INTEGER (1 = à vista)
notes                TEXT (nullable)
created_at           TIMESTAMPTZ
```

### Segurança (RLS)
Todas as tabelas têm Row Level Security ativado.
Policy em todas: `auth.uid() = user_id` — usuário só acessa seus próprios dados.

### Categorias padrão (seed automático)
Criadas automaticamente no primeiro acesso à tela "Inserir Gasto":
Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Educação, Outros.

---

## Estrutura de Arquivos

```
/
├── App.tsx                          # Entry point — SafeAreaProvider + AuthProvider + Navigation
├── app.json                         # Config Expo (web + android, bundler metro)
├── package.json                     # Expo SDK 54, react 18.3.1, react-native 0.76.5
├── tsconfig.json
├── babel.config.js
├── supabase_setup.sql               # SQL para criar tabelas no Supabase
└── src/
    ├── lib/
    │   └── supabase.ts              # Cliente Supabase com AsyncStorage
    ├── types/
    │   └── index.ts                 # Interfaces: Wallet, Category, Transaction
    ├── context/
    │   └── AuthContext.tsx          # signIn, signUp, signOut, session, user, loading
    ├── navigation/
    │   ├── index.tsx                # Root navigator (Login vs MainTabs)
    │   └── WalletsNavigator.tsx     # Stack: WalletsList → AddWallet / EditWallet
    ├── components/
    │   ├── MonthSelector.tsx        # ScrollView horizontal de meses (prop maxDate para meses futuros)
    │   ├── NativeDatePicker.tsx     # Re-exporta @react-native-community/datetimepicker (nativo)
    │   └── NativeDatePicker.web.tsx # No-op para web (Metro resolve por plataforma)
    └── screens/
        ├── auth/
        │   └── LoginScreen.tsx
        ├── main/
        │   ├── OverviewScreen.tsx        # Total + pizza por categoria + barras 12 meses
        │   ├── WalletsScreen.tsx         # Carteiras: tabs competência/caixa
        │   ├── StatementScreen.tsx       # Extrato: lista de transações
        │   ├── AddTransactionScreen.tsx  # Inserir gasto
        │   └── ExportScreen.tsx         # Export/Import CSV
        └── wallets/
            ├── AddWalletScreen.tsx
            └── EditWalletScreen.tsx
```

---

## Navegação

```
Root Stack
├── Login (se sem sessão)
└── Main (se autenticado)
    └── Bottom Tabs
        ├── Visão Geral  → OverviewScreen
        ├── Carteiras    → WalletsNavigator (Stack)
        │   ├── WalletsList → WalletsScreen
        │   ├── AddWallet   → AddWalletScreen
        │   └── EditWallet  → EditWalletScreen (params: { wallet: Wallet })
        ├── Inserir      → AddTransactionScreen
        ├── Extrato      → StatementScreen
        └── Imp/Exp      → ExportScreen
```

---

## Paleta de Cores

```
Primary:        #6C63FF  (roxo)
Background:     #F8F9FA  (cinza claro)
Card:           #FFFFFF  (branco)
Text:           #1A1A2E  (quase preto)
Text secondary: #8B8B9C  (cinza)
Surface:        #F0F0F5  (cinza muito claro, botões inativos)
Error/Delete:   #E74C3C  (vermelho)
```

---

## Lógica de Negócio

### Visão Competência vs Caixa (WalletsScreen)
- **Competência:** transações com `date` entre o primeiro e último dia do mês selecionado.
- **Caixa:** usa `cash_flow_start_day` e `cash_flow_end_day` da carteira.
  - Se `startDay <= endDay`: ciclo dentro do mesmo mês.
  - Se `startDay > endDay`: ciclo cruza mês (ex: dia 6 do mês anterior ao dia 5 do atual).

### Parcelamento (AddTransactionScreen)
- Cria N registros no banco, um por mês, cada um com `amount = total / N`.
- Cada registro tem `current_installment` (1 a N) e `total_installments = N`.
- A data de cada parcela é calculada com `addMonths(dataInicial, i - 1)`.
- `is_recurring = false` para parcelados.

### Recorrência (AddTransactionScreen)
- Cria um único registro com `is_recurring = true`.
- `recurrence_end_date` indica até quando se repete.
- Exibido com ícone de seta circular (Ionicons `refresh`) no Extrato.

### MonthSelector — Meses Futuros
- Aceita prop `maxDate?: Date`.
- Quando `maxDate` é fornecido e está além do mês atual, gera botões de mês futuros até essa data.
- Meses futuros aparecem com borda pontilhada verde.
- OverviewScreen calcula `maxDate` buscando a maior data futura entre parcelas e `recurrence_end_date`.

### Exportação CSV (ExportScreen — aba "Exportar")
- Separador: `;` (compatível com Excel Brasil).
- Campos: Data, Nome, Valor, Categoria, Carteira, Parcela, Total Parcelas, Recorrente.
- Web: download via Blob com BOM UTF-8 (`﻿`) para Excel reconhecer acentos.
- Android: compartilhamento via expo-sharing.

### Importação CSV (ExportScreen — aba "Importar")
- Formato esperado: `Data;Nome;Valor;Categoria;Carteira;Parcelas;Recorrente`
- Valor com vírgula decimal (ex: `25,50`).
- Detecção de duplicatas: compara data + nome + valor + categoria + carteira com transações existentes no banco.
- Upload de arquivo: `document.createElement('input')` dinâmico (sem JSX de elemento HTML cru).
- Template para download disponível na própria tela.

### Extrato — Destaque visual
- Transações recorrentes (`is_recurring = true`) ou parceladas (`total_installments > 1`) têm fundo verde sutil (`#F0FFF0`) no card.

---

## Como Rodar (Desenvolvimento)

### Web (atual)
```bash
cd C:\Projetos\gastos-clean
npm install --legacy-peer-deps
npx expo start --web --clear
```

### Android (futuro — via Expo Go)
```bash
npx expo start --clear
# Escanear QR code com Expo Go no celular Android (mesma rede Wi-Fi)
```

**Problemas comuns:**
- Conflito de merge no git: `git fetch origin && git reset --hard origin/claude/fix-expense-app-DuRrN`
- Cache travado: sempre usar `--clear`.
- **NUNCA renderizar elementos HTML crus (`'input'`, `'div'`, etc.) dentro da árvore React Native** — quebra o renderer web silenciosamente. Para file upload web, usar `document.createElement('input')` dinâmico no handler. Para DateTimePicker nativo, usar o wrapper `NativeDatePicker.tsx` + `NativeDatePicker.web.tsx`.

---

## O que Está Implementado

- [x] Autenticação: login e cadastro via Supabase Auth
- [x] Sessão persistida (AsyncStorage)
- [x] Seletor de mês — 18 meses para trás + meses futuros quando há parcelas/recorrências
- [x] **Visão Geral:** total do mês + gráfico pizza por categoria + gráfico de barras roxas (últimos 12 meses, título "Gastos Total por Mês")
- [x] **Carteiras:** lista com totais, tabs competência/caixa
- [x] **Adicionar carteira:** nome, cor, ícone, ciclo caixa
- [x] **Editar carteira:** mesmos campos + exclusão com dupla confirmação
- [x] **Extrato:** lista ordenada por data, categoria, carteira, parcelas, ícone recorrência; fundo verde sutil para parcelados/recorrentes
- [x] **Inserir gasto:** nome, valor, data (DD/MM/AAAA), categoria, carteira, parcelamento, recorrência; calendário nativo no Android
- [x] **Export/Import (aba "Imp/Exp"):**
  - Exportar: CSV por período + filtro por carteira
  - Importar: upload de CSV com detecção de duplicatas; download de planilha modelo
- [x] Suporte web (browser): `react-native-web` + Metro bundler
- [x] Seed automático de categorias padrão no primeiro uso
- [x] RLS no Supabase

---

## O que Falta / Próximos Passos

- [ ] **Editar/excluir transações** — no Extrato, ao tocar numa transação abrir opções de editar ou excluir
- [ ] **Gestão de categorias** — tela dedicada para editar nome/cor/ícone e excluir categorias
- [ ] **Filtros no Extrato** — filtrar por carteira e/ou categoria além do mês
- [ ] **Busca no Extrato** — campo de busca por nome da transação
- [ ] **Resumo por carteira no Extrato** — mostrar subtotal por carteira
- [ ] **Orçamento por categoria** — definir limite mensal e alertar quando ultrapassar
- [ ] **Notificações** — lembrete para registrar gastos
- [ ] **Geração de APK** — build via EAS para instalar direto no Android sem Expo Go
- [ ] **Integração bancária** — importar extratos (Open Finance / OFX) — planejado para futuro

---

## Geração do APK (quando pronto)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

---

## Observações de Arquitetura

- Dados buscados diretamente do Supabase nas telas (sem estado global além do Auth).
- Extrato, Visão Geral e Carteiras re-buscam ao mudar o mês (`useCallback` + `useEffect`).
- WalletsScreen usa `navigation.addListener('focus')` para atualizar ao voltar de AddWallet/EditWallet.
- AddTransactionScreen usa `useFocusEffect` para recarregar carteiras/categorias ao focar.
- MonthSelector auto-scrolla para o mês selecionado via `scrollRef` com `setTimeout(150ms)`.
- BarChart e PieChart da react-native-chart-kit funcionam no web via react-native-svg.
- DateTimePicker nativo isolado em `NativeDatePicker.tsx` / `NativeDatePicker.web.tsx` — Metro resolve o arquivo correto por plataforma automaticamente.
