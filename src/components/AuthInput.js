import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Reusable AuthInput component supporting two variants:
 * 1. 'pill' (default): Mobile-first pill-shaped field (h: 56px) with left icon, soft shadow, right eye toggle.
 * 2. 'underline': Web Admin minimalist field with label above and bottom border that turns sky blue on focus.
 */
export default function AuthInput({
  variant = 'pill',
  label = '',
  leftIcon = null,
  placeholder = '',
  value = '',
  onChangeText,
  secureTextEntry = false,
  error = '',
  hasError = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  onSubmitEditing,
  returnKeyType = 'done',
  style,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = Boolean(secureTextEntry);
  const actuallySecure = isPassword && !isPasswordVisible;
  const isErr = Boolean(hasError || error);

  // --- UNDERLINE VARIANT (WEB ADMIN) ---
  if (variant === 'underline') {
    return (
      <View style={[styles.underlineContainer, style]}>
        {label ? <Text style={styles.underlineLabel}>{label}</Text> : null}
        <View
          style={[
            styles.underlineFieldRow,
            isFocused && styles.underlineFieldFocused,
            isErr && styles.underlineFieldError,
          ]}
        >
          <TextInput
            style={styles.underlineInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            secureTextEntry={actuallySecure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            textContentType={textContentType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onSubmitEditing}
            returnKeyType={returnKeyType}
            {...props}
          />
          {isPassword && (
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={isFocused ? colors.primary : '#9CA3AF'}
              />
            </TouchableOpacity>
          )}
        </View>

        {error ? (
          <View style={styles.inlineErrorRow}>
            <Ionicons name="information-circle" size={14} color="#DC2626" />
            <Text style={[styles.inlineErrorText, { color: '#DC2626' }]}>{error}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // --- PILL VARIANT (WORKER MOBILE) ---
  return (
    <View style={[styles.pillContainer, style]}>
      <View
        style={[
          styles.pillFieldRow,
          isFocused && styles.pillFieldFocused,
          isErr && styles.pillFieldError,
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconWrapper}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={isErr ? '#DC2626' : (isFocused ? colors.primary : '#9CA3AF')}
            />
          </View>
        )}

        <TextInput
          style={styles.pillInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={actuallySecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isFocused ? colors.primary : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.inlineErrorRow}>
          <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
          <Text style={[styles.inlineErrorText, { color: '#DC2626' }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Underline Styles
  underlineContainer: {
    marginBottom: 20,
    width: '100%',
  },
  underlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  underlineFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
    paddingVertical: Platform.OS === 'web' ? 8 : 4,
    minHeight: 44,
  },
  underlineFieldFocused: {
    borderBottomColor: colors.primary,
  },
  underlineFieldError: {
    borderBottomColor: '#DC2626',
  },
  underlineInput: {
    flex: 1,
    fontSize: 15,
    color: colors.dark,
    paddingVertical: 4,
    minHeight: 38,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // Pill Styles
  pillContainer: {
    marginBottom: 16,
    width: '100%',
  },
  pillFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 28, // full pill height 56px / 2 = 28
    height: 56,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    // Soft shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pillFieldFocused: {
    borderColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  pillFieldError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  leftIconWrapper: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInput: {
    flex: 1,
    fontSize: 15,
    color: colors.dark,
    height: '100%',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  eyeBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inline Red-free Error Styling (Sky blue / Black with small alert icon)
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 6,
    gap: 5,
  },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
    flex: 1,
  },
});

