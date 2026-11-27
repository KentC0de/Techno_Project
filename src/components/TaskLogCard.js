import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrequencyBadge from './FrequencyBadge';
import TaskStatusChip from './TaskStatusChip';
import PhotoStrip from './PhotoStrip';
import WorkerGroupBadge from './WorkerGroupBadge';
import { fetchRuleDirect, loadTaskContext } from '../lib/dataService';
import { a11yRole } from '../utils/a11y';
import { colors } from '../theme';

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  if (isNaN(then)) return '';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yr}-${mo}-${dy} ${hh}:${mm}`;
}

function daysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dueDateStr >= todayStr) return 0;
  const dueMs = new Date(dueDateStr + 'T00:00:00').getTime();
  const todayMs = new Date(todayStr + 'T00:00:00').getTime();
  return Math.floor((todayMs - dueMs) / (24 * 60 * 60 * 1000));
}

function isDueToday(dueDateStr) {
  if (!dueDateStr) return false;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dueDateStr === todayStr;
}

function buildLocation(equipment, eqGroup, category) {
  const parts = [];
  if (category) {
    parts.push(`${category.code}. ${category.name}`);
  }
  if (eqGroup && eqGroup.name) {
    parts.push(eqGroup.name);
  }
  return parts.join(' > ');
}

export default function TaskLogCard({
  item,
  tab = 'pending',
  onEditRule,
  onOpenReport,
  onRemoveFromQueue,
  onRetry,
  profilesMap,
}) {
  const log = item.log || item;
  const initialRule = item.rule || null;
  const ruleId = log.rule_id || item.rule_id || null;
  const logId = log.id || item.id || null;
  const hasInitialRule = !!initialRule;

  // Direct verification state ONLY when initialRule is null
  const [ruleCheckState, setRuleCheckState] = useState({
    status: hasInitialRule ? 'found' : ruleId ? 'checking' : 'missing',
    error: null,
    context: null,
  });
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (hasInitialRule) {
      return;
    }

    if (!ruleId) {
      setRuleCheckState({ status: 'missing', error: null, context: null });
      return;
    }

    let cancelled = false;
    setRuleCheckState({ status: 'checking', error: null, context: null });

    (async () => {
      try {
        const { data, error } = await fetchRuleDirect(ruleId);
        if (cancelled) return;

        if (error) {
          setRuleCheckState({
            status: 'error',
            error: error.message || 'Failed to verify task rule.',
            context: null,
          });
          return;
        }

        if (!data) {
          setRuleCheckState({ status: 'missing', error: null, context: null });
          return;
        }

        // Rule exists in DB — load full context for this log
        const contexts = await loadTaskContext([log]);
        if (cancelled) return;
        const resolved = contexts[0] || { log, rule: data };
        setRuleCheckState({
          status: 'found',
          error: null,
          context: resolved,
        });
      } catch (err) {
        if (cancelled) return;
        setRuleCheckState({
          status: 'error',
          error: err?.message || 'Failed to verify task rule.',
          context: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasInitialRule, ruleId, logId, retryTick]);

  const resolvedCtx = !hasInitialRule ? ruleCheckState.context : null;
  const rule = initialRule || resolvedCtx?.rule || null;
  const equipment = resolvedCtx?.equipment || item.equipment || rule?.equipment || null;
  const eqGroup = resolvedCtx?.group || item.group || equipment?.group || null;
  const category = resolvedCtx?.category || item.category || eqGroup?.category || null;
  const workerGroup =
    resolvedCtx?.workerGroup ||
    item.workerGroup ||
    item.worker_group ||
    rule?.worker_group ||
    null;

  const freq = rule?.frequency || item.frequency || null;
  const dueDate = log.due_date || item.due_date || '';
  const status = log.status || item.status || 'pending';

  const lookupProfileName = (personId) => {
    if (!personId || !profilesMap) return null;
    return profilesMap.get ? profilesMap.get(personId) : profilesMap[personId];
  };

  const workerName =
    resolvedCtx?.worker?.full_name ||
    item.worker?.full_name ||
    item.submitterName ||
    lookupProfileName(log.done_by) ||
    'Worker';

  const approverId = log.approved_by || log.reviewed_by;
  const approverName =
    resolvedCtx?.approver?.full_name ||
    item.approver?.full_name ||
    item.approverName ||
    lookupProfileName(approverId) ||
    (approverId ? 'Admin' : null);

  const workerNote = item.log
    ? item.log.notes
    : status === 'pending'
    ? null
    : log.notes || item.notes;

  const overdueDays = daysOverdue(dueDate);
  const dueToday = isDueToday(dueDate);
  const isOverdue =
    overdueDays > 0 &&
    (status === 'pending' || status === 'rejected' || status === 'submitted');

  const location = buildLocation(equipment, eqGroup, category);
  const isReported = tab === 'reported';
  const isPending = tab === 'pending';

  if (!rule) {
    if (ruleCheckState.status === 'checking') {
      return (
        <View style={[styles.card, styles.checkingCard]}>
          <View style={styles.deletedRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.checkingText}>Checking task details...</Text>
          </View>
          <Text style={styles.deletedSub}>
            Due {dueDate} • Submitted by {workerName}
          </Text>
        </View>
      );
    }

    if (ruleCheckState.status === 'error') {
      return (
        <View style={[styles.card, styles.errorCard]}>
          <View style={styles.deletedRow}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{ruleCheckState.error}</Text>
          </View>
          <Text style={styles.deletedSub}>
            Due {dueDate} • Submitted by {workerName}
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.retryBtn]}
              onPress={() => {
                setRetryTick((t) => t + 1);
                if (onRetry) onRetry();
              }}
              activeOpacity={0.8}
              {...a11yRole('button')}
            >
              <Ionicons name="refresh-outline" size={15} color={colors.white} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Confirmed: direct query returned data = null and error = null
    return (
      <View style={[styles.card, styles.deletedCard]}>
        <View style={styles.deletedRow}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.deletedText}>This task is no longer available</Text>
        </View>
        <Text style={styles.deletedSub}>
          Due {dueDate} • {status === 'submitted' ? `Submitted by ${workerName}` : workerName}
        </Text>
        {onRemoveFromQueue && logId ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.removeQueueBtn]}
              onPress={() => onRemoveFromQueue(item)}
              activeOpacity={0.8}
              {...a11yRole('button')}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
              <Text style={styles.removeQueueBtnText}>Remove from queue</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  const workerGroupForBadge =
    workerGroup ||
    (rule.worker_group_id
      ? { id: rule.worker_group_id, name: 'Assigned Group', color: colors.primary }
      : null);

  const isEquipmentInactive = equipment && equipment.is_active === false;

  return (
    <View
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
      ]}
    >
      {/* Top row: freq badge, equipment name, status chip */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          {freq ? <FrequencyBadge freq={freq} size="medium" /> : null}
          <View style={styles.nameCol}>
            <View style={styles.equipNameRow}>
              <Text style={styles.equipName}>
                {equipment?.name || 'Equipment'}
              </Text>
              {equipment?.area ? (
                <View style={styles.areaChip}>
                  <Text style={styles.areaChipText}>{equipment.area}</Text>
                </View>
              ) : null}
              {isEquipmentInactive ? (
                <View style={styles.inactiveChip}>
                  <Text style={styles.inactiveChipText}>Inactive</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.topRight}>
          <TaskStatusChip status={status} />
          <Text style={styles.dueDateText}>Due {dueDate}</Text>
          {dueToday && <Text style={styles.dueTodayBadge}>Due today</Text>}
          {isOverdue && (
            <Text style={styles.overdueBadge}>
              Overdue by {overdueDays} day{overdueDays !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Location line: Category > Group */}
      {location ? (
        <Text style={styles.locationText} numberOfLines={1}>
          {location}
        </Text>
      ) : null}

      {/* Worker Group */}
      <View style={styles.groupRow}>
        <Text style={styles.groupLabel}>Worker Group:</Text>
        <WorkerGroupBadge group={workerGroupForBadge} />
      </View>

      {/* Submitted info */}
      {status === 'submitted' && (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.infoText}>
            Submitted by <Text style={styles.bold}>{workerName}</Text>
            {' - '}
            {timeAgo(log.submitted_at || log.done_at)}
          </Text>
        </View>
      )}
      {status === 'submitted' && (log.submitted_at || log.done_at) ? (
        <Text style={styles.timestampDetail}>
          {formatDateTime(log.submitted_at || log.done_at)}
        </Text>
      ) : null}

      {/* Done info */}
      {status === 'done' && (
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primaryDark} />
          <Text style={styles.infoText}>
            Done by <Text style={styles.bold}>{workerName}</Text>
            {approverName ? ` - approved by ${approverName}` : ' - Approved'}
            {log.approved_at || log.reviewed_at
              ? ` at ${formatDateTime(log.approved_at || log.reviewed_at)}`
              : ''}
          </Text>
        </View>
      )}

      {/* Issue info */}
      {(log.result === 'issue' || status === 'issue') && log.done_by ? (
        <View style={styles.infoRow}>
          <Ionicons name="warning-outline" size={14} color="#D97706" />
          <Text style={styles.infoText}>
            Reported by <Text style={styles.bold}>{workerName}</Text>
            {log.done_at ? ` - ${timeAgo(log.done_at)}` : ''}
            {log.issue_resolved_at ? ' • Resolved' : ' • Unresolved'}
          </Text>
        </View>
      ) : null}

      {/* Rejected info */}
      {status === 'rejected' && (
        <View style={styles.rejectionBox}>
          <Ionicons name="close-circle" size={14} color="#DC2626" />
          <Text style={styles.rejectionText}>
            Rejected: {log.review_note || 'Please redo this task.'}
          </Text>
        </View>
      )}

      {/* Worker note */}
      <View style={styles.noteBox}>
        <Ionicons
          name={workerNote ? 'chatbubble-ellipses-outline' : 'document-text-outline'}
          size={14}
          color={workerNote ? colors.textSecondary : colors.textMuted}
        />
        <Text style={[styles.noteText, !workerNote && styles.noteTextEmpty]}>
          {workerNote || 'No note'}
        </Text>
      </View>
      <PhotoStrip
        paths={log.photo_paths}
        title={equipment?.name || 'Equipment'}
        subtitle={log.done_at ? `Recorded ${new Date(log.done_at).toLocaleString()}` : undefined}
      />

      {/* Action buttons */}
      {isReported && onOpenReport ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => onOpenReport(item)}
            activeOpacity={0.8}
            {...a11yRole('button')}
          >
            <Ionicons name="document-text-outline" size={16} color={colors.white} />
            <Text style={styles.approveBtnText}>Open report</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isPending && onEditRule && rule ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editRuleBtn]}
            onPress={() => onEditRule(rule)}
            activeOpacity={0.8}
            {...a11yRole('button')}
          >
            <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.editRuleBtnText}>Edit Rule & Workers</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  cardOverdue: {
    borderColor: colors.dark,
    backgroundColor: '#F8FAFC',
  },
  checkingCard: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
  },
  checkingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  deletedCard: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deletedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  deletedSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 26,
    marginBottom: 6,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  removeQueueBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  removeQueueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  checkboxTouch: {
    marginRight: 4,
  },
  nameCol: {
    flex: 1,
  },
  equipNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  equipName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  areaChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    alignSelf: 'flex-start',
  },
  areaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inactiveChip: {
    backgroundColor: colors.dark,
    borderRadius: 4,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    alignSelf: 'flex-start',
  },
  inactiveChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  topRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  dueTodayBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  overdueBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
  },
  locationText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
    color: colors.dark,
  },
  timestampDetail: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 20,
    marginBottom: 4,
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  noteTextEmpty: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
  },
  approveBtn: {
    backgroundColor: colors.primary,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  rejectBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  editRuleBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  editRuleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
});
