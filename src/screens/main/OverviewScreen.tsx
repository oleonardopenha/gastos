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
import { PieChart, BarChart } from 'react-native-chart-kit';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MonthSelector from '../../components/MonthSelector';
import { Transaction } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtK = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
};

export default function OverviewScreen() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [barLabels, setBarLabels] = useState<string[]>([]);
  const [barValues, setBarValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBar, setLoadingBar] = useState(false);

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

  const fetchBarData = useCallback(async () => {
    setLoadingBar(true);
    const months = Array.from({ length: 6 }, (_, i) => subMonths(selectedMonth, 5 - i));
    const start = format(startOfMonth(months[0]), 'yyyy-MM-dd');
    const end = format(endOfMonth(months[months.length - 1]), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('transactions')
      .select('amount, date')
      .eq('user_id', user?.id)
      .gte('date', start)
      .lte('date', end);

    if (data) {
      const labels: string[] = [];
      const values: number[] = [];
      for (const month of months) {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd');
        const me = format(endOfMonth(month), 'yyyy-MM-dd');
        const total = data
          .filter((t) => t.date >= ms && t.date <= me)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        labels.push(format(month, 'MMM', { locale: ptBR }));
        values.push(total);
      }
      setBarLabels(labels);
      setBarValues(values);
    }
    setLoadingBar(false);
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    fetchTransactions();
    fetchBarData();
  }, [fetchTransactions, fetchBarData]);

  const totalSpending = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryMap: Record<string, { name: string; total: number; color: string }> = {};
  for (const t of transactions) {
    const key = t.category?.name ?? 'Sem categoria';
    if (!categoryMap[key]) {
      categoryMap[key] = { name: key, total: 0, color: t.category?.color ?? '#8B8B9C' };
    }
    categoryMap[key].total += Number(t.amount);
  }

  const pieData = Object.values(categoryMap)
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
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

  const chartWidth = Math.min(SCREEN_WIDTH - 32, 560);
  const hasBarData = barValues.some((v) => v > 0);

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
              width={chartWidth}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0,0,0,${opacity})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="16"
              absolute={false}
            />
          </View>
        )}

        {/* Bar chart: last 6 months */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Evolução Mensal</Text>
          {loadingBar ? (
            <ActivityIndicator color="#6C63FF" style={{ marginVertical: 40 }} />
          ) : hasBarData ? (
            <BarChart
              data={{
                labels: barLabels,
                datasets: [{ data: barValues.map((v) => Math.round(v * 100) / 100) }],
              }}
              width={chartWidth}
              height={180}
              fromZero
              showValuesOnTopOfBars={false}
              withInnerLines={false}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108,99,255,${opacity})`,
                labelColor: () => '#8B8B9C',
                barPercentage: 0.6,
                formatYLabel: fmtK,
              }}
              style={{ marginLeft: -16, borderRadius: 12 }}
              yAxisLabel=""
              yAxisSuffix=""
            />
          ) : (
            <View style={styles.barEmpty}>
              <Text style={styles.emptyText}>Sem dados nos últimos 6 meses</Text>
            </View>
          )}
        </View>

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
    margin: 16, padding: 24, backgroundColor: '#6C63FF',
    borderRadius: 20, alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  totalValue: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  chartCard: {
    marginHorizontal: 16, marginBottom: 16, padding: 16,
    backgroundColor: '#FFFFFF', borderRadius: 20,
  },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  barEmpty: { alignItems: 'center', paddingVertical: 32 },
  empty: { alignItems: 'center', paddingTop: 16 },
  emptyText: { fontSize: 14, color: '#8B8B9C' },
});
