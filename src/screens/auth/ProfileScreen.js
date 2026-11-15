import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase, isConfigured } from '../../lib/supabase';
import { getSavedWorkerSelection, fetchScheduleRules } from '../../lib/dataService';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useAction } from '../../hooks/useAction';
import { colors } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets?.top || 0,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0
  );

  const { user, signOut, refreshUser } = useAuth();
  const runAction = useAction();
  const isAdmin = user?.role === 'admin';

  const { groups: workerGroupsList, groupByUser, taskCountByGroup } = useWorkerGroups();
  const myGroupId = user?.id ? groupByUser[user.id] : null;
  const myGroup = myGroupId ? workerGroupsList.find((g) => g.id === myGroupId) : null;
  const myGroupTasksCount = myGroupId ? (taskCountByGroup[myGroupId] || 0) : 0;

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

  // Selected Station
  const [workerSelection, setWorkerSelection] = useState(null);

  // Activity Logs
  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || '');
    loadWorkerStation();
    loadUserActivity();
  }, [user]);

  const loadWorkerStation = async () => {
    const saved = await getSavedWorkerSelection();
    setWorkerSelection(saved);
  };

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
        title: 'Update Display Name?',
        message: `Change profile name to "${fullName.trim()}"?`,
        confirmText: 'Save Name',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'person-outline',
      },
      loading: 'Saving profile name...',
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
      success: 'Profile name updated successfully',
      onSuccess: () => {
        setEditingName(false);
      },
    });
  };

  const handleUpdatePassword = () => {
    setPasswordNotice('');
    if (newPassword.length < 8) {
      setPasswordNotice('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice('Passwords do not match.');
      return;
    }

    runAction({
      confirm: {
        title: 'Change Password?',
        message: 'Are you sure you want to update your login password?',
        confirmText: 'Update Password',
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
      success: 'Password updated successfully',
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
        message: 'Are you sure you want to sign out of your account?',
        confirmText: 'Sign Out',
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

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={styles.screen}>
      {/* Slim Header */}
      <View style={[styles.topBar, { paddingTop: topInset + 6, height: topInset + 52 }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.sunLogo}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
          <Text style={styles.topBarTitle}>Technician Profile</Text>
        </View>
        <TouchableOpacity onPress={handleConfirmSignOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
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
              >
                <Ionicons name="close" size={18} color={colors.dark} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={() => setEditingName(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.userName}>{user?.full_name || 'Technician'}</Text>
              <Ionicons name="pencil" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{isAdmin ? 'ADMINISTRATOR' : 'FIELD WORKER'}</Text>
          </View>
        </View>

        {/* Worker Group Information */}
        {!isAdmin && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Worker Group & Shift</Text>
            {myGroup ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <WorkerGroupBadge group={myGroup} />
                  <Text style={styles.groupTasksCountBadge}>
                    {myGroupTasksCount} {myGroupTasksCount === 1 ? 'task' : 'tasks'} assigned
                  </Text>
                </View>

                {myGroup.description && (
                  <Text style={styles.groupDescText}>{myGroup.description}</Text>
                )}

                {myGroup.shift_start && myGroup.shift_end && (
                  <View style={styles.groupMetaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.groupMetaText}>
                      Shift: {myGroup.shift_label ? `${myGroup.shift_label} • ` : ''}
                      {myGroup.shift_start.slice(0, 5)} - {myGroup.shift_end.slice(0, 5)}
                    </Text>
                  </View>
                )}

                {myGroup.work_days && myGroup.work_days.length > 0 && (
                  <View style={styles.groupMetaRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.groupMetaText}>
                      Work Days: {myGroup.work_days.map((d) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d-1]).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noGroupProfileBox}>
                <Ionicons name="people-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noGroupProfileText}>
                  You are not currently assigned to a worker group. Contact your administrator.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Assigned System / Station */}
        {!isAdmin && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Current Assignment</Text>
            <View style={styles.stationRow}>
              <Ionicons name="navigate-outline" size={20} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.stationLabel}>Assigned Work Station</Text>
                <Text style={styles.stationVal}>
                  {workerSelection?.categoryName || 'All Systems'}
                  {workerSelection?.area && workerSelection.area !== 'All'
                    ? ` • ${workerSelection.area}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeStationBtn}
                onPress={() => navigation.navigate('ChooseWorkTab')}
              >
                <Text style={styles.changeStationText}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Password & Security */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Account</Text>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowPasswordModal(!showPasswordModal)}
            activeOpacity={0.7}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.dark} />
            <Text style={styles.menuRowText}>Change Password</Text>
            <Ionicons
              name={showPasswordModal ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {showPasswordModal && (
            <View style={styles.passwordBox}>
              {passwordNotice ? (
                <Text style={styles.passwordNoticeText}>{passwordNotice}</Text>
              ) : null}
              <TextInput
                style={styles.passwordInput}
                placeholder="New Password (min 8 chars)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.updatePasswordBtn}
                onPress={handleUpdatePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.updatePasswordText}>Save New Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.menuRow} onPress={handleConfirmSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={[styles.menuRowText, { color: '#DC2626', fontWeight: '700' }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* My Activity (Last 30 entries) */}
        <View style={styles.sectionCard}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.sectionTitle}>My Activity (Recent 30)</Text>
            <TouchableOpacity onPress={loadUserActivity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loadingLogs ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 14 }} />
          ) : userLogs.length === 0 ? (
            <Text style={styles.emptyActivityText}>No recorded activity logs yet.</Text>
          ) : (
            userLogs.map((log) => {
              const d = new Date(log.created_at);
              return (
                <View key={log.id} style={styles.activityItem}>
                  <View style={styles.activityDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityAction}>{log.action}</Text>
                    <Text style={styles.activityTime}>{d.toLocaleString()}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>Solar PM Maintenance Hub • v1.0.0</Text>
      </ScrollView>
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sunLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.dark,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    marginBottom: 10,
    gap: 6,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    color: colors.dark,
    fontWeight: '600',
  },
  saveNameBtn: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 8,
  },
  cancelNameBtn: {
    backgroundColor: '#E2E8F0',
    padding: 8,
    borderRadius: 8,
  },
  groupTasksCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  groupDescText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupMetaText: {
    fontSize: 12,
    color: colors.dark,
    fontWeight: '600',
  },
  noGroupProfileBox: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    gap: 4,
  },
  noGroupProfileText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.darkMuted,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stationVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 2,
  },
  changeStationBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changeStationText: {
    color: colors.primaryDark || '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuRowText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.dark,
  },
  passwordBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordNoticeText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.dark,
    marginBottom: 10,
  },
  updatePasswordBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  updatePasswordText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
    fontWeight: '600',
    color: colors.dark,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
});
