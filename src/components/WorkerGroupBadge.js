import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWorkerGroups } from '../hooks/useWorkerGroups';
import { colors } from '../theme';

/**
 * WorkerGroupBadge:
 * Displays a group pill with color dot + name, or "Unassigned" with sky blue outline when empty.
 * Accepts either:
 *   - group: object { id, name, color, shift_label }
 *   - group: string / number (group_id) which is resolved against worker groups list
 *   - size: 'small' | 'medium' | 'large' (default: 'small')
 */
export default function WorkerGroupBadge({ group, size = 'small' }) {
  // Always call hook at module level to resolve ID if passed as string/number or fallback
  const { groups } = useWorkerGroups();

  let resolvedGroup = null;
  if (group && typeof group === 'object' && !Array.isArray(group)) {
    resolvedGroup = group;
  } else if (group && (typeof group === 'string' || typeof group === 'number')) {
    resolvedGroup = groups?.find((g) => g.id === group) || null;
  }

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  if (!resolvedGroup || !resolvedGroup.name) {
    return (
      <View
        style={[
          styles.badgeBase,
          styles.unassignedBadge,
          isSmall && styles.badgeSmall,
          isLarge && styles.badgeLarge,
        ]}
      >
        <View
          style={[
            styles.dot,
            styles.unassignedDot,
            isSmall && styles.dotSmall,
            isLarge && styles.dotLarge,
          ]}
        />
        <Text
          style={[
            styles.label,
            styles.unassignedLabel,
            isSmall && styles.labelSmall,
            isLarge && styles.labelLarge,
          ]}
          numberOfLines={1}
        >
          Unassigned
        </Text>
      </View>
    );
  }

  const groupColor = resolvedGroup.color || colors.primary;
  const shiftText = resolvedGroup.shift_label ? ` • ${resolvedGroup.shift_label}` : '';

  return (
    <View
      style={[
        styles.badgeBase,
        styles.assignedBadge,
        isSmall && styles.badgeSmall,
        isLarge && styles.badgeLarge,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: groupColor },
          isSmall && styles.dotSmall,
          isLarge && styles.dotLarge,
        ]}
      />
      <Text
        style={[
          styles.label,
          styles.assignedLabel,
          isSmall && styles.labelSmall,
          isLarge && styles.labelLarge,
        ]}
        numberOfLines={1}
      >
        {resolvedGroup.name}
        {shiftText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  assignedBadge: {
    backgroundColor: '#F5F9FD',
    borderWidth: 1,
    borderColor: '#C9DCF0',
  },
  unassignedBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary, // sky blue outline
  },
  dot: {
    borderRadius: 999,
    marginRight: 5,
  },
  dotSmall: {
    width: 6,
    height: 6,
  },
  dotLarge: {
    width: 8,
    height: 8,
    marginRight: 7,
  },
  unassignedDot: {
    backgroundColor: colors.primary,
  },
  label: {
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 11,
  },
  labelLarge: {
    fontSize: 13,
  },
  assignedLabel: {
    color: '#1C5089',
  },
  unassignedLabel: {
    color: colors.primary,
  },
});

