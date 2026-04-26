import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { CategoriesStackParamList } from '../../types';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'EditCategory'>;

const COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#6C63FF', '#E74C3C',
  '#2ECC71', '#3498DB', '#F39C12', '#8B8B9C',
];

const ICONS = [
  'restaurant', 'car', 'home', 'medical',
  'game-controller', 'cart', 'book', 'ellipsis-horizontal',
  'pricetag', 'heart', 'star', 'briefcase',
  'airplane', 'cafe', 'fitness', 'musical-notes',
];

export default function EditCategoryScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const { user } = useAuth();
  const isNew = !category?.id;

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#6C63FF');
  const [icon, setIcon] = useState(category?.icon ?? 'pricetag');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Digite o nome da categoria');
    setLoading(true);

    const { error } = isNew
      ? await supabase.from('categories').insert({ name: name.trim(), color, icon, user_id: user?.id })
      : await supabase.from('categories').update({ name: name.trim(), color, icon }).eq('id', category!.id);

    setLoading(false);
    if (error) Alert.alert('Erro', 'Não foi possível salvar');
    else navigation.goBack();
  };

  const handleDelete = () => {
    if (isNew) return;
    Alert.alert(
      'Excluir Categoria',
      `Transações com "${category!.name}" ficarão sem categoria.\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.from('categories').delete().eq('id', category!.id);
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
        <Text style={styles.title}>{isNew ? 'Nova Categoria' : 'Editar Categoria'}</Text>
        {!isNew && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={24} color="#E74C3C" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: color + '33' }]}>
            <Ionicons name={icon as any} size={36} color={color} />
          </View>
          <Text style={[styles.previewName, { color }]}>{name || 'Nome da Categoria'}</Text>
        </View>

        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Alimentação"
          autoFocus={isNew}
        />

        <Text style={styles.label}>Cor</Text>
        <View style={styles.colorGrid}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnSelected]}
              onPress={() => setColor(c)}
            >
              {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ícone</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((ic) => (
            <TouchableOpacity
              key={ic}
              style={[styles.iconBtn, icon === ic && { borderColor: color, backgroundColor: color + '11' }]}
              onPress={() => setIcon(ic)}
            >
              <Ionicons name={ic as any} size={22} color={icon === ic ? color : '#8B8B9C'} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  preview: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  previewIcon: { width: 80, height: 80, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  previewName: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 10, marginTop: 20 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA',
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorBtn: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  colorBtnSelected: { borderWidth: 3, borderColor: '#1A1A2E' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: {
    width: 54, height: 54, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA',
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
