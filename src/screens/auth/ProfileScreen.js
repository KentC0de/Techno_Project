import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase, isConfigured } from '../../lib/supabase';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useConnectionStatus } from '../../context/ConnectionStatusContext';
import { useNotificationsContext } from '../../context/NotificationsProvider';
import WorkerNotificationsModal from '../../components/WorkerNotificationsModal';
import { useAction } from '../../hooks/useAction';
import { a11yRole } from '../../utils/a11y';
import { colors } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets?.top || 0,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0
  );

  const { user, signOut, refreshUser } = useAuth();
  const runAction = useAction();
  const { status: connStatus } = useConnectionStatus();
  const { unreadCount: workerUnreadNotifs } = useNotificationsContext();
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const { groups: workerGroupsList, groupByUser } = useWorkerGroups();
  const myGroupId = user?.id ? groupByUser[user.id] : null;
  const myGroup = myGroupId ? workerGroupsList.find((g) => g.id === myGroupId) : null;

  // Edit Name
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  // Change Password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');

  // Activity Sheet
  const [showActivitySheet, setShowActivitySheet] = useState(false);
  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || '');
  }, [user]);

  const loadUserActivity = async () => {
    if (!isConfigured || !supabase || !user?.id) return;
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setUserLogs(data);
      }
    } catch (_) {
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveName = () => {
    if (!fullName.trim() || fullName.trim() === user?.full_name) {
      setEditingName(false);
      return;
    }

    runAction({
      confirm: {
        title: 'Save Name?',
        message: `Change name to "${fullName.trim()}"?`,
        confirmText: 'Save',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'person-outline',
      },
      loading: 'Saving name...',
      action: async () => {
        if (isConfigured && supabase) {
          const { error } = await supabase
            .from('profiles')
            .update({ full_name: fullName.trim() })
            .eq('id', user.id);

          if (error) throw error;
          await refreshUser();
        }
      },
      success: 'Profile name updated',
      onSuccess: () => {
        setEditingName(false);
      },
    });
  };

  const handleUpdatePassword = () => {
    setPasswordNotice('');
    if (newPassword.length < 8) {
      setPasswordNotice('Password must be at least 8 chars.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice('Passwords do not match.');
      return;
    }

    runAction({
      confirm: {
        title: 'Change Password?',
        message: 'Update your login password?',
        confirmText: 'Update',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'key-outline',
      },
      loading: 'Updating password...',
      action: async () => {
        if (isConfigured && supabase) {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
        }
      },
      success: 'Password updated',
      onSuccess: () => {
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
      },
    });
  };

  const handleConfirmSignOut = () => {
    runAction({
      confirm: {
        title: 'Sign Out?',
        message: 'Are you sure you want to sign out?',
        confirmText: 'Sign Out',
        cancelText: 'Stay',
        tone: 'danger',
        icon: 'log-out-outline',
      },
      loading: 'Signing out...',
      action: async () => {
        await signOut();
      },
      success: 'Signed out',
    });
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getStatusColor = () => {
    if (connStatus === 'connected') return '#10B981';
    if (connStatus === 'checking') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.screen}>
      {/* Top Bar: left = Screen title "Profile", right = Bell + connection dot */}
      <View style={[styles.topBar, { paddingTop: topInset + 6, height: topInset + 50 }]}>
        <Text style={styles.topBarTitle}>Profile</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />

          <TouchableOpacity
            style={styles.bellTouch}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={colors.white} />
            {workerUnreadNotifs > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {workerUnreadNotifs > 99 ? '99+' : workerUnreadNotifs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name card */}
        <View style={styles.userCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarInitials}>{getInitials(user?.full_name)}</Text>
          </View>

          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.nameInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={styles.saveNameBtn}
                onPress={handleSaveName}
                disabled={savingName}
                {...a11yRole('button')}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelNameBtn}
                onPress={() => {
                  setFullName(user?.full_name || '');
                  setEditingName(false);
                }}
                {...a11yRole('button')}
              >
                <Ionicons name="close" size={18} color={colors.dark} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={() => setEditingName(true)}
              activeOpacity={0.7}
              {...a11yRole('button')}
            >
              <Text style={styles.userName}>{user?.full_name || 'Worker'}</Text>
              <Ionicons name="pencil" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {/* Card: "Group A - Day shift" */}
        <View style={styles.groupCard}>
          <Ionicons name="people" size={20} color={colors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.groupCardTitle}>
              {myGroup?.name || 'No Group Assigned'}
            </Text>
            {myGroup?.shift_label ? (
              <Text style={styles.groupCardSub}>{myGroup.shift_label}</Text>
            ) : null}
          </View>
        </View>

        {/* Simple Rows: Notifications, Change password, Activity, Sign out */}
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
            {...a11yRole('button')}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <Text style={styles.menuItemText}>Notifications</Text>
            {workerUnreadNotifs > 0 && (
              <View style={styles.menuItemBadge}>
                <Text style={styles.menuItemBadgeText}>{workerUnreadNotifs}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPasswordModal(!showPasswordModal)}
            activeOpacity={0.7}
            {...a11yRole('button')}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <Text style={styles.menuItemText}>Change Password</Text>
            <Ionicons name={showPasswordModal ? 'chevron-up' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showPasswordModal && (
            <View style={styles.passwordBox}>
              {passwordNotice ? (
                <Text style={styles.passwordNoticeText}>{passwordNotice}</Text>
              ) : null}
              <TextInput
                style={styles.passwordInput}
                placeholder="New password (8+ chars)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.updatePasswordBtn}
                onPress={handleUpdatePassword}
                disabled={savingPassword}
                {...a11yRole('button')}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.updatePasswordText}>Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowActivitySheet(!showActivitySheet);
              if (!showActivitySheet && userLogs.length === 0) {
                loadUserActivity();
              }
            }}
            activeOpacity={0.7}
            {...a11yRole('button')}
          >
            <Ionicons name="time-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <Text style={styles.menuItemText}>Activity</Text>
            <Ionicons name={showActivitySheet ? 'chevron-up' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showActivitySheet && (
            <View style={styles.activityBox}>
              {loadingLogs ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : userLogs.length === 0 ? (
                <Text style={styles.emptyText}>No recent activity</Text>
              ) : (
                userLogs.slice(0, 10).map((log) => (
                  <View key={log.id} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityAction} numberOfLines={1}>{log.action}</Text>
                      <Text style={styles.activityTime}>{new Date(log.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={handleConfirmSignOut}
            activeOpacity={0.7}
            {...a11yRole('button')}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 12 }} />
            <Text style={[styles.menuItemText, { color: colors.danger, fontWeight: '700' }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Solar PM • v1.0</Text>
      </ScrollView>

      {/* Notifications Modal */}
      <WorkerNotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bellTouch: {
    padding: 6,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EAF2FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    minWidth: 180,
  },
  saveNameBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelNameBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  groupCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  groupCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    minHeight: 48,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  menuItemBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  menuItemBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  passwordBox: {
    padding: 14,
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 8,
  },
  passwordNoticeText: {
    fontSize: 12,
    color: colors.danger,
  },
  passwordInput: {
    height: 42,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  updatePasswordBtn: {
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatePasswordText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  activityBox: {
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  activityAction: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  versionText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
});
