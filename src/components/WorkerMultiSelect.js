import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * WorkerMultiSelect: Searchable multi-select of workers with initials avatar, name, email and checkbox.
 * Used exclusively for adding members to worker groups.
 * Disabled workers are greyed with a "Disabled" tag and cannot be selected.
 */
export default function WorkerMultiSelect({
  workers = [],
  selectedIds = [],
  onToggleWorker,
  groupByUser = {},
  groups = [],
  currentGroupId = null,
}) {
  const [search, setSearch] = useState('');

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        (w.full_name && w.full_name.toLowerCase().includes(q)) ||
        (w.email && w.email.toLowerCase().includes(q))
    );
  }, [workers, search]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search active workers by name or email..."
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {filteredWorkers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No workers match your search.</Text>
          </View>
        ) : (
          filteredWorkers.map((w) => {
            const isSelected = selectedIds.includes(w.id);
            const isDisabled = (w.status || 'active') === 'disabled';
            const otherGroupId = groupByUser[w.id];
            const isCurrentMember = otherGroupId === currentGroupId;
            const otherGroup =
              otherGroupId && otherGroupId !== currentGroupId
                ? groups.find((g) => g.id === otherGroupId)
                : null;

            return (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.workerRow,
                  isSelected && styles.workerRowSelected,
                  isDisabled && styles.workerRowDisabled,
                ]}
                onPress={() => {
                  if (!isDisabled) {
                    onToggleWorker(w.id);
                  }
                }}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <View style={styles.workerRowLeft}>
                  {/* Checkbox */}
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                      isDisabled && styles.checkboxDisabled,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={12} color={colors.white} />
                    )}
                  </View>

                  {/* Avatar */}
                  <View
                    style={[
                      styles.avatar,
                      isDisabled && { backgroundColor: '#CBD5E1' },
                    ]}
                  >
                    <Text style={styles.avatarText}>{getInitials(w.full_name)}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.workerName,
                          isSelected && styles.workerNameSelected,
                          isDisabled && styles.textDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {w.full_name || 'Worker'}
                      </Text>
                      {isDisabled && (
                        <View style={styles.disabledTag}>
                          <Text style={styles.disabledTagText}>Disabled</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.workerEmail, isDisabled && styles.textDisabled]}
                      numberOfLines={1}
                    >
                      {w.email || 'No email registered'}
                    </Text>
                  </View>
                </View>

                {/* Right side info: other group indication */}
                {otherGroup && !isDisabled && (
                  <View style={styles.otherGroupPill}>
                    <Text style={styles.otherGroupText} numberOfLines={1}>
                      In {otherGroup.name} • will move
                    </Text>
                  </View>
                )}
                {isCurrentMember && (
                  <View style={styles.currentMemberPill}>
                    <Text style={styles.currentMemberText}>Current member</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
  },
  list: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  workerRowSelected: {
    backgroundColor: '#F0F9FF',
  },
  workerRowDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
  },
  workerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  workerNameSelected: {
    color: colors.primaryDark,
  },
  workerEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
  disabledTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  disabledTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  otherGroupPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  otherGroupText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '700',
  },
  currentMemberPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentMemberText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
  },
});

