import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../components/feedback';
import {
  fetchScheduleRules,
  fetchTaskLogs,
  fetchGroupDailyReports,
  fetchReportDetailData,
  submitDailyReport,
} from '../../lib/dataService';
import { formatDate, addDays, expandRuleDueDates } from '../../utils/schedule';
import { getTaskState } from '../../utils/taskStatus';
import TaskStatusChip from '../../components/TaskStatusChip';
import WorkerGroupBadge from '../../components/WorkerGroupBadge';
import FilterButton from '../../components/FilterButton';
import { useTaskPhotoUrls } from '../../lib/taskPhotos';
import { a11yRole, modalA11y } from '../../utils/a11y';
import { colors } from '../../theme';

function ReportTaskPhotoThumbs({ paths, onSelectPhoto }) {
  const urls = useTaskPhotoUrls(paths);
  if (!urls || urls.length === 0) return null;
  return (
    <View style={reportPhotoStyles.thumbStrip}>
      {urls.map((url, i) => (
        <TouchableOpacity
          key={i}
          style={reportPhotoStyles.thumbTouch}
          onPress={() => onSelectPhoto(url)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: url }} style={reportPhotoStyles.thumbImg} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const reportPhotoStyles = StyleSheet.create({
  thumbStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  thumbTouch: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
});

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getReportStatusMeta(status) {
  switch (status) {
    case 'submitted':
      return {
        label: 'Submitted - waiting review',
        bg: '#FEF3C7',
        border: '#F59E0B',
        text: '#B45309',
      };
    case 'reviewed':
      return {
        label: 'Approved',
        bg: '#0EA5E9',
        border: '#0EA5E9',
        text: '#FFFFFF',
      };
    case 'returned':
      return {
        label: 'Returned',
        bg: '#FEF2F2',
        border: '#DC2626',
        text: '#DC2626',
      };
    default:
      return {
        label: 'Draft',
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: '#475569',
      };
  }
}

export default function WorkerReportScreen({ route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const runAction = useAction();
  const toast = useToast();

  const { groups: workerGroupsList, groupByUser } = useWorkerGroups();
  const myGroupId = user?.id ? groupByUser[user.id] : null;
  const myGroup = myGroupId ? workerGroupsList.find((g) => g.id === myGroupId) : null;

  const todayStr = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(route?.params?.reportDate || todayStr);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [overallNote, setOverallNote] = useState('');
  const [activePhotoUrl, setActivePhotoUrl] = useState(null);

  // Filter state: status ('all' | 'completed' | 'pending' | 'issue') and date range ('today' | '7days' | '14days')
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('14days');

  // Last 14 days for date selector and "Not yet reported"
  const last14Days = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      list.push(formatDate(addDays(base, -i)));
    }
    return list;
  }, []);

  const rangeStart14 = last14Days[last14Days.length - 1];
  const rangeEnd14 = last14Days[0];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['daily_report_detail', myGroupId, selectedDate],
    queryFn: () => fetchReportDetailData({ groupId: myGroupId, date: selectedDate }),
    enabled: !!myGroupId && !!selectedDate,
    staleTime: 15 * 1000,
  });

  const { data: historyReports = [], isLoading: historyLoading } = useQuery({
    queryKey: ['daily_reports', 'history', myGroupId],
    queryFn: () => fetchGroupDailyReports(myGroupId, 30),
    enabled: !!myGroupId,
    staleTime: 15 * 1000,
  });

  const { data: groupRules = [] } = useQuery({
    queryKey: ['schedule_rules', 'group', myGroupId],
    queryFn: async () => {
      const all = await fetchScheduleRules();
      return (all || []).filter((r) => r.worker_group_id === myGroupId);
    },
    enabled: !!myGroupId,
    staleTime: 30 * 1000,
  });

  const { data: logs14 = [] } = useQuery({
    queryKey: ['task_logs', 'group14', myGroupId, rangeStart14, rangeEnd14],
    queryFn: () => fetchTaskLogs(rangeStart14, rangeEnd14),
    enabled: !!myGroupId,
    staleTime: 15 * 1000,
  });

  const report = detailData?.report || null;
  const tasks = detailData?.tasks || [];
  const profilesMap = detailData?.profilesMap || new Map();

  // Compute live KPI counts
  const kpi = useMemo(() => {
    const assigned = tasks.length;
    let completed = 0;
    let issues = 0;
    let pending = 0;
    let returned = 0;

    for (const t of tasks) {
      const state = getTaskState(t.due_date, t.log, todayStr);
      if (state === 'completed' || state === 'submitted' || state === 'done') {
        completed++;
      } else if (state === 'issue') {
        completed++;
        issues++;
      } else if (state === 'returned') {
        returned++;
        pending++;
      } else {
        pending++;
      }
    }
    return { assigned, completed, pending, issues, returned };
  }, [tasks, todayStr]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => {
      const state = getTaskState(t.due_date, t.log, todayStr);
      if (statusFilter === 'pending') return state === 'pending' || state === 'overdue';
      return state === statusFilter;
    });
  }, [tasks, statusFilter, todayStr]);

  // Past days (last 14) with draft tasks and no submitted/reviewed report
  const notYetReportedDays = useMemo(() => {
    if (!myGroupId || groupRules.length === 0) return [];
    const groupRuleIds = new Set(groupRules.map((r) => r.id));
    const reportByDate = new Map(historyReports.map((r) => [r.report_date, r]));
    const draftCountByDate = new Map();

    for (const l of logs14) {
      if (!groupRuleIds.has(l.rule_id)) continue;
      if (l.status === 'draft') {
        draftCountByDate.set(l.due_date, (draftCountByDate.get(l.due_date) || 0) + 1);
      }
    }

    return last14Days
      .filter((d) => {
        const drafts = draftCountByDate.get(d) || 0;
        const rep = reportByDate.get(d);
        return drafts > 0 && (!rep || rep.status === 'draft' || rep.status === 'returned');
      })
      .map((d) => ({
        date: d,
        draftCount: draftCountByDate.get(d) || 0,
        status: reportByDate.get(d)?.status || 'draft',
      }));
  }, [myGroupId, groupRules, logs14, historyReports, last14Days]);

  const reportStatus = report?.status || 'draft';
  const statusMeta = getReportStatusMeta(reportStatus);
  const isSubmitted = reportStatus === 'submitted';
  const isReviewed = reportStatus === 'reviewed';
  const isReturned = reportStatus === 'returned';
  const canSubmit = !isSubmitted && !isReviewed && kpi.assigned > 0;

  const submittedByName = report?.submitted_by
    ? profilesMap.get(report.submitted_by) || 'Teammate'
    : null;

  const handleOpenSubmitPreview = (targetDate = selectedDate) => {
    if (targetDate !== selectedDate) {
      setSelectedDate(targetDate);
    }
    setOverallNote(report?.worker_note || '');
    setPreviewModalVisible(true);
  };

  const handleConfirmSubmit = () => {
    if (!myGroupId) {
      toast.error('You are not assigned to a worker group.');
      return;
    }

    const tasksAssigned = groupRules.filter(
      (r) => expandRuleDueDates(r, selectedDate, selectedDate).length > 0
    ).length || kpi.assigned;

    const details = [];
    if (kpi.pending > 0) {
      details.push(`${kpi.pending} pending task(s) will be reported as remaining.`);
    }

    setPreviewModalVisible(false);

    runAction({
      confirm: {
        title: isReturned ? 'Resubmit Daily Report?' : 'Submit Daily Report?',
        message: `Submit the daily report for ${myGroup?.name || 'your group'}? ${kpi.completed} completed, ${kpi.pending} pending, ${kpi.issues} issue. You cannot edit these tasks after submitting.`,
        details,
        confirmText: isReturned ? 'Resubmit Report' : 'Submit Report',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'document-text-outline',
      },
      loading: 'Submitting daily report...',
      action: async () => {
        await submitDailyReport({
          groupId: myGroupId,
          reportDate: selectedDate,
          tasksAssigned,
          note: overallNote,
        });
      },
      success: 'Daily report submitted for admin review.',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
        queryClient.invalidateQueries({ queryKey: ['daily_report_detail'] });
        queryClient.invalidateQueries({ queryKey: ['task_logs'] });
        queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
        queryClient.invalidateQueries({ queryKey: ['submitted_reports_count'] });
      },
    });
  };

  if (!myGroupId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Daily Report</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Worker Group Assigned</Text>
          <Text style={styles.emptySub}>
            Ask your admin to assign you to a worker group before submitting daily reports.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Daily Report</Text>
            <View style={styles.groupMetaRow}>
              <WorkerGroupBadge group={myGroup} size="small" />
              {myGroup?.shift_label ? (
                <Text style={styles.shiftText}>{myGroup.shift_label}</Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusMeta.bg,
                borderColor: statusMeta.border,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: statusMeta.text }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* Date Selector (last 14 days) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScroll}
        >
          {last14Days.map((d) => {
            const active = d === selectedDate;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
                {...a11yRole('button')}
              >
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                  {d === todayStr ? 'Today' : d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Returned Report Banner */}
        {isReturned && (
          <View style={styles.returnedBanner}>
            <View style={styles.returnedBannerHeader}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.returnedBannerTitle}>Returned for Correction</Text>
            </View>
            {report?.review_remarks ? (
              <Text style={styles.returnedBannerText}>{report.review_remarks}</Text>
            ) : null}
          </View>
        )}

        {/* Submitted by teammate info */}
        {isSubmitted && submittedByName ? (
          <View style={styles.submittedBanner}>
            <Ionicons name="time-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.submittedBannerText}>
              Submitted by {submittedByName}
              {report?.submitted_at ? ` at ${formatTime(report.submitted_at)}` : ''}
            </Text>
          </View>
        ) : null}

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{kpi.assigned}</Text>
            <Text style={styles.kpiLabel}>Assigned</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, { color: colors.primaryDark }]}>{kpi.completed}</Text>
            <Text style={styles.kpiLabel}>Completed</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{kpi.pending}</Text>
            <Text style={styles.kpiLabel}>Pending</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, { color: '#B45309' }]}>{kpi.issues}</Text>
            <Text style={styles.kpiLabel}>Issues</Text>
          </View>
        </View>

        {/* Submit / Resubmit CTA */}
        {canSubmit && (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => handleOpenSubmitPreview(selectedDate)}
            activeOpacity={0.85}
            {...a11yRole('button')}
          >
            <Ionicons name="send-outline" size={18} color={colors.white} />
            <Text style={styles.submitBtnText}>
              {isReturned ? 'Resubmit report' : 'Review & Submit Report'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tasks in this report with Filter button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Tasks in this report ({filteredTasks.length})</Text>
          <FilterButton
            sections={[
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'all', label: `All (${tasks.length})` },
                  { value: 'completed', label: 'Completed' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'issue', label: 'Issues' },
                ],
              },
              {
                key: 'range',
                label: 'Date Range',
                options: [
                  { value: 'today', label: 'Today' },
                  { value: '7days', label: 'Last 7 days' },
                  { value: '14days', label: 'Last 14 days' },
                ],
              },
            ]}
            value={{ status: statusFilter, range: dateRangeFilter }}
            onChange={(val) => {
              if (val.status !== undefined) setStatusFilter(val.status);
              if (val.range !== undefined) {
                setDateRangeFilter(val.range);
                if (val.range === 'today') setSelectedDate(todayStr);
              }
            }}
            resultCount={filteredTasks.length}
          />
        </View>
        {detailLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>No tasks found for {selectedDate}.</Text>
          </View>
        ) : (
          filteredTasks.map((t) => {
            const state = getTaskState(t.due_date, t.log, todayStr);
            const isFlagged = state === 'returned';
            return (
              <View
                key={t.id}
                style={[styles.taskRowCard, isFlagged && styles.taskRowCardReturned]}
              >
                <View style={styles.taskRowTop}>
                  <Text style={styles.taskEquipName} numberOfLines={1}>
                    {t.equipment?.name || 'Equipment'}
                  </Text>
                  <TaskStatusChip status={state} size="small" />
                </View>
                {t.log ? (
                  <Text style={styles.taskMeta}>
                    Recorded by {t.doneByName || 'Worker'}
                    {t.log.done_at ? ` • ${formatTime(t.log.done_at)}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.taskNotDone}>Not done yet</Text>
                )}
                {t.log?.notes ? (
                  <Text style={styles.taskNote}>Note: {t.log.notes}</Text>
                ) : null}
                {isFlagged && t.log?.review_note ? (
                  <Text style={styles.taskReturnNote}>
                    Admin remark: {t.log.review_note}
                  </Text>
                ) : null}
                {Array.isArray(t.log?.photo_paths) && t.log.photo_paths.length > 0 ? (
                  <ReportTaskPhotoThumbs
                    paths={t.log.photo_paths}
                    onSelectPhoto={setActivePhotoUrl}
                  />
                ) : null}
              </View>
            );
          })
        )}

        {/* Not yet reported */}
        {notYetReportedDays.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Not yet reported</Text>
            {notYetReportedDays.map((item) => (
              <View key={item.date} style={styles.unreportedRow}>
                <View>
                  <Text style={styles.unreportedDate}>{item.date}</Text>
                  <Text style={styles.unreportedSub}>
                    {item.draftCount} recorded task{item.draftCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallSubmitBtn}
                  onPress={() => handleOpenSubmitPreview(item.date)}
                  {...a11yRole('button')}
                >
                  <Text style={styles.smallSubmitBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* History (last 30 reports) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Report History</Text>
          {historyLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : historyReports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptySub}>No reports submitted yet.</Text>
            </View>
          ) : (
            historyReports.map((rep) => {
              const meta = getReportStatusMeta(rep.status);
              return (
                <TouchableOpacity
                  key={rep.id}
                  style={styles.historyCard}
                  onPress={() => setSelectedDate(rep.report_date)}
                  {...a11yRole('button')}
                >
                  <View style={styles.historyTop}>
                    <Text style={styles.historyDate}>{rep.report_date}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: meta.bg, borderColor: meta.border },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: meta.text }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyCounts}>
                    {rep.tasks_completed} completed • {rep.tasks_pending} pending • {rep.issues_count} issues
                  </Text>
                  {rep.review_remarks ? (
                    <Text style={styles.historyRemarks}>Admin: {rep.review_remarks}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Preview & Note Modal */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
        {...modalA11y(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {isReturned ? 'Resubmit Daily Report' : 'Submit Daily Report'}
            </Text>
            <Text style={styles.modalSub}>
              {myGroup?.name} • {selectedDate}
            </Text>
            <Text style={styles.modalSummary}>
              {kpi.completed} completed, {kpi.pending} pending, {kpi.issues} issue(s)
            </Text>
            <Text style={styles.inputLabel}>Overall Note (Optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={overallNote}
              onChangeText={setOverallNote}
              placeholder="Add any shift summary or remarks..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPreviewModalVisible(false)}
                {...a11yRole('button')}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmSubmit}
                {...a11yRole('button')}
              >
                <Text style={styles.modalConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Lightbox Modal */}
      {activePhotoUrl && (
        <Modal
          visible={!!activePhotoUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePhotoUrl(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setActivePhotoUrl(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: activePhotoUrl }}
              style={{ width: '90%', height: '80%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#0A0A0A',
    paddingTop: 14,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusPill: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateScroll: {
    gap: 8,
    paddingTop: 4,
  },
  dateChip: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 8,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4D4D8',
  },
  dateChipTextActive: {
    color: colors.white,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
    paddingLeft: 16,
    paddingRight: 16,
  },
  returnedBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 12,
  },
  returnedBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  returnedBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  returnedBannerText: {
    fontSize: 13,
    color: '#991B1B',
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 12,
  },
  submittedBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.dark,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 18,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 10,
  },
  sectionBlock: {
    marginTop: 20,
  },
  taskRowCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 8,
  },
  taskRowCardReturned: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  taskRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskEquipName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    flex: 1,
  },
  taskMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  taskNotDone: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  taskNote: {
    fontSize: 12,
    color: colors.dark,
    marginTop: 4,
  },
  taskReturnNote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 4,
  },
  unreportedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 8,
  },
  unreportedDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  unreportedSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  smallSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 14,
    paddingRight: 14,
  },
  smallSubmitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 8,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  historyCounts: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyRemarks: {
    fontSize: 12,
    color: colors.dark,
    marginTop: 4,
    fontWeight: '600',
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginTop: 10,
    marginBottom: 4,
  },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  modalSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 13,
    color: colors.dark,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
