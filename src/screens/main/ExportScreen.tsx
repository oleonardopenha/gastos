import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Wallet, Transaction } from '../../types';

export default function ExportScreen() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(subMonths(new Date(), 1)), 'dd/MM/yyyy')
  );
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'dd/MM/yyyy'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user?.id)
      .then(({ data }) => { if (data) setWallets(data); });
  }, [user?.id]);

  const parseDate = (str: string): string | null => {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (!d || !m || !y || y.length !== 4) return null;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const generateCSV = (txs: Transaction[]): string => {
    const header = ['Data', 'Nome', 'Valor', 'Categoria', 'Carteira', 'Parcela', 'Total Parcelas', 'Recorrente'];
    const rows = txs.map((t) => [
      t.date,
      `"${t.name.replace(/"/g, '""')}"`,
      String(t.amount).replace('.', ','),
      `"${t.category?.name ?? ''}"`,
      `"${t.wallet?.name ?? ''}"`,
      t.current_installment,
      t.total_installments,
      t.is_recurring ? 'Sim' : 'Não',
    ]);
    return [header, ...rows].map((r) => r.join(';')).join('\n');
  };

  const handleExport = async () => {
    const isoStart = parseDate(startDate);
    const isoEnd = parseDate(endDate);
    if (!isoStart || !isoEnd) {
      Alert.alert('Atenção', 'Datas inválidas. Use o formato DD/MM/AAAA');
      return;
    }

    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', user?.id)
      .gte('date', isoStart)
      .lte('date', isoEnd)
      .order('date');

    if (selectedWallet) {
      query = query.eq('wallet_id', selectedWallet.id);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error || !data) {
      Alert.alert('Erro', 'Não foi possível buscar os dados');
      return;
    }
    if (data.length === 0) {
      Alert.alert('Aviso', 'Nenhuma transação encontrada no período');
      return;
    }

    const csv = generateCSV(data);
    const filename = `gastos_${isoStart}_${isoEnd}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const FileSystem = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      const uri = (FileSystem.documentDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Exportar gastos' });
      } else {
        Alert.alert('Exportado', `Arquivo: ${filename}`);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exportar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Período</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>De</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="DD/MM/AAAA"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.dateField, { marginLeft: 12 }]}>
            <Text style={styles.dateLabel}>Até</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="DD/MM/AAAA"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Carteira</Text>

        <TouchableOpacity
          style={[styles.walletOpt, !selectedWallet && styles.walletOptActive]}
          onPress={() => setSelectedWallet(null)}
        >
          <Ionicons name="layers-outline" size={20} color={!selectedWallet ? '#6C63FF' : '#8B8B9C'} />
          <Text style={[styles.walletOptText, !selectedWallet && { color: '#6C63FF' }]}>
            Todas as carteiras
          </Text>
          {!selectedWallet && <Ionicons name="checkmark" size={18} color="#6C63FF" />}
        </TouchableOpacity>

        {wallets.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.walletOpt, selectedWallet?.id === w.id && styles.walletOptActive]}
            onPress={() => setSelectedWallet(w)}
          >
            <Ionicons name={w.icon as any} size={20} color={selectedWallet?.id === w.id ? w.color : '#8B8B9C'} />
            <Text style={[styles.walletOptText, selectedWallet?.id === w.id && { color: w.color }]}>
              {w.name}
            </Text>
            {selectedWallet?.id === w.id && <Ionicons name="checkmark" size={18} color={w.color} />}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.exportBtn, loading && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.exportBtnText}>Exportar CSV</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginTop: 16, marginBottom: 12 },
  dateRow: { flexDirection: 'row' },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 12, color: '#8B8B9C', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  walletOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletOptActive: { borderColor: '#6C63FF' },
  walletOptText: { flex: 1, fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  exportBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
