import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Category, Wallet, StatementStackParamList } from '../../types';
import DatePickerInput from '../../components/DatePickerInput';

type Props = NativeStackScreenProps<StatementStackParamList, 'EditTransaction'>;

const isoToDisplay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const parseDate = (str: string): string | null => {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

export default function EditTransactionScreen({ route, navigation }: Props) {
  const { transaction } = route.params;
  const { user } = useAuth();

  const [name, setName] = useState(transaction.name);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(isoToDisplay(transaction.date));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(transaction.category ?? null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(transaction.wallet ?? null);
  const [isRecurring, setIsRecurring] = useState(transaction.is_recurring);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    transaction.recurrence_end_date ? isoToDisplay(transaction.recurrence_end_date) : ''
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const fetchData = useCallback(async () => {
    const [catsRes, walletsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user?.id).order('name'),
      supabase.from('wallets').select('*').eq('user_id', user?.id).order('created_at'),
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (walletsRes.data) setWallets(walletsRes.data);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Digite o nome do gasto');
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Atenção', 'Digite um valor válido');
    const isoDate = parseDate(date);
    if (!isoDate) return Alert.alert('Atenção', 'Data inválida. Use DD/MM/AAAA');

    setLoading(true);
    const isoEnd = recurrenceEndDate ? parseDate(recurrenceEndDate) : null;
    const { error } = await supabase
      .from('transactions')
      .update({
        name: name.trim(),
        amount: parsedAmount,
        date: isoDate,
        wallet_id: selectedWallet?.id ?? null,
        category_id: selectedCategory?.id ?? null,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring ? isoEnd : null,
      })
      .eq('id', transaction.id);
    setLoading(false);

    if (error) Alert.alert('Erro', 'Não foi possível salvar');
    else navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Transação',
      `Deseja excluir "${transaction.name}"?${transaction.total_installments > 1 ? '\n\nApenas esta parcela será removida.' : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);
            setLoading(false);
            if (error) Alert.alert('Erro', 'Não foi possível excluir');
            else navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Gasto</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {transaction.total_installments > 1 && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#6C63FF" />
            <Text style={styles.infoBannerText}>
              Parcela {transaction.current_installment}/{transaction.total_installments} — editando apenas esta parcela
            </Text>
          </View>
        )}

        <Text style={styles.label}>Nome do gasto</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Valor (R$)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Data</Text>
        <DatePickerInput value={date} onChange={setDate} />

        <Text style={styles.label}>Categoria</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowCatModal(true)}>
          {selectedCategory ? (
            <View style={styles.selectorInner}>
              <View style={[styles.dot, { backgroundColor: selectedCategory.color }]} />
              <Text style={styles.selectorText}>{selectedCategory.name}</Text>
            </View>
          ) : (
            <Text style={styles.selectorPlaceholder}>Selecionar categoria</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color="#8B8B9C" />
        </TouchableOpacity>

        <Text style={styles.label}>Carteira</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowWalletModal(true)}>
          {selectedWallet ? (
            <View style={styles.selectorInner}>
              <Ionicons name={selectedWallet.icon as any} size={18} color={selectedWallet.color} />
              <Text style={[styles.selectorText, { marginLeft: 8 }]}>{selectedWallet.name}</Text>
            </View>
          ) : (
            <Text style={styles.selectorPlaceholder}>Selecionar carteira</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color="#8B8B9C" />
        </TouchableOpacity>

        {transaction.total_installments <= 1 && (
          <TouchableOpacity style={styles.toggle} onPress={() => setIsRecurring(!isRecurring)}>
            <View style={styles.toggleLeft}>
              <Ionicons name="refresh-outline" size={20} color="#6C63FF" />
              <Text style={styles.toggleLabel}>Recorrente</Text>
            </View>
            <View style={[styles.track, isRecurring && styles.trackOn]}>
              <View style={[styles.thumb, isRecurring && styles.thumbOn]} />
            </View>
          </TouchableOpacity>
        )}

        {isRecurring && (
          <>
            <Text style={styles.label}>Última recorrência</Text>
            <DatePickerInput value={recurrenceEndDate} onChange={setRecurrenceEndDate} />
          </>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Salvar Alterações</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCatModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Categoria</Text>
            <TouchableOpacity onPress={() => setShowCatModal(false)}>
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { setSelectedCategory(item); setShowCatModal(false); }}
              >
                <View style={[styles.dot, { backgroundColor: item.color, width: 14, height: 14, borderRadius: 7 }]} />
                <Text style={styles.modalItemText}>{item.name}</Text>
                {selectedCategory?.id === item.id && <Ionicons name="checkmark" size={20} color="#6C63FF" />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showWalletModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Carteira</Text>
            <TouchableOpacity onPress={() => setShowWalletModal(false)}>
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={wallets}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { setSelectedWallet(item); setShowWalletModal(false); }}
              >
                <Ionicons name={item.icon as any} size={20} color={item.color} />
                <Text style={[styles.modalItemText, { marginLeft: 12 }]}>{item.name}</Text>
                {selectedWallet?.id === item.id && <Ionicons name="checkmark" size={20} color="#6C63FF" />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { padding: 4, marginRight: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  deleteBtn: { padding: 4 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF0FF', borderRadius: 10, padding: 10, marginTop: 16,
  },
  infoBannerText: { fontSize: 12, color: '#6C63FF', flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA',
  },
  selector: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1,
    borderColor: '#E5E5EA', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectorInner: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  selectorText: { fontSize: 16, color: '#1A1A2E' },
  selectorPlaceholder: { fontSize: 16, color: '#8B8B9C' },
  toggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E5E5EA', marginTop: 16,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 15, color: '#1A1A2E' },
  track: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E5EA', justifyContent: 'center', paddingHorizontal: 2 },
  trackOn: { backgroundColor: '#6C63FF' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  thumbOn: { alignSelf: 'flex-end' },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  modalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8 },
  modalItemText: { flex: 1, fontSize: 15, color: '#1A1A2E' },
});
