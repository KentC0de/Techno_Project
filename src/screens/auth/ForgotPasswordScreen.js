import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getAuthRedirectUrl } from '../../lib/authRedirect';
import AuthInput from '../../components/AuthInput';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError('');
    if (!email.trim() || !isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl('/auth/reset-password');

      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo,
        }
      );
      if (err) {
        const msg = err.message || '';
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          setError('Too many requests. Please wait a few minutes before trying again.');
          return;
        }
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
          setError('Connection failed. Please check your internet and try again.');
          return;
        }
      }
      setSent(true);
    } catch (err) {
      setError('Unable to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Success state ---
  if (sent) {
    return (
      <View style={styles.successContainer}>
        <TouchableOpacity
          style={styles.backCircle}
          onPress={() => navigation.navigate('WorkerLogin')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.dark} />
        </TouchableOpacity>

        <View style={styles.successInner}>
          <View style={styles.successIconBox}>
            <Ionicons name="mail" size={36} color={colors.primary} />
          </View>
          <Text style={styles.successTitle}>Check your inbox</Text>
          <Text style={styles.successText}>
            If this email is registered, we sent a password reset link to{'\n'}
            <Text style={{ fontWeight: '700', color: colors.dark }}>{email.trim()}</Text>
          </Text>
          <Text style={styles.successHint}>
            Follow the link in your email to choose a new password. If you don't see it, check your spam folder.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('WorkerLogin')}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>Back to Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backCircle}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.dark} />
          </TouchableOpacity>

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you instructions to reset your password.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <AuthInput
            variant="pill"
            leftIcon="mail-outline"
            placeholder="Email address"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={handleSend}
          />

          <PrimaryButton
            title="Send Reset Link"
            onPress={handleSend}
            loading={loading}
            disabled={loading}
            shape="pill"
            style={styles.btn}
          />

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('WorkerLogin')}>
              <Text style={[styles.signInText, styles.link, { fontWeight: '700' }]}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 48,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.dark,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
  },
  btn: { marginTop: 8, marginBottom: 20 },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: { fontSize: 14, color: '#9CA3AF' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 48,
  },
  successInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryVeryLight || '#EAF2FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  successHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
    maxWidth: 320,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  backBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
