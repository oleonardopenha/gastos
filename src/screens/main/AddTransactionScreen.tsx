import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '../../components/NativeDatePicker';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Category, Wallet } from '../../types';

const WebInput = Platform.OS === 'web' ? ('input' as any) : null;

const dateToISO = (ddmmyyyy: string) => {
  const p = ddmmyyyy.split('/');
  return p.length === 3 && p[2].length === 4
    ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    : '';
};
const isoToDate = (yyyymmdd: string) => {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
};

const webDateStyle: any = {
  padding: '13px 14px',
  fontSize: '16px',
  border: '1px solid #E5E5EA',
  borderRadius: '12px',
  width: '100%',
  backgroundColor: '#FFFFFF',
  color: '#1A1A2E',
  boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
  outline: 'none',
  cursor: 'pointer',
};

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', color: '#FF6384', icon: 'restaurant' },
  { name: 'Transporte', color: '#36A2EB', icon: 'car' },
  { name: 'Moradia', color: '#FFCE56', icon: 'home' },
  { name: 'Saúde', color: '#4BC0C0', icon: 'medical' },
  { name: 'Lazer', color: '#9966FF', icon: 'game-controller' },
  { name: 'Compras', color: '#FF9F40', icon: 'cart' },
  { name: 'Educação', color: '#4BC0C0', icon: 'book' },
  { name: 'Outros', color: '#8B8B9C', icon: 'ellipsis-horizontal' },
];

