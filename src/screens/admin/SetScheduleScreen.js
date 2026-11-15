import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
} from '../../lib/dataService';
import { formatDate, parseDate, getIsoWeekday, addDays } from '../../utils/schedule';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import FrequencyBadge from '../../components/FrequencyBadge';
import WorkerGroupSelect from '../../components/WorkerGroupSelect';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useWorkers } from '../../hooks/useWorkers';
import { useAction } from '../../hooks/useAction';
import { colors, layout } from '../../theme';

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SetScheduleScreen({ navigation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runAction = useAction();

  // Selection states
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());

  // Rule settings
  const [frequency, setFrequency] = useState('d');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [weekday, setWeekday] = useState(1); // 1 = Monday
  const [notes, setNotes] = useState('');

  // Worker group assignment state
  const [selectedGroupIdState, setSelectedGroupIdState] = useState(null);
  const [allowUnassigned, setAllowUnassigned] = useState(false);

  const { groups: workerGroupsList, membersByGroup } = useWorkerGroups();
  const { data: workerData } = useWorkers();
  const activeWorkers = workerData?.activeWorkers || [];
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Categories query
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  // Auto-select first category
  useEffect(() => {
    if (!selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  // 2. Groups query
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups', selectedCatId],
    queryFn: () => fetchGroups(selectedCatId),
    enabled: !!selectedCatId,
    staleTime: 10 * 60 * 1000,
  });

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    } else {
      setSelectedGroupId(null);
    }
  }, [groups]);

  // 3. Equipment query
  const { data: equipmentList = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ['equipment', selectedGroupId],
    queryFn: () => fetchEquipment(selectedGroupId),
    enabled: !!selectedGroupId,
    staleTime: 5 * 60 * 1000,
  });

  // 4. Query recent schedule rules to display under "Tasks created"
  const {
    data: recentRules = [],
    isLoading: loadingRecentRules,
    refetch: refetchRecentRules,
  } = useQuery({
    queryKey: ['recent_schedule_rules'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('schedule_rules')
        .select(`
          id,
          frequency,
          start_date,
          end_date,
          notes,
          worker_group_id,
          worker_group:worker_groups(*),
          equipment:equipment(name, area)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (__DEV__) console.log('[recent_schedule_rules error]', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Reset selected equipment when group changes
  const equipmentIdsKey = useMemo(
    () => equipmentList.map((e) => e.id).join(','),
    [equipmentList]
  );

  useEffect(() => {
    if (equipmentList.length > 0) {
      setSelectedEquipmentIds(() => {
        const newIds = new Set();
        if (equipmentList[0]) {
          newIds.add(equipmentList[0].id);
        }
        return newIds;
      });
      const firstFreq = equipmentList[0]?.default_freq?.[0];
      if (firstFreq) {
        setFrequency((prev) => (prev === firstFreq ? prev : firstFreq));
      }
    } else {
      setSelectedEquipmentIds((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [equipmentIdsKey, equipmentList]);

  // Save mutation calling create_schedule_rules_for_group RPC
  const createRulesMutation = useMutation({
    mutationFn: async (payload) => {
      if (!isConfigured || !supabase) {
        throw new Error('Supabase is not configured.');
      }

      const { data, error } = await supabase.rpc('create_schedule_rules_for_group', {
        p_equipment_ids: payload.equipmentIds,
        p_frequency: payload.frequency,
        p_start_date: payload.startDate,
        p_end_date: payload.endDate || null,
        p_weekday: payload.frequency === 'w' ? payload.weekday : null,
        p_notes: payload.notes || null,
        p_group_id: payload.groupId || null,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('A task with the same equipment, frequency and start date already exists.');
        }
        if (error.code === '42883' || error.code === 'PGRST202') {
          throw new Error('Run the worker groups SQL in Supabase');
        }
        throw error;
      }

      return data;
    },
    onSuccess: (count, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
      queryClient.invalidateQueries({ queryKey: ['recent_schedule_rules'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      queryClient.invalidateQueries({ queryKey: ['worker_groups'] });

      const assignedGroup = workerGroupsList.find((g) => g.id === variables.groupId);
      const memberCount = (membersByGroup[variables.groupId] || []).length;
      const groupName = assignedGroup
        ? `${assignedGroup.name} (${memberCount} ${memberCount === 1 ? 'worker' : 'workers'})`
        : 'Nobody (Unassigned)';

      const taskCount = count || variables.equipmentIds.length;
      setSuccessMessage(
        `Created ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} for ${groupName}`
      );
      setErrorMessage('');

      // Reset assignment & notes
      setNotes('');
      setSelectedGroupIdState(null);
      setAllowUnassigned(false);

      setTimeout(() => {
        setSuccessMessage('');
      }, 7000);
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Failed to save rules. Please try again.');
    },
  });

  const loading = loadingCategories || (!!selectedCatId && loadingGroups);
  const saving = createRulesMutation.isPending;

  // Filter equipment by area
  const availableAreas = Array.from(
    new Set(equipmentList.map((e) => e.area).filter(Boolean))
  );
  const hasAreas = availableAreas.length > 0;

  const displayedEquipment = equipmentList.filter((eq) => {
    if (!hasAreas || selectedArea === 'All') return true;
    return eq.area === selectedArea;
  });

  const toggleEquipment = (id) => {
    const next = new Set(selectedEquipmentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEquipmentIds(next);
  };

  const handleSelectAllEquipment = () => {
    const allIds = displayedEquipment.map((e) => e.id);
    setSelectedEquipmentIds(new Set(allIds));
  };

  const handleClearEquipment = () => {
    setSelectedEquipmentIds(new Set());
  };

  const handleSave = () => {
    if (saving) return; // Prevent double taps

    if (selectedEquipmentIds.size === 0) {
      setErrorMessage('Please select at least one equipment.');
      return;
    }

    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage('Please enter start date as YYYY-MM-DD.');
      return;
    }

    if (endDate && !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage('Please enter end date as YYYY-MM-DD or leave blank.');
      return;
    }

    if (!selectedGroupIdState && !allowUnassigned) {
      setErrorMessage(
        'Please select a worker group, or turn on "Create without a group".'
      );
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    // Summary of selected equipment
    const selectedEqNames = equipmentList
      .filter((eq) => selectedEquipmentIds.has(eq.id))
      .map((eq) => eq.name);

    const chosenGroup = workerGroupsList.find((g) => g.id === selectedGroupIdState);
    const assignedGroupLabel = allowUnassigned || !chosenGroup
      ? 'Nobody (Unassigned)'
      : chosenGroup.name;

    const groupMembersCount = chosenGroup
      ? (membersByGroup[chosenGroup.id] || []).length
      : 0;

    runAction({
      confirm: {
        title: `Create ${selectedEquipmentIds.size} Schedule ${selectedEquipmentIds.size === 1 ? 'Task' : 'Tasks'}?`,
        message: `Create schedule for ${selectedEqNames.slice(0, 2).join(', ')}${selectedEqNames.length > 2 ? ` and ${selectedEqNames.length - 2} more` : ''}?`,
        details: [
          `Frequency: ${frequency.toUpperCase()}`,
          `Start Date: ${startDate}`,
          `Group: ${assignedGroupLabel}${chosenGroup ? ` (${groupMembersCount} workers)` : ''}`,
        ],
        confirmText: 'Create Task',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'calendar-outline',
      },
      loading: 'Creating schedule tasks...',
      action: async () => {
        return await createRulesMutation.mutateAsync({
          equipmentIds: Array.from(selectedEquipmentIds),
          frequency,
          startDate,
          endDate: endDate.trim() ? endDate.trim() : null,
          weekday,
          notes: notes.trim() ? notes.trim() : null,
          groupId: allowUnassigned ? null : selectedGroupIdState,
        });
      },
      success: `Created ${selectedEquipmentIds.size} schedule ${selectedEquipmentIds.size === 1 ? 'task' : 'tasks'}`,
    });
  };

  const freqOptions = [
    { code: 'd', label: 'Daily' },
    { code: 'w', label: 'Weekly' },
    { code: 'M', label: 'Monthly' },
    { code: 'Q', label: 'Quarterly' },
    { code: 'SA', label: 'Semi-annual' },
  ];

  const weekdayNames = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 7, label: 'Sun' },
  ];

  return (
    <View style={styles.screen}>
      <Header
        title="Set Schedule"
        subtitle="Create recurring preventive maintenance rules"
        navigation={navigation}
      />

      <PageContainer>
        {/* Messages */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* 1. Pick System */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>1. System Category</Text>
          <View style={styles.pillRow}>
            {categories.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => setSelectedCatId(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {cat.code}. {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Pick Group */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>2. Equipment Group</Text>
          {loadingGroups ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : groups.length === 0 ? (
            <Text style={styles.emptyText}>No groups in this category.</Text>
          ) : (
            <View style={styles.pillRow}>
              {groups.map((grp) => {
                const isSelected = selectedGroupId === grp.id;
                return (
                  <TouchableOpacity
                    key={grp.id}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => setSelectedGroupId(grp.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {grp.item_no ? `${grp.item_no}. ` : ''}
                      {grp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 3. Pick Area (if applicable) */}
        {hasAreas && (
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeader}>3. Area / Location Filter</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, selectedArea === 'All' && styles.pillSelected]}
                onPress={() => setSelectedArea('All')}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, selectedArea === 'All' && styles.pillTextSelected]}>
                  All Areas
                </Text>
              </TouchableOpacity>
              {availableAreas.map((area) => {
                const isSelected = selectedArea === area;
                return (
                  <TouchableOpacity
                    key={area}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => setSelectedArea(area)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 4. Equipment multi-select */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeader}>
              {hasAreas ? '4' : '3'}. Target Equipment ({selectedEquipmentIds.size} selected)
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={handleSelectAllEquipment}
              >
                <Text style={styles.headerActionText}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={handleClearEquipment}
              >
                <Text style={styles.headerActionText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loadingEquipment ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : displayedEquipment.length === 0 ? (
            <Text style={styles.emptyText}>No equipment found.</Text>
          ) : (
            <View style={styles.eqGrid}>
              {displayedEquipment.map((eq) => {
                const isSelected = selectedEquipmentIds.has(eq.id);
                return (
                  <TouchableOpacity
                    key={eq.id}
                    style={[styles.eqCard, isSelected && styles.eqCardSelected]}
                    onPress={() => toggleEquipment(eq.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eqName, isSelected && styles.eqNameSelected]}>
                        {eq.name}
                      </Text>
                      {eq.area ? (
                        <Text style={styles.eqArea}>{eq.area}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 5. Frequency & Dates */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>{hasAreas ? '5' : '4'}. Maintenance Frequency & Schedule</Text>

          {/* Frequency selector */}
          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.freqRow}>
            {freqOptions.map((opt) => {
              const isSelected = frequency === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.freqBtn, isSelected && styles.freqBtnSelected]}
                  onPress={() => setFrequency(opt.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.freqText, isSelected && styles.freqTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Weekday selector (weekly only) */}
          {frequency === 'w' && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Scheduled Weekday</Text>
              <View style={styles.weekdayRow}>
                {weekdayNames.map((item) => {
                  const isSelected = weekday === item.day;
                  return (
                    <TouchableOpacity
                      key={item.day}
                      style={[styles.weekdayBtn, isSelected && styles.weekdayBtnSelected]}
                      onPress={() => setWeekday(item.day)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.weekdayText, isSelected && styles.weekdayTextSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Dates */}
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-11-01"
              />
              <View style={styles.quickDateSuggestions}>
                <TouchableOpacity
                  onPress={() => setStartDate(formatDate(new Date()))}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const now = new Date();
                    setStartDate(
                      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                    );
                  }}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>1st of Month</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dateCol}>
              <Text style={styles.fieldLabel}>End Date (Optional)</Text>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="Indefinite (leave blank)"
              />
              {endDate ? (
                <TouchableOpacity
                  onPress={() => setEndDate('')}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>Clear End Date</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Notes */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.fieldLabel}>Admin / Procedure Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="E.g., Check inverter AC/DC cables, thermal scan switchboard, inspect grease..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* 6. Assign Worker Group */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>
            {hasAreas ? '6' : '5'}. Assign to Worker Group
          </Text>

          <WorkerGroupSelect
            selectedGroupId={selectedGroupIdState}
            onSelectGroup={(gId) => {
              setSelectedGroupIdState(gId);
              if (gId) setAllowUnassigned(false);
            }}
            allowUnassigned={false}
            onNavigateToManageGroups={() => navigation.navigate('AssignWorkers')}
            disabled={saving}
          />

          {/* Group preview */}
          {selectedGroupIdState && (
            <View style={styles.groupPreviewCard}>
              {(() => {
                const grp = workerGroupsList.find((g) => g.id === selectedGroupIdState);
                if (!grp) return null;
                const memberIds = membersByGroup[grp.id] || [];
                const memberNames = memberIds
                  .map((id) => activeWorkers.find((w) => w.id === id)?.full_name)
                  .filter(Boolean);

                return (
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <WorkerGroupBadge group={grp} />
                      <Text style={styles.previewCount}>
                        ({memberIds.length} {memberIds.length === 1 ? 'worker' : 'workers'})
                      </Text>
                    </View>
                    <Text style={styles.previewMembers} numberOfLines={2}>
                      Members: {memberNames.length > 0 ? memberNames.join(', ') : 'No workers in this group yet'}
                    </Text>
                    {memberIds.length === 0 && (
                      <Text style={styles.warningZeroMembers}>
                        Warning: This group has no workers yet. Tasks will be created, but nobody can see them until workers are added to the group.
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Switch: Create without a group */}
          <View style={styles.unassignedSwitchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.switchLabel}>Create without a group</Text>
              <Text style={styles.switchSubtext}>
                Nobody will see this task until it is assigned to a worker group
              </Text>
            </View>
            <Switch
              value={allowUnassigned}
              onValueChange={(val) => {
                setAllowUnassigned(val);
                if (val) {
                  setSelectedGroupIdState(null);
                }
              }}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons
                name="save-outline"
                size={20}
                color={colors.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.saveBtnText}>
                Create Schedule Rules ({selectedEquipmentIds.size} Equipment)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Section: Tasks Created (Recent) */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeaderRow}>
            <Text style={styles.recentSectionTitle}>Tasks Created (Recent)</Text>
            <TouchableOpacity onPress={() => refetchRecentRules()}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loadingRecentRules ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
          ) : recentRules.length === 0 ? (
            <Text style={styles.emptyRecentText}>No schedule rules created yet.</Text>
          ) : (
            <View style={styles.recentList}>
              {recentRules.map((rule) => {
                return (
                  <View key={rule.id} style={styles.recentRuleCard}>
                    <View style={styles.recentCardTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <FrequencyBadge freq={rule.frequency} size="small" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recentEqName}>{rule.equipment?.name || 'Equipment'}</Text>
                          {rule.equipment?.area ? (
                            <Text style={styles.recentEqArea}>{rule.equipment.area}</Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.recentStartDate}>From {rule.start_date}</Text>
                    </View>

                    {/* Assigned Worker Group */}
                    <View style={styles.recentAssigneesRow}>
                      <Text style={styles.assigneesLabel}>Assigned to:</Text>
                      <WorkerGroupBadge group={rule.worker_group} />

                      <TouchableOpacity
                        style={styles.editWorkersBtn}
                        onPress={() => navigation.navigate('AdminCalendar')}
                      >
                        <Text style={styles.editWorkersText}>Edit in Calendar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  pillTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  eqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    minWidth: 180,
    flex: 1,
  },
  eqCardSelected: {
    backgroundColor: colors.primaryVeryLight,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: colors.white,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  eqName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  eqNameSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  eqArea: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  freqBtn: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    minHeight: layout.minTouchTarget,
  },
  freqBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  freqText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  freqTextSelected: {
    color: colors.white,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  weekdayBtn: {
    flex: 1,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: layout.minTouchTarget,
  },
  weekdayBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  weekdayTextSelected: {
    color: colors.white,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  dateCol: {
    flex: 1,
    minWidth: 200,
  },
  dateInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.dark,
    minHeight: layout.minTouchTarget,
  },
  quickDateSuggestions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  suggestionTag: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  suggestionText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    color: colors.dark,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  unassignedSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginTop: 14,
  },
  groupPreviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 10,
  },
  previewCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  previewMembers: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  warningZeroMembers: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  switchSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  recentSection: {
    marginTop: 32,
    marginBottom: 40,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  emptyRecentText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  recentList: {
    gap: 10,
  },
  recentRuleCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
  },
  recentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentEqName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  recentEqArea: {
    fontSize: 11,
    color: colors.textMuted,
  },
  recentStartDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recentAssigneesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  assigneesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  unassignedChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  unassignedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  assigneeNamesText: {
    fontSize: 12,
    color: colors.textDark,
    fontWeight: '600',
    marginLeft: 4,
  },
  editWorkersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editWorkersText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
