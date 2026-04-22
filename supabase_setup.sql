-- ============================================================
-- GASTOS PESSOAIS - Setup do Banco de Dados
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Tabela de carteiras
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6C63FF',
  icon TEXT NOT NULL DEFAULT 'wallet',
  cash_flow_start_day INTEGER DEFAULT 1,
  cash_flow_end_day INTEGER DEFAULT 31,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios so veem suas proprias carteiras"
  ON wallets FOR ALL
  USING (auth.uid() = user_id);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6C63FF',
  icon TEXT NOT NULL DEFAULT 'tag',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios so veem suas proprias categorias"
  ON categories FOR ALL
  USING (auth.uid() = user_id);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_end_date DATE,
  total_installments INTEGER DEFAULT 1,
  current_installment INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios so veem suas proprias transacoes"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS transactions_category ON transactions(category_id);
