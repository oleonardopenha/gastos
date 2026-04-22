import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { supabase } from '../../lib/supabase';
import { Wallet } from '../../types';

const COLORS = [
  '#6C63FF', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#FF9F40', '#9966FF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#E74C3C',
];

const ICONS = [
  'wallet', 'card', 'cash', 'business', 'restaurant',
  'car', 'home', 'medical', 'cart', 'gift', 'star', 'phone-portrait',
];

export default function EditWalletScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const wallet: Wallet = route.params.wallet;

  const [name, setName] = useState(wallet.name);
  const [color, setColor] = useState(wallet.color);
  const [icon, setIcon] = useState(wallet.icon);
  const [startDay, setStartDay] = useState(String(wallet.cash_flow_start_day ?? 1));
  const [endDay, setEndDay] = useState(String(wallet.cash_flow_end_day ?? 31));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Digite um nome para a carteira');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('wallets')
      .update({
        name: name.trim(),
        color,
        icon,
        cash_flow_start_day: parseInt(startDay) || 1,
        cash_flow_end_day: parseInt(endDay) || 31,
      })
      .eq('id', wallet.id);
    setLoading(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações');
    } else {
      navigation.goBack();
    }
  };

  const handleDelete = () => {
    Alert.alert('Excluir carteira', `Tem certeza que deseja excluir "${wallet.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Confirmar exclusão',
            'Esta ação é irreversível. Os gastos desta carteira perderão a referência.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sim, excluir definitivamente', style: 'destructive', onPress: confirmDelete },
            ]
          ),
      },
    ]);
  };

  const confirmDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('wallets').delete().eq('id', wallet.id);
    setLoading(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível excluir a carteira');
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Carteira</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: color + '30' }]}>
            <Ionicons name={icon as any} size={32} color={color} />
          </View>
          <Text style={styles.previewName}>{name || 'Nome da carteira'}</Text>
        </View>

        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={40} />

        <Text style={styles.label}>Cor</Text>
        <View style={styles.grid}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
              onPress={() => setColor(c)}
            >
              {color === c && <Ionicons name="checkmark" size={16} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ícone</Text>
        <View style={styles.grid}>
          {ICONS.map((ic) => (
            <TouchableOpacity
              key={ic}
              style={[styles.iconOpt, icon === ic && { backgroundColor: color }]}
              onPress={() => setIcon(ic)}
            >
              <Ionicons name={ic as any} size={22} color={icon === ic ? '#fff' : '#8B8B9C'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ciclo de fechamento</Text>
        <View style={styles.cycleRow}>
          <View style={styles.cycleField}>
            <Text style={styles.cycleLabel}>Dia início</Text>
            <TextInput
              style={styles.input}
              value={startDay}
              onChangeText={setStartDay}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={[styles.cycleField, { marginLeft: 12 }]}>
            <Text style={styles.cycleLabel}>Dia fim</Text>
            <TextInput
              style={styles.input}
              value={endDay}
              onChangeText={setEndDay}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Salvar Alterações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  preview: { alignItems: 'center', paddingVertical: 24 },
  previewIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewName: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 10, marginTop: 20 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: '#1A1A2E' },
  iconOpt: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
  },
  cycleRow: { flexDirection: 'row' },
  cycleField: { flex: 1 },
  cycleLabel: { fontSize: 12, color: '#8B8B9C', marginBottom: 6 },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
