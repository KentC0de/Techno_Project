import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getHomeRoute } from '../utils/navigationHelper';
import { colors } from '../theme';

export default function NotFoundScreen({ navigation }) {
  const { user } = useAuth();

  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Page Not Found • Solar PM Hub';
    }
  }, []);

  const handleReturnHome = () => {
    const home = getHomeRoute(user?.role, Platform.OS);
    if (navigation?.navigate) {
      if (home.params) {
        navigation.navigate(home.name, home.params);
      } else {
        navigation.navigate(home.name);
      }
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = user?.role === 'admin' ? '/admin/calendar' : '/';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.message}>
          The page you requested does not exist or has been moved.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleReturnHome}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    padding: 36,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryVeryLight,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

