import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MonthSelector from '../../components/MonthSelector';
import { Transaction, Wallet, Category, StatementStackParamList } from '../../types';

type NavProp = NativeStackNavigationProp<StatementStackParamList, 'StatementList'>;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function StatementScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterWalletId, setFilterWalletId] = useState<string | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Action sheet
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

    const [txRes, walletsRes, catsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), wallet:wallets(*)')
        .eq('user_id', user?.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('wallets').select('*').eq('user_id', user?.id).order('created_at'),
      supabase.from('categories').select('*').eq('user_id', user?.id).order('name'),
    ]);

    if (txRes.data) setTransactions(txRes.data);
    if (walletsRes.data) setWallets(walletsRes.data);
    if (catsRes.data) setCategories(catsRes.data);
    setLoading(false);
  }, [selectedMonth, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (filterWalletId) list = list.filter((t) => t.wallet_id === filterWalletId);
    if (filterCategoryId) list = list.filter((t) => t.category_id === filterCategoryId);
    return list;
  }, [transactions, search, filterWalletId, filterCategoryId]);

  const walletSummary = useMemo(() => {
    const map: Record<string, { name: string; total: number; color: string }> = {};
    for (const t of filtered) {
      const key = t.wallet_id ?? '__none__';
      const name = t.wallet?.name ?? 'Sem carteira';
      const color = t.wallet?.color ?? '#8B8B9C';
      if (!map[key]) map[key] = { name, total: 0, color };
      map[key].total += Number(t.amount);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalFiltered = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const activeFilters = (filterWalletId ? 1 : 0) + (filterCategoryId ? 1 : 0);

  const handleTxPress = (tx: Transaction) => {
    setSelectedTx(tx);
    setShowActionSheet(true);
  };

  const handleEdit = () => {
    setShowActionSheet(false);
    if (selectedTx) navigation.navigate('EditTransaction', { transaction: selectedTx });
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleTxPress(item)} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: item.category?.color ?? '#8B8B9C' }]} />
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
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
              <Text style={styles.installment}>{item.current_installment}/{item.total_installments}x</Text>
            </>
          )}
          <Text style={styles.sep}>·</Text>
          <Text style={styles.metaText}>
            {format(new Date(item.date + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#E5E5EA" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Extrato</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={22} color={activeFilters > 0 ? '#6C63FF' : '#8B8B9C'} />
          {activeFilters > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilters}</Text></View>}
        </TouchableOpacity>
      </View>

      <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#8B8B9C" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar transação..."
          placeholderTextColor="#8B8B9C"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#8B8B9C" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Carteira</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity
              style={[styles.chip, !filterWalletId && styles.chipActive]}
              onPress={() => setFilterWalletId(null)}
            >
              <Text style={[styles.chipText, !filterWalletId && styles.chipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {wallets.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={[styles.chip, filterWalletId === w.id && styles.chipActive, filterWalletId === w.id && { borderColor: w.color }]}
                onPress={() => setFilterWalletId(filterWalletId === w.id ? null : w.id)}
              >
                <Ionicons name={w.icon as any} size={13} color={filterWalletId === w.id ? w.color : '#8B8B9C'} style={{ marginRight: 4 }} />
                <Text style={[styles.chipText, filterWalletId === w.id && { color: w.color }]}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterLabel, { marginTop: 8 }]}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity
              style={[styles.chip, !filterCategoryId && styles.chipActive]}
              onPress={() => setFilterCategoryId(null)}
            >
              <Text style={[styles.chipText, !filterCategoryId && styles.chipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, filterCategoryId === c.id && styles.chipActive, filterCategoryId === c.id && { borderColor: c.color }]}
                onPress={() => setFilterCategoryId(filterCategoryId === c.id ? null : c.id)}
              >
                <View style={[styles.chipDot, { backgroundColor: c.color }]} />
                <Text style={[styles.chipText, filterCategoryId === c.id && { color: c.color }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Wallet summary */}
      {filtered.length > 0 && walletSummary.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{fmt(totalFiltered)}</Text>
          </View>
          {walletSummary.map((ws, i) => (
            <View key={i} style={[styles.summaryCard, { borderLeftColor: ws.color, borderLeftWidth: 3 }]}>
              <Text style={styles.summaryLabel} numberOfLines={1}>{ws.name}</Text>
              <Text style={[styles.summaryValue, { color: ws.color }]}>{fmt(ws.total)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {filtered.length > 0 && walletSummary.length === 1 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total: </Text>
          <Text style={styles.totalValue}>{fmt(totalFiltered)}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6C63FF" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#8B8B9C" />
              <Text style={styles.emptyText}>
                {search || activeFilters > 0 ? 'Nenhuma transação encontrada' : 'Nenhuma transação neste mês'}
              </Text>
            </View>
          }
        />
      )}

      {/* Action sheet */}
      <Modal visible={showActionSheet} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{selectedTx?.name}</Text>
            <Text style={styles.sheetSubtitle}>
              {selectedTx ? fmt(Number(selectedTx.amount)) : ''} ·{' '}
              {selectedTx ? format(new Date(selectedTx.date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR }) : ''}
            </Text>

            <TouchableOpacity style={styles.sheetAction} onPress={handleEdit}>
              <Ionicons name="create-outline" size={22} color="#6C63FF" />
              <Text style={styles.sheetActionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                setShowActionSheet(false);
                setTimeout(() => {
                  if (!selectedTx) return;
                  const { Alert: RNAlert } = require('react-native');
                  RNAlert.alert(
                    'Excluir Transação',
                    `Deseja excluir "${selectedTx.name}"?`,
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: async () => {
                          await supabase.from('transactions').delete().eq('id', selectedTx.id);
                          fetchData();
                        },
                      },
                    ]
                  );
                }, 300);
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#E74C3C" />
              <Text style={[styles.sheetActionText, { color: '#E74C3C' }]}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetAction, styles.sheetCancel]} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  filterBtn: { padding: 4, position: 'relative' },
  filterBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#6C63FF', borderRadius: 8, width: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    marginHorizontal: 16, marginVertical: 8,
    paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E5EA',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E', paddingVertical: 11 },
  clearBtn: { padding: 4 },

  filterPanel: { paddingHorizontal: 16, paddingBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#8B8B9C', marginBottom: 6 },
  chipScroll: { flexGrow: 0 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA',
    marginRight: 8,
  },
  chipActive: { borderColor: '#6C63FF' },
  chipText: { fontSize: 13, color: '#8B8B9C' },
  chipTextActive: { color: '#6C63FF', fontWeight: '600' },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },

  summaryScroll: { flexGrow: 0 },
  summaryContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, minWidth: 110,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  summaryLabel: { fontSize: 11, color: '#8B8B9C', marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },

  totalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  totalLabel: { fontSize: 13, color: '#8B8B9C' },
  totalValue: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 2, flexShrink: 0 },
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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: '#8B8B9C', marginBottom: 20 },
  sheetAction: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  sheetActionText: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  sheetCancel: { borderBottomWidth: 0, justifyContent: 'center', marginTop: 8 },
  sheetCancelText: { fontSize: 16, color: '#8B8B9C', textAlign: 'center' },
});
