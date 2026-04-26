import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MonthSelector from '../../components/MonthSelector';
import { Transaction } from '../../types';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function StatementScreen() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', user?.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });

    if (data) setTransactions(data);
    setLoading(false);
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const renderItem = ({ item }: { item: Transaction }) => {
    const isSpecial = item.is_recurring || item.total_installments > 1;
    return (
    <View style={[styles.card, isSpecial && styles.cardSpecial]}>
      <View style={[styles.dot, { backgroundColor: item.category?.color ?? '#8B8B9C' }]} />
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.amountRow}>
            {item.is_recurring && (
              <Ionicons name="refresh" size={13} color="#6C63FF" style={{ marginRight: 4 }} />
            )}
            <Text style={styles.amount}>{fmt(Number(item.amount))}</Text>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{item.category?.name ?? 'Sem categoria'}</Text>
          <Text style={styles.sep}>·</Text>
          <Text style={styles.metaText}>{item.wallet?.name ?? 'Sem carteira'}</Text>
          {item.total_installments > 1 && (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={styles.installment}>
                {item.current_installment}/{item.total_installments}x
              </Text>
            </>
          )}
          <Text style={styles.sep}>·</Text>
          <Text style={styles.metaText}>
            {format(new Date(item.date + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
          </Text>
        </View>
      </View>
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Extrato</Text>
      </View>

      <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6C63FF" />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#8B8B9C" />
              <Text style={styles.emptyText}>Nenhuma transação neste mês</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardSpecial: {
    backgroundColor: '#F0FFF0',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 5 },
  info: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', flex: 1, marginRight: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amount: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#8B8B9C' },
  sep: { fontSize: 12, color: '#8B8B9C', marginHorizontal: 4 },
  installment: { fontSize: 12, color: '#6C63FF', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#8B8B9C' },
});
