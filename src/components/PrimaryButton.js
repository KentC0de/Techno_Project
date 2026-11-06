import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '../theme';

/**
 * Reusable PrimaryButton supporting:
 * - shape: 'pill' (border radius 28, height 56) or 'rounded' (border radius 8, height 48)
 * - loading state with white spinner
 * - disabled state
 * - soft shadow
 */
export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  shape = 'pill', // 'pill' | 'rounded'
  style,
  textStyle,
}) {
  const isPill = shape === 'pill';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPill ? styles.pillShape : styles.roundedShape,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    // Soft shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  pillShape: {
    height: 56,
    borderRadius: 28,
  },
  roundedShape: {
    height: 48,
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

