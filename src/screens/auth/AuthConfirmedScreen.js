import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme';

function parseUrlParams(rawUrl) {
  const result = {};
  if (!rawUrl) return { get: () => null };
  const hasHash = rawUrl.includes('#');
  const hashPart = hasHash ? rawUrl.split('#')[1] : '';
  const queryPart = rawUrl.includes('?') ? rawUrl.split('?')[1].split('#')[0] : '';
  const combined = [queryPart, hashPart].filter(Boolean).join('&');
  for (const part of combined.split('&')) {
    if (!part) continue;
    const [k, v] = part.split('=');
    if (k) {
      try {
        result[decodeURIComponent(k)] = v !== undefined ? decodeURIComponent(v.replace(/\+/g, ' ')) : '';
      } catch (_) {
        result[k] = v || '';
      }
    }
  }
  return {
    get: (key) => (result[key] !== undefined ? result[key] : null),
  };
}

export default function AuthConfirmedScreen({ navigation }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const incomingUrl = Linking.useURL();

  useEffect(() => {
    async function handleVerification() {
      try {
        let url = incomingUrl;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          url = window.location.href;
        }

        if (!url) {
          setStatus('error');
          setErrorMessage('No confirmation parameters found in the link.');
          return;
        }

        // Check for error parameters in URL (query or hash)
        // e.g. error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
        const params = parseUrlParams(url);

        const error = params.get('error') || params.get('error_code');
        const errorDesc = params.get('error_description');

        if (error || errorDesc) {
          setStatus('error');
          setErrorMessage(errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'This confirmation link is invalid or has expired.');
          return;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // Do not keep user logged in automatically unless requested - sign out session
          await supabase.auth.signOut();
          setStatus('success');
        } else if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            setStatus('error');
            setErrorMessage(exchangeErr.message || 'Failed to verify confirmation code.');
          } else {
            await supabase.auth.signOut();
            setStatus('success');
          }
        } else if (type === 'signup' || url.includes('confirmed')) {
          // If navigated directly or already verified
          // Check if there is an active session
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            await supabase.auth.signOut();
          }
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage('This confirmation link is invalid or has expired.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.message || 'An unexpected verification error occurred.');
      }
    }

    handleVerification();
  }, [incomingUrl]);

  const handleGoToLogin = () => {
    if (Platform.OS === 'web') {
      navigation.navigate('AdminLogin');
    } else {
      navigation.navigate('WorkerLogin');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'checking' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.checkingText}>Verifying your email...</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.center}>
            <View style={styles.iconCircleSuccess}>
              <Ionicons name="checkmark-circle" size={56} color="#0EA5E9" />
            </View>
            <Text style={styles.title}>Email confirmed!</Text>
            <Text style={styles.subtitle}>
              Your account is ready. You can now log in with your password.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleGoToLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Go to Log in</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <View style={styles.iconCircleError}>
              <Ionicons name="alert-circle" size={56} color="#DC2626" />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {errorMessage || 'This link is invalid or expired.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleGoToLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Back to Log in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 36,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  center: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircleSuccess: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircleError: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF2F2',
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
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  checkingText: {
    fontSize: 16,
    color: colors.dark,
    fontWeight: '600',
    marginTop: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.dark,
    fontSize: 15,
    fontWeight: '700',
  },
});
