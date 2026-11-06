import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, layout } from '../theme';

export default function WebSidebar({ activeRoute, onNavigate }) {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';

  const adminNavItems = [
    { key: 'AdminCalendar', label: 'Schedule Calendar', icon: 'calendar-outline' },
    { key: 'SetSchedule', label: 'Set Schedule', icon: 'create-outline' },
    { key: 'ManageEquipment', label: 'Equipment & Systems', icon: 'hardware-chip-outline' },
    { key: 'Performance', label: 'Performance Report', icon: 'stats-chart-outline' },
    { key: 'Users', label: 'User Roles', icon: 'people-outline' },
    { key: 'WorkerToday', label: 'Worker View', icon: 'phone-portrait-outline' },
  ];

  const workerNavItems = [
    { key: 'WorkerToday', label: 'Today\'s Work', icon: 'today-outline' },
    { key: 'ChooseWork', label: 'Switch System / Area', icon: 'grid-outline' },
  ];

  const navItems = isAdmin ? adminNavItems : workerNavItems;

  return (
    <View style={styles.sidebar}>
      {/* Brand logo header */}
      <View style={styles.brandBox}>
        <View style={styles.brandIcon}>
          <Ionicons name="sunny" size={24} color={colors.white} />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.brandTitle}>Solar PM</Text>
          <Text style={styles.brandSub}>Maintenance Hub</Text>
        </View>
      </View>

      {/* Navigation items */}
      <View style={styles.navSection}>
        <Text style={styles.sectionHeader}>
          {isAdmin ? 'ADMINISTRATION' : 'MAINTENANCE WORK'}
        </Text>
        {navItems.map((item) => {
          const isActive = activeRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => onNavigate(item.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? colors.primary : colors.textMuted}
                style={styles.navIcon}
              />
              <Text style={[styles.navText, isActive && styles.navTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer Profile & Sign out */}
      <View style={styles.footer}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name || 'Technician'}
            </Text>
            <Text style={styles.userRole}>
              {user?.role === 'admin' ? 'Administrator' : 'Field Worker'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={signOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: layout.sidebarWidth,
    backgroundColor: colors.dark,
    borderRightWidth: 1,
    borderRightColor: '#262626',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    marginBottom: 20,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandText: {
    flexDirection: 'column',
  },
  brandTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  navSection: {
    flex: 1,
  },
  sectionHeader: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#1E293B',
  },
  navIcon: {
    marginRight: 12,
  },
  navText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '600',
  },
  navTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#262626',
    paddingTop: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  userRole: {
    color: colors.textMuted,
    fontSize: 11,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
});

