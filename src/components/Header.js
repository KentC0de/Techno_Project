import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function Header({
  title,
  subtitle,
  rightAction = null,
  showRoleSwitch = true,
  navigation = null,
}) {
  const { user, isSupabaseLive, signOut } = useAuth();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.userArea}>
          {/* Supabase Status Pill */}
          <View
            style={[
              styles.statusPill,
              isSupabaseLive ? styles.statusLive : styles.statusDemo,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isSupabaseLive ? '#10B981' : '#F59E0B' },
              ]}
            />
            <Text style={styles.statusText}>
              {isSupabaseLive ? 'Supabase Live' : 'Demo Mode'}
            </Text>
          </View>

          {/* User profile icon & role */}
          {user && (
            <TouchableOpacity
              style={styles.profileBadge}
              onPress={() => {
                if (navigation) {
                  navigation.navigate('Profile');
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={14} color={colors.white} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.full_name?.split(' ')[0] || user.role}
                </Text>
                <Text style={styles.userRole}>
                  {user.role === 'admin' ? 'Admin' : 'Worker'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.dark,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  titleArea: {
    flex: 1,
    minWidth: 180,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.primaryLight,
    marginTop: 2,
    fontWeight: '500',
  },
  userArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusLive: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  statusDemo: {
    backgroundColor: '#3E2405',
    borderColor: '#D97706',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  userInfo: {
    flexDirection: 'column',
  },
  userName: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  userRole: {
    color: colors.primaryLight,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});

