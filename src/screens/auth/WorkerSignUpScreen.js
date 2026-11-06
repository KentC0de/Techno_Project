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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import AuthInput from '../../components/AuthInput';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function WorkerSignUpScreen({ navigation }) {
  const { setUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!email.trim() || !isValidEmail(email)) e.email = 'Please enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  };

  const handleSignUp = async () => {
    setGlobalError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;

      if (data.user && !data.session) {
        // Email confirmation required
        setSentEmail(email.trim().toLowerCase());
        setEmailSent(true);
      } else if (data.user && data.session) {
        // Immediate sign-in (email confirmation disabled)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        setUser({
          id: data.user.id,
          email: data.user.email,
          full_name: profile?.full_name || fullName.trim(),
          role: profile?.role || 'worker',
        });
        // AppNavigator will redirect automatically
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setGlobalError('An account with this email already exists. Please sign in instead.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setGlobalError('Connection failed. Please check your internet and try again.');
      } else {
        setGlobalError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Email Sent Success State ---
  if (emailSent) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="mail" size={36} color={colors.primary} />
        </View>
        <Text style={styles.successTitle}>Check your email</Text>
        <Text style={styles.successText}>
          We sent a confirmation link to{'\n'}
          <Text style={{ fontWeight: '700', color: colors.dark }}>{sentEmail}</Text>
        </Text>
        <Text style={styles.successHint}>
          Click the link in the email to activate your account, then come back to log in.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('WorkerLogin')}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Back to Log In</Text>
        </TouchableOpacity>
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backCircle}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.dark} />
          </TouchableOpacity>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Create a new account to see your assigned maintenance tasks.
          </Text>

          {/* Global error */}
          {globalError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{globalError}</Text>
            </View>
          ) : null}

          {/* Inputs */}
          <AuthInput
            variant="pill"
            leftIcon="person-outline"
            placeholder="Full name"
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrors((p) => ({ ...p, fullName: '' })); }}
            autoCapitalize="words"
            textContentType="name"
            returnKeyType="next"
            error={errors.fullName}
          />
          <AuthInput
            variant="pill"
            leftIcon="mail-outline"
            placeholder="Email address"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((p) => ({ ...p, email: '' })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            error={errors.email}
          />
          <AuthInput
            variant="pill"
            leftIcon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors((p) => ({ ...p, password: '' })); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            error={errors.password}
          />
          <AuthInput
            variant="pill"
            leftIcon="lock-closed-outline"
            placeholder="Confirm Password"
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setErrors((p) => ({ ...p, confirm: '' })); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
            error={errors.confirm}
          />

          <PrimaryButton
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            shape="pill"
            style={styles.btn}
          />

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('WorkerLogin')}>
              <Text style={[styles.signInText, styles.link, { fontWeight: '700' }]}>
                Sign In here
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
    marginBottom: 24,
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
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  errorBox: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: colors.dark,
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 36,
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryVeryLight || '#E0F2FE',
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
    color: '#9CA3AF',
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

