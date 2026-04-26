import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Category, CategoriesStackParamList } from '../../types';

type NavProp = NativeStackNavigationProp<CategoriesStackParamList, 'CategoriesList'>;

export default function CategoriesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    if (data) setCategories(data);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchCategories(); }, [fetchCategories]));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categorias</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('EditCategory', { category: null })}
        >
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6C63FF" />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('EditCategory', { category: item })}
            >
              <View style={[styles.iconBg, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Ionicons name="chevron-forward" size={18} color="#8B8B9C" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={48} color="#8B8B9C" />
              <Text style={styles.emptyText}>Nenhuma categoria cadastrada</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('EditCategory', { category: null })}
              >
                <Text style={styles.emptyBtnText}>Criar categoria</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  addBtn: { padding: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  iconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#8B8B9C' },
  emptyBtn: { backgroundColor: '#6C63FF', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '600' },
});
