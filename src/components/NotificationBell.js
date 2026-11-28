import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsContext } from '../context/NotificationsProvider';
import { colors } from '../theme';

function formatRelativeTime(isoStr) {
  if (!isoStr) return '';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  if (isNaN(then)) return '';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getNotificationIcon(type) {
  switch (type) {
    case 'report_submitted':
      return { name: 'document-text-outline', color: '#D97706' };
    case 'report_reviewed':
      return { name: 'checkmark-circle-outline', color: colors.primary };
    case 'report_returned':
      return { name: 'close-circle-outline', color: '#DC2626' };
    case 'task_assigned':
      return { name: 'calendar-outline', color: colors.primary };
    default:
      return { name: 'notifications-outline', color: colors.textSecondary };
  }
}

export default function NotificationBell({ onNavigate }) {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    loadMore,
    hasMore,
    loading,
  } = useNotificationsContext();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on Escape key on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleItemPress = useCallback(
    (item) => {
      markRead(item.id);
      setIsOpen(false);

      if (!onNavigate) return;

      if (item.type === 'report_submitted') {
        onNavigate('AdminCalendar', {
          view: 'reports',
          reportGroupId: item.data?.group_id || null,
          reportDate: item.data?.report_date || null,
        });
      } else if (item.type === 'task_assigned') {
        onNavigate('AdminCalendar');
      }
    },
    [markRead, onNavigate]
  );

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View style={styles.wrapper} ref={containerRef}>
      {/* Bell Button (40px) */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={toggleDropdown}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{displayCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Panel anchored under the bell */}
      {isOpen && (
        <>
          {/* Backdrop on web to catch outside clicks */}
          {Platform.OS === 'web' && (
            <Pressable
              style={styles.outsideOverlay}
              onPress={() => setIsOpen(false)}
            />
          )}

          <View style={styles.dropdownPanel}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                  <Text style={styles.markAllReadText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={notifications.length === 0 ? styles.emptyScroll : undefined}
            >
              {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyText}>You are all caught up</Text>
                </View>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.read_at;
                  const iconInfo = getNotificationIcon(item.type);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.item,
                        isUnread && styles.itemUnread,
                      ]}
                      onPress={() => handleItemPress(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemIconCol}>
                        <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
                      </View>
                      <View style={styles.itemContent}>
                        <View style={styles.itemTopRow}>
                          <Text style={[styles.itemTitle, isUnread && styles.itemTitleBold]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {isUnread && <View style={styles.unreadDot} />}
                        </View>
                        {item.body ? (
                          <Text style={styles.itemBody} numberOfLines={2}>
                            {item.body}
                          </Text>
                        ) : null}
                        <Text style={styles.itemTime}>
                          {formatRelativeTime(item.created_at)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Load More Button */}
              {hasMore && notifications.length > 0 && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={loadMore}
                  disabled={loading}
                >
                  <Text style={styles.loadMoreText}>
                    {loading ? 'Loading...' : 'Load more'}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 500,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    includeFontPadding: false,
  },
  outsideOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 550,
  },
  dropdownPanel: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 380,
    maxHeight: 480,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 600,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: '#FAFAFA',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollList: {
    maxHeight: 420,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
    gap: 10,
  },
  itemUnread: {
    backgroundColor: '#F5F9FD',
  },
  itemIconCol: {
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 13,
    color: colors.dark,
    flex: 1,
  },
  itemTitleBold: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6,
  },
  itemBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: '#FAFAFA',
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
});

