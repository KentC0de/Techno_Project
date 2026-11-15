import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { supabase, isConfigured } from '../../lib/supabase';
import { fetchProfiles, updateProfileRole } from '../../lib/dataService';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import WorkerGroupSelect from '../../components/WorkerGroupSelect';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAction } from '../../hooks/useAction';
import { colors } from '../../theme';

export default function UsersScreen({ navigation }) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { isDesktop, isSm } = useBreakpoint();
  const runAction = useAction();

  // Active vs Archived Tabs
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archived'
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'worker'

  // Updating role state
  const [updatingId, setUpdatingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'

  // Disable account modal
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Change worker group modal
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupTargetUser, setGroupTargetUser] = useState(null);
  const [selectedChangeGroupId, setSelectedChangeGroupId] = useState(null);

  const { groups: workerGroupsList, groupByUser, refetch: refetchWorkerGroups } = useWorkerGroups();

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Query profiles (staleTime 30s)
  const {
    data: profiles = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    staleTime: 30 * 1000,
  });

  // Realtime subscription on profiles
  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    const channelId = `admin_users_rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['profiles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Role toggle mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, nextRole }) => updateProfileRole(id, nextRole),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      showToast(`Role updated to ${variables.nextRole.toUpperCase()}`);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to update role.', 'error');
    },
    onSettled: () => {
      setUpdatingId(null);
    },
  });

  const handleToggleRole = (profile) => {
    if (profile.id === currentUser?.id) {
      showToast('You cannot change your own role.', 'error');
      return;
    }
    const nextRole = profile.role === 'admin' ? 'worker' : 'admin';
    setUpdatingId(profile.id);
    updateRoleMutation.mutate({ id: profile.id, nextRole });
  };

  // Open Disable Modal
  const openDisableModal = (profile) => {
    if (profile.id === currentUser?.id) {
      showToast('You cannot disable your own administrator account.', 'error');
      return;
    }
    if (profile.role === 'admin') {
      showToast('Administrator accounts cannot be disabled directly.', 'error');
      return;
    }
    setTargetUser(profile);
    setDisableReason('');
    setDisableModalVisible(true);
  };

  // Execute Disable via RPC admin_set_user_status
  const handleConfirmDisable = async () => {
    if (!targetUser) return;
    try {
      setActionLoading(true);
      const { error: rpcErr } = await supabase.rpc('admin_set_user_status', {
        target: targetUser.id,
        new_status: 'disabled',
        reason: disableReason.trim() || null,
      });

      if (rpcErr) {
        if (rpcErr.message?.includes('function') || rpcErr.code === '42883') {
          showToast('Run the settings SQL in Supabase to enable account management.', 'error');
        } else {
          showToast(rpcErr.message || 'Failed to disable user account.', 'error');
        }
        return;
      }

      setDisableModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      showToast(`${targetUser.full_name || 'Worker'} deactivated and moved to Archived.`);
    } catch (err) {
      showToast(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Restore via RPC
  const handleRestoreUser = (profile) => {
    runAction({
      confirm: {
        title: 'Restore Worker Account?',
        message: `Restore ${profile.full_name || 'this worker'}? They will be allowed to log into the mobile app and perform tasks.`,
        confirmText: 'Restore Account',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'person-add-outline',
      },
      loading: 'Restoring account...',
      action: async () => {
        const { error: rpcErr } = await supabase.rpc('admin_set_user_status', {
          target: profile.id,
          new_status: 'active',
          reason: null,
        });

        if (rpcErr) {
          if (rpcErr.message?.includes('function') || rpcErr.code === '42883') {
            throw new Error('Run the settings SQL in Supabase to enable account management.');
          }
          throw rpcErr;
        }
      },
      success: `${profile.full_name || 'Worker'} restored to Active accounts`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
      },
    });
  };

  // Split Active vs Archived
  const activeProfiles = useMemo(
    () => profiles.filter((p) => (p.status || 'active') !== 'disabled'),
    [profiles]
  );

  const archivedProfiles = useMemo(
    () => profiles.filter((p) => p.status === 'disabled'),
    [profiles]
  );

  // Filtered by tab, search, role
  const displayList = useMemo(() => {
    const source = activeTab === 'active' ? activeProfiles : archivedProfiles;
    return source.filter((p) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (p.full_name || '').toLowerCase().includes(q);
        const emailMatch = (p.email || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      // Role filter
      if (roleFilter !== 'all' && p.role !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [activeTab, activeProfiles, archivedProfiles, searchQuery, roleFilter]);

  return (
    <View style={styles.screen}>
      <Header
        title="User Roles & Access"
        subtitle="Manage administrator access, field worker roles, and account status"
        navigation={navigation}
      />

      <PageContainer>
        {/* Toast / Alert Message */}
        {toastMessage ? (
          <View
            style={[
              styles.toastBanner,
              toastType === 'error' ? styles.toastError : styles.toastSuccess,
            ]}
          >
            <Ionicons
              name={toastType === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={toastType === 'error' ? '#EF4444' : '#10B981'}
            />
            <Text
              style={[
                styles.toastText,
                toastType === 'error' ? styles.toastErrorText : styles.toastSuccessText,
              ]}
            >
              {toastMessage}
            </Text>
          </View>
        ) : null}

        {/* Tab Selector & Controls Bar */}
        <View style={styles.controlsBar}>
          {/* Active / Archived Tabs */}
          <View style={styles.tabGroup}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
              onPress={() => setActiveTab('active')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'active' && styles.tabLabelActive]}>
                Active
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 'active' && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 'active' && styles.tabBadgeTextActive,
                  ]}
                >
                  {activeProfiles.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'archived' && styles.tabBtnActive]}
              onPress={() => setActiveTab('archived')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'archived' && styles.tabLabelActive]}>
                Archived
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 'archived' && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 'archived' && styles.tabBadgeTextActive,
                  ]}
                >
                  {archivedProfiles.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Filters: Search & Role Picker */}
          <View style={styles.filterGroup}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name or email..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.rolePickerRow}>
              {['all', 'admin', 'worker'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleFilterBtn, roleFilter === r && styles.roleFilterBtnActive]}
                  onPress={() => setRoleFilter(r)}
                >
                  <Text
                    style={[
                      styles.roleFilterText,
                      roleFilter === r && styles.roleFilterTextActive,
                    ]}
                  >
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Content Table / Cards */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : displayList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name={activeTab === 'active' ? 'people-outline' : 'archive-outline'}
              size={40}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No active users found' : 'No archived accounts'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? 'Try clearing the search or role filter.'
                : activeTab === 'archived'
                ? 'Deactivated accounts will appear here for audit and restoration.'
                : 'No users currently match the selected criteria.'}
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {displayList.map((p) => {
              const isMe = p.id === currentUser?.id;
              const isAdmin = p.role === 'admin';
              const isArchived = p.status === 'disabled';

              return (
                <View key={p.id} style={[styles.userCard, isArchived && styles.userCardArchived]}>
                  {/* Left: Avatar + Details */}
                  <View style={styles.userCardLeft}>
                    <View
                      style={[
                        styles.avatar,
                        isAdmin ? styles.avatarAdmin : styles.avatarWorker,
                        isArchived && styles.avatarArchived,
                      ]}
                    >
                      <Ionicons
                        name={isArchived ? 'lock-closed' : isAdmin ? 'shield' : 'person'}
                        size={18}
                        color={colors.white}
                      />
                    </View>

                    <View style={styles.userMeta}>
                      <View style={styles.nameRow}>
                        <Text style={styles.fullName}>{p.full_name || 'Unnamed User'}</Text>
                        {isMe && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youText}>You</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.roleChip,
                            isAdmin ? styles.roleChipAdmin : styles.roleChipWorker,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleChipText,
                              isAdmin ? styles.roleChipTextAdmin : styles.roleChipTextWorker,
                            ]}
                          >
                            {p.role.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.emailText}>{p.email || 'No email registered'}</Text>

                      {/* Archived details row */}
                      {isArchived ? (
                        <View style={styles.archivedMetaBox}>
                          <Text style={styles.archivedReasonText}>
                            Deactivated: {p.disabled_at ? p.disabled_at.slice(0, 10) : 'Recently'}
                            {p.disabled_reason ? ` • Reason: "${p.disabled_reason}"` : ''}
                          </Text>
                          {groupByUser[p.id] && (
                            <Text style={[styles.archivedReasonText, { color: '#DC2626', fontWeight: '700', marginTop: 2 }]}>
                              Warning: This disabled worker still belongs to a worker group. Open Assign Workers to remove them.
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Text style={styles.createdText}>
                            Active • Joined {p.created_at ? p.created_at.slice(0, 10) : 'recently'}
                          </Text>
                          {p.role === 'worker' && (
                            <WorkerGroupBadge
                              group={workerGroupsList.find((g) => g.id === groupByUser[p.id])}
                              size="small"
                            />
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Right: Actions */}
                  <View style={styles.userCardActions}>
                    {!isArchived ? (
                      <>
                        {/* Change Role Button (disabled for yourself) */}
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            styles.roleSwitchBtn,
                            isMe && styles.actionBtnDisabled,
                          ]}
                          onPress={() => handleToggleRole(p)}
                          disabled={isMe || updatingId === p.id}
                          title={isMe ? 'You cannot change your own role' : undefined}
                        >
                          {updatingId === p.id ? (
                            <ActivityIndicator size="small" color={colors.primaryDark} />
                          ) : (
                            <>
                              <Ionicons name="swap-horizontal" size={14} color={colors.primaryDark} />
                              <Text style={styles.roleSwitchText}>
                                Make {isAdmin ? 'Worker' : 'Admin'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* Quick Change Group (only for active workers) */}
                        {!isAdmin && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.groupChangeBtn]}
                            onPress={() => {
                              setGroupTargetUser(p);
                              setSelectedChangeGroupId(groupByUser[p.id] || null);
                              setGroupModalVisible(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="people-outline" size={14} color={colors.primary} />
                            <Text style={styles.groupChangeBtnText}>Group</Text>
                          </TouchableOpacity>
                        )}

                        {/* Disable button (only for workers, never for admins or yourself) */}
                        {!isAdmin && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.disableBtn]}
                            onPress={() => openDisableModal(p)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="ban-outline" size={14} color="#EF4444" />
                            <Text style={styles.disableBtnText}>Disable</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      /* Restore Button for Archived workers */
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.restoreBtn]}
                        onPress={() => handleRestoreUser(p)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh-outline" size={14} color="#10B981" />
                        <Text style={styles.restoreBtnText}>Restore Account</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Modal: Quick Change Worker Group */}
        <Modal
          visible={groupModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGroupModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="people" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Change Worker Group</Text>
              </View>

              <Text style={styles.modalSub}>
                Assign <Text style={{ fontWeight: '700' }}>{groupTargetUser?.full_name}</Text> to a worker team.
              </Text>

              <View style={{ marginVertical: 12 }}>
                <WorkerGroupSelect
                  selectedGroupId={selectedChangeGroupId}
                  onSelectGroup={setSelectedChangeGroupId}
                  allowUnassigned={true}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setGroupModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalDisableBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (!groupTargetUser) return;
                    setGroupModalVisible(false);

                    const targetGroup = workerGroupsList.find((g) => g.id === selectedChangeGroupId);
                    runAction({
                      confirm: {
                        title: 'Update Worker Group?',
                        message: selectedChangeGroupId
                          ? `Assign ${groupTargetUser.full_name} to "${targetGroup?.name || 'group'}"?`
                          : `Remove ${groupTargetUser.full_name} from their worker group?`,
                        confirmText: 'Confirm',
                        cancelText: 'Cancel',
                        tone: selectedChangeGroupId ? 'default' : 'danger',
                        icon: 'people-outline',
                      },
                      loading: 'Updating worker group...',
                      action: async () => {
                        const { error } = await supabase.rpc('assign_worker_to_group', {
                          p_user_id: groupTargetUser.id,
                          p_group_id: selectedChangeGroupId || null,
                        });
                        if (error) {
                          if (error.code === '42883' || error.code === 'PGRST202') {
                            throw new Error('Run the worker groups SQL in Supabase');
                          }
                          throw error;
                        }
                      },
                      success: `Updated group for ${groupTargetUser.full_name}`,
                      onSuccess: () => {
                        refetchWorkerGroups();
                        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
                        queryClient.invalidateQueries({ queryKey: ['profiles'] });
                      },
                    });
                  }}
                >
                  <Text style={styles.modalDisableBtnText}>Save Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Disable Worker Confirmation */}
        <Modal
          visible={disableModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDisableModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="warning" size={22} color="#EF4444" />
                  <Text style={styles.modalTitle}>Disable Worker Account</Text>
                </View>
                <TouchableOpacity onPress={() => setDisableModalVisible(false)}>
                  <Ionicons name="close" size={20} color={colors.textDark} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalBodyText}>
                <Text style={{ fontWeight: '700' }}>{targetUser?.full_name || 'This user'}</Text>{' '}
                will be logged out immediately and blocked from logging in. You can restore this account at any time from the Archived tab.
              </Text>

              <Text style={styles.modalFieldLabel}>Reason for deactivation (optional):</Text>
              <TextInput
                style={styles.modalReasonInput}
                placeholder="e.g. End of contract, safety incident, transferred..."
                placeholderTextColor={colors.textMuted}
                value={disableReason}
                onChangeText={setDisableReason}
                multiline
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDisableModalVisible(false)}
                  disabled={actionLoading}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDisableBtn}
                  onPress={handleConfirmDisable}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalDisableBtnText}>Disable Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  toastSuccessText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  toastErrorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.dark,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.white,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E4E4E7',
  },
  tabBadgeActive: {
    backgroundColor: '#27272A',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textDark,
  },
  tabBadgeTextActive: {
    color: colors.white,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
    minWidth: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textDark,
  },
  rolePickerRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  roleFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  roleFilterBtnActive: {
    backgroundColor: colors.primary,
  },
  roleFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  roleFilterTextActive: {
    color: colors.white,
  },
  usersList: {
    flexDirection: 'column',
    gap: 10,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  userCardArchived: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E4E4E7',
    opacity: 0.88,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 260,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: colors.primary,
  },
  avatarWorker: {
    backgroundColor: colors.dark,
  },
  avatarArchived: {
    backgroundColor: '#71717A',
  },
  userMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  fullName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  youBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  roleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleChipAdmin: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
  },
  roleChipWorker: {
    backgroundColor: '#F4F4F5',
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleChipTextAdmin: {
    color: colors.primaryDark,
  },
  roleChipTextWorker: {
    color: '#52525B',
  },
  emailText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  createdText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  archivedMetaBox: {
    marginTop: 4,
  },
  archivedReasonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  userCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  roleSwitchBtn: {
    backgroundColor: colors.primaryVeryLight,
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  groupChangeBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
  },
  groupChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  roleSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  disableBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  disableBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  restoreBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textDark,
  },
  modalBodyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 6,
  },
  modalReasonInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: colors.textDark,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalDisableBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  modalDisableBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
