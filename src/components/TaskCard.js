import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrequencyBadge from './FrequencyBadge';
import TaskStatusChip from './TaskStatusChip';
import TaskActionModal from './TaskActionModal';
import WorkerGroupBadge from './WorkerGroupBadge';
import { colors } from '../theme';

function formatSimpleTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function TaskCard({
  task,
  onUpdateStatus,
  onUndoStatus,
  onCancelSubmission,
  canEdit = true,
  currentUserId = null,
  profileMap = null,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState('done');

  const {
    equipment,
    group,
    category,
    frequency,
    status = 'pending',
    notes,
    isOverdue,
    due_date,
    log,
  } = task;

  const handleActionClick = (type) => {
    setActionType(type);
    setModalVisible(true);
  };

  const handleModalSubmit = async (type, note) => {
    await onUpdateStatus(task, type, note);
  };

  const isSubmitted = status === 'submitted';
  const isDone = status === 'done';
  const isRejected = status === 'rejected';
  const isIssueOrSkipped = status === 'issue' || status === 'skipped';

  // Submitter & Approver names
  const submitterName = log?.done_by
    ? (profileMap?.get ? profileMap.get(log.done_by) : profileMap?.[log.done_by]) || log.done_by_name || 'Worker'
    : 'Worker';

  const approverName = log?.approved_by || log?.reviewed_by
    ? (profileMap?.get ? profileMap.get(log.approved_by || log.reviewed_by) : profileMap?.[log.approved_by || log.reviewed_by]) || log.approved_by_name || 'Admin'
    : null;

  const isMySubmission = isSubmitted && log?.done_by && currentUserId && log.done_by === currentUserId;

  return (
    <View
      style={[
        styles.card,
        isOverdue && styles.overdueCard,
        isDone && styles.doneCard,
        isRejected && styles.rejectedCard,
      ]}
    >
      {/* Top row: Frequency badge, Group & Area, and Status */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <FrequencyBadge freq={frequency} size="medium" />
          <View style={styles.titleInfo}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group?.name || 'General Maintenance'}
            </Text>
            {equipment?.area ? (
              <View style={styles.areaTag}>
                <Text style={styles.areaText}>{equipment.area}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <TaskStatusChip status={status} />
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={styles.equipmentName}>{equipment?.name || 'Equipment'}</Text>
        {category?.name ? (
          <Text style={styles.categorySubtext}>{category.code}. {category.name}</Text>
        ) : null}
      </View>

      {/* Worker Group Badge */}
      <View style={{ marginTop: 4, marginBottom: 8 }}>
        <WorkerGroupBadge group={task.rule?.worker_group || task.worker_group} />
      </View>

      {/* Schedule Notes if any */}
      {notes ? (
        <View style={styles.adminNoteBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.primaryDark}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.adminNoteText}>Schedule Note: {notes}</Text>
        </View>
      ) : null}

      {/* SUBMITTED STATE BANNER */}
      {isSubmitted && (
        <View style={styles.submittedBanner}>
          <Ionicons name="time-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
          <Text style={styles.submittedBannerText}>
            Waiting for admin approval • Submitted by {submitterName}
            {log?.submitted_at || log?.done_at ? ` at ${formatSimpleTime(log.submitted_at || log.done_at)}` : ''}
          </Text>
        </View>
      )}

      {/* DONE / APPROVED STATE BANNER */}
      {isDone && (
        <View style={styles.doneBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#15803D" style={{ marginRight: 6 }} />
          <Text style={styles.doneBannerText}>
            Done by {submitterName} — {approverName ? `approved by ${approverName}` : 'Approved'}
            {log?.approved_at || log?.reviewed_at ? ` at ${formatSimpleTime(log.approved_at || log.reviewed_at)}` : ''}
          </Text>
        </View>
      )}

      {/* REJECTED HIGHLIGHT BOX */}
      {isRejected && (
        <View style={styles.rejectedBox}>
          <View style={styles.rejectedBoxHeader}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.rejectedBoxTitle}>Needs Redo — Rejected by Admin</Text>
          </View>
          <Text style={styles.rejectedReasonText}>
            Reason: {log?.review_note || 'Please review and redo this maintenance task.'}
          </Text>
        </View>
      )}

      {/* Worker Log Note if any */}
      {log?.notes && !isRejected ? (
        <View
          style={[
            styles.logNoteBox,
            status === 'issue' && styles.issueNoteBox,
          ]}
        >
          <Ionicons
            name={status === 'issue' ? 'alert-circle-outline' : 'chatbubble-ellipses-outline'}
            size={16}
            color={status === 'issue' ? colors.danger : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.logNoteText,
              status === 'issue' && styles.issueNoteText,
            ]}
          >
            Worker Note: {log.notes}
          </Text>
        </View>
      ) : null}

      {/* Action Buttons */}
      {canEdit && (
        <View style={styles.actionsRow}>
          {/* Pending / Overdue state: Mark Done, Issue, Skip */}
          {(status === 'pending' || status === 'overdue') && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.doneBtn]}
                onPress={() => handleActionClick('done')}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={18} color={colors.white} />
                <Text style={styles.doneBtnText}>Mark Done</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.issueBtn]}
                onPress={() => handleActionClick('issue')}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <Text style={styles.issueBtnText}>Issue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.skipBtn]}
                onPress={() => handleActionClick('skipped')}
                activeOpacity={0.8}
              >
                <Ionicons name="play-forward-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Submitted state: Cancel submission button (if current user submitted) */}
          {isSubmitted && isMySubmission && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelSubmissionBtn]}
              onPress={() => onCancelSubmission && onCancelSubmission(task)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.cancelSubmissionText}>Cancel submission</Text>
            </TouchableOpacity>
          )}

          {/* Rejected state: Redo and resubmit button */}
          {isRejected && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.redoBtn]}
              onPress={() => handleActionClick('done')}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.white} />
              <Text style={styles.redoBtnText}>Redo and resubmit</Text>
            </TouchableOpacity>
          )}

          {/* Issue or Skipped: Undo / Reopen button */}
          {isIssueOrSkipped && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.undoBtn]}
              onPress={() => onUndoStatus(task)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.dark} />
              <Text style={styles.undoBtnText}>Undo / Reopen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modal for action details / issue notes */}
      <TaskActionModal
        visible={modalVisible}
        actionType={actionType}
        task={task}
        onClose={() => setModalVisible(false)}
        onSubmit={handleModalSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  overdueCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  doneCard: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F8FAFC',
  },
  rejectedCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  titleInfo: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginRight: 6,
  },
  areaTag: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  areaText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  mainContent: {
    marginBottom: 6,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 22,
  },
  categorySubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  adminNoteText: {
    fontSize: 12,
    color: colors.primaryDark,
    flex: 1,
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  submittedBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    flex: 1,
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  doneBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    flex: 1,
  },
  rejectedBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  rejectedBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rejectedBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectedReasonText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  logNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  logNoteText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  issueNoteBox: {
    backgroundColor: colors.dangerLight,
    borderColor: '#FCA5A5',
  },
  issueNoteText: {
    color: colors.danger,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    flex: 2,
    minWidth: 120,
  },
  doneBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  redoBtn: {
    backgroundColor: '#0EA5E9',
    flex: 1,
    minWidth: 150,
  },
  redoBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  cancelSubmissionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
  },
  cancelSubmissionText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  issueBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
    flex: 1,
    minWidth: 80,
  },
  issueBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  skipBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    minWidth: 70,
  },
  skipBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  undoBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 16,
    flex: 1,
  },
  undoBtnText: {
    color: colors.dark,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
});
