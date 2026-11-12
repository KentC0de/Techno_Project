import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function Pagination({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  style,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.summaryText}>
        {totalItems > 0
          ? `Showing ${startItem}-${endItem} of ${totalItems}`
          : '0 items'}
        {' • '}
        <Text style={styles.pageText}>{`Page ${currentPage} of ${totalPages}`}</Text>
      </Text>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, !canPrev && styles.btnDisabled]}
          onPress={() => canPrev && onPageChange(currentPage - 1)}
          disabled={!canPrev}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={canPrev ? colors.textDark : colors.textMuted}
          />
          <Text style={[styles.btnLabel, !canPrev && styles.btnLabelDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, !canNext && styles.btnDisabled]}
          onPress={() => canNext && onPageChange(currentPage + 1)}
          disabled={!canNext}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnLabel, !canNext && styles.btnLabelDisabled]}>
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={canNext ? colors.textDark : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  pageText: {
    fontWeight: '700',
    color: colors.textDark,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  btnDisabled: {
    backgroundColor: '#FAFAFA',
    borderColor: '#F4F4F5',
    opacity: 0.5,
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  btnLabelDisabled: {
    color: colors.textMuted,
  },
});
