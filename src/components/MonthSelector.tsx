import React, { useRef, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { format, subMonths, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  maxDate?: Date;
}

const MONTHS_BACK = 18;

export default function MonthSelector({ selectedMonth, onMonthChange, maxDate }: MonthSelectorProps) {
  const scrollRef = useRef<ScrollView>(null);

  const now = new Date();
  const months: Date[] = [];
  for (let i = MONTHS_BACK; i >= 0; i--) {
    months.push(subMonths(now, i));
  }

  if (maxDate) {
    const nowStart = startOfMonth(now);
    const maxStart = startOfMonth(maxDate);
    const futureMonths =
      (maxStart.getFullYear() - nowStart.getFullYear()) * 12 +
      (maxStart.getMonth() - nowStart.getMonth());
    for (let i = 1; i <= futureMonths; i++) {
      months.push(addMonths(now, i));
    }
  }

  useEffect(() => {
    const idx = months.findIndex(
      (m) =>
        m.getMonth() === selectedMonth.getMonth() &&
        m.getFullYear() === selectedMonth.getFullYear()
    );
    if (idx >= 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: idx * 64, animated: true });
      }, 150);
    }
  }, [selectedMonth.getMonth(), selectedMonth.getFullYear()]);

  const nowStart = startOfMonth(now);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {months.map((month, index) => {
        const isSelected =
          month.getMonth() === selectedMonth.getMonth() &&
          month.getFullYear() === selectedMonth.getFullYear();
        const isFuture = startOfMonth(month) > nowStart;
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.button,
              isSelected && styles.buttonSelected,
              isFuture && !isSelected && styles.buttonFuture,
            ]}
            onPress={() => onMonthChange(month)}
          >
            <Text style={[styles.monthText, isSelected && styles.textSelected, isFuture && !isSelected && styles.textFuture]}>
              {format(month, 'MMM', { locale: ptBR }).toUpperCase()}
            </Text>
            <Text style={[styles.yearText, isSelected && styles.textSelected, isFuture && !isSelected && styles.textFuture]}>
              {format(month, 'yy')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  button: {
    width: 56,
    height: 56,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSelected: {
    backgroundColor: '#6C63FF',
  },
  buttonFuture: {
    backgroundColor: '#F0F0F5',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderStyle: 'dashed',
  },
  monthText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B8B9C',
  },
  yearText: {
    fontSize: 10,
    color: '#8B8B9C',
    marginTop: 2,
  },
  textSelected: {
    color: '#FFFFFF',
  },
  textFuture: {
    color: '#66BB6A',
  },
});
