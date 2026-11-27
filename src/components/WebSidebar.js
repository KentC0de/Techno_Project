import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useSystemFilter } from '../context/SystemFilterContext';
import { useAction } from '../hooks/useAction';
import { useSubmittedReportsCount } from '../hooks/useSubmittedReportsCount';
import { fetchScheduleRules, fetchTaskLogs } from '../lib/dataService';
import {
  formatDate,
  getWorkWeek,
  buildDueTasks,
  computePerformance,
} from '../utils/schedule';
import { computeTaskCounts } from '../utils/taskStatus';
import { colors } from '../theme';

const ROUTE_LABELS = {
  AdminCalendar: 'Schedule Calendar • Solar PM Hub',
  ReportsList: 'Reports • Solar PM Hub',
  ReportDetail: 'Report Detail • Solar PM Hub',
  SetSchedule: 'Set Schedule • Solar PM Hub',
  AssignWorkers: 'Assign Workers • Solar PM Hub',
  ManageEquipment: 'Equipment & Systems • Solar PM Hub',
  Performance: 'Performance Report • Solar PM Hub',
  Users: 'User Roles • Solar PM Hub',
  ActivityLogs: 'Activity Logs • Solar PM Hub',
  WorkerToday: 'Worker View • Solar PM Hub',
  ChooseWork: 'My System • Solar PM Hub',
};

const SYSTEMS = [
  { id: 'A', name: 'A - Inverter Station Area', desc: 'Inverter Station Area', color: '#0EA5E9' },
  { id: 'B', name: 'B - PV Field Area', desc: 'PV Field Area', color: '#10B981' },
  { id: 'C', name: 'C - MV & LV System', desc: 'MV & LV System', color: '#F59E0B' },
  { id: 'D', name: 'D - Other System', desc: 'Other Systems', color: '#8B5CF6' },
];

