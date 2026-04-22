import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MonthSelector from '../../components/MonthSelector';
import { Wallet, Transaction } from '../../types';

type ViewMode = 'competencia' | 'caixa';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function WalletsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('competencia');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = format(subMonths(startOfMonth(selectedMonth), 1), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

    const [walletsRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user?.id).order('created_at'),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', start)
        .lte('date', end),
    ]);

    if (walletsRes.data) setWallets(walletsRes.data);
    if (txRes.data) setTransactions(txRes.data);
    setLoading(false);
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return navigation.addListener('focus', () => fetchData());
  }, [navigation, fetchData]);

  const walletTotal = (wallet: Wallet): number => {
    if (viewMode === 'competencia') {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      return transactions
        .filter((t) => {
          if (t.wallet_id !== wallet.id) return false;
          const d = new Date(t.date + 'T00:00:00');
          return d >= start && d <= end;
        })
        .reduce((s, t) => s + Number(t.amount), 0);
    }

    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    const sd = wallet.cash_flow_start_day ?? 1;
    const ed = wallet.cash_flow_end_day ?? 31;

    let start: Date, end: Date;
    if (sd <= ed) {
      start = new Date(y, m, sd);
      end = new Date(y, m, ed);
    } else {
      start = new Date(y, m - 1, sd);
      end = new Date(y, m, ed);
    }

    return transactions
      .filter((t) => {
        if (t.wallet_id !== wallet.id) return false;
        const d = new Date(t.date + 'T00:00:00');
        return d >= start && d <= end;
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Carteiras</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddWallet')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      <View style={styles.tabs}>
        {(['competencia', 'caixa'] as ViewMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.tab, viewMode === m && styles.tabActive]}
            onPress={() => setViewMode(m)}
          >
            <Text style={[styles.tabText, viewMode === m && styles.tabTextActive]}>
              {m === 'competencia' ? 'Competência' : 'Caixa'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6C63FF" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {wallets.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={48} color="#8B8B9C" />
              <Text style={styles.emptyText}>Nenhuma carteira cadastrada</Text>
              <Text style={styles.emptyHint}>Toque no + para adicionar</Text>
            </View>
          ) : (
            wallets.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={styles.card}
                onPress={() => navigation.navigate('EditWallet', { wallet })}
              >
                <View style={[styles.iconWrap, { backgroundColor: wallet.color + '25' }]}>
                  <Ionicons name={wallet.icon as any} size={24} color={wallet.color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{wallet.name}</Text>
                  {viewMode === 'caixa' && (
                    <Text style={styles.cardCycle}>
                      Ciclo: dia {wallet.cash_flow_start_day} ao {wallet.cash_flow_end_day}
                    </Text>
                  )}
                </View>
                <Text style={[styles.cardTotal, { color: wallet.color }]}>
                  {fmt(walletTotal(wallet))}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F0F0F5',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#8B8B9C' },
  tabTextActive: { color: '#1A1A2E', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  cardCycle: { fontSize: 12, color: '#8B8B9C', marginTop: 2 },
  cardTotal: { fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '500', color: '#8B8B9C' },
  emptyHint: { fontSize: 13, color: '#8B8B9C' },
});
