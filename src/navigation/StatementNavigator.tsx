import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatementStackParamList } from '../types';
import StatementScreen from '../screens/main/StatementScreen';
import EditTransactionScreen from '../screens/transactions/EditTransactionScreen';

const Stack = createNativeStackNavigator<StatementStackParamList>();

export default function StatementNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatementList" component={StatementScreen} />
      <Stack.Screen name="EditTransaction" component={EditTransactionScreen} />
    </Stack.Navigator>
  );
}
