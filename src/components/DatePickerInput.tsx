import React from 'react';
import { Platform, TextInput, View, StyleSheet } from 'react-native';

interface Props {
  value: string; // DD/MM/YYYY
  onChange: (v: string) => void;
  style?: object;
}

const toISO = (ddmmyyyy: string) => {
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3 && parts[2].length === 4)
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return '';
};

const fromISO = (iso: string) => {
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return '';
};

export default function DatePickerInput({ value, onChange, style }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={style}>
        {(React.createElement as any)('input', {
          type: 'date',
          value: toISO(value),
          onChange: (e: any) => onChange(fromISO(e.target.value)),
          style: {
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: '14px',
            fontSize: 16,
            border: '1px solid #E5E5EA',
            width: '100%',
            boxSizing: 'border-box',
            color: '#1A1A2E',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'inherit',
          },
        })}
      </View>
    );
  }

  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={onChange}
      placeholder="DD/MM/AAAA"
      keyboardType="numbers-and-punctuation"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    color: '#1A1A2E',
  },
});
