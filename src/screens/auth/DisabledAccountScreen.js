import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { colors } from '../../theme';

export default function DisabledAccountScreen({ onBackToLogin }) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { settings } = useAppSettings();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (_) {}
    if (onBackToLogin) onBackToLogin();
  };

  const handleContactPress = () => {
    const contact = settings?.support_contact;
    if (!contact) return;
    if (contact.includes('@')) {
      Linking.openURL(`mailto:${contact}`);
    } else if (/\d/.test(contact)) {
      Linking.openURL(`tel:${contact}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={44} color={colors.primary} />
        </View>

        <Text style={styles.title}>Account disabled</Text>

        <Text style={styles.message}>
          Your account has been disabled. Please contact your administrator to resolve this issue.
        </Text>

        {settings?.support_contact ? (
          <TouchableOpacity
            style={styles.contactBox}
            onPress={handleContactPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={settings.support_contact.includes('@') ? 'mail-outline' : 'call-outline'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.contactText}>
              {settings.support_contact}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.btn}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Back to Log in</Text>
        </TouchableOpacity>

        <Text style={styles.footerBrand}>Solar PM Hub</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  contactText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  btn: {
    width: '100%',
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  footerBrand: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 24,
  },
});
