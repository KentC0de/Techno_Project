import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TASK_STATUS_CONFIG } from '../utils/taskStatus';

export default function TaskStatusChip({ status = 'pending', labelOverride = null, size = 'small' }) {
  const config = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.pending;
  const isLarge = size === 'large';
  const label = labelOverride || (isLarge ? config.label : config.shortLabel || config.label);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          borderWidth: config.isOutline ? 1 : 0,
          paddingVertical: isLarge ? 4 : 2,
          paddingHorizontal: isLarge ? 10 : 8,
        },
      ]}
    >
      {config.icon ? (
        <Ionicons
          name={config.icon}
          size={isLarge ? 14 : 12}
          color={config.textColor}
          style={styles.icon}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: isLarge ? 12 : 11,
            fontWeight: config.isOutline ? '600' : '700',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    includeFontPadding: false,
  },
});
