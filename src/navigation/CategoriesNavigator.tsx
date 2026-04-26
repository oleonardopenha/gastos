import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CategoriesStackParamList } from '../types';
import CategoriesScreen from '../screens/categories/CategoriesScreen';
import EditCategoryScreen from '../screens/categories/EditCategoryScreen';

const Stack = createNativeStackNavigator<CategoriesStackParamList>();

export default function CategoriesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoriesList" component={CategoriesScreen} />
      <Stack.Screen name="EditCategory" component={EditCategoryScreen} />
    </Stack.Navigator>
  );
}
