import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useConnectionStatus } from '../context/ConnectionStatusContext';
import NotificationBell from './NotificationBell';
import { colors } from '../theme';

export default function Header({
  title,
  subtitle,
  rightAction = null,
  onNavigate = null,
}) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { toggleSidebar } = useSidebar();
  const { status: connStatus, lastCheckedTime } = useConnectionStatus();
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const isAdmin = user?.role === 'admin';

  const [tooltipVisible, setTooltipVisible] = useState(false);

  const getStatusColor = () => {
    if (connStatus === 'connected') return '#10B981';
    if (connStatus === 'checking') return '#F59E0B';
    return '#EF4444';
  };

  const getStatusTitle = () => {
    if (connStatus === 'connected') return 'Supabase connected - Live';
    if (connStatus === 'checking') return 'Checking connection...';
    return 'Cannot reach Supabase';
  };

  const handleBellNavigate = (screen, params) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      try {
        navigation.navigate('AdminRoot', { screen, params });
      } catch (_) {
        try {
          navigation.navigate(screen, params);
        } catch (__) {}
      }
    }
  };

  const initials = (() => {
    const parts = (user?.full_name || (isAdmin ? 'Admin' : 'Worker')).trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.[0] || 'A').toUpperCase();
  })();
  const showTopBar = Platform.OS === 'web' && isAdmin;

  return (
    <View style={styles.headerContainer}>
      {showTopBar && (
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={toggleSidebar}
              activeOpacity={0.7}
              accessibilityLabel="Toggle sidebar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="menu-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            {!isNarrow && (
              <Text style={styles.breadcrumb} numberOfLines={1}>
                Workspace <Text style={styles.breadcrumbSep}>/</Text>{' '}
                <Text style={styles.breadcrumbCurrent}>{title}</Text>
              </Text>
            )}
          </View>

          <View style={styles.rightArea}>
            {!isNarrow && (
              <View style={styles.plantPill}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={styles.plantPillText}>{getStatusTitle()}</Text>
              </View>
            )}
            <NotificationBell onNavigate={handleBellNavigate} />
            <View style={styles.userChip}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              {!isNarrow && (
                <View>
                  <Text style={styles.userName} numberOfLines={1}>{user?.full_name || 'Admin'}</Text>
                  <Text style={styles.userRole}>Site Engineer</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.pageRow}>
        <View style={styles.titleTextContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.rightArea}>
          {!showTopBar && (
            <View style={styles.statusDotWrapper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={getStatusTitle()}
                onHoverIn={() => setTooltipVisible(true)}
                onHoverOut={() => setTooltipVisible(false)}
                onPress={() => setTooltipVisible((v) => !v)}
                style={styles.dotTouchTarget}
              >
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              </Pressable>
              {tooltipVisible && (
                <View style={styles.tooltipPopover}>
                  <Text style={styles.tooltipTitle}>{getStatusTitle()}</Text>
                  {lastCheckedTime ? (
                    <Text style={styles.tooltipTime}>Last checked: {lastCheckedTime}</Text>
                  ) : null}
                </View>
              )}
            </View>
          )}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 100,
  },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 200,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuBtn: { padding: 8, borderRadius: 8, marginRight: 12 },
  breadcrumb: { fontSize: 14, color: colors.textSecondary },
  breadcrumbSep: { color: colors.textMuted },
  breadcrumbCurrent: { fontWeight: '600', color: colors.dark },
  plantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F6EE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  plantPillText: { fontSize: 12, fontWeight: '600', color: '#166534', marginLeft: 6 },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF2FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  userName: { fontSize: 13, fontWeight: '600', color: colors.dark, maxWidth: 160 },
  userRole: { fontSize: 11, color: colors.textMuted },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 18,
  },
  titleTextContainer: { flex: 1 },
  title: { fontSize: 26, fontWeight: '600', color: colors.dark, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  rightArea: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  statusDotWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  dotTouchTarget: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tooltipPopover: {
    position: 'absolute',
    top: 28,
    right: 0,
    backgroundColor: colors.dark,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 170,
    zIndex: 9999,
  },
  tooltipTitle: { fontSize: 11, fontWeight: '700', color: colors.white },
  tooltipTime: { fontSize: 10, color: '#CBD5E1', marginTop: 2 },
});
