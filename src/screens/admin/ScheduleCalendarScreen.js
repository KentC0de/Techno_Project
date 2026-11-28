import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchScheduleRules,
  updateScheduleRule,
  deleteScheduleRule,
  countRuleTaskLogs,
  deleteTaskLogById,
  fetchTaskLogById,
  fetchTaskLogs,
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
  expandRuleDueDates,
} from '../../utils/schedule';
import { supabase, isConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSubmittedReportsCount } from '../../hooks/useSubmittedReportsCount';
import { useCalendarFilters } from '../../hooks/useCalendarFilters';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import FrequencyBadge from '../../components/FrequencyBadge';
import TaskStatusChip from '../../components/TaskStatusChip';
import TaskLogCard from '../../components/TaskLogCard';
import ExportScheduleModal from '../../components/ExportScheduleModal';
import TaskFormModal from '../../components/TaskFormModal';
import WorkerGroupSelect from '../../components/WorkerGroupSelect';
import FilterButton from '../../components/FilterButton';
import ReportDetailSlideOver from '../../components/ReportDetailSlideOver';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useWorkers } from '../../hooks/useWorkers';
import { useAction } from '../../hooks/useAction';
import { useTaskLogs } from '../../hooks/useTaskLogs';
import { useToast } from '../../components/feedback';
import { mapError } from '../../utils/errorMessages';
import { a11yRole } from '../../utils/a11y';
import { colors } from '../../theme';

function getStatusPill(status) {
  switch (status) {
    case 'submitted':
      return {
        label: 'Submitted - Needs Review',
        bg: '#FEF3C7',
        text: '#B45309',
        dot: '#F59E0B',
      };
    case 'reviewed':
      return {
        label: 'Reviewed',
        bg: '#EAF2FA',
        text: '#1C5089',
        dot: '#2563A6',
      };
    case 'returned':
      return {
        label: 'Returned for Correction',
        bg: '#FEF2F2',
        text: '#DC2626',
        dot: '#DC2626',
      };
    case 'draft':
      return {
        label: 'Draft',
        bg: '#F1F5F9',
        text: '#475569',
        dot: '#64748B',
      };
    default:
      return null;
  }
}

