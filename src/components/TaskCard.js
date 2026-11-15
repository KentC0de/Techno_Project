import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrequencyBadge from './FrequencyBadge';
import StatusBadge from './StatusBadge';
import TaskActionModal from './TaskActionModal';
import WorkerGroupBadge from './WorkerGroupBadge';
import { colors } from '../theme';

export default function TaskCard({
  task,
  onUpdateStatus,
  onUndoStatus,
  canEdit = true,
  currentUserId = null,
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

  const isCompleted = status === 'done' || status === 'issue' || status === 'skipped';
  // Allow undo if the log was done by this user or if admin
  const canUndo = isCompleted && canEdit;

  const handleActionClick = (type) => {
    setActionType(type);
    setModalVisible(true);
  };

  const handleModalSubmit = async (type, note) => {
    await onUpdateStatus(task, type, note);
  };

  return (
    <View
      style={[
        styles.card,
        isOverdue && styles.overdueCard,
        status === 'done' && styles.doneCard,
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

        <StatusBadge status={status} />
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={styles.equipmentName}>{equipment?.name || 'Equipment'}</Text>
        {category?.name ? (
          <Text style={styles.categorySubtext}>{category.code}. {category.name}</Text>
        ) : null}
      </View>

      {/* Worker Group Badge */}
      <View style={{ marginTop: 6, marginBottom: 4 }}>
        <WorkerGroupBadge group={task.rule?.worker_group || task.worker_group} />
      </View>

      {/* Notes if any */}
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

      {/* If task has a logged note (e.g. issue or completion report) */}
      {log?.notes ? (
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
            Worker Log: {log.notes}
          </Text>
        </View>
      ) : null}

      {/* Action Buttons for Worker / Admin */}
      {canEdit && (
        <View style={styles.actionsRow}>
          {!isCompleted ? (
            <>
              {/* Mark Done Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.doneBtn]}
                onPress={() => handleActionClick('done')}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={18} color={colors.white} />
                <Text style={styles.doneBtnText}>Mark Done</Text>
              </TouchableOpacity>

              {/* Report Issue Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.issueBtn]}
                onPress={() => handleActionClick('issue')}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <Text style={styles.issueBtnText}>Issue</Text>
              </TouchableOpacity>

              {/* Skip Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.skipBtn]}
                onPress={() => handleActionClick('skipped')}
                activeOpacity={0.8}
              >
                <Ionicons name="play-forward-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </>
          ) : (
            canUndo && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.undoBtn]}
                onPress={() => onUndoStatus(task)}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={colors.dark} />
                <Text style={styles.undoBtnText}>Undo / Reopen</Text>
              </TouchableOpacity>
            )
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  coWorkersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  coWorkersText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  overdueCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  doneCard: {
    borderColor: '#BAE6FD',
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
    marginBottom: 10,
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
    minHeight: 48,
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

