import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletsScreen from '../screens/main/WalletsScreen';
import AddWalletScreen from '../screens/wallets/AddWalletScreen';
import EditWalletScreen from '../screens/wallets/EditWalletScreen';
import { WalletsStackParamList } from '../types';

const Stack = createNativeStackNavigator<WalletsStackParamList>();

export default function WalletsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletsList" component={WalletsScreen} />
      <Stack.Screen name="AddWallet" component={AddWalletScreen} />
      <Stack.Screen name="EditWallet" component={EditWalletScreen} />
    </Stack.Navigator>
  );
}