export default function ScheduleCalendarScreen({ navigation, route }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const runAction = useAction();
  const toast = useToast();

  const [filters, setFilters] = useCalendarFilters('tasks');
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState(formatDate(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);

  // Group expand state and pagination
  const [expandedDayGroups, setExpandedDayGroups] = useState({});
  const [dayPanelPage, setDayPanelPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const DAY_PAGE_SIZE = 10;
  const REPORTS_PAGE_SIZE = 10;

  // Slide-over state synced with route params
  const [slideOverReport, setSlideOverReport] = useState({
    visible: false,
    groupId: null,
    date: null,
    reportId: null,
  });

  // Submitted reports count for badge
  const { count: submittedReportsCount } = useSubmittedReportsCount({ enabled: isAdmin });

  // Handle route params: view ('tasks' | 'reports'), reportGroupId, reportDate
  useEffect(() => {
    if (route?.params?.view) {
      setFilters((prev) => (prev.view === route.params.view ? prev : { ...prev, view: route.params.view }));
    }
    if (route?.params?.reportGroupId || route?.params?.reportDate) {
      setSlideOverReport({
        visible: true,
        groupId: route.params.reportGroupId || null,
        date: route.params.reportDate || selectedDayStr,
        reportId: route.params.reportId || null,
      });
    }
  }, [route?.params?.view, route?.params?.reportGroupId, route?.params?.reportDate, route?.params?.reportId, selectedDayStr, setFilters]);

  // Handle deep link logId / dueDate
  useEffect(() => {
    const paramDueDate = route?.params?.dueDate;
    const paramLogId = route?.params?.logId;
    if (!paramDueDate && !paramLogId) return;

    let cancelled = false;
    if (paramDueDate) {
      setCurrentDateStr(paramDueDate);
      setSelectedDayStr(paramDueDate);
    }
    if (paramLogId) {
      (async () => {
        try {
          const ctx = await fetchTaskLogById(paramLogId);
          if (cancelled || !ctx?.log) return;
          if (ctx.log.due_date) {
            setCurrentDateStr(ctx.log.due_date);
            setSelectedDayStr(ctx.log.due_date);
          }
        } catch (_) {}
      })();
    }
    if (navigation?.setParams) {
      navigation.setParams({ logId: undefined, dueDate: undefined });
    }
    return () => {
      cancelled = true;
    };
  }, [route?.params?.logId, route?.params?.dueDate, navigation]);

  // Handle openAddTask param
  useEffect(() => {
    if (route?.params?.openAddTask) {
      setAddTaskModalVisible(true);
      if (navigation?.setParams) {
        navigation.setParams({ openAddTask: undefined });
      }
    }
  }, [route?.params?.openAddTask, navigation]);

  // Visible range for calendar week/month
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const m = getMonthRange(currentDateStr);
      return { rangeStart: m.start, rangeEnd: m.end };
    } else {
      const w = getWorkWeek(currentDateStr);
      return { rangeStart: w.start, rangeEnd: w.end };
    }
  }, [viewMode, currentDateStr]);

  // Query Schedule Rules
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

  // Query Task Logs for visible range (+ selectedDayStr)
  const {
    logs = [],
    contexts: logContexts = [],
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useTaskLogs(rangeStart, rangeEnd, { extraDate: selectedDayStr });

  // Worker Groups & Workers
  const { groups: workerGroupsList = [] } = useWorkerGroups();
  const { data: workerData } = useWorkers();

  const profilesMap = useMemo(() => {
    const map = new Map();
    if (workerData?.allUsers) {
      workerData.allUsers.forEach((u) => map.set(u.id, u.full_name));
    }
    return map;
  }, [workerData]);

  // Invalidate queries after review
  const invalidateAllAfterReview = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
    queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
    queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
    queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
    queryClient.invalidateQueries({ queryKey: ['submitted_reports_count'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
  }, [queryClient]);

  // Date range for reports view based on filters.range
  const reportsRange = useMemo(() => {
    const today = new Date();
    if (filters.range === 'week') {
      const w = getWorkWeek(selectedDayStr || formatDate(today));
      return { start: w.start, end: w.end };
    }
    if (filters.range === 'last7') {
      return { start: formatDate(addDays(today, -6)), end: formatDate(today) };
    }
    // Default: selected day
    return { start: selectedDayStr, end: selectedDayStr };
  }, [filters.range, selectedDayStr]);

  // Query daily_reports for Reports view
  const { data: dailyReports = [], isLoading: dailyReportsLoading } = useQuery({
    queryKey: ['daily_reports', 'calendar_view', reportsRange.start, reportsRange.end],
    queryFn: async () => {
      if (!isConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .gte('report_date', reportsRange.start)
        .lte('report_date', reportsRange.end);
      if (error) {
        if (error.code === '42P01' || error.code === '42703') return [];
        throw error;
      }
      return data || [];
    },
    staleTime: 15 * 1000,
  });

  // Query additional task logs for reports range if outside calendar range
  const { data: reportsRangeLogs = [] } = useQuery({
    queryKey: ['task_logs', 'reports_range', reportsRange.start, reportsRange.end],
    queryFn: () => fetchTaskLogs(reportsRange.start, reportsRange.end),
    staleTime: 15 * 1000,
  });

  // Expand due tasks for the calendar view, filtered by system
  const tasks = useMemo(() => {
    if (!rules || rules.length === 0) return [];
    const allDueTasks = buildDueTasks(rules, logs, rangeStart, rangeEnd);
    if (!filters.system || filters.system === 'ALL') {
      return allDueTasks;
    }
    return allDueTasks.filter((t) => {
      const code =
        t.category?.code ||
        t.equipment?.group?.category?.code ||
        t.equipment?.groups?.categories?.code ||
        t.categoryCode;
      return code === filters.system;
    });
  }, [rules, logs, rangeStart, rangeEnd, filters.system]);

  // Filter tasks by group filter
  const filteredTasks = useMemo(() => {
    if (!filters.group || filters.group === 'all') return tasks;
    return tasks.filter((t) => {
      const gId = t.rule?.worker_group_id || t.worker_group_id;
      if (filters.group === 'unassigned') {
        return !gId;
      }
      return gId === filters.group;
    });
  }, [tasks, filters.group]);

  // Tasks for selected day enriched with context
  const selectedDayTasks = useMemo(() => {
    const contextByKey = new Map();
    for (const ctx of logContexts) {
      if (ctx?.log?.rule_id && ctx?.log?.due_date) {
        contextByKey.set(`${ctx.log.rule_id}_${ctx.log.due_date}`, ctx);
      }
    }

    const seenKeys = new Set();
    const enriched = filteredTasks
      .filter((t) => t.due_date === selectedDayStr)
      .map((t) => {
        const key = `${t.rule_id}_${t.due_date}`;
        seenKeys.add(key);
        const ctx = contextByKey.get(key);
        if (!ctx) return t;
        return {
          ...t,
          ...ctx.log,
          id: ctx.log.id || t.id,
          log: ctx.log,
          rule: ctx.rule || t.rule,
          equipment: ctx.equipment || t.equipment,
          group: ctx.group || t.group,
          category: ctx.category || t.category,
          workerGroup: ctx.workerGroup || t.rule?.worker_group || null,
          worker_group: ctx.workerGroup || t.rule?.worker_group || null,
          worker: ctx.worker || null,
          approver: ctx.approver || null,
          submitterName: ctx.worker?.full_name || 'Worker',
          approverName: ctx.approver?.full_name || null,
        };
      });

    for (const ctx of logContexts) {
      const log = ctx?.log;
      if (!log || log.due_date !== selectedDayStr) continue;
      const key = `${log.rule_id}_${log.due_date}`;
      if (seenKeys.has(key)) continue;

      if (filters.system && filters.system !== 'ALL') {
        if (ctx.category?.code && ctx.category.code !== filters.system) continue;
      }
      if (filters.group && filters.group !== 'all') {
        const gId = ctx.rule?.worker_group_id;
        if (filters.group === 'unassigned' && gId) continue;
        if (filters.group !== 'unassigned' && gId !== filters.group) continue;
      }

      seenKeys.add(key);
      enriched.push({
        ...log,
        ...ctx,
        worker_group: ctx.workerGroup,
        submitterName: ctx.worker?.full_name || 'Worker',
        approverName: ctx.approver?.full_name || null,
      });
    }

    return enriched;
  }, [filteredTasks, logContexts, selectedDayStr, filters.system, filters.group]);

  // Apply search and status filter to selectedDayTasks
  const searchFilteredTasks = useMemo(() => {
    let list = selectedDayTasks;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const eqName = (t.equipment?.name || '').toLowerCase();
        const grpName = (t.group?.name || t.equipment?.group?.name || '').toLowerCase();
        const notes = (t.notes || t.log?.notes || '').toLowerCase();
        return eqName.includes(q) || grpName.includes(q) || notes.includes(q);
      });
    }

    if (!filters.status || filters.status === 'all') return list;

    return list.filter((t) => {
      const log = t.log;
      if (filters.status === 'pending') return !log || log.status === 'pending' || (!log.result && log.status === 'draft');
      if (filters.status === 'completed') return log?.result === 'completed';
      if (filters.status === 'issue') return log?.result === 'issue';
      if (filters.status === 'submitted') return log?.status === 'submitted';
      if (filters.status === 'done') return log?.status === 'done';
      if (filters.status === 'returned') return log?.status === 'returned';
      return true;
    });
  }, [selectedDayTasks, searchQuery, filters.status]);

  // Group tasks by SYSTEM header, then by EQUIPMENT GROUP row
  const systemGroupedTasks = useMemo(() => {
    const systemsMap = new Map();
    searchFilteredTasks.forEach((t) => {
      const sysCode = t.category?.code || t.equipment?.group?.category?.code || 'OTHER';
      const sysName = t.category?.name || t.equipment?.group?.category?.name || 'Other System';
      const sysKey = `${sysCode} - ${sysName}`;

      if (!systemsMap.has(sysKey)) {
        systemsMap.set(sysKey, new Map());
      }
      const eqGroupsMap = systemsMap.get(sysKey);
      const eqGroupName = t.group?.name || t.equipment?.group?.name || 'General Equipment';

      if (!eqGroupsMap.has(eqGroupName)) {
        eqGroupsMap.set(eqGroupName, []);
      }
      eqGroupsMap.get(eqGroupName).push(t);
    });

    const result = [];
    systemsMap.forEach((eqGroupsMap, sysKey) => {
      const groups = Array.from(eqGroupsMap.entries()).map(([grpName, units]) => {
        const doneCount = units.filter((t) => {
          const l = t.log;
          return l && (l.status === 'draft' || l.status === 'submitted' || l.status === 'done');
        }).length;
        const issueCount = units.filter((t) => t.log?.result === 'issue').length;
        const pendingCount = units.length - doneCount;

        // Determine dominant worker group dot
        const gIds = units.map((u) => u.rule?.worker_group_id || u.worker_group_id).filter(Boolean);
        let groupInfo = null;
        if (gIds.length > 0) {
          const g = workerGroupsList.find((wg) => wg.id === gIds[0]);
          if (g) groupInfo = { name: g.name, color: g.color || colors.primary };
        }

        return {
          groupName: grpName,
          units,
          doneCount,
          issueCount,
          pendingCount,
          groupInfo,
        };
      });
      result.push({ systemName: sysKey, groups });
    });

    return result;
  }, [searchFilteredTasks, workerGroupsList]);

  // Flatten group rows for 10-per-page pagination
  const allGroupRows = useMemo(() => {
    const list = [];
    systemGroupedTasks.forEach((sys) => {
      sys.groups.forEach((grp) => {
        list.push({ ...grp, systemName: sys.systemName });
      });
    });
    return list;
  }, [systemGroupedTasks]);

  const paginatedGroupRows = useMemo(() => {
    const start = (dayPanelPage - 1) * DAY_PAGE_SIZE;
    return allGroupRows.slice(start, start + DAY_PAGE_SIZE);
  }, [allGroupRows, dayPanelPage]);

  // Reset pagination on filter or day change
  useEffect(() => {
    setDayPanelPage(1);
    setReportsPage(1);
  }, [filters, selectedDayStr, searchQuery]);

  // Day KPI strip counts
  const dayKpi = useMemo(() => {
    let assigned = 0, completed = 0, pending = 0, issues = 0;
    for (const t of selectedDayTasks) {
      assigned++;
      const log = t.log;
      if (log?.result === 'issue') {
        completed++;
        issues++;
      } else if (log && (log.status === 'draft' || log.status === 'submitted' || log.status === 'done')) {
        completed++;
      } else {
        pending++;
      }
    }
    return { assigned, completed, pending, issues };
  }, [selectedDayTasks]);

  // Build Reports View rows (worker groups x dates in reportsRange)
  const reportRows = useMemo(() => {
    const reportMap = new Map(
      dailyReports.map((r) => [`${r.worker_group_id}_${r.report_date}`, r])
    );
    const allLogs = [...logs, ...reportsRangeLogs];
    const logMap = new Map(
      allLogs.map((l) => [`${l.rule_id}_${l.due_date}`, l])
    );

    // Compute dates list in reportsRange
    const dStart = parseDate(reportsRange.start);
    const dEnd = parseDate(reportsRange.end);
    const dateList = [];
    let cur = new Date(dStart);
    while (cur <= dEnd) {
      dateList.push(formatDate(cur));
      cur = addDays(cur, 1);
    }

    const q = searchQuery.trim().toLowerCase();
    const result = [];

    for (const date of dateList) {
      for (const wg of workerGroupsList) {
        if (filters.group && filters.group !== 'all' && filters.group !== wg.id) {
          continue;
        }

        const groupRules = rules.filter((r) => {
          if (r.worker_group_id !== wg.id) return false;
          if (filters.system && filters.system !== 'ALL') {
            const code = r.equipment?.group?.category?.code || r.category?.code;
            if (code && code !== filters.system) return false;
          }
          return expandRuleDueDates(r, date, date).length > 0;
        });

        if (groupRules.length === 0) continue;

        if (q) {
          const matchesSearch =
            wg.name.toLowerCase().includes(q) ||
            groupRules.some((r) => {
              const eqName = (r.equipment?.name || '').toLowerCase();
              const grpName = (r.equipment?.group?.name || '').toLowerCase();
              return eqName.includes(q) || grpName.includes(q);
            });
          if (!matchesSearch) continue;
        }

        const rep = reportMap.get(`${wg.id}_${date}`) || null;
        // Only APPROVED tasks (status 'done') count as completed.
        // Recorded-but-unapproved tasks are shown separately as "to approve".
        let completedCount = 0;
        let waitingCount = 0;
        let remainingCount = 0;
        for (const r of groupRules) {
          const l = logMap.get(`${r.id}_${date}`);
          if (l && l.status === 'done') {
            completedCount++;
          } else if (l && (l.status === 'draft' || l.status === 'submitted' || l.status === 'rejected')) {
            waitingCount++;
          } else {
            remainingCount++;
          }
        }

        const repStatus = rep?.status || null;

        // Apply reports status filter
        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'submitted' && repStatus !== 'submitted') continue;
          if (filters.status === 'reviewed' && repStatus !== 'reviewed') continue;
          if (filters.status === 'returned' && repStatus !== 'returned') continue;
          if (filters.status === 'draft' && repStatus !== 'draft') continue;
          if (filters.status === 'none' && repStatus !== null) continue;
        }

        result.push({
          key: `${wg.id}_${date}`,
          groupId: wg.id,
          groupName: wg.name,
          groupColor: wg.color || colors.primary,
          date,
          submittedBy: rep?.submitted_by ? profilesMap.get(rep.submitted_by) || 'Worker' : '-',
          completedCount,
          remainingCount,
          waitingCount,
          status: repStatus,
          reportId: rep?.id || null,
        });
      }
    }

    // Sort: "needs review" (submitted) first, then by date descending
    result.sort((a, b) => {
      if (a.status === 'submitted' && b.status !== 'submitted') return -1;
      if (a.status !== 'submitted' && b.status === 'submitted') return 1;
      return b.date.localeCompare(a.date);
    });

    return result;
  }, [dailyReports, logs, reportsRangeLogs, reportsRange, rules, workerGroupsList, filters.group, filters.system, filters.status, searchQuery, profilesMap]);

  // Reports needing review count in current table rows
  const currentTableNeedsReviewCount = useMemo(() => {
    return reportRows.filter((r) => r.status === 'submitted').length;
  }, [reportRows]);

  // Diff between global badge count and visible needs-review reports in table
  const unshownNeedsReviewCount = Math.max(0, submittedReportsCount - currentTableNeedsReviewCount);

  const handleShowAllNeedsReview = () => {
    setFilters((prev) => ({
      ...prev,
      status: 'submitted',
      range: 'week',
    }));
  };

  const handleClearReportFilters = () => {
    setFilters((prev) => ({
      ...prev,
      status: 'all',
      group: 'all',
      system: 'ALL',
      range: 'day',
    }));
    setSearchQuery('');
  };

  const paginatedReportRows = useMemo(() => {
    const start = (reportsPage - 1) * REPORTS_PAGE_SIZE;
    return reportRows.slice(start, start + REPORTS_PAGE_SIZE);
  }, [reportRows, reportsPage]);

  // Edit Rule Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editFreq, setEditFreq] = useState('d');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editWeekday, setEditWeekday] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [editGroupId, setEditGroupId] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setEditFreq(rule.frequency || 'd');
    setEditStartDate(rule.start_date || selectedDayStr);
    setEditEndDate(rule.end_date || '');
    setEditWeekday(rule.weekday || 1);
    setEditNotes(rule.notes || '');
    setEditGroupId(rule.worker_group_id || null);
    setEditModalVisible(true);
  };

  const handleSaveEditRule = async () => {
    if (!editingRule?.id) return;
    setModalSaving(true);
    try {
      await updateScheduleRule(editingRule.id, {
        frequency: editFreq,
        start_date: editStartDate,
        end_date: editEndDate.trim() ? editEndDate.trim() : null,
        weekday: editFreq === 'w' ? editWeekday : null,
        notes: editNotes.trim() ? editNotes.trim() : null,
      });
      if (isConfigured && supabase) {
        await supabase.rpc('set_rules_group', {
          p_rule_ids: [editingRule.id],
          p_group_id: editGroupId || null,
        });
      }
      toast.success('Schedule rule updated successfully');
      setEditModalVisible(false);
      refetchRules();
    } catch (err) {
      toast.error(mapError(err));
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!ruleId) return;
    let totalLogs = 0;
    try {
      const counts = await countRuleTaskLogs(ruleId);
      totalLogs = counts.total;
    } catch (_) {}

    runAction({
      confirm: {
        title: 'Delete Rule?',
        message:
          totalLogs > 0
            ? `This schedule rule and ${totalLogs} associated task logs will be removed. This cannot be undone.`
            : 'This schedule rule will be removed. This cannot be undone.',
        confirmText: 'Delete Rule',
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
        setEditModalVisible(false);
        setEditingRule(null);
        invalidateAllAfterReview();
      },
    });
  };

  const handleRemoveFromQueue = (item) => {
    const logId = item?.log?.id || item?.id;
    if (!logId) return;
    runAction({
      confirm: {
        title: 'Remove from queue?',
        message: 'Remove this submission from the approval queue?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'trash-outline',
      },
      loading: 'Removing...',
      action: async () => {
        await deleteTaskLogById(logId);
      },
      success: 'Removed from queue',
      onSuccess: invalidateAllAfterReview,
    });
  };

  const handleOpenReportSlideOver = (groupId, date, reportId = null) => {
    setSlideOverReport({
      visible: true,
      groupId,
      date,
      reportId,
    });
    if (navigation?.setParams) {
      navigation.setParams({ reportGroupId: groupId, reportDate: date, reportId });
    }
  };

  const handleCloseReportSlideOver = () => {
    setSlideOverReport({ visible: false, groupId: null, date: null, reportId: null });
    if (navigation?.setParams) {
      navigation.setParams({ reportGroupId: undefined, reportDate: undefined, reportId: undefined });
    }
    invalidateAllAfterReview();
  };

  // Filter sections for FilterButton
  const taskFilterSections = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'single',
        options: [
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' },
          { value: 'issue', label: 'Issues' },
          { value: 'submitted', label: 'In Report' },
          { value: 'done', label: 'Done' },
          { value: 'returned', label: 'Returned' },
        ],
      },
      {
        key: 'group',
        label: 'Worker group',
        type: 'single',
        options: [
          { value: 'all', label: 'All' },
          { value: 'unassigned', label: 'Unassigned' },
          ...workerGroupsList.map((g) => ({
            value: g.id,
            label: g.name,
            dot: g.color || colors.primary,
          })),
        ],
      },
      {
        key: 'system',
        label: 'System',
        type: 'single',
        options: [
          { value: 'ALL', label: 'All Systems' },
          { value: 'A', label: 'A - Inverter Station Area' },
          { value: 'B', label: 'B - PV Field Area' },
          { value: 'C', label: 'C - MV & LV System' },
          { value: 'D', label: 'D - Other System' },
        ],
      },
    ],
    [workerGroupsList]
  );

  const reportFilterSections = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'single',
        options: [
          { value: 'all', label: 'All' },
          { value: 'submitted', label: 'Needs Review' },
          { value: 'reviewed', label: 'Reviewed' },
          { value: 'returned', label: 'Returned' },
          { value: 'draft', label: 'Draft' },
          { value: 'none', label: 'Not reported' },
        ],
      },
      {
        key: 'group',
        label: 'Worker group',
        type: 'single',
        options: [
          { value: 'all', label: 'All' },
          ...workerGroupsList.map((g) => ({
            value: g.id,
            label: g.name,
            dot: g.color || colors.primary,
          })),
        ],
      },
      {
        key: 'system',
        label: 'System',
        type: 'single',
        options: [
          { value: 'ALL', label: 'All Systems' },
          { value: 'A', label: 'A - Inverter Station Area' },
          { value: 'B', label: 'B - PV Field Area' },
          { value: 'C', label: 'C - MV & LV System' },
          { value: 'D', label: 'D - Other System' },
        ],
      },
      {
        key: 'range',
        label: 'Date Range',
        type: 'single',
        options: [
          { value: 'day', label: 'Selected day' },
          { value: 'week', label: 'This week' },
          { value: 'last7', label: 'Last 7 days' },
        ],
      },
    ],
    [workerGroupsList]
  );

  // Month Grid
  const renderMonthGrid = () => {
    const mRange = getMonthRange(currentDateStr);
    const d = parseDate(mRange.start);
    const firstWeekday = getIsoWeekday(d);
    const totalDays = daysInMonth(mRange.year, mRange.month);

    const tasksByDay = new Map();
    for (const t of filteredTasks) {
      if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
      tasksByDay.get(t.due_date).push(t);
    }

    const cells = [];
    for (let i = 1; i < firstWeekday; i++) {
      cells.push({ isBlank: true, key: `blank-${i}` });
    }
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
        <View style={styles.weekHeaderRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dName) => (
            <View key={dName} style={styles.weekHeaderCell}>
              <Text style={styles.weekHeaderText}>{dName}</Text>
            </View>
          ))}
        </View>
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

  // Week View
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

  const isTasksView = filters.view !== 'reports';
  const weekNum = getWorkWeekNumber(currentDateStr);
  const monthInfo = getMonthRange(currentDateStr);
  const loading = rulesLoading || logsLoading;
  const error = rulesError?.message || logsError?.message || '';

  return (
    <View style={styles.screen}>
      <Header
        title="Schedule Calendar"
        subtitle={`Week ${weekNum} • ${monthInfo.monthName} ${monthInfo.year}`}
        navigation={navigation}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {Platform.OS === 'web' && isAdmin && (
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
        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                refetchRules();
                refetchLogs();
              }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Date Navigation Strip */}
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

        {/* Calendar Days Strip */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : viewMode === 'month' ? (
          renderMonthGrid()
        ) : (
          renderWeekView()
        )}

        {/* Compact Single Toolbar Row */}
        <View style={styles.unifiedToolbar}>
          {/* Segmented Toggle: Tasks | Reports */}
          <View style={styles.segmentedToggle}>
            <TouchableOpacity
              style={[styles.segmentBtn, isTasksView && styles.segmentBtnActive]}
              onPress={() => setFilters((prev) => ({ ...prev, view: 'tasks' }))}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentBtnText, isTasksView && styles.segmentBtnTextActive]}>
                Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, !isTasksView && styles.segmentBtnActive]}
              onPress={() => setFilters((prev) => ({ ...prev, view: 'reports' }))}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentBtnText, !isTasksView && styles.segmentBtnTextActive]}>
                Reports
              </Text>
              {submittedReportsCount > 0 && (
                <View style={styles.segmentBadge}>
                  <Text style={styles.segmentBadgeText}>
                    {submittedReportsCount > 99 ? '99+' : submittedReportsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search equipment or activity..."
              placeholderTextColor={colors.textMuted}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Button */}
          <FilterButton
            sections={isTasksView ? taskFilterSections : reportFilterSections}
            value={filters}
            onChange={setFilters}
            resultCount={isTasksView ? searchFilteredTasks.length : reportRows.length}
          />
        </View>

        {/* ================= TASKS VIEW ================= */}
        {isTasksView ? (
          <View style={styles.tasksViewContainer}>
            {/* Compact Heading with small muted task count */}
            <View style={styles.smallHeadingRow}>
              <Text style={styles.smallHeadingText}>Tasks for {selectedDayStr}</Text>
              <Text style={styles.smallHeadingCount}>
                {searchFilteredTasks.length} {searchFilteredTasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>

            {/* Compact KPI Line */}
            <View style={styles.compactKpiLine}>
              <View style={styles.compactKpiItem}>
                <Text style={styles.compactKpiVal}>{dayKpi.assigned}</Text>
                <Text style={styles.compactKpiLabel}>Assigned</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.compactKpiItem}>
                <Text style={[styles.compactKpiVal, { color: colors.primaryDark }]}>
                  {dayKpi.completed}
                </Text>
                <Text style={styles.compactKpiLabel}>Completed</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.compactKpiItem}>
                <Text style={styles.compactKpiVal}>{dayKpi.pending}</Text>
                <Text style={styles.compactKpiLabel}>Pending</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.compactKpiItem}>
                <Text style={[styles.compactKpiVal, { color: '#B45309' }]}>{dayKpi.issues}</Text>
                <Text style={styles.compactKpiLabel}>Issues</Text>
              </View>
            </View>

            {/* Collapsed Equipment Groups */}
            {searchFilteredTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyCardText}>
                  No tasks found for {selectedDayStr} matching active filters.
                </Text>
              </View>
            ) : (
              <View style={styles.groupsContainer}>
                {paginatedGroupRows.map((grpRow) => {
                  const isExpanded = expandedDayGroups[grpRow.groupName] === true;
                  const hasIssue = grpRow.issueCount > 0;
                  const allDone = grpRow.doneCount === grpRow.units.length && grpRow.units.length > 0;

                  return (
                    <View key={grpRow.groupName} style={styles.declutteredGroupCard}>
                      {/* Short 2-line group row */}
                      <TouchableOpacity
                        style={styles.groupCardHeader}
                        onPress={() =>
                          setExpandedDayGroups((prev) => ({
                            ...prev,
                            [grpRow.groupName]: !prev[grpRow.groupName],
                          }))
                        }
                        activeOpacity={0.8}
                        {...a11yRole('button')}
                      >
                        <View style={styles.groupCardHeaderLeft}>
                          <Ionicons
                            name={hasIssue ? 'warning' : allDone ? 'checkmark-circle' : 'time-outline'}
                            size={18}
                            color={hasIssue ? '#D97706' : allDone ? colors.primary : colors.textMuted}
                          />
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.groupCardName}>{grpRow.groupName}</Text>
                              {grpRow.groupInfo ? (
                                <View
                                  style={[styles.workerGroupDot, { backgroundColor: grpRow.groupInfo.color }]}
                                  title={grpRow.groupInfo.name}
                                />
                              ) : null}
                            </View>
                            <Text style={styles.groupCardSummary}>
                              {grpRow.units.length} units · {grpRow.doneCount} done
                              {grpRow.issueCount > 0 ? ` · ${grpRow.issueCount} issue` : ''}
                              {grpRow.pendingCount > 0 ? ` · ${grpRow.pendingCount} pending` : ''}
                            </Text>
                          </View>
                        </View>

                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>

                      {/* Expanded Unit Rows */}
                      {isExpanded && (
                        <View style={styles.expandedUnitsArea}>
                          {grpRow.units.map((u) => (
                            <TaskLogCard
                              key={u.id}
                              item={u}
                              tab="pending"
                              onEditRule={(rule) => openEditRule(rule)}
                              onOpenReport={(item) =>
                                handleOpenReportSlideOver(
                                  item.rule?.worker_group_id || item.worker_group_id,
                                  item.due_date || selectedDayStr
                                )
                              }
                              onRemoveFromQueue={handleRemoveFromQueue}
                              onRetry={() => {
                                refetchRules();
                                refetchLogs();
                              }}
                              profilesMap={profilesMap}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}

                {allGroupRows.length > DAY_PAGE_SIZE && (
                  <View style={{ marginTop: 12, marginBottom: 16 }}>
                    <Pagination
                      currentPage={dayPanelPage}
                      totalItems={allGroupRows.length}
                      pageSize={DAY_PAGE_SIZE}
                      onPageChange={setDayPanelPage}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          /* ================= REPORTS VIEW ================= */
          <View style={styles.reportsCard}>
            {/* Slim Amber Info Banner when badge count > visible table needs review count */}
            {unshownNeedsReviewCount > 0 && (
              <View style={styles.reportsInfoBanner}>
                <View style={styles.reportsInfoBannerLeft}>
                  <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
                  <Text style={styles.reportsInfoBannerText}>
                    {unshownNeedsReviewCount} {unshownNeedsReviewCount === 1 ? 'report needs' : 'reports need'} review on other days
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleShowAllNeedsReview}
                  style={styles.reportsInfoBannerBtn}
                  activeOpacity={0.8}
                  {...a11yRole('button')}
                >
                  <Text style={styles.reportsInfoBannerBtnText}>Show</Text>
                </TouchableOpacity>
              </View>
            )}

            {dailyReportsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : paginatedReportRows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyCardText}>
                  No reports for this selection
                </Text>
                <TouchableOpacity
                  onPress={handleClearReportFilters}
                  style={styles.clearFiltersBtn}
                  activeOpacity={0.8}
                  {...a11yRole('button')}
                >
                  <Text style={styles.clearFiltersBtnText}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={styles.tableScrollWrapper}
                  contentContainerStyle={styles.tableScrollContent}
                >
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, styles.colGroup]} numberOfLines={1}>WORKER GROUP</Text>
                      <Text style={[styles.th, styles.colPerson]} numberOfLines={1}>SUBMITTED BY</Text>
                      <Text style={[styles.th, styles.colDate]} numberOfLines={1}>REPORTING DATE</Text>
                      <Text style={[styles.th, styles.colNum]} numberOfLines={1}>TASKS COMPLETED</Text>
                      <Text style={[styles.th, styles.colNum]} numberOfLines={1}>TASKS REMAINING</Text>
                      <Text style={[styles.th, styles.colStatus]} numberOfLines={1}>REPORT STATUS</Text>
                      <Text style={[styles.th, styles.colAction]} numberOfLines={1}>ACTION</Text>
                    </View>

                    {paginatedReportRows.map((row) => {
                      const pill = getStatusPill(row.status);
                      const needsReview = row.status === 'submitted';
                      return (
                        <View key={row.key} style={styles.tableRow}>
                          <View style={[styles.td, styles.colGroup, styles.groupCell]}>
                            <View style={[styles.dot, { backgroundColor: row.groupColor }]} />
                            <Text style={styles.groupName} numberOfLines={1}>{row.groupName}</Text>
                          </View>
                          <Text style={[styles.td, styles.colPerson]} numberOfLines={1}>{row.submittedBy}</Text>
                          <Text style={[styles.td, styles.colDate]} numberOfLines={1}>{row.date}</Text>
                          <View style={[styles.td, styles.colNum]}>
                            <Text style={styles.boldNum}>{row.completedCount}</Text>
                            {row.waitingCount > 0 ? (
                              <Text style={styles.waitingNum}>+{row.waitingCount} to approve</Text>
                            ) : null}
                          </View>
                          <Text style={[styles.td, styles.colNum]}>{row.remainingCount}</Text>
                          <View style={[styles.td, styles.colStatus]}>
                            {pill ? (
                              <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                                <View style={[styles.pillDot, { backgroundColor: pill.dot }]} />
                                <Text style={[styles.statusPillText, { color: pill.text }]} numberOfLines={1}>
                                  {pill.label}
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.dashText}>-</Text>
                            )}
                          </View>
                          <View style={[styles.td, styles.colAction]}>
                            {needsReview ? (
                              <TouchableOpacity
                                style={styles.viewBtnOutlined}
                                onPress={() => handleOpenReportSlideOver(row.groupId, row.date, row.reportId)}
                                activeOpacity={0.8}
                                {...a11yRole('button')}
                              >
                                <Text style={styles.viewBtnOutlinedText}>View Report</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleOpenReportSlideOver(row.groupId, row.date, row.reportId)}
                                activeOpacity={0.7}
                                style={styles.plainLinkWrapper}
                                {...a11yRole('button')}
                              >
                                <Text style={styles.plainLinkText}>View Report</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                {reportRows.length > REPORTS_PAGE_SIZE && (
                  <View style={{ marginTop: 16 }}>
                    <Pagination
                      currentPage={reportsPage}
                      totalItems={reportRows.length}
                      pageSize={REPORTS_PAGE_SIZE}
                      onPageChange={setReportsPage}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Slide-over Report Detail Panel */}
        <ReportDetailSlideOver
          visible={slideOverReport.visible}
          onClose={handleCloseReportSlideOver}
          groupId={slideOverReport.groupId}
          date={slideOverReport.date}
          reportId={slideOverReport.reportId}
        />

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

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>Notes</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60 }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                <Text style={[styles.modalFieldLabel, { marginTop: 16 }]}>
                  Assign to Worker Group
                </Text>
                <WorkerGroupSelect
                  selectedGroupId={editGroupId}
                  onSelectGroup={setEditGroupId}
                  allowUnassigned={true}
                  disabled={modalSaving}
                />

                <View style={styles.modalBtnRowSplit}>
                  {editingRule?.id ? (
                    <TouchableOpacity
                      style={styles.modalDeleteBtn}
                      onPress={() => {
                        const targetRuleId = editingRule.id;
                        setEditModalVisible(false);
                        handleDeleteRule(targetRuleId);
                      }}
                      disabled={modalSaving}
                      {...a11yRole('button')}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.modalDeleteText}>Delete Rule</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  <View style={styles.modalBtnRight}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setEditModalVisible(false)}
                      {...a11yRole('button')}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalSaveBtn}
                      onPress={handleSaveEditRule}
                      disabled={modalSaving}
                      {...a11yRole('button')}
                    >
                      {modalSaving ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.modalSaveText}>Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
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
    fontWeight: '600',
    color: colors.dark,
  },
  dayCellCountMuted: {
    color: colors.textMuted,
  },
  dayCellCountSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  weekViewContainer: {
    marginBottom: 16,
  },
  weekCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekColumnCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  weekColumnCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  weekColumnCardToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  weekColHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekColHeaderSelected: {
    backgroundColor: '#EAF2FA',
  },
  weekColShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  weekColShortSelected: {
    color: colors.primaryDark,
  },
  weekColDayNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginTop: 2,
  },
  weekColDayNumSelected: {
    color: colors.primaryDark,
  },
  weekColBody: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  weekTaskCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.dark,
  },
  weekTaskCountMuted: {
    color: colors.textMuted,
  },
  weekTaskCountSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  unifiedToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: colors.dark,
    fontWeight: '700',
  },
  segmentBadge: {
    backgroundColor: '#2563A6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
  },
  tasksViewContainer: {
    gap: 14,
  },
  smallHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallHeadingText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  smallHeadingCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  compactKpiLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 16,
  },
  compactKpiItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  compactKpiVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  compactKpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  kpiDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  groupsContainer: {
    gap: 10,
  },
  declutteredGroupCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  groupCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  groupCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  workerGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupCardSummary: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  expandedUnitsArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
    gap: 8,
  },
  reportsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    width: '100%',
  },
  reportsInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  reportsInfoBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reportsInfoBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  reportsInfoBannerBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  reportsInfoBannerBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  clearFiltersBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  clearFiltersBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  tableScrollWrapper: {
    width: '100%',
  },
  tableScrollContent: {
    width: '100%',
  },
  table: {
    width: '100%',
    minWidth: 760,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 6,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  td: {
    fontSize: 13,
    color: colors.dark,
  },
  colGroup: {
    flex: 1.4,
    paddingRight: 8,
  },
  colPerson: {
    flex: 1.2,
    paddingRight: 8,
  },
  colDate: {
    flex: 1.0,
    paddingRight: 8,
  },
  colNum: {
    flex: 0.9,
    textAlign: 'center',
    justifyContent: 'center',
  },
  colStatus: {
    flex: 1.6,
    paddingRight: 8,
  },
  colAction: {
    width: 130,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  groupCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  waitingNum: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  boldNum: {
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dashText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  viewBtnOutlined: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  viewBtnOutlinedText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  plainLinkWrapper: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  plainLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  modalFreqRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modalFreqBtn: {
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  modalFreqBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.dark,
    backgroundColor: colors.white,
  },
  modalBtnRowSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  modalDeleteText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBtnRight: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSaveText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