export default function WebSidebar({ activeRoute, onNavigate, onClose }) {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { selectedSystem, setSelectedSystem, systemOptions } = useSystemFilter();
  const runAction = useAction();

  const [systemsGroupOpen, setSystemsGroupOpen] = useState(true);
  const [systemDropdownOpen, setSystemDropdownOpen] = useState(false);
  const [railFlyoutOpen, setRailFlyoutOpen] = useState(false);

  // Animated width for smooth expand / collapse
  const sidebarWidthAnim = useRef(new Animated.Value(isCollapsed ? 72 : 260)).current;

  useEffect(() => {
    Animated.timing(sidebarWidthAnim, {
      toValue: isCollapsed ? 72 : 260,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed, sidebarWidthAnim]);

  // Update browser document.title on route change
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = ROUTE_LABELS[activeRoute] || 'Solar PM Hub';
    }
  }, [activeRoute]);

  // Live queries for badge counts and weekly performance (cached with 60s stale time)
  const todayStr = useMemo(() => formatDate(new Date()), []);
  const currentWeek = useMemo(() => getWorkWeek(todayStr), [todayStr]);

  const { data: rules = [] } = useQuery({
    queryKey: ['schedule_rules', 'all'],
    queryFn: () => fetchScheduleRules(null),
    staleTime: 60 * 1000,
  });

  const { data: weekLogs = [] } = useQuery({
    queryKey: ['task_logs', currentWeek.start, currentWeek.end],
    queryFn: () => fetchTaskLogs(currentWeek.start, currentWeek.end),
    staleTime: 60 * 1000,
  });

  const { count: submittedReportsCount } = useSubmittedReportsCount({ enabled: isAdmin });

  // Today's due tasks & Overdue tasks count
  const { todayDueCount, overdueCount, weekPerformanceRate } = useMemo(() => {
    if (!rules || rules.length === 0) {
      return { todayDueCount: 0, overdueCount: 0, weekPerformanceRate: 0 };
    }

    // Weekly tasks
    const weekTasks = buildDueTasks(rules, weekLogs, currentWeek.start, currentWeek.end);
    const perf = computeTaskCounts(weekTasks);

    // Today's tasks (due today and pending)
    const todayTasks = weekTasks.filter((t) => t.dueDate === todayStr);
    const todayPending = todayTasks.filter((t) => t.status === 'pending').length;

    return {
      todayDueCount: todayPending,
      overdueCount: perf.overdue || 0,
      weekPerformanceRate: perf.rate || 0,
    };
  }, [rules, weekLogs, currentWeek, todayStr]);

  const handleSignOut = () => {
    runAction({
      confirm: {
        title: 'Sign Out?',
        message: 'Are you sure you want to end your session?',
        confirmText: 'Sign out',
        cancelText: 'Stay signed in',
        tone: 'danger',
        icon: 'log-out-outline',
      },
      loading: 'Signing out...',
      action: async () => {
        await signOut();
      },
      success: 'Signed out successfully',
    });
  };

  const currentSystemObj = systemOptions.find((s) => s.id === selectedSystem) || systemOptions[0];

  const adminNavItems = [
    {
      key: 'AdminCalendar',
      label: 'Schedule Calendar',
      icon: 'calendar-outline',
      badge: submittedReportsCount > 0 ? (submittedReportsCount > 99 ? '99+' : submittedReportsCount) : null,
      badgeColor: '#0EA5E9',
    },
    {
      key: 'AssignWorkers',
      label: 'Assign Workers',
      icon: 'people-circle-outline',
    },
    {
      key: 'ManageEquipment',
      label: 'Equipment & Systems',
      icon: 'hardware-chip-outline',
    },
    {
      key: 'Performance',
      label: 'Performance Report',
      icon: 'stats-chart-outline',
      badge: overdueCount > 0 ? overdueCount : null,
      badgeColor: '#EF4444',
    },
    {
      key: 'Users',
      label: 'User Roles',
      icon: 'people-outline',
    },
    {
      key: 'ActivityLogs',
      label: 'Activity Logs',
      icon: 'receipt-outline',
    },
    {
      key: 'WorkerToday',
      label: 'Worker View',
      icon: 'phone-portrait-outline',
    },
  ];

  const workerNavItems = [
    { key: 'WorkerToday', label: "Today's Work", icon: 'today-outline' },
    { key: 'ChooseWork', label: 'Switch System / Area', icon: 'grid-outline' },
  ];

  const navItems = isAdmin ? adminNavItems : workerNavItems;

  const handleSystemSelect = (systemId) => {
    setSelectedSystem(systemId);
    setSystemDropdownOpen(false);
    setRailFlyoutOpen(false);
    onNavigate('AdminCalendar');
  };

  const userInitials = useMemo(() => {
    const name = user?.full_name || (isAdmin ? 'Admin' : 'Worker');
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || 'A').toUpperCase();
  }, [user, isAdmin]);

  return (
    <Animated.View style={[styles.sidebar, { width: sidebarWidthAnim }]}>
      {/* 1. Header / Brand Bar (Pinned Top) */}
      <View style={[styles.brandBox, isCollapsed && styles.brandBoxCollapsed]}>
        <View style={styles.brandIcon}>
          <Ionicons name="sunny" size={20} color={colors.white} />
        </View>

        {!isCollapsed && (
          <View style={styles.brandText}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              Solar PM
            </Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              Maintenance Hub
            </Text>
          </View>
        )}

        {/* Toggle / Collapse Button */}
        <TouchableOpacity
          style={styles.collapseToggleBtn}
          onPress={toggleCollapse}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-back'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Workspace / System Selector Dropdown (Pinned Top) */}
      {isAdmin && (
        <View style={[styles.systemSelectContainer, isCollapsed && styles.systemSelectContainerCollapsed]}>
          <TouchableOpacity
            style={[styles.systemSelectorBox, isCollapsed && styles.systemSelectorBoxCollapsed]}
            onPress={() => {
              if (isCollapsed) {
                setRailFlyoutOpen(true);
              } else {
                setSystemDropdownOpen((v) => !v);
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.systemSelectorLeft}>
              <View style={styles.systemIconCircle}>
                <Ionicons name="flash-outline" size={14} color={colors.primary} />
              </View>
              {!isCollapsed && (
                <View style={styles.systemSelectorText}>
                  <Text style={styles.systemSelectorLabel} numberOfLines={1} ellipsizeMode="tail">
                    {currentSystemObj.shortLabel}
                  </Text>
                  <Text style={styles.systemSelectorSub} numberOfLines={1}>
                    Workspace filter
                  </Text>
                </View>
              )}
            </View>
            {!isCollapsed && (
              <Ionicons
                name={systemDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
              />
            )}
          </TouchableOpacity>

          {/* System Dropdown Popover in Expanded state */}
          {!isCollapsed && systemDropdownOpen && (
            <View style={styles.dropdownPopover}>
              {systemOptions.map((opt) => {
                const isSelected = opt.id === selectedSystem;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                    onPress={() => handleSystemSelect(opt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View
                        style={[
                          styles.dropdownItemDot,
                          isSelected && { backgroundColor: colors.primary },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownItemLabel,
                            isSelected && styles.dropdownItemLabelActive,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {opt.label}
                        </Text>
                        <Text style={styles.dropdownItemDesc} numberOfLines={1}>
                          {opt.description}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 3. Middle Scrollable Area: Navigation Links + Systems Group */}
      <ScrollView
        style={styles.scrollNavArea}
        contentContainerStyle={styles.scrollNavContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navSection}>
          {!isCollapsed && (
            <Text style={styles.sectionHeader}>
              {isAdmin ? 'ADMINISTRATION' : 'MAINTENANCE WORK'}
            </Text>
          )}

          {navItems.map((item) => {
            const isActive = activeRoute === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive,
                  isCollapsed && styles.navItemCollapsed,
                ]}
                onPress={() => onNavigate(item.key, item.navigateParams)}
                activeOpacity={0.7}
              >
                <View style={styles.navItemIconWrapper}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={isActive ? colors.primary : colors.textMuted}
                  />
                  {/* Tiny badge dot in rail mode */}
                  {isCollapsed && item.badge ? (
                    <View
                      style={[
                        styles.railBadgeDot,
                        { backgroundColor: item.badgeColor || colors.primary },
                      ]}
                    />
                  ) : null}
                </View>

                {!isCollapsed && (
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                )}

                {/* Number Badge in expanded state */}
                {!isCollapsed && item.badge ? (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: item.badgeColor || colors.primary },
                    ]}
                  >
                    <Text style={styles.countBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {/* 4. Expandable "Systems" Group with Full Names */}
          {isAdmin && !isCollapsed && (
            <View style={styles.systemsGroupContainer}>
              <TouchableOpacity
                style={styles.systemsGroupHeader}
                onPress={() => setSystemsGroupOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={styles.systemsGroupHeaderLeft}>
                  <Ionicons name="layers-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.systemsGroupTitle}>Systems</Text>
                </View>
                <Ionicons
                  name={systemsGroupOpen ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {systemsGroupOpen && (
                <View style={styles.systemsTreeWrapper}>
                  {/* Tree vertical connector line */}
                  <View style={styles.treeLine} />
                  {SYSTEMS.map((sys) => {
                    const isSysActive = selectedSystem === sys.id;
                    return (
                      <TouchableOpacity
                        key={sys.id}
                        style={[
                          styles.systemSubItem,
                          isSysActive && styles.systemSubItemActive,
                        ]}
                        onPress={() => handleSystemSelect(sys.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.subItemDot,
                            { backgroundColor: sys.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.systemSubLabel,
                            isSysActive && styles.systemSubLabelActive,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          title={sys.name}
                        >
                          {sys.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 5. Progress Card ("Performance to schedule") (Pinned Bottom) */}
      {!isCollapsed && (
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressCardTitle}>This Week's Progress</Text>
            <Text style={styles.progressCardPercent}>{weekPerformanceRate}%</Text>
          </View>
          <Text style={styles.progressCardSubtitle}>Performance to schedule</Text>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, Math.max(0, weekPerformanceRate))}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* 6. User Footer Card (Pinned Bottom) */}
      <View style={[styles.footer, isCollapsed && styles.footerCollapsed]}>
        <View style={[styles.userCard, isCollapsed && styles.userCardCollapsed]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{userInitials}</Text>
          </View>

          {!isCollapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.full_name || (isAdmin ? 'Administrator' : 'Worker')}
              </Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {user?.email || (isAdmin ? 'Admin' : 'Field Worker')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signOutIconBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            title="Sign Out"
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 7. Collapsed Rail Flyout Modal / Card */}
      {isCollapsed && railFlyoutOpen && (
        <Modal
          visible={railFlyoutOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setRailFlyoutOpen(false)}
        >
          <TouchableOpacity
            style={styles.flyoutModalBackdrop}
            activeOpacity={1}
            onPress={() => setRailFlyoutOpen(false)}
          >
            <View style={styles.railFlyoutCard}>
              <View style={styles.flyoutHeader}>
                <Text style={styles.flyoutTitle}>Select System</Text>
                <TouchableOpacity
                  onPress={() => setRailFlyoutOpen(false)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {systemOptions.map((opt) => {
                const isSelected = opt.id === selectedSystem;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.flyoutItem, isSelected && styles.flyoutItemActive]}
                    onPress={() => handleSystemSelect(opt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.flyoutItemLeft}>
                      <View
                        style={[
                          styles.flyoutDot,
                          isSelected && { backgroundColor: colors.primary },
                        ]}
                      />
                      <Text
                        style={[
                          styles.flyoutItemLabel,
                          isSelected && styles.flyoutItemLabelActive,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#0A0A0A',
    borderRightWidth: 1,
    borderRightColor: '#171717',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 16,
    height: '100%',
    overflow: 'hidden',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 44,
  },
  brandBoxCollapsed: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
    marginLeft: 10,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  collapseToggleBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#15181E',
    marginLeft: 6,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    marginLeft: 6,
  },
  // System Selector Dropdown
  systemSelectContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
    position: 'relative',
    zIndex: 50,
  },
  systemSelectContainerCollapsed: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  systemSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15181E',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  systemSelectorBoxCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: 44,
    height: 44,
  },
  systemSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  systemIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  systemSelectorText: {
    flex: 1,
  },
  systemSelectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  systemSelectorSub: {
    fontSize: 9,
    color: colors.textMuted,
  },
  dropdownPopover: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    backgroundColor: '#15181E',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingVertical: 4,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItemActive: {
    backgroundColor: '#1E232B',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#52525B',
    marginRight: 10,
  },
  dropdownItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4D4D8',
  },
  dropdownItemLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  dropdownItemDesc: {
    fontSize: 10,
    color: colors.textMuted,
  },
  // Scrollable Middle Area
  scrollNavArea: {
    flex: 1,
    minHeight: 0,
  },
  scrollNavContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  navSection: {
    paddingHorizontal: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#52525B',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 3,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  navItemActive: {
    backgroundColor: '#15181E',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  navItemIconWrapper: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 10,
    flex: 1,
  },
  navLabelActive: {
    color: colors.white,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  railBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Systems Group
  systemsGroupContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#171717',
  },
  systemsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  systemsGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  systemsGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
    marginLeft: 8,
  },
  systemsTreeWrapper: {
    position: 'relative',
    paddingLeft: 22,
    marginTop: 2,
  },
  treeLine: {
    position: 'absolute',
    top: 6,
    bottom: 12,
    left: 28,
    width: 1,
    backgroundColor: '#27272A',
  },
  systemSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  systemSubItemActive: {
    backgroundColor: '#15181E',
  },
  subItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  systemSubLabel: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
    flex: 1,
  },
  systemSubLabelActive: {
    color: colors.white,
    fontWeight: '700',
  },
  // Progress Card
  progressCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#15181E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  progressCardPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  progressCardSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  // Footer
  footer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#171717',
  },
  footerCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userCardCollapsed: {
    flexDirection: 'column',
    gap: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  userRole: {
    fontSize: 10,
    color: colors.textMuted,
  },
  signOutIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E1515',
  },
  // Rail Flyout
  flyoutModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 80,
  },
  railFlyoutCard: {
    width: 240,
    backgroundColor: '#15181E',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 8,
  },
  flyoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    marginBottom: 4,
  },
  flyoutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  flyoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  flyoutItemActive: {
    backgroundColor: '#1E232B',
  },
  flyoutItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flyoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#52525B',
    marginRight: 8,
  },
  flyoutItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D4D4D8',
    flex: 1,
  },
  flyoutItemLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
