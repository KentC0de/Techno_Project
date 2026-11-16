import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchScheduleRules,
  fetchTaskLogs,
  updateScheduleRule,
  deleteScheduleRule,
} from '../../lib/dataService';
import {
  formatDate,
  parseDate,
  addDays,
  getMonthRange,
  getWorkWeek,
  getWorkWeekNumber,
  daysInMonth,
  getIsoWeekday,
  buildDueTasks,
} from '../../utils/schedule';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSystemFilter } from '../../context/SystemFilterContext';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import FrequencyBadge from '../../components/FrequencyBadge';
import StatusBadge from '../../components/StatusBadge';
import ExportScheduleModal from '../../components/ExportScheduleModal';
import TaskFormModal from '../../components/TaskFormModal';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import WorkerGroupSelect from '../../components/WorkerGroupSelect';
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

export default function ScheduleCalendarScreen({ navigation, route }) {
  const { user } = useAuth();
  const { selectedSystem, setSelectedSystem } = useSystemFilter();
  const queryClient = useQueryClient();
  const runAction = useAction();
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState(formatDate(new Date()));
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);

  // Handle openAddTask param from navigation redirects
  useEffect(() => {
    if (route?.params?.openAddTask) {
      setAddTaskModalVisible(true);
      if (navigation?.setParams) {
        navigation.setParams({ openAddTask: undefined });
      }
    }
  }, [route?.params?.openAddTask, navigation]);

  // Calculate range depending on view mode
  const { rangeStart, rangeEnd } = React.useMemo(() => {
    if (viewMode === 'month') {
      const m = getMonthRange(currentDateStr);
      return { rangeStart: m.start, rangeEnd: m.end };
    } else {
      const w = getWorkWeek(currentDateStr);
      return { rangeStart: w.start, rangeEnd: w.end };
    }
  }, [viewMode, currentDateStr]);

  // Query Schedule Rules (cached for 30s)
  const {
    data: rules = [],
    isLoading: rulesLoading,
    error: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['schedule_rules'],
    queryFn: () => fetchScheduleRules(),
    staleTime: 30 * 1000,
  });

  // Query Task Logs for visible range
  const {
    data: logs = [],
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['task_logs', rangeStart, rangeEnd],
    queryFn: () => fetchTaskLogs(rangeStart, rangeEnd),
    staleTime: 30 * 1000,
  });

  const loading = rulesLoading || logsLoading;
  const error = rulesError?.message || logsError?.message || '';

  // Realtime subscription for task_logs invalidation
  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    const channelId = `task_logs_${rangeStart}_${rangeEnd}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_logs' },
        () => {
          // Invalidate task logs query debounced
          queryClient.invalidateQueries({ queryKey: ['task_logs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rangeStart, rangeEnd, queryClient]);

  // Expand due tasks with useMemo, filtered by selectedSystem if not 'ALL'
  const tasks = React.useMemo(() => {
    if (!rules || rules.length === 0) return [];
    const allDueTasks = buildDueTasks(rules, logs, rangeStart, rangeEnd);
    if (!selectedSystem || selectedSystem === 'ALL') {
      return allDueTasks;
    }
    return allDueTasks.filter((t) => {
      const code = t.category?.code || t.equipment?.group?.category?.code || t.equipment?.groups?.categories?.code || t.categoryCode;
      return code === selectedSystem;
    });
  }, [rules, logs, rangeStart, rangeEnd, selectedSystem]);

  const loadData = useCallback(() => {
    refetchRules();
    refetchLogs();
  }, [refetchRules, refetchLogs]);

  // Edit Rule Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editFreq, setEditFreq] = useState('d');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editWeekday, setEditWeekday] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [editGroupId, setEditGroupId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [bulkGroupModalVisible, setBulkGroupModalVisible] = useState(false);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Worker Groups & Workers
  const { groups: workerGroupsList } = useWorkerGroups();
  const { data: workerData } = useWorkers();

  // Filter by Assigned Group: 'ALL' | 'UNASSIGNED' | groupId
  const [groupFilter, setGroupFilter] = useState('ALL');

  // Navigate dates
  const handlePrev = () => {
    const d = parseDate(currentDateStr);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    const newStr = formatDate(d);
    setCurrentDateStr(newStr);
    setSelectedDayStr(newStr);
  };

  const handleNext = () => {
    const d = parseDate(currentDateStr);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    const newStr = formatDate(d);
    setCurrentDateStr(newStr);
    setSelectedDayStr(newStr);
  };

  const handleToday = () => {
    const today = formatDate(new Date());
    setCurrentDateStr(today);
    setSelectedDayStr(today);
  };

  // Open edit rule
  const openEditRule = (rule) => {
    setEditingRule(rule);
    setEditFreq(rule.frequency || 'd');
    setEditStartDate(rule.start_date || '');
    setEditEndDate(rule.end_date || '');
    setEditWeekday(rule.weekday ? Number(rule.weekday) : 1);
    setEditNotes(rule.notes || '');

    // Prefill assigned group from rule
    setEditGroupId(rule.worker_group_id || null);
    setEditModalVisible(true);
  };

  const handleSaveEditRule = () => {
    if (!editingRule) return;

    const chosenGroup = workerGroupsList.find((g) => g.id === editGroupId);
    const isUnassigning = !editGroupId;

    runAction({
      confirm: {
        title: 'Save Schedule Rule?',
        message: isUnassigning
          ? 'Save changes with no worker group assigned? Nobody will see this task until it is assigned.'
          : `Update schedule rule and assign to "${chosenGroup?.name || 'Worker Group'}"?`,
        confirmText: 'Save Changes',
        cancelText: 'Cancel',
        tone: isUnassigning ? 'danger' : 'default',
        icon: 'create-outline',
      },
      loading: 'Saving schedule rule...',
      action: async () => {
        // 1. Update rule basic fields
        await updateScheduleRule(editingRule.id, {
          frequency: editFreq,
          start_date: editStartDate,
          end_date: editEndDate.trim() ? editEndDate.trim() : null,
          weekday: editFreq === 'w' ? editWeekday : null,
          notes: editNotes.trim() ? editNotes.trim() : null,
        });

        // 2. Update assigned worker group via set_rules_group RPC
        if (isConfigured && supabase) {
          const { error: groupErr } = await supabase.rpc('set_rules_group', {
            p_rule_ids: [editingRule.id],
            p_group_id: editGroupId || null,
          });

          if (groupErr) {
            if (groupErr.code === '42883' || groupErr.code === 'PGRST202') {
              throw new Error('Run the worker groups SQL in Supabase');
            }
            throw groupErr;
          }
        }
      },
      success: 'Schedule rule updated successfully',
      onSuccess: () => {
        setEditModalVisible(false);
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
        queryClient.invalidateQueries({ queryKey: ['recent_schedule_rules'] });
      },
    });
  };

  const handleDeleteRule = (ruleId) => {
    runAction({
      confirm: {
        title: 'Delete this task?',
        message: 'This schedule rule and all future recurrences will be removed. This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'trash-outline',
      },
      loading: 'Deleting schedule rule...',
      action: async () => {
        await deleteScheduleRule(ruleId);
      },
      success: 'Schedule rule deleted successfully',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
      },
    });
  };

  // Filtered tasks across the entire calendar based on system filter and group filter
  const filteredTasks = React.useMemo(() => {
    if (groupFilter === 'ALL') return tasks;
    return tasks.filter((t) => {
      const gId = t.rule?.worker_group_id || t.worker_group_id;
      if (groupFilter === 'UNASSIGNED') {
        return !gId;
      }
      return gId === groupFilter;
    });
  }, [tasks, groupFilter]);

  // Build Month Grid
  const renderMonthGrid = () => {
    const mRange = getMonthRange(currentDateStr);
    const d = parseDate(mRange.start);
    const firstWeekday = getIsoWeekday(d); // 1=Mon ... 7=Sun
    const totalDays = daysInMonth(mRange.year, mRange.month);

    // Map tasks by day using filteredTasks
    const tasksByDay = new Map();
    for (const t of filteredTasks) {
      if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
      tasksByDay.get(t.due_date).push(t);
    }

    const cells = [];
    // Blank padding cells before 1st of month
    for (let i = 1; i < firstWeekday; i++) {
      cells.push({ isBlank: true, key: `blank-${i}` });
    }

    // Actual month days
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${mRange.year}-${String(mRange.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayTasks = tasksByDay.get(dateStr) || [];

      cells.push({
        isBlank: false,
        dateStr,
        dayNum,
        dayTasks,
        isToday: dateStr === formatDate(new Date()),
        isSelected: dateStr === selectedDayStr,
        key: dateStr,
      });
    }

    return (
      <View style={styles.calendarContainer}>
        {/* Days of week header (Mon - Sun) */}
        <View style={styles.weekHeaderRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dName) => (
            <View key={dName} style={styles.weekHeaderCell}>
              <Text style={styles.weekHeaderText}>{dName}</Text>
            </View>
          ))}
        </View>

        {/* Days grid */}
        <View style={styles.gridRow}>
          {cells.map((cell) => {
            if (cell.isBlank) {
              return <View key={cell.key} style={styles.blankCell} />;
            }
            const taskCount = cell.dayTasks.length;
            const countLabel = `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
            return (
              <TouchableOpacity
                key={cell.key}
                style={[
                  styles.dayCell,
                  cell.isSelected && styles.dayCellSelected,
                  cell.isToday && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDayStr(cell.dateStr)}
              >
                <View style={styles.dayCellHeader}>
                  <Text
                    style={[
                      styles.dayCellNum,
                      cell.isSelected && styles.dayCellNumSelected,
                    ]}
                  >
                    {cell.dayNum}
                  </Text>
                </View>

                {/* Only task count line */}
                <View style={styles.dayCellBody}>
                  <Text
                    style={[
                      styles.dayCellCountText,
                      taskCount === 0 && styles.dayCellCountMuted,
                      cell.isSelected && styles.dayCellCountSelected,
                    ]}
                  >
                    {countLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Build Week View (Mon-Sun like Excel)
  const renderWeekView = () => {
    const wInfo = getWorkWeek(currentDateStr);
    const tasksByDay = new Map();
    for (const t of filteredTasks) {
      if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
      tasksByDay.get(t.due_date).push(t);
    }

    return (
      <View style={styles.weekViewContainer}>
        <View style={styles.weekCardsRow}>
          {wInfo.days.map((day) => {
            const dayTasks = tasksByDay.get(day.date) || [];
            const isSelected = day.date === selectedDayStr;
            const taskCount = dayTasks.length;
            const countLabel = `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.weekColumnCard,
                  isSelected && styles.weekColumnCardSelected,
                  day.isToday && styles.weekColumnCardToday,
                ]}
                onPress={() => setSelectedDayStr(day.date)}
              >
                <View
                  style={[
                    styles.weekColHeader,
                    isSelected && styles.weekColHeaderSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekColShort,
                      isSelected && styles.weekColShortSelected,
                    ]}
                  >
                    {day.shortLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekColDayNum,
                      isSelected && styles.weekColDayNumSelected,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                </View>

                <View style={styles.weekColBody}>
                  <Text
                    style={[
                      styles.weekTaskCountText,
                      taskCount === 0 && styles.weekTaskCountMuted,
                      isSelected && styles.weekTaskCountSelected,
                    ]}
                  >
                    {countLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Tasks for the selected day, using filteredTasks
  const selectedDayTasks = filteredTasks.filter((t) => t.due_date === selectedDayStr);
  const weekNum = getWorkWeekNumber(currentDateStr);
  const monthInfo = getMonthRange(currentDateStr);

  return (
    <View style={styles.screen}>
      <Header
        title="Schedule Calendar"
        subtitle={`Week ${weekNum} • ${monthInfo.monthName} ${monthInfo.year}`}
        navigation={navigation}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {Platform.OS === 'web' && user?.role === 'admin' && (
              <TouchableOpacity
                style={styles.exportExcelBtn}
                onPress={() => setExportModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={17} color={colors.primary} />
                <Text style={styles.exportExcelText}>Export Excel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.newRuleBtn}
              onPress={() => setAddTaskModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.newRuleText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <PageContainer>
        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Navigation & Controls Bar */}
        <View style={styles.controlsBar}>
          <View style={styles.navButtonGroup}>
            <TouchableOpacity style={styles.iconNavBtn} onPress={handlePrev}>
              <Ionicons name="chevron-back" size={20} color={colors.dark} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.todayBtn} onPress={handleToday}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconNavBtn} onPress={handleNext}>
              <Ionicons name="chevron-forward" size={20} color={colors.dark} />
            </TouchableOpacity>

            <Text style={styles.currentRangeTitle}>
              {viewMode === 'month'
                ? `${monthInfo.monthName} ${monthInfo.year}`
                : `Work Week No. ${weekNum} (${getWorkWeek(currentDateStr).start} to ${getWorkWeek(currentDateStr).end})`}
            </Text>
          </View>

          {/* Toggle Week / Month */}
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
              onPress={() => setViewMode('week')}
            >
              <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
              onPress={() => setViewMode('month')}
            >
              <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>
                Month
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar View */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : viewMode === 'month' ? (
          renderMonthGrid()
        ) : (
          renderWeekView()
        )}

        {/* Selected Day Task List */}
        <View style={styles.dayTasksSection}>
          <View style={styles.dayTasksHeader}>
            <View>
              <Text style={styles.dayTasksHeading}>
                Tasks Scheduled for {selectedDayStr}
              </Text>
              <Text style={styles.dayTasksSub}>
                {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>

            {/* Assigned Worker Group filter pills */}
            <View style={styles.assigneeFilterBar}>
              <Text style={styles.assigneeFilterLabel}>Worker Group:</Text>
              <TouchableOpacity
                style={[
                  styles.assigneeFilterPill,
                  groupFilter === 'ALL' && styles.assigneeFilterPillActive,
                ]}
                onPress={() => setGroupFilter('ALL')}
              >
                <Text
                  style={[
                    styles.assigneeFilterText,
                    groupFilter === 'ALL' && styles.assigneeFilterTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.assigneeFilterPill,
                  groupFilter === 'UNASSIGNED' && styles.assigneeFilterPillActive,
                ]}
                onPress={() => setGroupFilter('UNASSIGNED')}
              >
                <Text
                  style={[
                    styles.assigneeFilterText,
                    groupFilter === 'UNASSIGNED' && styles.assigneeFilterTextActive,
                  ]}
                >
                  Unassigned
                </Text>
              </TouchableOpacity>
              {workerGroupsList.map((g) => {
                const isSelected = groupFilter === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.assigneeFilterPill,
                      isSelected && styles.assigneeFilterPillActive,
                    ]}
                    onPress={() => setGroupFilter(g.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[styles.filterGroupDot, { backgroundColor: g.color || colors.primary }]} />
                      <Text
                        style={[
                          styles.assigneeFilterText,
                          isSelected && styles.assigneeFilterTextActive,
                        ]}
                      >
                        {g.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedDayTasks.length === 0 ? (
            <View style={styles.emptyDayBox}>
              <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
              {selectedSystem && selectedSystem !== 'ALL' ? (
                <>
                  <Text style={styles.emptyDayText}>
                    No tasks for System {selectedSystem} on this day.
                  </Text>
                  <TouchableOpacity
                    style={styles.clearFilterBtn}
                    onPress={() => setSelectedSystem('ALL')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.clearFilterBtnText}>Clear filter</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.emptyDayText}>No tasks scheduled for {selectedDayStr}</Text>
              )}
            </View>
          ) : (
            selectedDayTasks.map((t) => {
              return (
                <View key={t.id} style={styles.ruleCard}>
                  <View style={styles.ruleCardTop}>
                    <View style={styles.badgeLine}>
                      <FrequencyBadge freq={t.frequency} size="medium" />
                      <View style={styles.ruleNameBox}>
                        <Text style={styles.ruleEqName}>{t.equipment?.name || 'Equipment'}</Text>
                        <Text style={styles.ruleGroupName}>
                          {t.category?.code}. {t.category?.name} • {t.group?.name}
                          {t.equipment?.area ? ` (${t.equipment.area})` : ''}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>

                  {/* Worker Group Row */}
                  <View style={styles.cardAssigneesRow}>
                    <Text style={styles.cardAssigneesLabel}>Worker Group:</Text>
                    <WorkerGroupBadge group={t.rule?.worker_group || t.worker_group} />
                  </View>

                  {t.notes ? (
                    <Text style={styles.ruleCardNotes}>Admin Note: {t.notes}</Text>
                  ) : null}

                  {/* Edit & Delete actions for Admin */}
                  <View style={styles.ruleActionsRow}>
                    <TouchableOpacity
                      style={styles.ruleActionEdit}
                      onPress={() => openEditRule(t.rule)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                      <Text style={styles.ruleActionEditText}>Edit Rule & Workers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.ruleActionDelete}
                      onPress={() => handleDeleteRule(t.rule_id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={styles.ruleActionDeleteText}>Delete Rule</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Dev Diagnostics Line */}
        {__DEV__ && (
          <View style={styles.devDiagnosticsBar}>
            <Text style={styles.devDiagnosticsText}>
              [DEV DIAGNOSTICS] Rules: {rules.length} | Active Equipment with Rules: {new Set(rules.map((r) => r.equipment_id)).size} | Role: {user?.role || 'none'} | Date: {selectedDayStr}
            </Text>
          </View>
        )}

        {/* Edit Rule Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Schedule Rule</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={styles.modalFieldLabel}>Frequency Code</Text>
                <View style={styles.modalFreqRow}>
                  {['d', 'w', 'M', 'Q', 'SA'].map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.modalFreqBtn, editFreq === f && styles.modalFreqBtnSelected]}
                      onPress={() => setEditFreq(f)}
                    >
                      <FrequencyBadge freq={f} size="small" />
                    </TouchableOpacity>
                  ))}
                </View>

                {editFreq === 'w' && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.modalFieldLabel}>Weekday (1=Mon ... 7=Sun)</Text>
                    <View style={styles.modalFreqRow}>
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.modalFreqBtn,
                            editWeekday === num && styles.modalFreqBtnSelected,
                          ]}
                          onPress={() => setEditWeekday(num)}
                        >
                          <Text
                            style={{
                              fontWeight: '700',
                              color: editWeekday === num ? colors.white : colors.dark,
                            }}
                          >
                            {num}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  Start Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editStartDate}
                  onChangeText={setEditStartDate}
                />

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  End Date (YYYY-MM-DD or blank)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEndDate}
                  onChangeText={setEditEndDate}
                  placeholder="Optional"
                />

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  Notes
                </Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60 }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                {/* Worker Group assignment in Edit Rule modal */}
                <Text style={[styles.modalFieldLabel, { marginTop: 16 }]}>
                  Assign to Worker Group
                </Text>
                <WorkerGroupSelect
                  selectedGroupId={editGroupId}
                  onSelectGroup={setEditGroupId}
                  allowUnassigned={true}
                  disabled={modalSaving}
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveEditRule}
                    disabled={modalSaving}
                  >
                    {modalSaving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Export to Excel Modal */}
        <ExportScheduleModal
          visible={exportModalVisible}
          onClose={() => setExportModalVisible(false)}
          initialPeriodType={viewMode}
        />

        {/* Add Task Modal */}
        <TaskFormModal
          visible={addTaskModalVisible}
          onClose={() => setAddTaskModalVisible(false)}
          initialStartDate={selectedDayStr || currentDateStr}
          onCreated={({ startDate }) => {
            if (startDate) {
              setSelectedDayStr(startDate);
            }
            refetchRules();
          }}
        />
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
    width: '100%',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  devDiagnosticsBar: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  devDiagnosticsText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  exportExcelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  exportExcelText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  newRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newRuleText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  navButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  currentRangeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginLeft: 6,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.dark,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  calendarContainer: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  blankCell: {
    width: '14.28%',
    height: 70,
  },
  dayCell: {
    width: '14.28%',
    height: 70,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    padding: 4,
    justifyContent: 'flex-start',
  },
  dayCellSelected: {
    backgroundColor: colors.primaryVeryLight,
    borderColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  dayCellHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
  },
  dayCellNumSelected: {
    color: colors.primaryDark,
  },
  dayCellBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
  },
  dayCellCountMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  dayCellCountSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  weekViewContainer: {
    marginBottom: 16,
  },
  weekCardsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  weekColumnCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  weekColumnCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekColumnCardToday: {
    borderColor: colors.primaryDark,
  },
  weekColHeader: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekColHeaderSelected: {
    backgroundColor: colors.primary,
  },
  weekColShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  weekColShortSelected: {
    color: colors.white,
  },
  weekColDayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  weekColDayNumSelected: {
    color: colors.white,
  },
  weekColBody: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  weekTaskCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
  },
  weekTaskCountMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  weekTaskCountSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  dayTasksSection: {
    marginTop: 8,
  },
  dayTasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTasksHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
  },
  dayTasksSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyDayBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearFilterBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearFilterBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyDayText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  ruleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  ruleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ruleNameBox: {
    marginLeft: 10,
    flex: 1,
  },
  ruleEqName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  ruleGroupName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ruleCardNotes: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primaryVeryLight,
    padding: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  ruleActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    marginTop: 4,
  },
  ruleActionEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primaryVeryLight,
  },
  ruleActionEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginLeft: 4,
  },
  ruleActionDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  ruleActionDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    marginLeft: 4,
  },
  filterGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    width: '100%',
    maxWidth: 450,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.dark,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  modalFreqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalFreqBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFreqBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.dark,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    color: colors.white,
    fontWeight: '700',
  },
  // Two-Column Responsive Layout
  twoColContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    marginTop: 8,
    width: '100%',
  },
  twoColStacked: {
    flexDirection: 'column',
    gap: 16,
  },
  tasksCol: {
    width: '100%',
  },
  overviewCol: {
    width: '100%',
  },
  tasksGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  tasksGridXl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compactTaskCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
  },
  compactTaskCardXl: {
    width: '49.2%',
  },
  cardLeftCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenterCol: {
    flex: 1,
    justifyContent: 'center',
  },
  cardEqName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 2,
  },
  cardBreadcrumb: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardInlineNote: {
    fontSize: 10,
    color: colors.primaryDark,
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  cardRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  compactActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.primaryVeryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionDelete: {
    backgroundColor: '#FEE2E2',
  },
  tasksPagination: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  // Assignee filter bar
  assigneeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  assigneeFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  assigneeFilterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assigneeFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  assigneeFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDark,
  },
  assigneeFilterTextActive: {
    color: colors.white,
  },
  // Card assignees
  cardAssigneesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardAssigneesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  unassignedChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  unassignedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cardAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  cardMiniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMiniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  cardMoreAssignees: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  cardAssigneeNames: {
    fontSize: 12,
    color: colors.textDark,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Day Overview Panel Card
  overviewCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: 0.3,
  },
  overviewDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 6,
  },
  metricItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metricItemDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  metricItemPending: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  metricItemOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  progSection: {
    marginBottom: 14,
  },
  progHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  progPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  progTrack: {
    height: 6,
    backgroundColor: '#E4E4E7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  breakdownSection: {
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  breakdownTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sysRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sysDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  sysName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.dark,
    flex: 1,
  },
  sysRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  sysBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#E4E4E7',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sysBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sysCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
    minWidth: 16,
    textAlign: 'right',
  },
  freqBadgeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freqBadgeItem: {
    alignItems: 'center',
    gap: 4,
  },
  freqCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
  },
  quickAddRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 6,
  },
  quickAddRuleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});

