import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrequencyBadge from './FrequencyBadge';
import TaskStatusChip from './TaskStatusChip';
import WorkerGroupBadge from './WorkerGroupBadge';
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

function buildLocation(item) {
  const equipment = item.equipment || item.rule?.equipment;
  const eqGroup = item.group || equipment?.group || item.rule?.equipment?.group;
  const category = item.category || eqGroup?.category || item.rule?.equipment?.group?.category;
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
  tab = 'approval',
  isSelected = false,
  onToggleSelect,
  onApprove,
  onReject,
  onEditRule,
  profilesMap,
}) {
  const rule = item.rule || null;
  const equipment = item.equipment || rule?.equipment || null;
  const workerGroup = item.worker_group || rule?.worker_group || null;
  const freq = item.frequency || rule?.frequency || null;
  const isDeleted = !rule;

  const workerName = item.submitterName || (item.done_by && profilesMap ? (profilesMap.get ? profilesMap.get(item.done_by) : profilesMap[item.done_by]) : null) || 'Worker';
  const approverName = (item.approved_by || item.reviewed_by) && profilesMap
    ? (profilesMap.get ? profilesMap.get(item.approved_by || item.reviewed_by) : profilesMap[item.approved_by || item.reviewed_by]) || 'Admin'
    : item.approved_by || item.reviewed_by ? 'Admin' : null;

  const overdueDays = daysOverdue(item.due_date);
  const dueToday = isDueToday(item.due_date);
  const isOverdue = overdueDays > 0 && (item.status === 'pending' || item.status === 'rejected' || item.status === 'submitted');

  const location = buildLocation(item);
  const isApproval = tab === 'approval';
  const isDone = tab === 'done';
  const isPending = tab === 'pending';

  if (isDeleted) {
    return (
      <View style={[styles.card, styles.deletedCard]}>
        <View style={styles.deletedRow}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          <Text style={styles.deletedText}>This task was deleted</Text>
        </View>
        <Text style={styles.deletedSub}>
          Due: {item.due_date} • Submitted by {workerName}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isOverdue && styles.cardOverdue,
      ]}
    >
      {/* Top row: checkbox, freq badge, equipment name, status chip */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          {isApproval && (
            <TouchableOpacity
              onPress={() => onToggleSelect && onToggleSelect(item.id)}
              style={styles.checkboxTouch}
            >
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={isSelected ? colors.primary : '#A1A1AA'}
              />
            </TouchableOpacity>
          )}
          <FrequencyBadge freq={freq} size="medium" />
          <View style={styles.nameCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.equipName}>
                {equipment?.name || 'Equipment'}
              </Text>
              {equipment?.area ? (
                <View style={styles.areaChip}>
                  <Text style={styles.areaChipText}>{equipment.area}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.topRight}>
          <TaskStatusChip status={item.status || 'pending'} />
          <Text style={styles.dueDateText}>Due: {item.due_date}</Text>
          {dueToday && (
            <Text style={styles.dueTodayBadge}>Due today</Text>
          )}
          {isOverdue && (
            <Text style={styles.overdueBadge}>
              Overdue by {overdueDays} day{overdueDays !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Location line: Category > Group */}
      {location ? (
        <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
      ) : null}

      {/* Worker Group */}
      <View style={styles.groupRow}>
        <Text style={styles.groupLabel}>Worker Group:</Text>
        <WorkerGroupBadge group={workerGroup} />
      </View>

      {/* Submitted info */}
      {item.status === 'submitted' && (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color="#0284C7" />
          <Text style={styles.infoText}>
            Submitted by <Text style={styles.bold}>{workerName}</Text>
            {' - '}{timeAgo(item.submitted_at || item.done_at)}
          </Text>
        </View>
      )}
      {item.status === 'submitted' && (item.submitted_at || item.done_at) && (
        <Text style={styles.timestampDetail}>
          {formatDateTime(item.submitted_at || item.done_at)}
        </Text>
      )}

      {/* Done info */}
      {item.status === 'done' && (
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle" size={14} color="#15803D" />
          <Text style={styles.infoText}>
            Done by <Text style={styles.bold}>{workerName}</Text>
            {approverName ? ` - approved by ${approverName}` : ' - Approved'}
            {item.approved_at || item.reviewed_at
              ? ` at ${formatDateTime(item.approved_at || item.reviewed_at)}`
              : ''}
          </Text>
        </View>
      )}

      {/* Rejected info */}
      {item.status === 'rejected' && (
        <View style={styles.rejectionBox}>
          <Ionicons name="close-circle" size={14} color="#DC2626" />
          <Text style={styles.rejectionText}>
            Rejected: {item.review_note || 'Please redo this task.'}
          </Text>
        </View>
      )}

      {/* Worker note */}
      <View style={styles.noteBox}>
        <Ionicons
          name={item.notes ? 'chatbubble-ellipses-outline' : 'document-text-outline'}
          size={14}
          color={item.notes ? colors.textSecondary : colors.textMuted}
        />
        <Text style={[styles.noteText, !item.notes && styles.noteTextEmpty]}>
          {item.notes || 'No note'}
        </Text>
      </View>

      {/* Action buttons */}
      {isApproval && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => onApprove && onApprove(item.id, equipment?.name)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color={colors.white} />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => onReject && onReject(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color="#DC2626" />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPending && onEditRule && rule && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editRuleBtn]}
            onPress={() => onEditRule(rule)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.editRuleBtnText}>Edit Rule & Workers</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  cardOverdue: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  deletedCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
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
    color: colors.textMuted,
  },
  deletedSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 26,
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
  equipName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  areaChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  areaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
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
    color: '#D97706',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionText: {
    fontSize: 13,
    color: '#991B1B',
    flex: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
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

