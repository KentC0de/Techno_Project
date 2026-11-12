import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import AuthInput from '../../components/AuthInput';
import PrimaryButton from '../../components/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';

// Try to load the solar background image — fall back gracefully if missing
let loginBg = null;
try {
  loginBg = require('../../../assets/images/login-solar.jpg');
} catch (_) {
  loginBg = null;
}

export default function AdminLoginScreen({ navigation, route }) {
  const { signInWithRoleCheck } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  // Set browser document title on web
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Admin Portal • Solar PM Hub';
    }
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // passwordRef not used since AuthInput doesn't forward refs; Enter on email
  // submits the form instead via returnKeyType="next" focus chain

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      await signInWithRoleCheck(email.trim().toLowerCase(), password, 'admin');
      // If there was a redirect return path stored in route or localStorage, handle it
      let returnPath = route?.params?.returnTo;
      if (!returnPath && Platform.OS === 'web' && typeof window !== 'undefined') {
        returnPath = window.sessionStorage?.getItem('pm_redirect_after_login');
        if (returnPath) {
          window.sessionStorage?.removeItem('pm_redirect_after_login');
          window.location.href = returnPath;
          return;
        }
      }
      // Otherwise AppNavigator automatically renders AdminRoot based on user.role === 'admin'
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <View style={styles.formPanel}>
      <Text style={styles.portalLabel}>ADMIN PORTAL</Text>
      <Text style={styles.welcomeHeading}>Welcome back</Text>
      <Text style={styles.welcomeSub}>Sign in with your administrator account.</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <AuthInput
        variant="underline"
        label="Email"
        placeholder="admin@solarpm.com"
        value={email}
        hasError={Boolean(error)}
        onChangeText={(t) => { setEmail(t); setError(''); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => { }}
      />
      <AuthInput
        variant="underline"
        label="Password"
        placeholder="••••••••"
        value={password}
        hasError={Boolean(error)}
        onChangeText={(t) => { setPassword(t); setError(''); }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <PrimaryButton
        title="Sign In"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        shape="rounded"
        style={styles.signInBtn}
      />

      <View style={styles.formFooter}>
        <Text style={styles.footerNote}>Authorized personnel only</Text>
        <Text style={styles.footerCopy}>© USTP IT Student 2026. All rights reserved.</Text>
      </View>
    </View>
  );

  // --- WIDE LAYOUT (split panel) ---
  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        {/* Left image panel */}
        <View style={styles.leftPanel}>
          {loginBg && (
            <Image source={loginBg} style={styles.bgImage} resizeMode="cover" />
          )}
          {/* Linear gradient overlay (or fallback if image missing) */}
          <LinearGradient
            colors={['#0A0A0A', '#0EA5E9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { opacity: loginBg ? 0.6 : 1 }]}
          />
          {/* Diagonal slice on the right edge */}
          <View style={styles.diagonalSlice} />
          {/* Content */}
          <View style={styles.leftContent}>
            <View style={styles.logoBox}>
              <Ionicons name="sunny" size={26} color={colors.white} />
            </View>
            <Text style={styles.leftBrand}>Solar PM Hub</Text>
            <Text style={styles.leftHeadline}>
              Keep every solar asset on schedule.
            </Text>
            <Text style={styles.leftSub}>
              Plan, assign and track preventive maintenance in one place.
            </Text>
          </View>
        </View>

        {/* Right form panel */}
        <View style={styles.rightPanel}>
          <ScrollView
            contentContainerStyle={styles.rightScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrapper}>{form}</View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // --- NARROW LAYOUT (centered form) ---
  return (
    <ScrollView
      contentContainerStyle={styles.narrowScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <View style={styles.narrowLogoRow}>
        <View style={styles.logoBox}>
          <Ionicons name="sunny" size={26} color={colors.white} />
        </View>
        <Text style={styles.narrowBrand}>Solar PM Hub</Text>
      </View>
      {form}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // --- WIDE ---
  wideRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
  },
  leftPanel: {
    flex: 55,
    position: 'relative',
    overflow: 'hidden',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  // Diagonal slice — white wedge on right edge to create the angled split
  diagonalSlice: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 100,
    height: '130%',
    backgroundColor: colors.white,
    transform: [{ rotate: '6deg' }],
    zIndex: 2,
  },
  leftContent: {
    position: 'absolute',
    bottom: 60,
    left: 48,
    right: 80,
    zIndex: 3,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  leftBrand: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 20,
    opacity: 0.85,
  },
  leftHeadline: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 14,
  },
  leftSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 23,
  },

  rightPanel: {
    flex: 45,
    backgroundColor: colors.white,
  },
  rightScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 380,
  },

  // --- NARROW ---
  narrowScroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 56,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  narrowLogoRow: {
    alignItems: 'center',
    marginBottom: 36,
  },
  narrowBrand: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: 0.3,
  },

  // --- FORM ---
  formPanel: {
    width: '100%',
  },
  portalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  welcomeHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 32,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  signInBtn: {
    marginTop: 28,
    marginBottom: 36,
  },
  formFooter: {
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  footerCopy: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
