# Gastos Pessoais — Documentação de Desenvolvimento

## Visão Geral

App mobile de controle de gastos pessoais para Android, desenvolvido em React Native + Expo.
Dados armazenados no Supabase (PostgreSQL na nuvem) com autenticação por e-mail e senha.
Uso pessoal — um único usuário.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Mobile | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (e-mail + senha) |
| Navegação | React Navigation 6 (Bottom Tabs + Native Stack) |
| Gráficos | react-native-chart-kit + react-native-svg |
| Datas | date-fns v3 (locale ptBR) |
| Exportação | expo-file-system + expo-sharing (CSV) |

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
├── app.json                         # Config Expo (nome, slug, android package)
├── package.json                     # Expo SDK 54, react 18.3.1, react-native 0.76.5
├── tsconfig.json
├── babel.config.js
├── supabase_setup.sql               # SQL para criar tabelas no Supabase
└── src/
    ├── lib/
    │   └── supabase.ts              # Cliente Supabase com AsyncStorage
    ├── types/
    │   └── index.ts                 # Interfaces: Wallet, Category, Transaction, WalletsStackParamList
    ├── context/
    │   └── AuthContext.tsx          # signIn, signUp, signOut, session, user, loading
    ├── navigation/
    │   ├── index.tsx                # Root navigator (Login vs MainTabs)
    │   └── WalletsNavigator.tsx     # Stack: WalletsList → AddWallet / EditWallet
    ├── components/
    │   └── MonthSelector.tsx        # ScrollView horizontal de meses (18 meses para trás)
    └── screens/
        ├── auth/
        │   └── LoginScreen.tsx      # Login + Cadastro (toggle entre modos)
        ├── main/
        │   ├── OverviewScreen.tsx   # Visão geral: total do mês + pizza por categoria
        │   ├── WalletsScreen.tsx    # Carteiras: tabs competência/caixa + totais
        │   ├── StatementScreen.tsx  # Extrato: lista de transações do mês
        │   ├── AddTransactionScreen.tsx  # Inserir gasto: parcelamento + recorrência
        │   └── ExportScreen.tsx     # Exportar CSV por período e/ou carteira
        └── wallets/
            ├── AddWalletScreen.tsx  # Cadastro: nome + cor + ícone + ciclo caixa
            └── EditWalletScreen.tsx # Edição + exclusão com dupla confirmação
```

---

## Navegação

```
Root Stack
├── Login (se sem sessão)
└── Main (se autenticado)
    └── Bottom Tabs
        ├── Overview     → OverviewScreen
        ├── Wallets      → WalletsNavigator (Stack)
        │   ├── WalletsList → WalletsScreen
        │   ├── AddWallet   → AddWalletScreen
        │   └── EditWallet  → EditWalletScreen (params: { wallet: Wallet })
        ├── AddTransaction → AddTransactionScreen
        ├── Statement    → StatementScreen
        └── Export       → ExportScreen
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
  - Se `startDay <= endDay`: ciclo dentro do mesmo mês (ex: dia 1 ao 31).
  - Se `startDay > endDay`: ciclo cruza mês (ex: dia 6 do mês anterior ao dia 5 do mês selecionado).

### Parcelamento (AddTransactionScreen)
- Cria N registros no banco, um por mês, cada um com `amount = total / N`.
- Cada registro tem `current_installment` (1 a N) e `total_installments = N`.
- A data de cada parcela é calculada com `addMonths(dataInicial, i - 1)`.
- `is_recurring = false` para parcelados.

### Recorrência (AddTransactionScreen)
- Cria um único registro com `is_recurring = true`.
- `recurrence_end_date` indica até quando se repete.
- Exibido com ícone de seta circular (Ionicons `refresh`) no Extrato.

### Exportação CSV (ExportScreen)
- Separador: `;` (compatível com Excel Brasil).
- Campos: Data, Nome, Valor, Categoria, Carteira, Parcela, Total Parcelas, Recorrente.
- Valores com vírgula decimal (ex: `1.250,00`).
- Compartilhado via `expo-sharing` (abre o menu de compartilhar do Android).

---

## Como Rodar (Desenvolvimento)

**Pré-requisitos no PC:** Node.js LTS, npm, Expo Go no celular Android.
PC e celular na mesma rede Wi-Fi.

```bash
# Na pasta do projeto
npm install --legacy-peer-deps
npx expo start --clear
```

Escanear o QR code com o Expo Go.

