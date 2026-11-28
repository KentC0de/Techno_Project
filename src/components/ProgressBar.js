import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function ProgressBar({ completed = 0, total = 0, waiting = 0, title = "Today's Progress" }) {
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.ratio}>
          <Text style={styles.bold}>{completed}</Text> of {total} done ({percentage}%)
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: percentage === 100 ? colors.primaryDark : colors.primary,
            },
          ]}
        />
      </View>
      {waiting > 0 && (
        <View style={styles.waitingRow}>
          <Text style={styles.waitingText}>{waiting} waiting for approval</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  ratio: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: '700',
    color: colors.primary,
  },
  track: {
    height: 10,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  waitingRow: {
    marginTop: 8,
  },
  waitingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C5089',
  },
});


