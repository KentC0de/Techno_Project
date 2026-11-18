import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
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
    case 'task_submitted':
      return { name: 'time-outline', color: colors.primary };
    case 'task_approved':
      return { name: 'checkmark-circle-outline', color: '#16A34A' };
    case 'task_rejected':
      return { name: 'close-circle-outline', color: '#DC2626' };
    case 'task_assigned':
      return { name: 'calendar-outline', color: colors.primary };
    default:
      return { name: 'notifications-outline', color: colors.textSecondary };
  }
}

export default function WorkerNotificationsModal({ visible, onClose, onSelectNotification }) {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    loadMore,
    hasMore,
    loading,
  } = useNotificationsContext();

  const handleItemPress = (item) => {
    markRead(item.id);
    onClose();
    if (onSelectNotification) {
      onSelectNotification(item);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadSubtitle}>{unreadCount} unread</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications List */}
        <ScrollView contentContainerStyle={notifications.length === 0 ? styles.emptyScroll : styles.listContent}>
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptySub}>No notifications right now.</Text>
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
                    <Ionicons name={iconInfo.name} size={22} color={iconInfo.color} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemTopRow}>
                      <Text style={[styles.itemTitle, isUnread && styles.itemTitleBold]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    {item.body ? (
                      <Text style={styles.itemBody}>
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

          {hasMore && notifications.length > 0 && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMore}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
    backgroundColor: '#0A0A0A',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  unreadSubtitle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  listContent: {
    paddingBottom: 32,
    backgroundColor: colors.background,
    minHeight: '100%',
  },
  emptyScroll: {
    flexGrow: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
    gap: 12,
  },
  itemUnread: {
    backgroundColor: '#F0F9FF',
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
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
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
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  itemTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  loadMoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 10,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});

