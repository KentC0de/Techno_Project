import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  AppState,
  StatusBar as RNStatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConnectionStatus } from '../../context/ConnectionStatusContext';
import {
  fetchScheduleRules,
  fetchTaskLogs,
  upsertTaskLog,
  undoTaskLog,
  getSavedWorkerSelection,
  fetchCategories,
} from '../../lib/dataService';
import {
  formatDate,
  parseDate,
  addDays,
  getWorkWeek,
  buildDueTasks,
  expandRuleDueDates,
  computePerformance,
} from '../../utils/schedule';
import Header from '../../components/Header';
import TaskCard from '../../components/TaskCard';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useWorkers } from '../../hooks/useWorkers';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../components/feedback';
import { colors, layout } from '../../theme';

export default function TodayScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { status: connStatus, lastCheckedTime } = useConnectionStatus();
  const queryClient = useQueryClient();
  const runAction = useAction();
  const toast = useToast();

  const { groups: workerGroupsList, groupByUser, membersByGroup, refetch: refetchWorkerGroups } = useWorkerGroups();
  const { data: workerData } = useWorkers();

  // Current worker's group & teammates
  const myGroupId = user?.id ? groupByUser[user.id] : null;
  const myGroup = myGroupId ? workerGroupsList.find((g) => g.id === myGroupId) : null;
  const myTeammates = useMemo(() => {
    if (!myGroupId || !user?.id) return [];
    const memberIds = membersByGroup[myGroupId] || [];
    return memberIds
      .filter((id) => id !== user.id)
      .map((id) => (workerData?.allUsers || []).find((u) => u.id === id)?.full_name)
      .filter(Boolean);
  }, [myGroupId, membersByGroup, user?.id, workerData]);

  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));
  const [selection, setSelection] = useState({
    categoryId: route?.params?.categoryId || null,
    categoryName: route?.params?.categoryName || 'All Systems',
    area: route?.params?.area || 'All',
  });

  const [refreshing, setRefreshing] = useState(false);
  const [mutatingRuleId, setMutatingRuleId] = useState(null);

  // Range window: past 30 days to next 14 days
  const today = new Date();
  const pastWindowStart = formatDate(addDays(today, -30));
  const futureWindowEnd = formatDate(addDays(today, 14));

  // Load rules with react-query (fetch all group tasks for worker; JS filtering applied)
  const {
    data: rawRules = [],
    isLoading: rulesLoading,
    error: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['schedule_rules', user?.id, selection.categoryId, selection.area, currentDateStr],
    queryFn: () => fetchScheduleRules(),
    enabled: !!user?.id,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Load task logs with react-query
  const {
    data: logs = [],
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['task_logs', user?.id, pastWindowStart, futureWindowEnd, currentDateStr],
    queryFn: () => fetchTaskLogs(pastWindowStart, futureWindowEnd),
    enabled: !!user?.id,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });

  const loading = rulesLoading || logsLoading;
  const error = rulesError?.message || logsError?.message || null;

  // Compute all tasks across all systems before selection filtering
  const allTasksUnfiltered = useMemo(() => {
    if (!rawRules || rawRules.length === 0) return [];
    return buildDueTasks(rawRules, logs, pastWindowStart, futureWindowEnd);
  }, [rawRules, logs, pastWindowStart, futureWindowEnd]);

  // Check saved worker selection on mount if none provided.
  // If the saved selection yields 0 tasks while allTasksUnfiltered has tasks,
  // automatically reset to "All my systems / areas" so tasks are not hidden!
  useEffect(() => {
    async function loadSaved() {
      if (!selection.categoryId) {
        try {
          const saved = await getSavedWorkerSelection(user?.id);
          if (saved && saved.categoryId) {
            setSelection({
              categoryId: saved.categoryId,
              categoryName: saved.categoryName || 'Selected System',
              area: saved.area || 'All',
            });
            return;
          }
        } catch (_) {}

        setSelection({
          categoryId: null,
          categoryName: 'All Systems',
          area: 'All',
        });
      }
    }
    loadSaved();
  }, [user?.id]);

  // Auto-reset filter if saved filter hides all tasks
  useEffect(() => {
    if (selection.categoryId && allTasksUnfiltered.length > 0) {
      const matchCount = allTasksUnfiltered.filter((t) => {
        const catMatch =
          t.equipment?.group?.category_id === selection.categoryId ||
          t.equipment?.group?.category?.id === selection.categoryId;
        const areaMatch =
          !selection.area || selection.area === 'All' || t.equipment?.area === selection.area;
        return catMatch && areaMatch;
      }).length;

      if (matchCount === 0) {
        setSelection({
          categoryId: null,
          categoryName: 'All Systems',
          area: 'All',
        });
      }
    }
  }, [allTasksUnfiltered, selection.categoryId, selection.area]);

  // When returning with new selection params
  useEffect(() => {
    if (route?.params?.categoryId) {
      setSelection({
        categoryId: route.params.categoryId,
        categoryName: route.params.categoryName || 'Selected System',
        area: route.params.area || 'All',
      });
    }
  }, [route?.params]);

  // Refetch on AppState active (foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refetchRules();
        refetchLogs();
      }
    });
    return () => subscription.remove();
  }, [refetchRules, refetchLogs]);

  // Refetch on screen focus
  useFocusEffect(
    useCallback(() => {
      refetchRules();
      refetchLogs();
    }, [refetchRules, refetchLogs])
  );

  // Apply user selection (system / area) to raw rules
  const rules = useMemo(() => {
    if (!rawRules || rawRules.length === 0) return [];
    let list = rawRules;
    if (selection.categoryId) {
      list = list.filter(
        (r) =>
          r.equipment?.group?.category_id === selection.categoryId ||
          r.equipment?.group?.category?.id === selection.categoryId
      );
    }
    if (selection.area && selection.area !== 'All') {
      list = list.filter((r) => r.equipment?.area === selection.area);
    }
    return list;
  }, [rawRules, selection.categoryId, selection.area]);

  // Compute all tasks for the filtered rules
  const allTasks = useMemo(() => {
    if (!rules || rules.length === 0) return [];
    return buildDueTasks(rules, logs, pastWindowStart, futureWindowEnd);
  }, [rules, logs, pastWindowStart, futureWindowEnd]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchRules(), refetchLogs()]);
    setRefreshing(false);
  };

  // Mutation with optimistic updates & friendly concurrent notice
  const updateLogMutation = useMutation({
    mutationFn: async ({ task, status, note }) => {
      return await upsertTaskLog({
        rule_id: task.rule_id,
        due_date: task.due_date,
        status,
        notes: note,
        done_by: user?.id || null,
      });
    },
    onMutate: async ({ task, status, note }) => {
      setMutatingRuleId(task.rule_id);
      await queryClient.cancelQueries({ queryKey: ['task_logs'] });
      const previousLogs = queryClient.getQueryData(['task_logs', pastWindowStart, futureWindowEnd]);

      queryClient.setQueryData(
        ['task_logs', pastWindowStart, futureWindowEnd],
        (old = []) => {
          const filtered = old.filter(
            (l) => !(l.rule_id === task.rule_id && l.due_date === task.due_date)
          );
          return [
            ...filtered,
            {
              id: `opt-${Date.now()}`,
              rule_id: task.rule_id,
              due_date: task.due_date,
              status,
              notes: note,
              done_by: user?.id,
              done_at: new Date().toISOString(),
            },
          ];
        }
      );

      return { previousLogs };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData(
          ['task_logs', pastWindowStart, futureWindowEnd],
          context.previousLogs
        );
      }
      // Graceful concurrent notice
      if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.message?.includes('already exists')) {
        alert('This task was already completed by a co-worker.');
      } else {
        alert(err.message || 'Failed to update task.');
      }
    },
    onSettled: () => {
      setMutatingRuleId(null);
      queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    },
  });

  const handleUpdateStatus = (task, status, note) => {
    if (mutatingRuleId) return; // double-submit prevention

    const statusLabel =
      status === 'done' ? 'Mark Done' : status === 'issue' ? 'Report Issue' : 'Skip Task';
    const isDone = status === 'done';

    runAction({
      confirm: {
        title: `${statusLabel}?`,
        message: `${statusLabel} for "${task.equipment?.name || 'Equipment'}"?`,
        details: [
          `Date: ${task.due_date}`,
          `Area: ${task.equipment?.area || 'General Area'}`,
          note ? `Note: "${note}"` : null,
        ].filter(Boolean),
        confirmText: statusLabel,
        cancelText: 'Cancel',
        tone: status === 'issue' ? 'danger' : 'default',
        icon: isDone
          ? 'checkmark-circle-outline'
          : status === 'issue'
          ? 'alert-circle-outline'
          : 'play-forward-outline',
      },
      loading: 'Updating task status...',
      action: async () => {
        return await updateLogMutation.mutateAsync({ task, status, note });
      },
      success: `Task marked as ${status.toUpperCase()}`,
    });
  };

  const handleUndoStatus = (task) => {
    if (mutatingRuleId) return;

    runAction({
      confirm: {
        title: 'Undo Completion?',
        message: `Reopen task for "${task.equipment?.name || 'Equipment'}" on ${task.due_date}?`,
        confirmText: 'Reopen Task',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'arrow-undo-outline',
      },
      loading: 'Reopening task...',
      action: async () => {
        await undoTaskLog(task.rule_id, task.due_date);
        queryClient.invalidateQueries({ queryKey: ['task_logs'] });
      },
      success: 'Task reopened successfully',
    });
  };

  const handleStatusPress = () => {
    const msg =
      connStatus === 'connected'
        ? `Supabase connected - Live\nLast checked: ${lastCheckedTime || 'Just now'}`
        : connStatus === 'checking'
        ? 'Checking Supabase connection...'
        : 'Cannot reach Supabase (Offline / Demo Mode)';

    runAction({
      confirm: {
        title: 'Connection Status',
        message: msg,
        confirmText: 'OK',
        cancelText: 'Close',
        tone: 'default',
        icon: 'wifi-outline',
      },
    });
  };

  // Week strip calculation
  const weekInfo = getWorkWeek(currentDateStr);
  const todayStr = formatDate(new Date());

  // Overdue tasks: past due and still pending
  const overdueTasks = allTasks.filter(
    (t) => t.isOverdue && t.due_date < todayStr
  );

  // Selected date tasks
  const selectedDateTasks = allTasks.filter((t) => t.due_date === currentDateStr);

  // Group selected date tasks by group name
  const groupedTasks = selectedDateTasks.reduce((acc, t) => {
    const groupName = t.group?.name || 'General Tasks';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(t);
    return acc;
  }, {});

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Hidden tasks calculation for honesty state
  const hiddenCountByFilter = useMemo(() => {
    if (!selection.categoryId && (!selection.area || selection.area === 'All')) return 0;
    const unfilteredDue = allTasksUnfiltered.filter((t) => t.due_date === currentDateStr);
    return Math.max(0, unfilteredDue.length - selectedDateTasks.length);
  }, [allTasksUnfiltered, currentDateStr, selectedDateTasks.length, selection.categoryId, selection.area]);

  // Next upcoming task for "none due today" honesty state
  const nextUpcomingTask = useMemo(() => {
    if (selectedDateTasks.length > 0 || !rawRules || rawRules.length === 0) return null;
    let next = null;
    const rangeEnd = formatDate(addDays(new Date(), 90));
    rawRules.forEach((rule) => {
      const dates = expandRuleDueDates(rule, currentDateStr, rangeEnd);
      const futureDates = dates.filter((d) => d > currentDateStr).sort();
      if (futureDates.length > 0) {
        const firstDate = futureDates[0];
        if (!next || firstDate < next.date) {
          next = {
            date: firstDate,
            equipmentName: rule.equipment?.name || 'Equipment',
          };
        }
      }
    });
    return next;
  }, [selectedDateTasks.length, rawRules, currentDateStr]);

  const handleResetFilters = () => {
    setSelection({
      categoryId: null,
      categoryName: 'All Systems',
      area: 'All',
    });
  };

  const perf = computePerformance(selectedDateTasks);

  const [statusReason, setStatusReason] = useState('');

  const topInset = Math.max(
    insets?.top || 0,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0
  );

  const getStatusColor = () => {
    if (connStatus === 'connected') return '#10B981';
    if (connStatus === 'checking') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.screen}>
      {/* Slim Native Top Bar with safe area paddingTop */}
      <View style={[styles.slimTopBar, { paddingTop: topInset + 6, height: topInset + 50 }]}>
        <View style={styles.slimLeft}>
          <View style={styles.slimLogo}>
            <Ionicons name="sunny" size={16} color={colors.white} />
          </View>
          <View style={styles.systemChip}>
            <Text style={styles.systemChipText} numberOfLines={1} ellipsizeMode="tail">
              {selection.categoryName} • {selection.area}
            </Text>
          </View>
        </View>

        {/* Supabase Status Dot Only (Tapping displays toast/tooltip status) */}
        <TouchableOpacity
          style={styles.dotTouch}
          onPress={handleStatusPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View
            style={[
              styles.statusDotOnly,
              { backgroundColor: getStatusColor() },
            ]}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Large Scrollable Heading inside the scrollable content */}
        <View style={styles.pageHeadingSection}>
          <Text style={styles.pageTitle} numberOfLines={1} ellipsizeMode="tail">
            Today's Tasks
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={styles.pageSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {selection.categoryName} • {selection.area}
            </Text>
            {selection.categoryId && (
              <TouchableOpacity
                onPress={handleResetFilters}
                style={{ paddingVertical: 2, paddingHorizontal: 8, backgroundColor: '#E0F2FE', borderRadius: 6 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  Show All Systems
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Date Switcher: Yesterday / Today / Tomorrow */}
        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === formatDate(addDays(new Date(), -1)) && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(formatDate(addDays(new Date(), -1)))}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === formatDate(addDays(new Date(), -1)) && styles.quickDateTextActive,
              ]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === todayStr && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(todayStr)}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === todayStr && styles.quickDateTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === formatDate(addDays(new Date(), 1)) && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(formatDate(addDays(new Date(), 1)))}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === formatDate(addDays(new Date(), 1)) && styles.quickDateTextActive,
              ]}
            >
              Tomorrow
            </Text>
          </TouchableOpacity>
        </View>

        {/* This Week (Mon-Sun strip) */}
        <View style={styles.weekStripContainer}>
          <Text style={styles.stripLabel}>WORK WEEK STRIP</Text>
          <View style={styles.weekStrip}>
            {weekInfo.days.map((day) => {
              const isSelected = day.date === currentDateStr;
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    day.isToday && !isSelected && styles.dayPillToday,
                  ]}
                  onPress={() => setCurrentDateStr(day.date)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayShort,
                      isSelected && styles.dayShortSelected,
                    ]}
                  >
                    {day.shortLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  {day.isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        isSelected && { backgroundColor: colors.white },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Group & Team Header Box */}
        {myGroup ? (
          <View style={styles.teamInfoBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <WorkerGroupBadge group={myGroup} />
              {myGroup.shift_start && myGroup.shift_end && (
                <Text style={styles.shiftHintText}>
                  Shift {myGroup.shift_start.slice(0, 5)} - {myGroup.shift_end.slice(0, 5)}
                </Text>
              )}
            </View>
            <Text style={styles.teammatesText}>
              Team: {myTeammates.length > 0 ? myTeammates.join(', ') : 'You are the only active member'}
            </Text>
          </View>
        ) : (
          <View style={styles.noGroupBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
            <Text style={styles.noGroupBannerText}>
              You are currently not in any worker group. Ask an admin to assign you in Assign Workers.
            </Text>
          </View>
        )}

        {/* Progress Bar */}
        <ProgressBar
          completed={perf.completedCount}
          total={perf.totalCount}
          title={currentDateStr === todayStr ? 'Today\'s Progress' : `Progress for ${currentDateStr}`}
        />

        {/* Loading / Error states */}
        {loading && !refreshing ? (
          <LoadingSkeleton message="Loading today's maintenance schedule..." />
        ) : error ? (
          <ErrorMessage
            message={error}
            onRetry={() => { refetchRules(); refetchLogs(); }}
          />
        ) : (
          <>
            {/* OVERDUE TASKS SECTION */}
            {overdueTasks.length > 0 && (
              <View style={styles.overdueSection}>
                <View style={styles.overdueHeader}>
                  <Ionicons name="warning" size={20} color={colors.danger} />
                  <Text style={styles.overdueTitle}>
                    Overdue Tasks ({overdueTasks.length})
                  </Text>
                </View>
                <Text style={styles.overdueNotice}>
                  Past scheduled maintenance pending completion
                </Text>
                {overdueTasks.map((task) => (
                  <TaskCard
                    key={`overdue-${task.id}`}
                    task={task}
                    onUpdateStatus={handleUpdateStatus}
                    onUndoStatus={handleUndoStatus}
                    currentUserId={user?.id}
                  />
                ))}
              </View>
            )}

            {/* SCHEDULED TASKS FOR SELECTED DATE */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>
                Scheduled for {currentDateStr === todayStr ? 'Today' : currentDateStr}
              </Text>
              <Text style={styles.taskCountText}>
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>

            {/* Honest Empty States */}
            {!myGroupId ? (
              <EmptyState
                title="Not in a worker group yet"
                message="You are not in a worker group yet. Please contact your admin."
                icon="people-outline"
              />
            ) : rawRules.length === 0 ? (
              <EmptyState
                title="No tasks for your group yet"
                message="No tasks for your group yet. Your administrator has not assigned schedule rules to your group."
                icon="calendar-outline"
              />
            ) : rules.length === 0 ? (
              <EmptyState
                title="Tasks hidden by system filter"
                message="Tasks are assigned to your group, but none match the currently selected system or area."
                icon="filter-outline"
                actionLabel="Show all my tasks"
                onAction={handleResetFilters}
              />
            ) : selectedDateTasks.length === 0 ? (
              hiddenCountByFilter > 0 ? (
                <EmptyState
                  title="Tasks hidden by filter"
                  message={`${hiddenCountByFilter} ${hiddenCountByFilter === 1 ? 'task is' : 'tasks are'} hidden by your system/area filter for ${currentDateStr}.`}
                  icon="funnel-outline"
                  actionLabel="Show all my tasks"
                  onAction={handleResetFilters}
                />
              ) : (
                <EmptyState
                  title="No tasks due today"
                  message={
                    nextUpcomingTask
                      ? `No tasks due today. Next task: ${nextUpcomingTask.equipmentName} on ${nextUpcomingTask.date}`
                      : 'No tasks due today. All scheduled maintenance is up to date.'
                  }
                  icon="checkmark-done-circle-outline"
                  actionLabel="Switch System or Area"
                  onAction={() => navigation.navigate('ChooseWorkTab', { isChangingWork: true })}
                />
              )
            ) : (
              Object.entries(groupedTasks).map(([groupName, tasksInGroup]) => (
                <View key={groupName} style={styles.groupContainer}>
                  <View style={styles.groupHeaderBar}>
                    <Ionicons name="layers-outline" size={16} color={colors.primaryDark} />
                    <Text style={styles.groupHeaderTitle}>{groupName}</Text>
                    <Text style={styles.groupHeaderCount}>
                      ({tasksInGroup.length})
                    </Text>
                  </View>
                  {tasksInGroup.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdateStatus={handleUpdateStatus}
                      onUndoStatus={handleUndoStatus}
                      currentUserId={user?.id}
                    />
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {/* Collapsible Diagnostics Panel (__DEV__ only) */}
        {__DEV__ && (
          <View style={styles.diagContainer}>
            <TouchableOpacity
              style={styles.diagHeader}
              onPress={() => setDiagnosticsOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={diagnosticsOpen ? 'chevron-down' : 'chevron-forward'}
                  size={16}
                  color={colors.primaryDark}
                />
                <Text style={styles.diagTitle}>Diagnostics (Dev Only)</Text>
              </View>
              <Text style={styles.diagBadge}>
                {rawRules.length} raw | {selectedDateTasks.length} due
              </Text>
            </TouchableOpacity>

            {diagnosticsOpen && (
              <View style={styles.diagBody}>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>User ID: </Text>
                  {user?.id || 'none'}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Role: </Text>
                  {user?.role || 'none'} | <Text style={styles.diagLabel}>Status: </Text>
                  {user?.status || 'active'}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Worker Group: </Text>
                  {myGroup?.name ? `${myGroup.name} (${myGroupId})` : myGroupId || 'none (not in worker_group_members)'}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Raw Rules returned: </Text>
                  {rawRules.length} (before category/area filter)
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Rules after filter: </Text>
                  {rules.length}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Total expanded tasks: </Text>
                  {allTasks.length} in window [-30d..+14d]
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Tasks due on {currentDateStr}: </Text>
                  {selectedDateTasks.length}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Saved Selection: </Text>
                  {selection.categoryName} ({selection.categoryId || 'All'}) • {selection.area}
                </Text>
                <Text style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Tasks hidden by filter: </Text>
                  {hiddenCountByFilter}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slimTopBar: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  slimLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  slimLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  systemChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: '75%',
  },
  systemChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  dotTouch: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotOnly: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pageHeadingSection: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark || '#0284C7',
    marginTop: 2,
  },
  content: {
    padding: 16,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  changeWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  changeWorkText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  quickDateRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  quickDateActive: {
    backgroundColor: colors.dark,
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickDateTextActive: {
    color: colors.white,
  },
  teamInfoBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  shiftHintText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  teammatesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  noGroupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 10,
    marginBottom: 12,
  },
  noGroupBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
  },
  weekStripContainer: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  stripLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  dayPillToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  dayPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dayShortSelected: {
    color: colors.white,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  dayNumSelected: {
    color: colors.white,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  overdueSection: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  overdueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 6,
  },
  overdueNotice: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
  },
  taskCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginLeft: 6,
  },
  groupHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginLeft: 6,
  },
  diagContainer: {
    marginTop: 24,
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
  },
  diagTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
    marginLeft: 6,
  },
  diagBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  diagBody: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  diagItem: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagLabel: {
    fontWeight: '700',
    color: colors.dark,
  },
});

