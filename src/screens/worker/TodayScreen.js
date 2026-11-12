import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  computePerformance,
} from '../../utils/schedule';
import Header from '../../components/Header';
import TaskCard from '../../components/TaskCard';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import { colors, layout } from '../../theme';

export default function TodayScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { status: connStatus, lastCheckedTime } = useConnectionStatus();
  const queryClient = useQueryClient();

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

  // Load rules with react-query
  const {
    data: rules = [],
    isLoading: rulesLoading,
    error: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['schedule_rules', selection.categoryId, selection.area],
    queryFn: () =>
      fetchScheduleRules({
        categoryId: selection.categoryId,
        area: selection.area,
      }),
    staleTime: 30 * 1000,
  });

  // Load task logs with react-query
  const {
    data: logs = [],
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['task_logs', pastWindowStart, futureWindowEnd],
    queryFn: () => fetchTaskLogs(pastWindowStart, futureWindowEnd),
    staleTime: 30 * 1000,
  });

  const loading = rulesLoading || logsLoading;
  const error = rulesError?.message || logsError?.message || null;

  // Realtime subscription for task_logs invalidation
  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    const channel = supabase
      .channel(`worker_task_logs_${pastWindowStart}_${futureWindowEnd}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['task_logs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pastWindowStart, futureWindowEnd, queryClient]);

  // Compute all tasks using useMemo
  const allTasks = React.useMemo(() => {
    if (!rules || rules.length === 0) return [];
    return buildDueTasks(rules, logs, pastWindowStart, futureWindowEnd);
  }, [rules, logs, pastWindowStart, futureWindowEnd]);

  // Check saved worker selection on mount if none provided
  useEffect(() => {
    async function loadSaved() {
      if (!selection.categoryId) {
        const saved = await getSavedWorkerSelection();
        if (saved && saved.categoryId) {
          setSelection({
            categoryId: saved.categoryId,
            categoryName: saved.categoryName || 'Selected System',
            area: saved.area || 'All',
          });
        } else {
          try {
            const cats = await fetchCategories();
            if (cats.length > 0) {
              setSelection({
                categoryId: cats[0].id,
                categoryName: cats[0].name,
                area: 'All',
              });
            }
          } catch (_) {}
        }
      }
    }
    loadSaved();
  }, []);

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
      alert(err.message || 'Failed to update task.');
    },
    onSettled: () => {
      setMutatingRuleId(null);
      queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    },
  });

  const handleUpdateStatus = (task, status, note) => {
    if (mutatingRuleId) return; // double-submit prevention
    updateLogMutation.mutate({ task, status, note });
  };

  const handleUndoStatus = async (task) => {
    if (mutatingRuleId) return;
    try {
      setMutatingRuleId(task.rule_id);
      await undoTaskLog(task.rule_id, task.due_date);
      queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    } catch (err) {
      alert(err.message || 'Failed to undo task.');
    } finally {
      setMutatingRuleId(null);
    }
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

  const handleStatusPress = () => {
    const msg =
      connStatus === 'connected'
        ? `Supabase connected - Live\nLast checked: ${lastCheckedTime || 'Just now'}`
        : connStatus === 'checking'
        ? 'Checking Supabase connection...'
        : 'Cannot reach Supabase (Offline / Demo Mode)';
    alert(msg);
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
          <Text style={styles.pageSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {selection.categoryName} • {selection.area}
          </Text>
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

            {selectedDateTasks.length === 0 ? (
              <EmptyState
                title="No tasks for today"
                message="All scheduled maintenance is up to date or no activities planned for this day."
                icon="checkmark-done-circle-outline"
                actionLabel="Switch System or Area"
                onAction={() => navigation.navigate('ChooseWorkTab', { isChangingWork: true })}
              />
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
});

