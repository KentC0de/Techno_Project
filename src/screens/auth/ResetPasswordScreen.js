import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AuthInput from '../../components/AuthInput';
import PrimaryButton from '../../components/PrimaryButton';
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

export default function ResetPasswordScreen({ navigation }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'input' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const incomingUrl = Linking.useURL();

  useEffect(() => {
    async function checkRecoverySession() {
      try {
        let url = incomingUrl;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          url = window.location.href;
        }

        if (!url) {
          // If no URL params, check if active session already has recovery event
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            setStatus('input');
          } else {
            setStatus('error');
            setErrorMessage('No password recovery token found. Please request a new reset link.');
          }
          return;
        }

        const params = parseUrlParams(url);

        const error = params.get('error') || params.get('error_code');
        const errorDesc = params.get('error_description');

        if (error || errorDesc) {
          setStatus('error');
          setErrorMessage(errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'This reset link is invalid or has expired.');
          return;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          setStatus('input');
        } else if (code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (codeErr) throw codeErr;
          setStatus('input');
        } else {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            setStatus('input');
          } else {
            setStatus('error');
            setErrorMessage('This password reset link is invalid or has expired.');
          }
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.message || 'Unable to verify reset link.');
      }
    }

    checkRecoverySession();
  }, [incomingUrl]);

  const handleUpdatePassword = async () => {
    setFormError('');
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // Sign out recovery session so worker logs in cleanly with new password
      await supabase.auth.signOut();
      setStatus('success');
    } catch (err) {
      setFormError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isMobileBrowser =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const handleOpenApp = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = 'solarpm://';
      }
    } catch (_) {}
  };

  const handleGoToLogin = () => {
    if (Platform.OS === 'web') {
      navigation.navigate('AdminLogin');
    } else {
      navigation.navigate('WorkerLogin');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            {status === 'checking' && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.checkingText}>Verifying reset token...</Text>
              </View>
            )}

            {status === 'input' && (
              <View style={styles.inner}>
                <View style={styles.iconCircleSuccess}>
                  <Ionicons name="key-outline" size={40} color={colors.primary} />
                </View>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>
                  Enter a strong new password with at least 8 characters.
                </Text>

                {formError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{formError}</Text>
                  </View>
                ) : null}

                <AuthInput
                  variant="pill"
                  leftIcon="lock-closed-outline"
                  placeholder="New Password (min 8 chars)"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setFormError(''); }}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="next"
                />

                <AuthInput
                  variant="pill"
                  leftIcon="lock-closed-outline"
                  placeholder="Confirm New Password"
                  value={confirm}
                  onChangeText={(t) => { setConfirm(t); setFormError(''); }}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={handleUpdatePassword}
                />

                <PrimaryButton
                  title="Update Password"
                  onPress={handleUpdatePassword}
                  loading={loading}
                  disabled={loading}
                  shape="pill"
                  style={styles.btn}
                />
              </View>
            )}

            {status === 'success' && (
              <View style={styles.center}>
                <View style={styles.iconCircleSuccess}>
                  <Ionicons name="checkmark-circle" size={56} color="#2563A6" />
                </View>
                <Text style={styles.title}>Password Updated!</Text>
                {isMobileBrowser ? (
                  <>
                    <Text style={styles.subtitle}>
                      Password updated. Return to the Solar PM Hub app and log in with your new password.
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleOpenApp}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryBtnText}>Open Solar PM Hub App</Text>
                    </TouchableOpacity>
                    <Text style={[styles.subtitle, { marginTop: 12, fontSize: 12 }]}>
                      If the app doesn't open automatically, simply switch back to the Solar PM Hub app on your phone.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.subtitle}>
                      Your password has been reset successfully. You can now log in with your new credentials.
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleGoToLogin}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryBtnText}>Go to Log In</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {status === 'error' && (
              <View style={styles.center}>
                <View style={styles.iconCircleError}>
                  <Ionicons name="alert-circle" size={56} color="#DC2626" />
                </View>
                <Text style={styles.title}>Reset Link Expired</Text>
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {errorMessage || 'This password reset link is invalid or has expired.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Request New Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { marginTop: 12 }]}
                  onPress={handleGoToLogin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Back to Log In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scroll: {
    flexGrow: 1,
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
  inner: {
    width: '100%',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircleSuccess: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EAF2FA',
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
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  checkingText: {
    fontSize: 15,
    color: colors.dark,
    fontWeight: '600',
    marginTop: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    width: '100%',
    marginBottom: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  btn: {
    marginTop: 10,
    width: '100%',
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

