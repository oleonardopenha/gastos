export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  cash_flow_start_day: number;
  cash_flow_end_day: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string | null;
  category_id: string | null;
  name: string;
  amount: number;
  date: string;
  is_recurring: boolean;
  recurrence_end_date: string | null;
  total_installments: number;
  current_installment: number;
  notes: string | null;
  created_at: string;
  wallet?: Wallet;
  category?: Category;
}

export type WalletsStackParamList = {
  WalletsList: undefined;
  AddWallet: undefined;
  EditWallet: { wallet: Wallet };
};

export type StatementStackParamList = {
  StatementList: undefined;
  EditTransaction: { transaction: Transaction };
};

export type CategoriesStackParamList = {
  CategoriesList: undefined;
  EditCategory: { category: Category | null };
};
