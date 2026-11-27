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
import FilterButton from '../../components/FilterButton';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useWorkers } from '../../hooks/useWorkers';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../components/feedback';
import { getTaskState, computeTaskCounts } from '../../utils/taskStatus';
import { a11yRole } from '../../utils/a11y';
import WorkerNotificationsModal from '../../components/WorkerNotificationsModal';
import { useNotificationsContext } from '../../context/NotificationsProvider';
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
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const { unreadCount: workerUnreadNotifs } = useNotificationsContext();

  // Load categories for system filter in FilterSheet
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

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

  // Worker filter tabs state: 'all' | 'pending' | 'completed' | 'issue' | 'submitted' | 'returned'
  const [workerStatusFilter, setWorkerStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Collapsible overdue section (collapsed by default)
  const [overdueExpanded, setOverdueExpanded] = useState(false);

  // Collapsible groups, select mode
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskKeys, setSelectedTaskKeys] = useState(new Set());

  // Mutation with optimistic updates & friendly concurrent notice
  const updateLogMutation = useMutation({
    mutationFn: async ({ task, status, note, photos }) => {
      const targetResult = status === 'issue' ? 'issue' : 'completed';
      return await upsertTaskLog({
        rule_id: task.rule_id,
        due_date: task.due_date,
        status: 'draft',
        result: targetResult,
        notes: note || null,
        ...(Array.isArray(photos) ? { photo_paths: photos } : {}),
        done_by: user?.id || null,
      });
    },
    onMutate: async ({ task, status, note, photos }) => {
      setMutatingRuleId(task.rule_id);
      await queryClient.cancelQueries({ queryKey: ['task_logs'] });
      const previousLogs = queryClient.getQueryData(['task_logs', user?.id, pastWindowStart, futureWindowEnd, currentDateStr]);

      const targetResult = status === 'issue' ? 'issue' : 'completed';

      queryClient.setQueryData(
        ['task_logs', user?.id, pastWindowStart, futureWindowEnd, currentDateStr],
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
              status: 'draft',
              result: targetResult,
              notes: note || null,
              photo_paths: Array.isArray(photos) ? photos : (task.log?.photo_paths || []),
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
          ['task_logs', user?.id, pastWindowStart, futureWindowEnd, currentDateStr],
          context.previousLogs
        );
      }
      toast.error(err.message || 'Failed to update task.');
    },
    onSettled: () => {
      setMutatingRuleId(null);
      queryClient.invalidateQueries({ queryKey: ['task_logs'] });
      queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
      queryClient.invalidateQueries({ queryKey: ['daily_report_detail'] });
      queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
    },
  });

  const handleUpdateStatus = async (task, status, note, photos) => {
    if (mutatingRuleId) return; // double-submit prevention

    if (status === 'completed' || status === 'done') {
      try {
        await updateLogMutation.mutateAsync({ task, status: 'completed', note: note || null, photos });
        toast.success('Marked as completed', {
          actionLabel: 'Undo',
          onAction: () => handleUndoStatus(task),
        });
      } catch (_) {
        // Error toast handled in mutation onError
      }
      return;
    }

    // Issue report (called from TaskActionModal with required note)
    await updateLogMutation.mutateAsync({ task, status: 'issue', note, photos });
    toast.success('Issue reported');
  };

  const handleUndoStatus = (task) => {
    if (mutatingRuleId) return;

    runAction({
      confirm: {
        title: 'Remove Completion?',
        message: `Remove your draft completion for "${task.equipment?.name || 'Equipment'}" on ${task.due_date}?`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'arrow-undo-outline',
      },
      loading: 'Removing draft...',
      action: async () => {
        if (isConfigured && supabase) {
          const { error: delErr } = await supabase
            .from('task_logs')
            .delete()
            .eq('rule_id', task.rule_id)
            .eq('due_date', task.due_date)
            .eq('status', 'draft');
          if (delErr) throw delErr;
        } else {
          await undoTaskLog(task.rule_id, task.due_date);
        }
        queryClient.invalidateQueries({ queryKey: ['task_logs'] });
        queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
        queryClient.invalidateQueries({ queryKey: ['daily_report_detail'] });
        queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
      },
      success: 'Draft removed. Task is now pending.',
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

  const taskCounts = useMemo(() => {
    return computeTaskCounts(selectedDateTasks);
  }, [selectedDateTasks]);

  // Status Filtered Tasks
  const statusFilteredTasks = useMemo(() => {
    if (workerStatusFilter === 'all') return selectedDateTasks;
    return selectedDateTasks.filter((t) => {
      const state = getTaskState(t.due_date, t.log, todayStr);
      if (workerStatusFilter === 'pending') return state === 'pending' || state === 'overdue';
      return state === workerStatusFilter;
    });
  }, [selectedDateTasks, workerStatusFilter, todayStr]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [workerStatusFilter, currentDateStr]);

  // Build Filter sections for FilterSheet
  const filterSections = useMemo(() => {
    const sec = [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: `All (${selectedDateTasks.length})` },
          { value: 'pending', label: `Pending (${taskCounts.pending})` },
          { value: 'completed', label: `Completed (${taskCounts.completed})` },
          { value: 'issue', label: `Issues (${taskCounts.issue})` },
          { value: 'submitted', label: `Submitted (${taskCounts.submitted})` },
          { value: 'returned', label: `Returned (${taskCounts.returned})` },
        ],
      },
    ];

    if (categories.length > 0) {
      sec.push({
        key: 'system',
        label: 'System',
        options: [
          { value: 'ALL', label: 'All Systems' },
          ...categories.map((c) => ({
            value: c.id,
            label: `${c.code}. ${c.name}`,
          })),
        ],
      });
    }

    return sec;
  }, [selectedDateTasks.length, taskCounts, categories]);

  const filterValue = useMemo(() => {
    return {
      status: workerStatusFilter,
      system: selection.categoryId || 'ALL',
    };
  }, [workerStatusFilter, selection.categoryId]);

  const handleFilterChange = (newVal) => {
    if (newVal.status !== undefined) {
      setWorkerStatusFilter(newVal.status);
    }
    if (newVal.system !== undefined) {
      if (newVal.system === 'ALL' || newVal.system === 'all' || !newVal.system) {
        setSelection({
          categoryId: null,
          categoryName: 'All Systems',
          area: 'All',
        });
      } else {
        const cat = categories.find((c) => c.id === newVal.system);
        setSelection({
          categoryId: newVal.system,
          categoryName: cat ? `${cat.code}. ${cat.name}` : 'Selected System',
          area: 'All',
        });
      }
    }
  };

  // Group statusFilteredTasks by equipment group name
  const allGroupedEntries = useMemo(() => {
    const map = {};
    statusFilteredTasks.forEach((t) => {
      const groupName = t.group?.name || 'General Tasks';
      if (!map[groupName]) map[groupName] = [];
      map[groupName].push(t);
    });
    return Object.entries(map); // [ [groupName, tasksArray], ... ]
  }, [statusFilteredTasks]);

  // Paginate on groups (PAGE_SIZE groups per page)
  const paginatedGroupEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allGroupedEntries.slice(start, start + PAGE_SIZE);
  }, [allGroupedEntries, page]);

  const profileMap = useMemo(() => {
    if (!workerData?.allUsers) return null;
    return new Map(workerData.allUsers.map((u) => [u.id, u.full_name]));
  }, [workerData]);

  const handleBulkMarkCompleted = async (tasksToMark) => {
    if (!tasksToMark || tasksToMark.length === 0) return;
    const rows = tasksToMark.map((t) => ({
      rule_id: t.rule_id,
      due_date: t.due_date,
      status: 'draft',
      result: 'completed',
      done_by: user?.id || null,
    }));
    if (isConfigured && supabase) {
      const { error } = await supabase.from('task_logs').upsert(rows, { onConflict: 'rule_id,due_date' });
      if (error) throw error;
    }
    queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    queryClient.invalidateQueries({ queryKey: ['daily_report_detail'] });
  };

  const toggleGroupExpanded = (groupName, defaultExpanded) => {
    setExpandedGroups((prev) => {
      const current = prev[groupName] !== undefined ? prev[groupName] : defaultExpanded;
      return { ...prev, [groupName]: !current };
    });
  };

  const toggleTaskSelected = (taskKey) => {
    setSelectedTaskKeys((prev) => {
      const next = new Set(prev);
      if (next.has(taskKey)) {
        next.delete(taskKey);
      } else {
        next.add(taskKey);
      }
      return next;
    });
  };

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

  const myFirstName = (() => {
    const full = (workerData?.allUsers || []).find((u) => u.id === user?.id)?.full_name || '';
    return full.trim().split(' ')[0] || '';
  })();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 18) return 'Good afternoon,';
    return 'Good evening,';
  })();
  const doneCount = taskCounts.completed + taskCounts.submitted + taskCounts.done;
  const donePct = taskCounts.total > 0 ? Math.min(100, Math.round((doneCount / taskCounts.total) * 100)) : 0;
  const monthLabel = (() => {
    const [yy, mm] = String(currentDateStr).split('-').map(Number);
    if (!yy || !mm) return '';
    return new Date(yy, mm - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  })();

  const getStatusColor = () => {
    if (connStatus === 'connected') return '#10B981';
    if (connStatus === 'checking') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.screen}>
      {/* Greeting header */}
      <View style={[styles.greetBar, { paddingTop: topInset + 10 }]}>
        <View style={styles.greetAvatar}>
          <Text style={styles.greetAvatarText}>{(myFirstName || 'W').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.greetTextWrap}>
          <Text style={styles.greetHello}>{greeting}</Text>
          <Text style={styles.greetName} numberOfLines={1}>{myFirstName || 'Worker'}</Text>
        </View>
        <TouchableOpacity
          style={styles.dotTouch}
          onPress={handleStatusPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Connection status"
        >
          <View style={[styles.statusDotOnly, { backgroundColor: getStatusColor() }]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.greetBell}
          onPress={() => setNotifModalVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.dark} />
          {workerUnreadNotifs > 0 && (
            <View style={styles.workerBellBadge}>
              <Text style={styles.workerBellBadgeText}>
                {workerUnreadNotifs > 99 ? '99+' : workerUnreadNotifs}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Worker Notifications Modal */}
      <WorkerNotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onSelectNotification={(notif) => {
          const reportDate = notif?.data?.report_date || notif?.due_date || notif?.data?.due_date;
          if (notif?.type === 'report_reviewed' || notif?.type === 'report_returned' || notif?.type === 'task_assigned') {
            if (navigation?.navigate) {
              navigation.navigate('WorkerReportTab', { reportDate: reportDate || currentDateStr });
            }
          }
        }}
      />

        {/* Hero progress card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Today's work</Text>
              <Text style={styles.heroBig}>
                {doneCount}
                <Text style={styles.heroBigSub}>/{taskCounts.total}</Text>
              </Text>
            </View>
            {myGroup ? (
              <View style={styles.heroGroupPill}>
                <View style={[styles.heroGroupDot, { backgroundColor: myGroup.color || colors.primary }]} />
                <Text style={styles.heroGroupText} numberOfLines={1}>{myGroup.name}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${donePct}%` }]} />
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroMeta}>{donePct}%{taskCounts.submitted > 0 ? `  \u2022  ${taskCounts.submitted} sent` : ''}</Text>
            {myGroup?.shift_start && myGroup?.shift_end ? (
              <Text style={styles.heroMeta}>
                {myGroup.shift_start.slice(0, 5)} - {myGroup.shift_end.slice(0, 5)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.monthRow}>
          <Text style={styles.monthText}>{monthLabel}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </View>

        {/* This Week (Mon-Sun compact strip) */}
        <View style={styles.weekStripContainer}>
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

        {!myGroup ? (
          <View style={styles.noGroupBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
            <Text style={styles.noGroupBannerText}>Not in a worker group. Ask your admin.</Text>
          </View>
        ) : null}

        {/* Progress + actions: one aligned row */}
        <View style={styles.progressActionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>All Tasks</Text>
          </View>
          {statusFilteredTasks.length > 0 && (
            <TouchableOpacity
              style={styles.selectModeBtn}
              onPress={() => {
                setSelectMode((prev) => !prev);
                setSelectedTaskKeys(new Set());
              }}
              activeOpacity={0.8}
              {...a11yRole('button')}
            >
              <Text style={styles.selectModeBtnText}>{selectMode ? 'Cancel' : 'Select'}</Text>
            </TouchableOpacity>
          )}
          <FilterButton
            sections={filterSections}
            value={filterValue}
            onChange={handleFilterChange}
            resultCount={statusFilteredTasks.length}
          />
        </View>

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
            {/* OVERDUE TASKS SECTION (Collapsed by default with count badge) */}
            {overdueTasks.length > 0 && (
              <View style={styles.overdueSection}>
                <TouchableOpacity
                  style={styles.overdueHeaderTouch}
                  onPress={() => setOverdueExpanded((prev) => !prev)}
                  activeOpacity={0.7}
                  {...a11yRole('button')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="warning" size={18} color={colors.danger} />
                    <Text style={styles.overdueTitle}>Overdue Tasks</Text>
                    <View style={styles.overdueCountBadge}>
                      <Text style={styles.overdueCountBadgeText}>{overdueTasks.length}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={overdueExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={16}
                    color={colors.danger}
                  />
                </TouchableOpacity>

                {overdueExpanded && (
                  <View style={{ marginTop: 8 }}>
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
              </View>
            )}

            {/* Honest Empty States */}
            {!myGroupId ? (
              <EmptyState
                title="No group yet"
                message="Contact your admin."
                icon="people-outline"
              />
            ) : rawRules.length === 0 ? (
              <EmptyState
                title="No tasks yet"
                message="Nothing assigned yet."
                icon="calendar-outline"
              />
            ) : rules.length === 0 ? (
              <EmptyState
                title="Hidden by filter"
                message="No match for this filter."
                icon="filter-outline"
                actionLabel="Show all my tasks"
                onAction={handleResetFilters}
              />
            ) : selectedDateTasks.length === 0 ? (
              hiddenCountByFilter > 0 ? (
                <EmptyState
                  title="Hidden by filter"
                  message={`${hiddenCountByFilter} hidden by filter.`}
                  icon="funnel-outline"
                  actionLabel="Show all my tasks"
                  onAction={handleResetFilters}
                />
              ) : (
                <EmptyState
                  title="No tasks due today"
                  message={
                    nextUpcomingTask
                      ? `Next: ${nextUpcomingTask.equipmentName}, ${nextUpcomingTask.date}`
                      : 'All up to date.'
                  }
                  icon="checkmark-done-circle-outline"
                  actionLabel="Change filter"
                  onAction={() => navigation.navigate('ChooseWorkTab', { isChangingWork: true })}
                />
              )
            ) : statusFilteredTasks.length === 0 ? (
              <EmptyState
                title={`No ${workerStatusFilter} tasks`}
                message="Try another filter."
                icon="filter-outline"
                actionLabel="View all tasks"
                onAction={() => setWorkerStatusFilter('all')}
              />
            ) : (
              <>
                {paginatedGroupEntries.map(([groupName, tasksInGroup]) => {
                  const pendingInGroup = tasksInGroup.filter((t) => {
                    const st = getTaskState(t.due_date, t.log, todayStr);
                    return st === 'pending' || st === 'overdue' || st === 'returned';
                  });
                  const completedInGroup = tasksInGroup.filter((t) => {
                    const st = getTaskState(t.due_date, t.log, todayStr);
                    return st === 'completed' || st === 'issue' || st === 'submitted' || st === 'done';
                  });
                  const defaultExpanded = false; // Collapsed by default
                  const isExpanded = expandedGroups[groupName] !== undefined
                    ? expandedGroups[groupName]
                    : defaultExpanded;

                  return (
                    <View key={groupName} style={styles.groupContainer}>
                      {/* Equipment-group header: one line: icon, group name, short progress "4/6" and chevron */}
                      <TouchableOpacity
                        style={styles.groupHeaderBar}
                        onPress={() => toggleGroupExpanded(groupName, defaultExpanded)}
                        activeOpacity={0.8}
                        {...a11yRole('button')}
                      >
                        <Ionicons
                          name="hardware-chip-outline"
                          size={18}
                          color={colors.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.groupHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
                          {groupName}
                        </Text>
                        <Text style={styles.groupHeaderProgressShort}>
                          {completedInGroup.length}/{tasksInGroup.length}
                        </Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={colors.textSecondary}
                          style={{ marginLeft: 6 }}
                        />
                        {pendingInGroup.length > 0 && (
                          <TouchableOpacity
                            style={styles.markAllBtn}
                            onPress={() => {
                              runAction({
                                confirm: {
                                  title: 'Mark All Completed?',
                                  message: `Mark all ${pendingInGroup.length} pending task${pendingInGroup.length === 1 ? '' : 's'} in "${groupName}" as completed?`,
                                  confirmText: 'Mark All',
                                  cancelText: 'Cancel',
                                  tone: 'default',
                                  icon: 'checkmark-done-outline',
                                },
                                loading: 'Marking tasks...',
                                action: () => handleBulkMarkCompleted(pendingInGroup),
                                success: `${pendingInGroup.length} task${pendingInGroup.length === 1 ? '' : 's'} marked as completed.`,
                              });
                            }}
                            activeOpacity={0.8}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            {...a11yRole('button')}
                          >
                            <Ionicons name="checkmark-done-outline" size={14} color={colors.primary} />
                            <Text style={styles.markAllBtnText}>Mark all</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>

                      {/* Task cards (collapsible) */}
                      {isExpanded && tasksInGroup.map((task) => {
                        const taskKey = `${task.rule_id}__${task.due_date}`;
                        const isSelected = selectedTaskKeys.has(taskKey);
                        return (
                          <View key={task.id} style={styles.taskCardWrapper}>
                            {selectMode && (
                              <TouchableOpacity
                                style={[styles.checkboxOuter, isSelected && styles.checkboxOuterSelected]}
                                onPress={() => toggleTaskSelected(taskKey)}
                                activeOpacity={0.7}
                                {...a11yRole('button')}
                              >
                                {isSelected && (
                                  <Ionicons name="checkmark" size={14} color={colors.white} />
                                )}
                              </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }}>
                              <TaskCard
                                task={task}
                                onUpdateStatus={handleUpdateStatus}
                                onUndoStatus={handleUndoStatus}
                                currentUserId={user?.id}
                                profileMap={profileMap}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}

                {/* Group-level pagination */}
                {allGroupedEntries.length > PAGE_SIZE && (
                  <View style={{ marginTop: 8, marginBottom: 16 }}>
                    <Pagination
                      currentPage={page}
                      totalItems={allGroupedEntries.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setPage}
                    />
                  </View>
                )}
              </>
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

      {/* Sticky submit: the single next step once tasks are recorded */}
      {!selectMode && (taskCounts.completed + taskCounts.issue) > 0 && (
        <View style={styles.submitBar}>
          <TouchableOpacity
            style={styles.submitBarBtn}
            onPress={() => navigation.navigate('WorkerReportTab')}
            activeOpacity={0.85}
            {...a11yRole('button')}
            accessibilityLabel="Submit report"
          >
            <Ionicons name="paper-plane-outline" size={18} color={colors.white} />
            <Text style={styles.submitBarBtnText}>
              Submit report ({taskCounts.completed + taskCounts.issue})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Select mode bulk action bar */}
      {selectMode && selectedTaskKeys.size > 0 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkActionText}>
            {selectedTaskKeys.size} selected
          </Text>
          <TouchableOpacity
            style={styles.bulkMarkBtn}
            onPress={() => {
              const tasksToMark = statusFilteredTasks.filter((t) => {
                const taskKey = `${t.rule_id}__${t.due_date}`;
                return selectedTaskKeys.has(taskKey);
              });
              runAction({
                confirm: {
                  title: 'Mark Selected Completed?',
                  message: `Mark ${tasksToMark.length} selected task${tasksToMark.length === 1 ? '' : 's'} as completed?`,
                  confirmText: 'Mark Completed',
                  cancelText: 'Cancel',
                  tone: 'default',
                  icon: 'checkmark-done-outline',
                },
                loading: 'Marking tasks...',
                action: async () => {
                  await handleBulkMarkCompleted(tasksToMark);
                  setSelectMode(false);
                  setSelectedTaskKeys(new Set());
                },
                success: `${tasksToMark.length} task${tasksToMark.length === 1 ? '' : 's'} marked as completed.`,
              });
            }}
            activeOpacity={0.85}
            {...a11yRole('button')}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={colors.white} />
            <Text style={styles.bulkMarkBtnText}>
              Mark {selectedTaskKeys.size} completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkCancelBtn}
            onPress={() => {
              setSelectMode(false);
              setSelectedTaskKeys(new Set());
            }}
            activeOpacity={0.8}
            {...a11yRole('button')}
          >
            <Text style={styles.bulkCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sticky Daily Report Summary Card */}
      {myGroupId && !selectMode ? (
        <View style={styles.stickyReportBar}>
          <View style={styles.stickyReportInfo}>
            <Text style={styles.stickyReportTitle}>
              Daily report for {currentDateStr}
            </Text>
            <Text style={styles.stickyReportSub}>
              {taskCounts.completed + taskCounts.submitted + taskCounts.done + taskCounts.issue} completed, {taskCounts.pending} pending, {taskCounts.issue} issue
            </Text>
          </View>
          <TouchableOpacity
            style={styles.stickyReportBtn}
            onPress={() => {
              if (navigation?.navigate) {
                navigation.navigate('WorkerReportTab', { reportDate: currentDateStr });
              }
            }}
            activeOpacity={0.85}
            {...a11yRole('button')}
          >
            <Text style={styles.stickyReportBtnText}>Review and submit report</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  greetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  greetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  greetAvatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  greetTextWrap: { flex: 1 },
  greetHello: { fontSize: 14, color: colors.textSecondary },
  greetName: { fontSize: 18, fontWeight: '800', color: colors.dark },
  greetBell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLabel: { fontSize: 14, color: '#D1D5DB' },
  heroBig: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  heroBigSub: { fontSize: 20, fontWeight: '600', color: '#9CA3AF' },
  heroGroupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  heroGroupDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  heroGroupText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  heroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 14,
    overflow: 'hidden',
  },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: '#0EA5E9' },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  heroMeta: { fontSize: 14, color: '#D1D5DB' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthText: { fontSize: 16, fontWeight: '800', color: colors.dark },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.dark },
  compactGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stickyReportBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stickyReportInfo: {
    flex: 1,
  },
  stickyReportTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.dark,
  },
  stickyReportSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stickyReportBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
  },
  stickyReportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
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
    marginBottom: 18,
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
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 64,
    justifyContent: 'center',
  },
  dayPillToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  dayPillSelected: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
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
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  groupHeaderSub: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  groupHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginLeft: 6,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 3,
  },
  selectModeBtn: {
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  taskCardWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginRight: 8,
  },
  checkboxOuterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  submitBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
  },
  submitBarBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBarBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  bulkActionBar: {
    backgroundColor: colors.dark,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulkActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    flex: 1,
  },
  bulkMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  bulkMarkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    marginLeft: 5,
  },
  bulkCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bulkCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  oneLineProgressCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  oneLineProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  progressTrackCompact: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFillCompact: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  filterBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 44,
  },
  taskCountMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  overdueHeaderTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  overdueCountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  overdueCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  groupHeaderProgressShort: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  filterChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0EA5E9',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
  },
  filterChipTextActive: {
    color: '#0284C7',
    fontWeight: '700',
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

