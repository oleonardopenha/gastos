import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import OverviewScreen from '../screens/main/OverviewScreen';
import WalletsNavigator from './WalletsNavigator';
import StatementScreen from '../screens/main/StatementScreen';
import AddTransactionScreen from '../screens/main/AddTransactionScreen';
import ExportScreen from '../screens/main/ExportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#8B8B9C',
        tabBarStyle: { height: 60, paddingBottom: 8 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { active: string; inactive: string }> = {
            Overview: { active: 'pie-chart', inactive: 'pie-chart-outline' },
            Wallets: { active: 'wallet', inactive: 'wallet-outline' },
            AddTransaction: { active: 'add-circle', inactive: 'add-circle-outline' },
            Statement: { active: 'list', inactive: 'list-outline' },
            Export: { active: 'download', inactive: 'download-outline' },
          };
          const iconSet = icons[route.name] ?? { active: 'help-circle', inactive: 'help-circle-outline' };
          const iconName = focused ? iconSet.active : iconSet.inactive;
          const iconSize = route.name === 'AddTransaction' ? 32 : size;
          return <Ionicons name={iconName as any} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={OverviewScreen} options={{ title: 'Visão Geral' }} />
      <Tab.Screen name="Wallets" component={WalletsNavigator} options={{ title: 'Carteiras' }} />
      <Tab.Screen name="AddTransaction" component={AddTransactionScreen} options={{ title: 'Inserir' }} />
      <Tab.Screen name="Statement" component={StatementScreen} options={{ title: 'Extrato' }} />
      <Tab.Screen name="Export" component={ExportScreen} options={{ title: 'Exportar' }} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
