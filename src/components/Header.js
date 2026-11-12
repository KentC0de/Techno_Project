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
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useConnectionStatus } from '../context/ConnectionStatusContext';
import { colors } from '../theme';

export default function Header({
  title,
  subtitle,
  rightAction = null,
}) {
  const { user } = useAuth();
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

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          {/* Hamburger button ONLY on narrow screens (< 900px) */}
          {Platform.OS === 'web' && isAdmin && isNarrow && (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={toggleSidebar}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="menu" size={24} color={colors.white} />
            </TouchableOpacity>
          )}
          <View style={styles.titleTextContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightArea}>
          {/* Supabase Status Dot Only with Tooltip on Hover/Focus */}
          <View style={styles.statusDotWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getStatusTitle()}
              onHoverIn={() => setTooltipVisible(true)}
              onHoverOut={() => setTooltipVisible(false)}
              onFocus={() => setTooltipVisible(true)}
              onBlur={() => setTooltipVisible(false)}
              onPress={() => setTooltipVisible((v) => !v)}
              style={styles.dotTouchTarget}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor() },
                ]}
              />
            </Pressable>

            {/* Tooltip positioned below the dot, aligned to the right */}
            {tooltipVisible && (
              <View style={styles.tooltipPopover}>
                <Text style={styles.tooltipTitle}>{getStatusTitle()}</Text>
                {lastCheckedTime ? (
                  <Text style={styles.tooltipTime}>Last checked: {lastCheckedTime}</Text>
                ) : null}
              </View>
            )}
          </View>

          {/* Action button (e.g., + Add Rule) */}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0A0A0A',
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    zIndex: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuBtn: {
    marginRight: 12,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginTop: 2,
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  statusDotWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  dotTouchTarget: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tooltipPopover: {
    position: 'absolute',
    top: 28,
    right: 0,
    backgroundColor: '#15181E',
    borderWidth: 1,
    borderColor: '#2D323B',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 170,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  tooltipTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
});
