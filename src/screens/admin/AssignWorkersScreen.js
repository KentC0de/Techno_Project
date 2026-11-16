import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import WorkerMultiSelect from '../../components/WorkerMultiSelect';
import FrequencyBadge from '../../components/FrequencyBadge';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useWorkers } from '../../hooks/useWorkers';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../context/AuthContext';
import { fetchScheduleRules } from '../../lib/dataService';
import { supabase } from '../../lib/supabase';
import { colors, layout } from '../../theme';

const COLOR_PRESETS = [
  '#0EA5E9', // Sky blue (default theme)
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#64748B', // Slate
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AssignWorkersScreen({ navigation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runAction = useAction();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const {
    groups,
    members,
    membersByGroup,
    groupByUser,
    taskCountByGroup,
    isLoading: loadingGroups,
    refetch: refetchGroups,
  } = useWorkerGroups();

  const {
    data: workerData,
    isLoading: loadingWorkers,
    refetch: refetchWorkers,
  } = useWorkers();

  // All schedule rules to view assigned tasks
  const { data: allRules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['schedule_rules_all'],
    queryFn: () => fetchScheduleRules(null),
    staleTime: 60 * 1000,
  });

  const allWorkers = workerData?.workers || [];
  const activeWorkers = workerData?.activeWorkers || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Group Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0EA5E9');
  const [formShiftLabel, setFormShiftLabel] = useState('');
  const [formShiftStart, setFormShiftStart] = useState('08:00');
  const [formShiftEnd, setFormShiftEnd] = useState('17:00');
  const [formWorkDays, setFormWorkDays] = useState([1, 2, 3, 4, 5]);
  const [formIsActive, setFormIsActive] = useState(true);

  // Add Workers Selected IDs (in multi-select)
  const [selectedAddWorkerIds, setSelectedAddWorkerIds] = useState([]);

  // Selected group object
  const activeGroup = useMemo(() => {
    if (isCreatingNew) return null;
    return groups.find((g) => g.id === selectedGroupId) || groups[0] || null;
  }, [groups, selectedGroupId, isCreatingNew]);

  // Keep selected group updated on initial load
  useEffect(() => {
    if (!isCreatingNew && !selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId, isCreatingNew]);

  // Populate form fields whenever activeGroup changes
  useEffect(() => {
    if (activeGroup && !isCreatingNew) {
      setFormName(activeGroup.name || '');
      setFormDesc(activeGroup.description || '');
      setFormColor(activeGroup.color || '#0EA5E9');
      setFormShiftLabel(activeGroup.shift_label || '');
      setFormShiftStart(activeGroup.shift_start ? activeGroup.shift_start.slice(0, 5) : '08:00');
      setFormShiftEnd(activeGroup.shift_end ? activeGroup.shift_end.slice(0, 5) : '17:00');
      setFormWorkDays(activeGroup.work_days || [1, 2, 3, 4, 5]);
      setFormIsActive(activeGroup.is_active !== false);

      // Pre-populate multi-select with existing members
      const existingMembers = membersByGroup[activeGroup.id] || [];
      setSelectedAddWorkerIds(existingMembers);
    }
  }, [activeGroup, isCreatingNew, membersByGroup]);

  // Filtered groups in left pane
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        (g.name && g.name.toLowerCase().includes(q)) ||
        (g.description && g.description.toLowerCase().includes(q)) ||
        (g.shift_label && g.shift_label.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // Members of active group
  const currentGroupMemberIds = useMemo(() => {
    if (!activeGroup) return [];
    return membersByGroup[activeGroup.id] || [];
  }, [membersByGroup, activeGroup]);

  // Workers without any group
  const unassignedWorkers = useMemo(() => {
    return activeWorkers.filter((w) => !groupByUser[w.id]);
  }, [activeWorkers, groupByUser]);

  // Tasks of active group
  const activeGroupRules = useMemo(() => {
    if (!activeGroup) return [];
    return allRules.filter((r) => r.worker_group_id === activeGroup.id);
  }, [allRules, activeGroup]);

  // Start new group creation
  const handleStartNewGroup = () => {
    setIsCreatingNew(true);
    setSelectedGroupId(null);
    setFormName('');
    setFormDesc('');
    setFormColor('#0EA5E9');
    setFormShiftLabel('');
    setFormShiftStart('08:00');
    setFormShiftEnd('17:00');
    setFormWorkDays([1, 2, 3, 4, 5]);
    setFormIsActive(true);
    setSelectedAddWorkerIds([]);
  };

  const toggleWorkDay = (day) => {
    setFormWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day).sort() : [...prev, day].sort()
    );
  };

  // Save Group (Insert or Update)
  const handleSaveGroup = () => {
    if (!formName.trim()) {
      runAction({
        confirm: {
          title: 'Validation Error',
          message: 'Please provide a name for the worker group.',
          confirmText: 'Understood',
          cancelText: 'Close',
          tone: 'default',
          icon: 'information-circle-outline',
        },
      });
      return;
    }

    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      color: formColor || '#0EA5E9',
      shift_label: formShiftLabel.trim() || null,
      shift_start: formShiftStart ? `${formShiftStart}:00` : null,
      shift_end: formShiftEnd ? `${formShiftEnd}:00` : null,
      work_days: formWorkDays,
      is_active: formIsActive,
    };

    const isEdit = !isCreatingNew && activeGroup?.id;

    runAction({
      confirm: {
        title: isEdit ? 'Update Worker Group?' : 'Create Worker Group?',
        message: `${isEdit ? 'Save updates to' : 'Create new worker group'} "${formName.trim()}"?`,
        confirmText: isEdit ? 'Save Group' : 'Create Group',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'people-outline',
      },
      loading: isEdit ? 'Updating group...' : 'Creating group...',
      action: async () => {
        if (isEdit) {
          const { data, error } = await supabase
            .from('worker_groups')
            .update(payload)
            .eq('id', activeGroup.id)
            .select()
            .single();
          if (error) {
            if (error.code === '23505') {
              throw new Error('A worker group with this name already exists.');
            }
            throw error;
          }
          return data;
        } else {
          const { data, error } = await supabase
            .from('worker_groups')
            .insert({
              ...payload,
              created_by: user?.id,
            })
            .select()
            .single();
          if (error) {
            if (error.code === '23505') {
              throw new Error('A worker group with this name already exists.');
            }
            throw error;
          }
          return data;
        }
      },
      success: isEdit ? 'Group updated successfully' : 'Worker group created successfully',
      onSuccess: (saved) => {
        setIsCreatingNew(false);
        if (saved?.id) {
          setSelectedGroupId(saved.id);
        }
        refetchGroups();
        queryClient.invalidateQueries({ queryKey: ['worker_groups'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
      },
    });
  };

  // Delete Group with RESTRICT handling
  const handleDeleteGroup = () => {
    if (!activeGroup) return;

    runAction({
      confirm: {
        title: 'Delete Worker Group?',
        message: `Are you sure you want to delete "${activeGroup.name}"? This action cannot be undone.`,
        confirmText: 'Delete Group',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'trash-outline',
      },
      loading: 'Deleting group...',
      action: async () => {
        const { error } = await supabase
          .from('worker_groups')
          .delete()
          .eq('id', activeGroup.id);

        if (error) {
          if (error.code === '23503') {
            throw new Error(
              'This group still has tasks. Move them to another group or set the group to Inactive first.'
            );
          }
          throw error;
        }
      },
      success: 'Worker group deleted',
      onSuccess: () => {
        setSelectedGroupId(null);
        refetchGroups();
        queryClient.invalidateQueries({ queryKey: ['worker_groups'] });
        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
      },
    });
  };

  // Single worker assign/move
  const handleAssignSingleWorker = (worker) => {
    if (!activeGroup) return;

    const existingGroupId = groupByUser[worker.id];
    const isMoving = existingGroupId && existingGroupId !== activeGroup.id;
    const oldGroup = isMoving ? groups.find((g) => g.id === existingGroupId) : null;

    runAction({
      confirm: {
        title: isMoving ? 'Move Worker to This Group?' : 'Add Worker to Group?',
        message: isMoving
          ? `${worker.full_name || 'This worker'} is currently in "${oldGroup?.name || 'another group'}". Moving them will remove them from that group. Proceed?`
          : `Add ${worker.full_name || 'this worker'} to "${activeGroup.name}"?`,
        confirmText: isMoving ? 'Move Worker' : 'Add to Group',
        cancelText: 'Cancel',
        tone: isMoving ? 'danger' : 'default',
        icon: 'person-add-outline',
      },
      loading: 'Updating membership...',
      action: async () => {
        const { error } = await supabase.rpc('assign_worker_to_group', {
          p_user_id: worker.id,
          p_group_id: activeGroup.id,
        });

        if (error) {
          if (error.code === '42883' || error.code === 'PGRST202') {
            throw new Error('Run the worker groups SQL in Supabase');
          }
          throw error;
        }
      },
      success: `${worker.full_name || 'Worker'} added to ${activeGroup.name}`,
      onSuccess: () => {
        refetchGroups();
        refetchWorkers();
        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      },
    });
  };

  // Remove worker from active group (unassign)
  const handleRemoveWorker = (worker) => {
    if (!activeGroup) return;

    runAction({
      confirm: {
        title: 'Remove Worker from Group?',
        message: `Remove ${worker.full_name || 'this worker'} from "${activeGroup.name}"? They will no longer see tasks assigned to this group.`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'person-remove-outline',
      },
      loading: 'Removing worker...',
      action: async () => {
        const { error } = await supabase.rpc('assign_worker_to_group', {
          p_user_id: worker.id,
          p_group_id: null,
        });

        if (error) {
          if (error.code === '42883' || error.code === 'PGRST202') {
            throw new Error('Run the worker groups SQL in Supabase');
          }
          throw error;
        }
      },
      success: `${worker.full_name || 'Worker'} removed from group`,
      onSuccess: () => {
        refetchGroups();
        refetchWorkers();
        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      },
    });
  };

  // Toggle worker in multi-select
  const handleToggleAddWorker = (workerId) => {
    setSelectedAddWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  // Save full members list with set_group_members RPC
  const handleSaveMembersList = () => {
    if (!activeGroup) return;

    // Filter to active workers only (DB requirement)
    const finalActiveIds = selectedAddWorkerIds.filter((id) => {
      const w = allWorkers.find((item) => item.id === id);
      return (w?.status || 'active') === 'active';
    });

    const added = finalActiveIds.filter((id) => !currentGroupMemberIds.includes(id));
    const removed = currentGroupMemberIds.filter((id) => !finalActiveIds.includes(id));
    const moved = added.filter((id) => groupByUser[id] && groupByUser[id] !== activeGroup.id);

    const changesText = [
      added.length > 0 ? `+${added.length} added` : '',
      moved.length > 0 ? `(${moved.length} moved from other groups)` : '',
      removed.length > 0 ? `-${removed.length} removed` : '',
    ]
      .filter(Boolean)
      .join(' ');

    runAction({
      confirm: {
        title: 'Save Group Membership?',
        message: `Update members for "${activeGroup.name}"? Total active members: ${finalActiveIds.length}. ${changesText ? `Changes: ${changesText}.` : ''}`,
        confirmText: 'Save Members',
        cancelText: 'Cancel',
        tone: moved.length > 0 || removed.length > 0 ? 'danger' : 'default',
        icon: 'people-outline',
      },
      loading: 'Saving group members...',
      action: async () => {
        const { error } = await supabase.rpc('set_group_members', {
          p_group_id: activeGroup.id,
          p_user_ids: finalActiveIds,
        });

        if (error) {
          if (error.code === '42883' || error.code === 'PGRST202') {
            throw new Error('Run the worker groups SQL in Supabase');
          }
          throw error;
        }
      },
      success: `Updated members for ${activeGroup.name}`,
      onSuccess: () => {
        refetchGroups();
        refetchWorkers();
        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      },
    });
  };

  const isLoading = loadingGroups || loadingWorkers || loadingRules;

  return (
    <View style={styles.screen}>
      <Header
        title="Assign Workers"
        subtitle="Manage worker groups, team shifts, member allocations and task assignments"
        navigation={navigation}
        rightAction={
          <TouchableOpacity
            style={styles.newGroupHeaderBtn}
            onPress={handleStartNewGroup}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.newGroupHeaderBtnText}>New Group</Text>
          </TouchableOpacity>
        }
      />

      <PageContainer>
        <View style={[styles.mainLayout, !isDesktop && styles.mainLayoutStacked]}>
          {/* LEFT PANEL: Worker Groups List */}
          <View style={[styles.leftPanel, !isDesktop && styles.leftPanelFull]}>
            {/* Search Box */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search worker groups..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Groups Scroll List */}
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
            ) : filteredGroups.length === 0 ? (
              <View style={styles.emptyGroupsBox}>
                <Ionicons name="people-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyGroupsText}>
                  {searchQuery ? 'No groups match your search.' : 'No worker groups found.'}
                </Text>
                <TouchableOpacity style={styles.createFirstBtn} onPress={handleStartNewGroup}>
                  <Text style={styles.createFirstBtnText}>+ Create First Group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {filteredGroups.map((g) => {
                  const isSelected = !isCreatingNew && activeGroup?.id === g.id;
                  const memberCount = (membersByGroup[g.id] || []).length;
                  const taskCount = taskCountByGroup[g.id] || 0;
                  const isActive = g.is_active !== false;

                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.groupCard,
                        isSelected && styles.groupCardSelected,
                        !isActive && styles.groupCardInactive,
                      ]}
                      onPress={() => {
                        setIsCreatingNew(false);
                        setSelectedGroupId(g.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.groupCardTop}>
                        <View style={styles.groupCardHeaderLeft}>
                          <View style={[styles.groupDot, { backgroundColor: g.color || colors.primary }]} />
                          <Text
                            style={[
                              styles.groupCardName,
                              isSelected && styles.groupCardNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {g.name}
                          </Text>
                        </View>
                        {!isActive ? (
                          <View style={styles.inactivePill}>
                            <Text style={styles.inactivePillText}>Inactive</Text>
                          </View>
                        ) : null}
                      </View>

                      {g.description ? (
                        <Text style={styles.groupCardDesc} numberOfLines={2}>
                          {g.description}
                        </Text>
                      ) : null}

                      {/* Shift & Time */}
                      {g.shift_label && (
                        <View style={styles.shiftMetaRow}>
                          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                          <Text style={styles.shiftMetaText}>
                            {g.shift_label}
                            {g.shift_start && g.shift_end
                              ? ` (${g.shift_start.slice(0, 5)} - ${g.shift_end.slice(0, 5)})`
                              : ''}
                          </Text>
                        </View>
                      )}

                      {/* Work days chips */}
                      {g.work_days && g.work_days.length > 0 && (
                        <View style={styles.daysRow}>
                          {DAYS_OF_WEEK.map((d) => {
                            const isWorkDay = g.work_days.includes(d.day);
                            return (
                              <View
                                key={d.day}
                                style={[
                                  styles.dayChip,
                                  isWorkDay && styles.dayChipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dayChipText,
                                    isWorkDay && styles.dayChipTextActive,
                                  ]}
                                >
                                  {d.label[0]}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Card Footer: Members & Tasks Count */}
                      <View style={styles.groupCardFooter}>
                        <View style={styles.footerCountItem}>
                          <Ionicons name="people" size={13} color="#475569" />
                          <Text style={styles.footerCountText}>
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </Text>
                        </View>
                        <View style={styles.footerCountItem}>
                          <Ionicons name="calendar-outline" size={13} color="#475569" />
                          <Text style={styles.footerCountText}>
                            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Unassigned Workers Count Banner */}
            {unassignedWorkers.length > 0 && (
              <View style={styles.unassignedBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#0284C7" />
                <Text style={styles.unassignedBannerText}>
                  {unassignedWorkers.length} active worker(s) without a group
                </Text>
              </View>
            )}
          </View>

          {/* RIGHT PANEL: Details & Edit Form */}
          <View style={[styles.rightPanel, !isDesktop && styles.rightPanelFull]}>
            {isCreatingNew || activeGroup ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
                {/* 1. Group Edit Form Card */}
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <View>
                      <Text style={styles.detailTitle}>
                        {isCreatingNew ? 'Create Worker Group' : `Edit "${activeGroup.name}"`}
                      </Text>
                      <Text style={styles.detailSubtitle}>
                        Configure group identity, shift hours, and active work days.
                      </Text>
                    </View>

                    {!isCreatingNew && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={handleDeleteGroup}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        <Text style={styles.deleteBtnText}>Delete Group</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Name & Active switch */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Group Name *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. Electrical Team, Night Shift, HVAC Crew"
                        value={formName}
                        onChangeText={setFormName}
                      />
                    </View>

                    <View style={styles.activeSwitchWrap}>
                      <Text style={styles.formLabel}>Active</Text>
                      <Switch
                        value={formIsActive}
                        onValueChange={setFormIsActive}
                        trackColor={{ false: '#CBD5E1', true: colors.primary }}
                        thumbColor={colors.white}
                      />
                    </View>
                  </View>

                  {/* Description */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.formLabel}>Description / Specialty</Text>
                    <TextInput
                      style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                      placeholder="Specialized functions, responsibilities, or coverage"
                      value={formDesc}
                      onChangeText={setFormDesc}
                      multiline
                    />
                  </View>

                  {/* Color Swatches */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.formLabel}>Group Color Label</Text>
                    <View style={styles.swatchRow}>
                      {COLOR_PRESETS.map((hex) => (
                        <TouchableOpacity
                          key={hex}
                          style={[
                            styles.swatch,
                            { backgroundColor: hex },
                            formColor === hex && styles.swatchSelected,
                          ]}
                          onPress={() => setFormColor(hex)}
                        >
                          {formColor === hex && (
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                          )}
                        </TouchableOpacity>
                      ))}
                      <TextInput
                        style={styles.hexInput}
                        value={formColor}
                        onChangeText={setFormColor}
                        placeholder="#0EA5E9"
                        maxLength={7}
                      />
                    </View>
                  </View>

                  {/* Shift Label & Times */}
                  <View style={[styles.formRow, { marginTop: 12 }]}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.formLabel}>Shift Label (Optional)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. Morning Shift, Night Crew"
                        value={formShiftLabel}
                        onChangeText={setFormShiftLabel}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Start (HH:MM)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="08:00"
                        value={formShiftStart}
                        onChangeText={setFormShiftStart}
                        maxLength={5}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>End (HH:MM)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="17:00"
                        value={formShiftEnd}
                        onChangeText={setFormShiftEnd}
                        maxLength={5}
                      />
                    </View>
                  </View>

                  {/* Work Days Toggle */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.formLabel}>Work Days</Text>
                    <View style={styles.daysToggleRow}>
                      {DAYS_OF_WEEK.map((d) => {
                        const isSelected = formWorkDays.includes(d.day);
                        return (
                          <TouchableOpacity
                            key={d.day}
                            style={[
                              styles.dayToggleBtn,
                              isSelected && styles.dayToggleBtnSelected,
                            ]}
                            onPress={() => toggleWorkDay(d.day)}
                          >
                            <Text
                              style={[
                                styles.dayToggleText,
                                isSelected && styles.dayToggleTextSelected,
                              ]}
                            >
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.formActionRow}>
                    {isCreatingNew && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => setIsCreatingNew(false)}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGroup}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />
                      <Text style={styles.saveBtnText}>
                        {isCreatingNew ? 'Create Group' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Group Members Section */}
                {!isCreatingNew && activeGroup && (
                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <View>
                        <Text style={styles.detailTitle}>
                          Group Members ({currentGroupMemberIds.length})
                        </Text>
                        <Text style={styles.detailSubtitle}>
                          Field workers allocated to this team. One worker belongs to only one group.
                        </Text>
                      </View>
                    </View>

                    {/* Current Members List */}
                    {currentGroupMemberIds.length === 0 ? (
                      <View style={styles.emptyMembersBox}>
                        <Ionicons name="person-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.emptyMembersText}>
                          No workers assigned to this group yet. Add active workers below.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.membersList}>
                        {currentGroupMemberIds.map((userId) => {
                          const worker = allWorkers.find((w) => w.id === userId);
                          const isWorkerDisabled = (worker?.status || 'active') === 'disabled';

                          return (
                            <View key={userId} style={styles.memberRow}>
                              <View style={styles.memberLeft}>
                                <View style={[styles.avatar, { backgroundColor: activeGroup.color || colors.primary }]}>
                                  <Text style={styles.avatarText}>
                                    {getInitials(worker?.full_name || 'Worker')}
                                  </Text>
                                </View>
                                <View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.memberName}>
                                      {worker?.full_name || 'Field Worker'}
                                    </Text>
                                    {isWorkerDisabled && (
                                      <View style={styles.disabledTag}>
                                        <Text style={styles.disabledTagText}>Disabled</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.memberEmail}>
                                    {worker?.email || 'No email registered'}
                                  </Text>
                                </View>
                              </View>

                              <TouchableOpacity
                                style={styles.removeWorkerBtn}
                                onPress={() => handleRemoveWorker(worker || { id: userId, full_name: 'Worker' })}
                              >
                                <Text style={styles.removeWorkerText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Add / Manage Members with WorkerMultiSelect */}
                    <View style={styles.addWorkersSection}>
                      <View style={styles.addWorkersHeaderRow}>
                        <Text style={styles.subSectionTitle}>Add / Manage Members</Text>
                        <TouchableOpacity
                          style={styles.saveMembersBtn}
                          onPress={handleSaveMembersList}
                        >
                          <Ionicons name="checkmark-done-outline" size={14} color={colors.white} />
                          <Text style={styles.saveMembersBtnText}>Save Member Selection</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.addWorkersHelp}>
                        Tick active workers to include them in this group. Workers currently in another group will be moved.
                      </Text>

                      <WorkerMultiSelect
                        workers={activeWorkers}
                        selectedIds={selectedAddWorkerIds}
                        onToggleWorker={handleToggleAddWorker}
                        groupByUser={groupByUser}
                        groups={groups}
                        currentGroupId={activeGroup.id}
                      />
                    </View>

                    {/* Workers without a group quick add */}
                    {unassignedWorkers.length > 0 && (
                      <View style={styles.unassignedQuickSection}>
                        <Text style={styles.subSectionTitle}>
                          Workers Without a Group ({unassignedWorkers.length})
                        </Text>
                        <View style={styles.unassignedList}>
                          {unassignedWorkers.slice(0, 5).map((w) => (
                            <View key={w.id} style={styles.unassignedRow}>
                              <View style={styles.memberLeft}>
                                <View style={styles.candidateAvatar}>
                                  <Text style={styles.candidateAvatarText}>
                                    {getInitials(w.full_name)}
                                  </Text>
                                </View>
                                <Text style={styles.candidateName}>{w.full_name}</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.quickAddBtn}
                                onPress={() => handleAssignSingleWorker(w)}
                              >
                                <Ionicons name="add" size={14} color={colors.primary} />
                                <Text style={styles.quickAddBtnText}>Add to {activeGroup.name}</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* 3. Tasks Assigned to this Group */}
                {!isCreatingNew && activeGroup && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>
                      Assigned Schedule Rules ({activeGroupRules.length})
                    </Text>
                    <Text style={styles.detailSubtitle}>
                      Tasks scheduled for maintenance by this group.
                    </Text>

                    {activeGroupRules.length === 0 ? (
                      <View style={styles.emptyMembersBox}>
                        <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.emptyMembersText}>
                          No tasks assigned to this group yet. Select this group when clicking "Add Task" in the Schedule Calendar.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 10, gap: 8 }}>
                        {activeGroupRules.slice(0, 10).map((rule) => (
                          <View key={rule.id} style={styles.ruleItem}>
                            <View>
                              <Text style={styles.ruleItemTitle}>
                                {rule.equipment?.name || 'Equipment'}
                              </Text>
                              <Text style={styles.ruleItemSub}>
                                {rule.equipment?.group?.name || 'Group'}
                                {rule.equipment?.area ? ` • ${rule.equipment.area}` : ''}
                              </Text>
                            </View>
                            <FrequencyBadge frequency={rule.frequency} />
                          </View>
                        ))}
                        {activeGroupRules.length > 10 && (
                          <Text style={styles.moreRulesText}>
                            + {activeGroupRules.length - 10} more tasks scheduled
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.noGroupSelectedBox}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={styles.noGroupSelectedTitle}>Select a Worker Group</Text>
                <Text style={styles.noGroupSelectedSub}>
                  Select a group on the left to edit its configuration, manage workers, or view scheduled tasks.
                </Text>
                <TouchableOpacity style={styles.createFirstBtn} onPress={handleStartNewGroup}>
                  <Text style={styles.createFirstBtnText}>+ Create New Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  newGroupHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newGroupHeaderBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  mainLayout: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 40,
  },
  mainLayoutStacked: {
    flexDirection: 'column',
  },
  leftPanel: {
    width: 320,
    gap: 10,
  },
  leftPanelFull: {
    width: '100%',
  },
  rightPanel: {
    flex: 1,
  },
  rightPanelFull: {
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
  },
  emptyGroupsBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyGroupsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  createFirstBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createFirstBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  groupCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  groupCardInactive: {
    opacity: 0.6,
  },
  groupCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  groupCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    flex: 1,
  },
  groupCardNameSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  inactivePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactivePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  groupCardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  shiftMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  shiftMetaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  dayChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: '#0EA5E9',
  },
  dayChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dayChipTextActive: {
    color: colors.white,
  },
  groupCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 4,
  },
  footerCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  unassignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  unassignedBannerText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
  },
  detailScroll: {
    gap: 16,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  detailSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.dark,
  },
  activeSwitchWrap: {
    alignItems: 'center',
    marginLeft: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.dark,
  },
  hexInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 80,
    color: colors.dark,
  },
  daysToggleRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dayToggleBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayToggleTextSelected: {
    color: colors.white,
  },
  formActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  emptyMembersBox: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    gap: 6,
  },
  emptyMembersText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  membersList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  memberEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  disabledTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  disabledTagText: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '700',
  },
  removeWorkerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeWorkerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  addWorkersSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    gap: 8,
  },
  addWorkersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.dark,
  },
  addWorkersHelp: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  saveMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveMembersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  unassignedQuickSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    gap: 8,
  },
  unassignedList: {
    gap: 6,
  },
  unassignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  candidateAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateAvatarText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  candidateName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  ruleItemSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  moreRulesText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  noGroupSelectedBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noGroupSelectedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  noGroupSelectedSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 380,
  },
});