**Problemas comuns:**
- `SDK mismatch`: verificar se `"expo": "~54.0.0"` no package.json. Deletar node_modules e reinstalar.
- `PlatformConstants not found`: `"newArchEnabled": true` no app.json. Já removido no projeto atual.
- `PowerShell execution policy`: usar CMD em vez de PowerShell.
- Cache travado: sempre usar `npx expo start --clear`.
- Bundle trava em 91% no Expo Go: problema de rede/firewall entre PC e celular. Alternativa: gerar APK via EAS Build.
- `Failed to download remote update`: celular não consegue se conectar ao servidor Metro. Verificar se PC e celular estão na mesma rede Wi-Fi.

---

## O que Está Implementado

- [x] Autenticação: login e cadastro via Supabase Auth
- [x] Sessão persistida no dispositivo (AsyncStorage)
- [x] Seletor de mês (horizontal, 18 meses)
- [x] Página 1 — Visão Geral: total do mês + gráfico pizza por categoria
- [x] Página 2 — Carteiras: lista com totais, tabs competência/caixa
- [x] Página 2.1 — Adicionar carteira: nome, cor (12 opções), ícone (12 opções), ciclo caixa
- [x] Página 2.2 — Editar carteira: mesmos campos + exclusão com dupla confirmação
- [x] Página 3 — Extrato: lista ordenada por data, com categoria, carteira, parcelas, ícone recorrência
- [x] Página 4 — Inserir gasto: nome, valor, data (DD/MM/AAAA), categoria, carteira, parcelamento, recorrência
- [x] Página 5 — Exportar: CSV por período + filtro por carteira, compartilhamento nativo
- [x] Seed automático de categorias padrão no primeiro uso
- [x] RLS no Supabase (isolamento por usuário)

---

## O que Falta / Próximos Passos

- [ ] **Editar/excluir transações** — no Extrato, ao tocar numa transação abrir opções de editar ou excluir
- [ ] **Gestão de categorias** — tela dedicada para editar nome/cor/ícone e excluir categorias
- [ ] **Filtros no Extrato** — filtrar por carteira e/ou categoria além do mês
- [ ] **Busca no Extrato** — campo de busca por nome da transação
- [ ] **Resumo por carteira no Extrato** — mostrar subtotal por carteira
- [ ] **Validação de datas** — usar um date picker visual em vez de texto livre
- [ ] **Gráfico de barras** — na Visão Geral, evolução de gastos mês a mês
- [ ] **Orçamento por categoria** — definir limite mensal e alertar quando ultrapassar
- [ ] **Notificações** — lembrete para registrar gastos
- [ ] **Geração de APK** — EAS Build configurado, falta rodar com projeto FORA do OneDrive (ver seção "Geração do APK")
- [ ] **Integração bancária** — importar extratos (Open Finance / OFX) — planejado para futuro

---

## Geração do APK

O projeto já tem `eas.json` configurado com perfil `preview` (APK) e `production` (AAB).
A conta Expo é `oleonardopenha` (já configurada em `app.json` como `owner`).

```bash
# Na pasta do projeto (FORA do OneDrive — ver nota abaixo)
npx eas-cli login        # usuário: oleonardopenha
npx eas-cli build -p android --profile preview
```

Aguardar na fila do plano free (~15-30 min). Ao terminar, baixar o APK pelo link do build no expo.dev e instalar no Android.

### IMPORTANTE — Projeto deve estar fora do OneDrive
O projeto em `C:\Users\Leonardo\OneDrive\...` causa erro no EAS Build:
```
tar: src/components: Cannot mkdir: Permission denied
```
**Solução:** copiar o projeto para fora do OneDrive, ex: `C:\Projetos\gastos`, antes de rodar o build.

### Arquivos de configuração do EAS já presentes
- `eas.json` — perfis preview (APK) e production (AAB)
- `.npmrc` — `legacy-peer-deps=true` (necessário para compatibilidade de dependências)
- `app.json` — inclui `"owner": "oleonardopenha"`

---

## Observações de Arquitetura

- Todos os dados são buscados diretamente do Supabase nas telas (sem estado global além do Auth).
- As telas do Extrato, Visão Geral e Carteiras re-buscam dados ao mudar o mês selecionado (`useCallback` + `useEffect`).
- WalletsScreen usa `navigation.addListener('focus')` para atualizar ao voltar de AddWallet/EditWallet.
- AddTransactionScreen usa `useFocusEffect` para recarregar carteiras/categorias ao focar.
- O `MonthSelector` auto-scrolla para o mês selecionado via `scrollRef` com `setTimeout(150ms)`.
