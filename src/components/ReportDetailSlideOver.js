import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchReportDetailData,
  reviewDailyReport,
  resolveTaskIssue,
} from '../lib/dataService';
import { formatDate } from '../utils/schedule';
import { getTaskState } from '../utils/taskStatus';
import { useAction } from '../hooks/useAction';
import { useToast } from './feedback';
import TaskStatusChip from './TaskStatusChip';
import PhotoStrip from './PhotoStrip';
import { a11yRole, modalA11y } from '../utils/a11y';
import { colors } from '../theme';

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildLocation(t) {
  const parts = [];
  if (t.category) parts.push(`${t.category.code}. ${t.category.name}`);
  if (t.group?.name) parts.push(t.group.name);
  return parts.join(' > ');
}

export default function ReportDetailSlideOver({
  visible,
  onClose,
  groupId,
  date,
  reportId,
}) {
  const queryClient = useQueryClient();
  const runAction = useAction();
  const toast = useToast();

  const [remarks, setRemarks] = useState('');
  const [flaggedMap, setFlaggedMap] = useState({}); // { [logId]: { flagged: boolean, note: string } }
  const [resolveModalLog, setResolveModalLog] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [expandedEqGroups, setExpandedEqGroups] = useState({});

  // Close on Escape key on web
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily_report_detail', groupId || null, date || null, reportId || null],
    queryFn: () => fetchReportDetailData({ groupId, date, reportId }),
    enabled: visible && (!!groupId || !!reportId || !!date),
    staleTime: 15 * 1000,
  });

  const report = data?.report || null;
  const workerGroup = data?.workerGroup || null;
  const reportDate = data?.reportDate || date || '';
  const tasks = data?.tasks || [];
  const profilesMap = data?.profilesMap || new Map();

  const todayStr = formatDate(new Date());
  const reportStatus = report?.status || null;
  const isSubmitted = reportStatus === 'submitted';
  const isReviewed = reportStatus === 'reviewed';
  const isReturned = reportStatus === 'returned';

  const kpi = useMemo(() => {
    if (report && (isSubmitted || isReviewed || isReturned)) {
      return {
        assigned: report.tasks_assigned ?? tasks.length,
        completed: report.tasks_completed ?? 0,
        pending: report.tasks_pending ?? 0,
        issues: report.issues_count ?? 0,
      };
    }
    let completed = 0;
    let pending = 0;
    let issues = 0;
    for (const t of tasks) {
      if (t.log && (t.log.status === 'draft' || t.log.status === 'submitted' || t.log.status === 'done')) {
        completed++;
        if (t.log.result === 'issue') issues++;
      } else {
        pending++;
      }
    }
    return { assigned: tasks.length, completed, pending, issues };
  }, [report, tasks, isSubmitted, isReviewed, isReturned]);

  const issueTasks = useMemo(
    () => tasks.filter((t) => t.log?.result === 'issue'),
    [tasks]
  );

  // Group tasks by equipment group for structured inspection results
  const groupedTasks = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const gName = t.group?.name || t.equipment?.group?.name || 'General Equipment';
      if (!map.has(gName)) map.set(gName, []);
      map.get(gName).push(t);
    }
    return Array.from(map.entries());
  }, [tasks]);

  const toggleFlag = (logId) => {
    setFlaggedMap((prev) => {
      const cur = prev[logId] || { flagged: false, note: '' };
      return { ...prev, [logId]: { ...cur, flagged: !cur.flagged } };
    });
  };

  const setFlagNote = (logId, note) => {
    setFlaggedMap((prev) => {
      const cur = prev[logId] || { flagged: true, note: '' };
      return { ...prev, [logId]: { ...cur, note } };
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
    queryClient.invalidateQueries({ queryKey: ['daily_report_detail'] });
    queryClient.invalidateQueries({ queryKey: ['submitted_reports_count'] });
    queryClient.invalidateQueries({ queryKey: ['task_logs'] });
    queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
    queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
    queryClient.invalidateQueries({ queryKey: ['performance'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
  };

  const handleApprove = () => {
    if (!report?.id) return;
    runAction({
      confirm: {
        title: 'Approve Report?',
        message: `Approve the report for ${workerGroup?.name || 'this group'} (${reportDate})? All submitted tasks will be marked Done.`,
        confirmText: 'Approve Report',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'checkmark-circle-outline',
      },
      loading: 'Approving daily report...',
      action: async () => {
        await reviewDailyReport({
          reportId: report.id,
          decision: 'approve',
          remarks,
          flags: [],
        });
      },
      success: 'Daily report approved.',
      onSuccess: () => {
        invalidateAll();
        onClose();
      },
    });
  };

  const handleReturn = () => {
    if (!report?.id) return;
    const flags = Object.entries(flaggedMap)
      .filter(([, v]) => v.flagged)
      .map(([logId, v]) => ({ log_id: logId, note: v.note?.trim() || remarks.trim() || null }));

    if (!remarks.trim() && flags.length === 0) {
      toast.error('Please enter review remarks or flag at least one task for correction.');
      return;
    }

    const returnedCount = flags.length > 0
      ? flags.length
      : tasks.filter((t) => t.log?.status === 'submitted').length;

    runAction({
      confirm: {
        title: 'Return for Correction?',
        message: `${returnedCount} task(s) will be sent back to ${workerGroup?.name || 'the group'} for correction.`,
        confirmText: 'Return for Correction',
        cancelText: 'Cancel',
        tone: 'danger',
        icon: 'close-circle-outline',
      },
      loading: 'Returning report for correction...',
      action: async () => {
        await reviewDailyReport({
          reportId: report.id,
          decision: 'return',
          remarks,
          flags,
        });
      },
      success: 'Report returned for correction.',
      onSuccess: () => {
        invalidateAll();
        onClose();
      },
    });
  };

  const handleResolveIssue = () => {
    if (!resolveModalLog?.id) return;
    const targetId = resolveModalLog.id;
    setResolveModalLog(null);
    runAction({
      loading: 'Marking issue resolved...',
      action: async () => {
        await resolveTaskIssue({ logId: targetId, resolution: resolutionNote });
      },
      success: 'Issue marked as resolved.',
      onSuccess: () => {
        setResolutionNote('');
        invalidateAll();
      },
    });
  };

  if (!visible) return null;

  const submittedByName = report?.submitted_by
    ? profilesMap.get(report.submitted_by) || 'Worker'
    : null;
  const reviewedByName = report?.reviewed_by
    ? profilesMap.get(report.reviewed_by) || 'Admin'
    : null;

  return (
    <View style={styles.portalOverlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.slideOverPanel}>
        {/* Slide-over Header */}
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {workerGroup?.color ? (
                <View style={[styles.groupDot, { backgroundColor: workerGroup.color }]} />
              ) : null}
              <Text style={styles.panelTitle} numberOfLines={1}>
                {workerGroup?.name ? `${workerGroup.name} • ${reportDate}` : `Report • ${reportDate}`}
              </Text>
            </View>
            <Text style={styles.panelSubtitle} numberOfLines={1}>
              {submittedByName
                ? `Submitted by ${submittedByName}${report?.submitted_at ? ` at ${formatTime(report.submitted_at)}` : ''}`
                : 'Daily maintenance report'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            {...a11yRole('button')}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Panel Scrollable Content */}
        <ScrollView
          style={styles.panelContent}
          contentContainerStyle={styles.scrollInside}
          showsVerticalScrollIndicator={true}
        >
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
              <Text style={styles.errorText}>{error.message || 'Report not found'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !report && tasks.length === 0 ? (
            <View style={styles.errorBox}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.errorText}>Report not found</Text>
            </View>
          ) : (
            <>
              {!report && (
                <View style={styles.noReportBanner}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.noReportText}>
                    No report submitted yet. Showing live scheduled tasks for this group.
                  </Text>
                </View>
              )}

              {report?.worker_note ? (
                <View style={styles.workerNoteBanner}>
                  <Text style={styles.workerNoteLabel}>Worker Group Note:</Text>
                  <Text style={styles.workerNoteText}>{report.worker_note}</Text>
                </View>
              ) : null}

              {/* KPI Strip */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiVal}>{kpi.assigned}</Text>
                  <Text style={styles.kpiLabel}>Tasks assigned</Text>
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
                  <Text style={styles.kpiLabel}>Issue reported</Text>
                </View>
              </View>

              {/* Inspection Results grouped by Equipment Group */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Inspection results</Text>
                <Text style={styles.cardSub}>
                  Recorded task outcomes included in this submission
                </Text>

                {groupedTasks.map(([groupName, groupUnits]) => {
                  const isExpanded = expandedEqGroups[groupName] !== false;
                  return (
                    <View key={groupName} style={styles.eqGroupSection}>
                      <TouchableOpacity
                        style={styles.eqGroupHeader}
                        onPress={() =>
                          setExpandedEqGroups((prev) => ({
                            ...prev,
                            [groupName]: prev[groupName] === false ? true : false,
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={colors.primaryDark}
                        />
                        <Text style={styles.eqGroupName}>{groupName}</Text>
                        <Text style={styles.eqGroupCount}>({groupUnits.length} units)</Text>
                      </TouchableOpacity>

                      {isExpanded &&
                        groupUnits.map((t) => {
                          const state = getTaskState(t.due_date, t.log, todayStr);
                          const isIssue = t.log?.result === 'issue';
                          const flag = t.log?.id ? flaggedMap[t.log.id] : null;
                          const iconName = isIssue
                            ? 'warning'
                            : t.log
                            ? 'checkmark-circle'
                            : 'time-outline';
                          const iconColor = isIssue
                            ? '#D97706'
                            : t.log
                            ? colors.primary
                            : colors.textMuted;

                          return (
                            <View key={t.id} style={styles.resultRow}>
                              <View style={styles.resultTop}>
                                <Ionicons name={iconName} size={20} color={iconColor} />
                                <View style={styles.resultInfo}>
                                  <Text style={styles.resultEquip}>
                                    {t.equipment?.name || 'Equipment'}
                                  </Text>
                                  <Text style={styles.resultLoc}>{buildLocation(t)}</Text>
                                  <Text style={styles.resultNote}>
                                    {t.log?.notes || 'No remarks'}
                                  </Text>
                                  {t.log ? (
                                    <Text style={styles.resultMeta}>
                                      Recorded by {t.doneByName || 'Worker'}
                                      {t.log.done_at ? ` - ${formatTime(t.log.done_at)}` : ''}
                                    </Text>
                                  ) : null}
                                  <PhotoStrip
                                    paths={t.log?.photo_paths}
                                    title={t.equipment?.name || 'Equipment'}
                                    subtitle={`Recorded by ${t.doneByName || 'Worker'}${t.log?.done_at ? ' - ' + formatTime(t.log.done_at) : ''}`}
                                  />
                                </View>
                                <TaskStatusChip status={state} size="small" />
                              </View>

                              {isSubmitted && t.log?.id ? (
                                <View style={styles.flagBox}>
                                  <TouchableOpacity
                                    style={styles.flagToggle}
                                    onPress={() => toggleFlag(t.log.id)}
                                    {...a11yRole('checkbox')}
                                  >
                                    <Ionicons
                                      name={flag?.flagged ? 'checkbox' : 'square-outline'}
                                      size={18}
                                      color={flag?.flagged ? '#DC2626' : colors.textMuted}
                                    />
                                    <Text style={styles.flagToggleText}>Flag for correction</Text>
                                  </TouchableOpacity>
                                  {flag?.flagged ? (
                                    <TextInput
                                      style={styles.flagInput}
                                      value={flag.note}
                                      onChangeText={(txt) => setFlagNote(t.log.id, txt)}
                                      placeholder="Reason for returning this task..."
                                      placeholderTextColor={colors.textMuted}
                                    />
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                    </View>
                  );
                })}
              </View>

              {/* Reported Issues Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Reported issue</Text>
                  <View
                    style={[
                      styles.issueBadge,
                      issueTasks.every((t) => !!t.log?.issue_resolved_at) && issueTasks.length > 0
                        ? styles.issueBadgeResolved
                        : styles.issueBadgeUnresolved,
                    ]}
                  >
                    <Text style={styles.issueBadgeText}>
                      {issueTasks.length === 0
                        ? 'None'
                        : issueTasks.every((t) => !!t.log?.issue_resolved_at)
                        ? 'Resolved'
                        : 'Unresolved'}
                    </Text>
                  </View>
                </View>

                {issueTasks.length === 0 ? (
                  <Text style={styles.emptySub}>No issues reported in this submission.</Text>
                ) : (
                  issueTasks.map((t) => {
                    const isResolved = !!t.log?.issue_resolved_at;
                    return (
                      <View key={t.id} style={styles.issueItem}>
                        <Text style={styles.issueEquip}>{t.equipment?.name || 'Equipment'}</Text>
                        <Text style={styles.issueLoc}>{buildLocation(t)}</Text>
                        <Text style={styles.issueNote}>{t.log?.notes}</Text>
                        <PhotoStrip
                          paths={t.log?.photo_paths}
                          title={t.equipment?.name || 'Equipment'}
                          subtitle={`Recorded by ${t.doneByName || 'Worker'}`}
                        />
                        {isResolved ? (
                          <Text style={styles.resolvedMeta}>
                            Resolved by {t.resolvedByName || 'Admin'}
                            {t.log.issue_resolution ? `: ${t.log.issue_resolution}` : ''}
                          </Text>
                        ) : (
                          <TouchableOpacity
                            style={styles.resolveBtn}
                            onPress={() => {
                              setResolutionNote('');
                              setResolveModalLog(t.log);
                            }}
                            {...a11yRole('button')}
                          >
                            <Text style={styles.resolveBtnText}>Mark resolved</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Review Remarks Card */}
              {report ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Review remarks</Text>
                  {isSubmitted ? (
                    <TextInput
                      style={styles.remarksInput}
                      value={remarks}
                      onChangeText={setRemarks}
                      placeholder="Add review remarks..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                    />
                  ) : (
                    <>
                      <Text style={styles.readOnlyRemarks}>
                        {report.review_remarks || 'No review remarks.'}
                      </Text>
                      {reviewedByName ? (
                        <Text style={styles.reviewedMeta}>
                          Approved by {reviewedByName}
                          {report.reviewed_at ? ` at ${formatTime(report.reviewed_at)}` : ''}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Sticky Bottom Bar */}
        <View style={styles.stickyBottomBar}>
          <Text style={styles.bottomBarInfo}>
            {isSubmitted
              ? 'Approving will not complete pending tasks.'
              : isReviewed
                ? 'This report is already approved.'
                : isReturned
                  ? 'Returned. Waiting for the worker to resubmit.'
                  : 'Waiting for the worker to submit this report.'}
          </Text>
          <View style={styles.bottomBtnGroup}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onClose}
              {...a11yRole('button')}
            >
              <Text style={styles.backBtnText}>Back to Reports</Text>
            </TouchableOpacity>

            {!isReviewed && (
              <>
                <TouchableOpacity
                  style={[styles.returnBtn, !isSubmitted && { opacity: 0.4 }]}
                  onPress={handleReturn}
                  disabled={!isSubmitted}
                  {...a11yRole('button')}
                >
                  <Text style={styles.returnBtnText}>Return for Correction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.approveBtn, !isSubmitted && { opacity: 0.4 }]}
                  onPress={handleApprove}
                  disabled={!isSubmitted}
                  {...a11yRole('button')}
                >
                  <Text style={styles.approveBtnText}>Approve Report</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Resolve Issue Modal */}
        <Modal
          visible={!!resolveModalLog}
          transparent
          animationType="fade"
          onRequestClose={() => setResolveModalLog(null)}
          {...modalA11y(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Mark Issue Resolved</Text>
              <Text style={styles.modalLabel}>Resolution Note (Optional)</Text>
              <TextInput
                style={styles.remarksInput}
                value={resolutionNote}
                onChangeText={setResolutionNote}
                placeholder="Describe how the issue was resolved..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setResolveModalLog(null)}
                  {...a11yRole('button')}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={handleResolveIssue}
                  {...a11yRole('button')}
                >
                  <Text style={styles.approveBtnText}>Mark Resolved</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  slideOverPanel: {
    position: 'relative',
    width: '100%',
    maxWidth: 960,
    height: '100%',
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  panelSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  panelContent: {
    flex: 1,
  },
  scrollInside: {
    padding: 24,
    gap: 18,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  noReportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
  },
  noReportText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '500',
  },
  workerNoteBanner: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
  },
  workerNoteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  workerNoteText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eqGroupSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  eqGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  eqGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  eqGroupCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultEquip: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultLoc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultNote: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
  },
  resultMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  flagBox: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  flagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  flagInput: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    backgroundColor: colors.white,
    padding: 8,
    fontSize: 12,
    color: colors.textPrimary,
  },
  issueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  issueBadgeResolved: {
    backgroundColor: '#E0F2FE',
  },
  issueBadgeUnresolved: {
    backgroundColor: '#FEF3C7',
  },
  issueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  issueItem: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  issueEquip: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  issueLoc: {
    fontSize: 12,
    color: '#B91C1C',
  },
  issueNote: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  resolvedMeta: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  resolveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  resolveBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  readOnlyRemarks: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  reviewedMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  stickyBottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  bottomBarInfo: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  returnBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: colors.white,
  },
  returnBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
