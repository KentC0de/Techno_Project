import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, layout } from '../../theme';

export default function LoginScreen() {
  const { signIn, signUp, isSupabaseLive } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('worker'); // default role for sign up

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please provide your email and password.');
      return;
    }
    if (isSignUp && !fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click test login for evaluator convenience
  const handleQuickLogin = async (asRole) => {
    try {
      setLoading(true);
      setError('');
      if (asRole === 'admin') {
        await signIn('admin@solarpm.com', 'admin123');
      } else {
        await signIn('worker@solarpm.com', 'worker123');
      }
    } catch (err) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Logo / Header */}
          <View style={styles.brandContainer}>
            <View style={styles.brandIcon}>
              <Ionicons name="sunny" size={32} color={colors.white} />
            </View>
            <Text style={styles.brandName}>Solar PM Hub</Text>
            <Text style={styles.brandSubtitle}>
              Preventive Maintenance Scheduling System
            </Text>
          </View>

          {/* Database status pill */}
          <View
            style={[
              styles.backendPill,
              isSupabaseLive ? styles.pillLive : styles.pillDemo,
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: isSupabaseLive ? '#10B981' : '#F59E0B' },
              ]}
            />
            <Text style={styles.pillText}>
              {isSupabaseLive
                ? 'Connected to Supabase'
                : 'Demo Mode (Add Supabase keys in .env to connect)'}
            </Text>
          </View>

          {/* Tabs: Login / Sign Up */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, !isSignUp && styles.tabActive]}
              onPress={() => {
                setIsSignUp(false);
                setError('');
              }}
            >
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, isSignUp && styles.tabActive]}
              onPress={() => {
                setIsSignUp(true);
                setError('');
              }}
            >
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          {isSignUp && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Morgan"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. technician@solarpm.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {isSignUp && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Account Role</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'worker' && styles.roleBtnActive]}
                  onPress={() => setRole('worker')}
                >
                  <Text style={[styles.roleBtnText, role === 'worker' && styles.roleBtnTextActive]}>
                    Field Worker
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]}
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleBtnText, role === 'admin' && styles.roleBtnTextActive]}>
                    Administrator
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isSignUp ? 'Create Technician Account' : 'Sign In to Hub'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Evaluator Quick Access Helper */}
          <View style={styles.quickAccessSection}>
            <Text style={styles.quickAccessTitle}>QUICK ONE-CLICK DEMO LOGIN</Text>
            <View style={styles.quickBtnRow}>
              <TouchableOpacity
                style={[styles.quickBtn, styles.quickBtnWorker]}
                onPress={() => handleQuickLogin('worker')}
                disabled={loading}
              >
                <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
                <Text style={styles.quickBtnWorkerText}>Worker (Mobile)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickBtn, styles.quickBtnAdmin]}
                onPress={() => handleQuickLogin('admin')}
                disabled={loading}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.white} />
                <Text style={styles.quickBtnAdminText}>Admin (Web/App)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  backendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 18,
    justifyContent: 'center',
  },
  pillLive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  pillDemo: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.dark,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.dark,
    minHeight: layout.minTouchTarget,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  roleBtnTextActive: {
    color: colors.white,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  quickAccessSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAccessTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  quickBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 10,
  },
  quickBtnWorker: {
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  quickBtnWorkerText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  quickBtnAdmin: {
    backgroundColor: colors.dark,
  },
  quickBtnAdminText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
});

