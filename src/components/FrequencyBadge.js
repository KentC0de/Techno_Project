import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

const FREQ_KEY_MAP = {
  d: 'd',
  w: 'w',
  m: 'M',
  q: 'Q',
  sa: 'SA',
};

export default function FrequencyBadge({ freq, size = 'medium' }) {
  const normalizedKey = freq ? FREQ_KEY_MAP[String(freq).trim().toLowerCase()] || freq : null;
  const config = (normalizedKey && colors.frequency[normalizedKey]) || {
    code: freq ? String(freq).toUpperCase() : '?',
    label: freq || 'Unknown',
    bg: '#F1F5F9',
    text: '#0A0A0A',
    border: '#CBD5E1',
  };

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingHorizontal: isSmall ? 6 : isLarge ? 12 : 8,
          paddingVertical: isSmall ? 2 : isLarge ? 6 : 4,
          minWidth: isSmall ? 24 : isLarge ? 40 : 32,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: isSmall ? 11 : isLarge ? 15 : 12,
          },
        ]}
      >
        {config.code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