const TOGGLE_COLORS = ['#6C63FF', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#FF9F40', '#9966FF'];

function Toggle({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: string;
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toggle} onPress={onToggle}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon as any} size={20} color="#6C63FF" />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

export default function AddTransactionScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('2');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'date' | 'recurrenceEnd' | null>(null);

  const fetchData = useCallback(async () => {
    const [catsRes, walletsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user?.id).order('name'),
      supabase.from('wallets').select('*').eq('user_id', user?.id).order('created_at'),
    ]);

    if (catsRes.data?.length === 0) {
      const toInsert = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user?.id }));
      const { data } = await supabase.from('categories').insert(toInsert).select();
      if (data) setCategories(data);
    } else if (catsRes.data) {
      setCategories(catsRes.data);
    }

    if (walletsRes.data) setWallets(walletsRes.data);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const parseDate = (str: string): string | null => {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (!d || !m || !y || y.length !== 4) return null;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setDate(format(new Date(), 'dd/MM/yyyy'));
    setSelectedCategory(null);
    setSelectedWallet(null);
    setHasInstallments(false);
    setTotalInstallments('2');
    setIsRecurring(false);
    setRecurrenceEndDate('');
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Digite o nome do gasto');
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Atenção', 'Digite um valor válido');

    const isoDate = parseDate(date);
    if (!isoDate) return Alert.alert('Atenção', 'Data inválida. Use o formato DD/MM/AAAA');

    setLoading(true);
    const numInstallments = hasInstallments ? Math.max(1, parseInt(totalInstallments) || 1) : 1;

    if (numInstallments > 1) {
      const installmentAmount = parsedAmount / numInstallments;
      const rows = [];
      for (let i = 1; i <= numInstallments; i++) {
        const installDate = addMonths(new Date(isoDate + 'T00:00:00'), i - 1);
        rows.push({
          user_id: user?.id,
          wallet_id: selectedWallet?.id ?? null,
          category_id: selectedCategory?.id ?? null,
          name: name.trim(),
          amount: Math.round(installmentAmount * 100) / 100,
          date: format(installDate, 'yyyy-MM-dd'),
          is_recurring: false,
          total_installments: numInstallments,
          current_installment: i,
        });
      }
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) Alert.alert('Erro', 'Não foi possível salvar');
      else {
        resetForm();
        Alert.alert('Sucesso', `${numInstallments} parcelas registradas!`);
      }
    } else {
      const isoEnd = recurrenceEndDate ? parseDate(recurrenceEndDate) : null;
      const { error } = await supabase.from('transactions').insert({
        user_id: user?.id,
        wallet_id: selectedWallet?.id ?? null,
        category_id: selectedCategory?.id ?? null,
        name: name.trim(),
        amount: parsedAmount,
        date: isoDate,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring ? isoEnd : null,
        total_installments: 1,
        current_installment: 1,
      });
      if (error) Alert.alert('Erro', 'Não foi possível salvar');
      else {
        resetForm();
        Alert.alert('Sucesso', 'Gasto registrado!');
      }
    }
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const color = TOGGLE_COLORS[categories.length % TOGGLE_COLORS.length];
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user?.id, name: newCatName.trim(), color, icon: 'tag' })
      .select()
      .single();
    if (!error && data) {
      setCategories((prev) => [...prev, data]);
      setSelectedCategory(data);
      setNewCatName('');
      setShowCatModal(false);
    }
  };

  const getPickerDate = (): Date => {
    const raw = datePickerTarget === 'date' ? date : recurrenceEndDate;
    const parsed = parseDate(raw);
    return parsed ? new Date(parsed + 'T00:00:00') : new Date();
  };

  const handleDatePickerChange = (_event: any, selected?: Date) => {
    setDatePickerTarget(null);
    if (selected) {
      const formatted = format(selected, 'dd/MM/yyyy');
      if (datePickerTarget === 'date') setDate(formatted);
      else if (datePickerTarget === 'recurrenceEnd') setRecurrenceEndDate(formatted);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Novo Gasto</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Nome do gasto</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Almoço" />

        <Text style={styles.label}>Valor (R$)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0,00"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Data</Text>
        {Platform.OS === 'web' ? (
          <WebInput
            type="date"
            value={dateToISO(date)}
            onChange={(e: any) => setDate(isoToDate(e.target.value))}
            style={webDateStyle}
          />
        ) : (
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={date}
              onChangeText={setDate}
              placeholder="22/04/2026"
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity style={styles.calendarBtn} onPress={() => setDatePickerTarget('date')}>
              <Ionicons name="calendar-outline" size={22} color="#6C63FF" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Categoria</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowCatModal(true)}>
          {selectedCategory ? (
            <View style={styles.selectorInner}>
              <View style={[styles.selectorDot, { backgroundColor: selectedCategory.color }]} />
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

        <Toggle
          icon="layers-outline"
          label="Parcelado"
          value={hasInstallments}
          onToggle={() => { setHasInstallments(!hasInstallments); if (isRecurring) setIsRecurring(false); }}
        />

        {hasInstallments && (
          <>
            <Text style={styles.label}>Número de parcelas</Text>
            <TextInput
              style={styles.input}
              value={totalInstallments}
              onChangeText={setTotalInstallments}
              keyboardType="number-pad"
              placeholder="2"
            />
          </>
        )}

        {!hasInstallments && (
          <Toggle
            icon="refresh-outline"
            label="Recorrente"
            value={isRecurring}
            onToggle={() => setIsRecurring(!isRecurring)}
          />
        )}

        {isRecurring && (
          <>
            <Text style={styles.label}>Última recorrência</Text>
            {Platform.OS === 'web' ? (
              <WebInput
                type="date"
                value={dateToISO(recurrenceEndDate)}
                onChange={(e: any) => setRecurrenceEndDate(isoToDate(e.target.value))}
                style={webDateStyle}
              />
            ) : (
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={recurrenceEndDate}
                  onChangeText={setRecurrenceEndDate}
                  placeholder="31/12/2026"
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity style={styles.calendarBtn} onPress={() => setDatePickerTarget('recurrenceEnd')}>
                  <Ionicons name="calendar-outline" size={22} color="#6C63FF" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Registrar Gasto</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de categorias */}
      <Modal visible={showCatModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Categoria</Text>
            <TouchableOpacity onPress={() => setShowCatModal(false)}>
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          <View style={styles.newRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Nova categoria..."
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCategory}>
              <Ionicons name="add" size={24} color="#fff" />
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
                <View style={[styles.selectorDot, { backgroundColor: item.color, width: 14, height: 14, borderRadius: 7 }]} />
                <Text style={styles.modalItemText}>{item.name}</Text>
                {selectedCategory?.id === item.id && (
                  <Ionicons name="checkmark" size={20} color="#6C63FF" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {datePickerTarget !== null && Platform.OS !== 'web' && (
        <DateTimePicker
          value={getPickerDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDatePickerChange}
        />
      )}

      {/* Modal de carteiras */}
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
                {selectedWallet?.id === item.id && (
                  <Ionicons name="checkmark" size={20} color="#6C63FF" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: '#8B8B9C', padding: 24 }}>
                Nenhuma carteira cadastrada
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorInner: { flexDirection: 'row', alignItems: 'center' },
  selectorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  selectorText: { fontSize: 16, color: '#1A1A2E' },
  selectorPlaceholder: { fontSize: 16, color: '#8B8B9C' },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 16,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 15, color: '#1A1A2E' },
  track: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E5EA', justifyContent: 'center', paddingHorizontal: 2 },
  trackOn: { backgroundColor: '#6C63FF' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  thumbOn: { alignSelf: 'flex-end' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1 },
  calendarBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  newRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  addBtn: { backgroundColor: '#6C63FF', borderRadius: 12, width: 48, justifyContent: 'center', alignItems: 'center' },
  modalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8 },
  modalItemText: { flex: 1, fontSize: 15, color: '#1A1A2E' },
});
