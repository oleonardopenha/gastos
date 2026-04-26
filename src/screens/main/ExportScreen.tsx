import React, { useState, useEffect, useRef } from 'react';
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

const WebFileInput = Platform.OS === 'web' ? ('input' as any) : null;

const CSV_HEADER = 'Data;Nome;Valor;Categoria;Carteira;Parcelas;Recorrente';
const CSV_EXAMPLE =
  '22/04/2026;Exemplo - Almoço;25,50;Alimentação;Minha Carteira;1;Não\n' +
  '23/04/2026;Exemplo - Uber;15,00;Transporte;Carteira Principal;1;Não';

export default function ExportScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(subMonths(new Date(), 1)), 'dd/MM/yyyy')
  );
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'dd/MM/yyyy'));
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; duplicates: number; errors: number } | null>(null);
  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user?.id)
      .then(({ data }) => { if (data) setWallets(data); });
  }, [user?.id]);

  const parseDate = (str: string): string | null => {
    const parts = str.trim().split('/');
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

  const downloadCSV = (content: string, filename: string) => {
    if (Platform.OS === 'web') {
      const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
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

    if (selectedWallet) query = query.eq('wallet_id', selectedWallet.id);

    const { data, error } = await query;
    setLoading(false);

    if (error || !data) { Alert.alert('Erro', 'Não foi possível buscar os dados'); return; }
    if (data.length === 0) { Alert.alert('Aviso', 'Nenhuma transação encontrada no período'); return; }

    const csv = generateCSV(data);
    const filename = `gastos_${isoStart}_${isoEnd}.csv`;

    if (Platform.OS === 'web') {
      downloadCSV(csv, filename);
    } else {
      const FileSystem = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      const uri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Exportar gastos' });
      } else {
        Alert.alert('Exportado', `Arquivo: ${filename}`);
      }
    }
  };

  const handleDownloadTemplate = () => {
    downloadCSV(`${CSV_HEADER}\n${CSV_EXAMPLE}`, 'modelo_importacao.csv');
  };

  const handleImportCSV = async (csvText: string) => {
    setImportResult(null);
    const lines = csvText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim());

    if (lines.length < 2) { Alert.alert('Erro', 'Arquivo inválido ou sem dados'); return; }

    setLoading(true);

    const [{ data: cats }, { data: walls }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('user_id', user?.id),
      supabase.from('wallets').select('id, name').eq('user_id', user?.id),
    ]);

    const rows = lines.slice(1);

    // Parse rows to get date range for duplicate check
    const isoDates = rows
      .map((r) => parseDate(r.split(';')[0] ?? ''))
      .filter(Boolean) as string[];

    const { data: existingTxns } = isoDates.length > 0
      ? await supabase
          .from('transactions')
          .select('date, name, amount, category:categories(name), wallet:wallets(name)')
          .eq('user_id', user?.id)
          .gte('date', [...isoDates].sort()[0])
          .lte('date', [...isoDates].sort().reverse()[0])
      : { data: [] };

    let inserted = 0;
    let duplicates = 0;
    let errors = 0;
    const toInsert: any[] = [];

    for (const row of rows) {
      const cols = row.split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
      const [dateStr, nome, valorStr, catName, walletName, parcelasStr, recorrenteStr] = cols;

      if (!dateStr || !nome || !valorStr) { errors++; continue; }

      const isoDate = parseDate(dateStr);
      if (!isoDate) { errors++; continue; }

      const amount = parseFloat((valorStr ?? '').replace(',', '.'));
      if (isNaN(amount) || amount <= 0) { errors++; continue; }

      const cat = cats?.find((c) => c.name.toLowerCase() === (catName ?? '').toLowerCase());
      const wall = walls?.find((w) => w.name.toLowerCase() === (walletName ?? '').toLowerCase());

      const isDup = existingTxns?.some(
        (t: any) =>
          t.date === isoDate &&
          t.name.toLowerCase() === nome.toLowerCase() &&
          Math.abs(Number(t.amount) - amount) < 0.005 &&
          (t.category?.name ?? '').toLowerCase() === (catName ?? '').toLowerCase() &&
          (t.wallet?.name ?? '').toLowerCase() === (walletName ?? '').toLowerCase()
      );

      if (isDup) { duplicates++; continue; }

      toInsert.push({
        user_id: user?.id,
        category_id: cat?.id ?? null,
        wallet_id: wall?.id ?? null,
        name: nome,
        amount,
        date: isoDate,
        is_recurring: (recorrenteStr ?? '').toLowerCase() === 'sim',
        total_installments: Math.max(1, parseInt(parcelasStr ?? '1') || 1),
        current_installment: 1,
      });
      inserted++;
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('transactions').insert(toInsert);
      if (error) {
        setLoading(false);
        Alert.alert('Erro', 'Falha ao inserir transações');
        return;
      }
    }

    setLoading(false);
    setImportResult({ inserted, duplicates, errors });
  };

  const handleFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleImportCSV(ev.target?.result as string);
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Export / Import</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'export' && styles.toggleBtnActive]}
          onPress={() => setMode('export')}
        >
          <Ionicons name="download-outline" size={16} color={mode === 'export' ? '#6C63FF' : '#8B8B9C'} />
          <Text style={[styles.toggleBtnText, mode === 'export' && styles.toggleBtnTextActive]}>Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'import' && styles.toggleBtnActive]}
          onPress={() => setMode('import')}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={mode === 'import' ? '#6C63FF' : '#8B8B9C'} />
          <Text style={[styles.toggleBtnText, mode === 'import' && styles.toggleBtnTextActive]}>Importar</Text>
        </TouchableOpacity>
      </View>

      {mode === 'export' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Período</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>De</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={[styles.dateField, { marginLeft: 12 }]}>
              <Text style={styles.dateLabel}>Até</Text>
              <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Carteira</Text>
          <TouchableOpacity style={[styles.walletOpt, !selectedWallet && styles.walletOptActive]} onPress={() => setSelectedWallet(null)}>
            <Ionicons name="layers-outline" size={20} color={!selectedWallet ? '#6C63FF' : '#8B8B9C'} />
            <Text style={[styles.walletOptText, !selectedWallet && { color: '#6C63FF' }]}>Todas as carteiras</Text>
            {!selectedWallet && <Ionicons name="checkmark" size={18} color="#6C63FF" />}
          </TouchableOpacity>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.walletOpt, selectedWallet?.id === w.id && styles.walletOptActive]}
              onPress={() => setSelectedWallet(w)}
            >
              <Ionicons name={w.icon as any} size={20} color={selectedWallet?.id === w.id ? w.color : '#8B8B9C'} />
              <Text style={[styles.walletOptText, selectedWallet?.id === w.id && { color: w.color }]}>{w.name}</Text>
              {selectedWallet?.id === w.id && <Ionicons name="checkmark" size={18} color={w.color} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={[styles.actionBtn, loading && styles.actionBtnDisabled]} onPress={handleExport} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Exportar CSV</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color="#6C63FF" />
            <Text style={styles.infoText}>
              Baixe a planilha modelo, preencha no Excel e importe. Duplicatas (mesma data, nome, valor, categoria e carteira) são ignoradas automaticamente.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Planilha Modelo</Text>
          <TouchableOpacity style={styles.templateBtn} onPress={handleDownloadTemplate}>
            <Ionicons name="document-text-outline" size={20} color="#6C63FF" />
            <Text style={styles.templateBtnText}>Baixar modelo_importacao.csv</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Importar CSV</Text>
          <Text style={styles.formatHint}>
            Formato esperado:{'\n'}
            <Text style={styles.formatCode}>Data;Nome;Valor;Categoria;Carteira;Parcelas;Recorrente</Text>{'\n'}
            Separador: ponto e vírgula · Valor: vírgula decimal (ex: 25,50)
          </Text>

          {Platform.OS === 'web' && (
            <>
              {/* Hidden file input */}
              <WebFileInput
                type="file"
                accept=".csv"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <TouchableOpacity
                style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                onPress={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Selecionar arquivo .csv</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {importResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Resultado da Importação</Text>
              <View style={styles.resultRow}>
                <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                <Text style={styles.resultText}>{importResult.inserted} transação(ões) importada(s)</Text>
              </View>
              {importResult.duplicates > 0 && (
                <View style={styles.resultRow}>
                  <Ionicons name="remove-circle" size={18} color="#F39C12" />
                  <Text style={styles.resultText}>{importResult.duplicates} duplicata(s) ignorada(s)</Text>
                </View>
              )}
              {importResult.errors > 0 && (
                <View style={styles.resultRow}>
                  <Ionicons name="close-circle" size={18} color="#E74C3C" />
                  <Text style={styles.resultText}>{importResult.errors} linha(s) com erro ignorada(s)</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F0F0F5',
    borderRadius: 14,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: '#FFFFFF' },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: '#8B8B9C' },
  toggleBtnTextActive: { color: '#6C63FF' },
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
  actionBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: '#1A1A2E', lineHeight: 19 },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  templateBtnText: { fontSize: 15, color: '#6C63FF', fontWeight: '600' },
  formatHint: { fontSize: 13, color: '#8B8B9C', lineHeight: 20, marginBottom: 4 },
  formatCode: { fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace', color: '#1A1A2E' },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultText: { fontSize: 14, color: '#1A1A2E' },
});
