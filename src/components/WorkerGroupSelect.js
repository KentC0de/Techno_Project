import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkerGroups } from '../hooks/useWorkerGroups';
import { colors } from '../theme';

/**
 * WorkerGroupSelect: Module-level picker for choosing ONE worker group (or "No group / Unassigned").
 * Shows color dot, name, shift label, and member count.
 * Inactive groups are greyed out with an "Inactive" tag and cannot be selected.
 */
export default function WorkerGroupSelect({
  selectedGroupId = null,
  onSelectGroup,
  allowUnassigned = true,
  onNavigateToManageGroups = null,
  disabled = false,
}) {
  const { groups, membersByGroup, isLoading, error, refetch } = useWorkerGroups();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading worker groups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle" size={18} color="#DC2626" />
        <Text style={styles.errorText}>
          {error.message || 'Failed to load worker groups.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={24} color={colors.textMuted} />
        <Text style={styles.emptyText}>No worker groups created yet.</Text>
        {onNavigateToManageGroups && (
          <TouchableOpacity
            style={styles.createLinkBtn}
            onPress={onNavigateToManageGroups}
          >
            <Text style={styles.createLinkText}>Create Worker Group in Assign Workers →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {allowUnassigned && (
        <TouchableOpacity
          style={[
            styles.groupRow,
            selectedGroupId === null && styles.groupRowSelected,
            disabled && styles.groupRowDisabled,
          ]}
          onPress={() => !disabled && onSelectGroup(null)}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.radio, selectedGroupId === null && styles.radioSelected]}>
              {selectedGroupId === null && <View style={styles.radioInner} />}
            </View>
            <View style={[styles.colorDot, { backgroundColor: '#94A3B8' }]} />
            <Text style={[styles.groupName, selectedGroupId === null && styles.groupNameSelected]}>
              No group (Unassigned)
            </Text>
          </View>
          <Text style={styles.unassignedHint}>Visible to all admins only</Text>
        </TouchableOpacity>
      )}

      {groups.map((group) => {
        const isSelected = selectedGroupId === group.id;
        const isActive = group.is_active !== false;
        const memberCount = (membersByGroup[group.id] || []).length;
        const isDisabled = disabled || !isActive;

        return (
          <TouchableOpacity
            key={group.id}
            style={[
              styles.groupRow,
              isSelected && styles.groupRowSelected,
              !isActive && styles.groupRowInactive,
              isDisabled && styles.groupRowDisabled,
            ]}
            onPress={() => {
              if (isActive && !disabled) {
                onSelectGroup(group.id);
              }
            }}
            activeOpacity={isActive && !disabled ? 0.7 : 1}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
              <View style={[styles.colorDot, { backgroundColor: group.color || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.groupName, isSelected && styles.groupNameSelected]}>
                    {group.name}
                  </Text>
                  {!isActive && (
                    <View style={styles.inactiveChip}>
                      <Text style={styles.inactiveChipText}>Inactive</Text>
                    </View>
                  )}
                </View>
                {group.shift_label ? (
                  <Text style={styles.shiftLabel}>
                    {group.shift_label}
                    {group.shift_start && group.shift_end
                      ? ` (${group.shift_start.slice(0, 5)} - ${group.shift_end.slice(0, 5)})`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.rowRight}>
              <View style={styles.memberBadge}>
                <Ionicons name="people" size={12} color="#475569" />
                <Text style={styles.memberCountText}>
                  {memberCount} {memberCount === 1 ? 'worker' : 'workers'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  createLinkBtn: {
    marginTop: 4,
  },
  createLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  groupRowInactive: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  groupRowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  groupNameSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  inactiveChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inactiveChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  shiftLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  unassignedHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});

