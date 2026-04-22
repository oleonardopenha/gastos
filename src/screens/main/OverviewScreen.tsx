import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MonthSelector from '../../components/MonthSelector';
import { Transaction } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function OverviewScreen() {
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
      .lte('date', end);

    if (data) setTransactions(data);
    setLoading(false);
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalSpending = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryMap: Record<string, { name: string; total: number; color: string }> = {};
  for (const t of transactions) {
    const key = t.category?.name ?? 'Sem categoria';
    if (!categoryMap[key]) {
      categoryMap[key] = { name: key, total: 0, color: t.category?.color ?? '#8B8B9C' };
    }
    categoryMap[key].total += Number(t.amount);
  }

  const pieData = Object.values(categoryMap).map((c) => ({
    name: c.name,
    population: Math.round(c.total * 100) / 100,
    color: c.color,
    legendFontColor: '#1A1A2E',
    legendFontSize: 12,
  }));

  const monthLabel = (() => {
    const raw = format(selectedMonth, 'MMMM yyyy', { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Visão Geral</Text>
      </View>

      <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total em {monthLabel}</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
          ) : (
            <Text style={styles.totalValue}>{fmt(totalSpending)}</Text>
          )}
        </View>

        {!loading && pieData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Gastos por Categoria</Text>
            <PieChart
              data={pieData}
              width={SCREEN_WIDTH - 32}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0,0,0,${opacity})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="16"
              absolute={false}
            />
          </View>
        )}

        {!loading && pieData.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum gasto registrado neste mês</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  content: { paddingBottom: 32 },
  totalCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 20,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  totalValue: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  chartCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { fontSize: 14, color: '#8B8B9C' },
});
