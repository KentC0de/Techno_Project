import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import { colors, layout } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, signOut, isSupabaseLive } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <View style={styles.screen}>
      <Header
        title="My Profile"
        subtitle="Technician settings and session preferences"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View
            style={[
              styles.avatar,
              isAdmin ? styles.avatarAdmin : styles.avatarWorker,
            ]}
          >
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'person'}
              size={36}
              color={colors.white}
            />
          </View>
          <Text style={styles.userName}>{user?.full_name || 'Technician'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>

          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>
              {isAdmin ? 'ADMINISTRATOR' : 'FIELD WORKER'}
            </Text>
          </View>
        </View>

        {/* Database & Environment Info */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Backend Connection</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database Mode</Text>
            <Text style={[styles.infoVal, isSupabaseLive && { color: '#059669' }]}>
              {isSupabaseLive ? 'Supabase PostgreSQL (Live)' : 'Mock Demo Store'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoVal} numberOfLines={1}>
              {user?.id || 'demo-user'}
            </Text>
          </View>
        </View>

        {/* Navigation / Switch View shortcuts */}
        <View style={styles.actionCard}>
          <Text style={styles.cardTitle}>View Modes</Text>
          {isAdmin ? (
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => navigation.navigate('WorkerToday')}
            >
              <View style={styles.navLeft}>
                <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
                <Text style={styles.navLabel}>Preview Field Worker View</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => navigation.navigate('ChooseWork', { isChangingWork: true })}
            >
              <View style={styles.navLeft}>
                <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
                <Text style={styles.navLabel}>Change Assigned System & Area</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={signOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarAdmin: {
    backgroundColor: colors.dark,
  },
  avatarWorker: {
    backgroundColor: colors.primary,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.dark,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  roleTag: {
    marginTop: 12,
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    maxWidth: 240,
  },
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: layout.minTouchTarget,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
    marginLeft: 10,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 12,
    minHeight: 50,
  },
  signOutText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

