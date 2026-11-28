import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskStatusChip from './TaskStatusChip';
import TaskActionModal from './TaskActionModal';
import { useTaskPhotoUrls } from '../lib/taskPhotos';
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
  const [actionType, setActionType] = useState('completed');
  const [lightboxUri, setLightboxUri] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const photoPaths = Array.isArray(log?.photo_paths) ? log.photo_paths : [];
  const photoUrls = useTaskPhotoUrls(photoPaths);

  const handleActionClick = (type) => {
    setActionType(type);
    setModalVisible(true);
  };

  const handleModalSubmit = async (type, note, photos) => {
    await onUpdateStatus(task, type, note, photos);
  };

  const taskState = task.taskState || (status === 'rejected' ? 'returned' : status);
  const isDraftCompleted = log?.status === 'draft' && log?.result !== 'issue';
  const isDraftIssue = log?.status === 'draft' && log?.result === 'issue';
  const isDraft = log?.status === 'draft';
  const isSubmitted = status === 'submitted';
  const isDone = status === 'done';
  const isReturned = status === 'rejected' || taskState === 'returned';
  const isPendingOrOverdue = status === 'pending' || status === 'overdue';

  // Submitter & Approver names
  const submitterName = log?.done_by
    ? (profileMap?.get ? profileMap.get(log.done_by) : profileMap?.[log.done_by]) || log.done_by_name || 'Worker'
    : 'Worker';

  const approverName = log?.approved_by || log?.reviewed_by
    ? (profileMap?.get ? profileMap.get(log.approved_by || log.reviewed_by) : profileMap?.[log.approved_by || log.reviewed_by]) || log.approved_by_name || 'Admin'
    : null;

  const isMyDraft = isDraft && log?.done_by && currentUserId && log.done_by === currentUserId;
  const hasNotesOrPhotos = !!notes || !!log?.notes || photoUrls.length > 0;

  return (
    <View
      style={[
        styles.card,
        isOverdue && isPendingOrOverdue && styles.overdueCard,
        isDone && styles.doneCard,
        isReturned && styles.rejectedCard,
      ]}
    >
      {/* Unit row (1-line equipment name, status pill, 3 icon buttons: check, warning, camera with 44px hit areas) */}
      <TouchableOpacity
        style={styles.unitRowMain}
        onPress={() => setIsExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.equipNameWrap}>
          <Text style={styles.equipmentName} numberOfLines={1} ellipsizeMode="tail">
            {equipment?.name || 'Equipment'}
          </Text>
          {hasNotesOrPhotos && (
            <View style={styles.infoDot} />
          )}
        </View>

        {taskState !== 'pending' && taskState !== 'overdue' ? (
          <TaskStatusChip status={taskState} size="small" />
        ) : null}

        {/* 3 ICON BUTTONS with 44px hit areas: check, warning, camera */}
        {canEdit && !isSubmitted && !isDone && (
          <View style={styles.iconButtonsWrap}>
            {/* Check Button (Mark Completed) */}
            <TouchableOpacity
              style={[styles.iconButton, styles.checkIconButton]}
              onPress={() => onUpdateStatus && onUpdateStatus(task, 'completed', null)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Mark Completed"
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Warning Button (Report Issue) */}
            <TouchableOpacity
              style={[styles.iconButton, styles.warningIconButton]}
              onPress={() => handleActionClick('issue')}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Report Issue"
            >
              <Ionicons name="warning-outline" size={19} color="#B45309" />
            </TouchableOpacity>

            {/* Camera Button (Complete with photos or edit photos) */}
            <TouchableOpacity
              style={[styles.iconButton, styles.cameraIconButton]}
              onPress={() => handleActionClick(isDraft ? (log?.result === 'issue' ? 'issue' : 'completed') : 'completed')}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={isDraft ? "Edit photos" : "Complete with photos"}
            >
              <Ionicons name="camera-outline" size={19} color={colors.primary} />
              {photoUrls.length > 0 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>{photoUrls.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Undo button for draft */}
        {isMyDraft && (
          <TouchableOpacity
            style={styles.undoIconTouch}
            onPress={() => onUndoStatus && onUndoStatus(task)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Undo Completion"
          >
            <Ionicons name="arrow-undo-outline" size={18} color={colors.dark} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Expanded Details when row is tapped */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {category?.name ? (
            <Text style={styles.categorySubtext}>
              {category.code}. {category.name} {equipment?.area ? `• ${equipment.area}` : ''}
            </Text>
          ) : null}

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
              <Ionicons name="time-outline" size={16} color="#1C5089" style={{ marginRight: 6 }} />
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
                Done by {submitterName} - {approverName ? `approved by ${approverName}` : 'Approved'}
                {log?.approved_at || log?.reviewed_at ? ` at ${formatSimpleTime(log.approved_at || log.reviewed_at)}` : ''}
              </Text>
            </View>
          )}

          {/* REJECTED / RETURNED HIGHLIGHT BOX */}
          {isReturned && (
            <View style={styles.rejectedBox}>
              <View style={styles.rejectedBoxHeader}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.rejectedBoxTitle}>Returned for Correction by Admin</Text>
              </View>
              <Text style={styles.rejectedReasonText}>
                Remarks: {log?.review_note || 'Please review and redo this maintenance task.'}
              </Text>
            </View>
          )}

          {/* Worker Log Note if any */}
          {log?.notes && !isReturned ? (
            <View
              style={[
                styles.logNoteBox,
                (isDraftIssue || taskState === 'issue') && styles.issueNoteBox,
              ]}
            >
              <Ionicons
                name={isDraftIssue || taskState === 'issue' ? 'warning-outline' : 'chatbubble-ellipses-outline'}
                size={16}
                color={isDraftIssue || taskState === 'issue' ? '#B45309' : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.logNoteText,
                  (isDraftIssue || taskState === 'issue') && styles.issueNoteText,
                ]}
              >
                Worker Note: {log.notes}
              </Text>
            </View>
          ) : null}

          {/* Photo thumbnails */}
          {photoUrls.length > 0 && (
            <View style={styles.photoThumbStrip}>
              {photoUrls.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.photoThumbTouch}
                  onPress={() => setLightboxUri(uri)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri }} style={styles.photoThumbImg} />
                </TouchableOpacity>
              ))}
            </View>
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

      {/* Lightbox Modal */}
      {lightboxUri && (
        <Modal
          visible={!!lightboxUri}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxUri(null)}
        >
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity
              style={styles.lightboxClose}
              onPress={() => setLightboxUri(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: lightboxUri }}
              style={styles.lightboxImg}
              resizeMode="contain"
            />
          </View>
        </Modal>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  overdueCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  doneCard: {
    borderColor: '#C9DCF0',
    backgroundColor: '#F5F7FA',
  },
  rejectedCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  unitRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 8,
  },
  equipNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginLeft: 6,
  },
  iconButtonsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  checkIconButton: {
    backgroundColor: colors.primary,
  },
  warningIconButton: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  cameraIconButton: {
    backgroundColor: '#F5F9FD',
    borderWidth: 1,
    borderColor: '#C9DCF0',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  undoIconTouch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  categorySubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  adminNoteText: {
    fontSize: 12,
    color: colors.primaryDark,
    flex: 1,
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F9FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  submittedBannerText: {
    fontSize: 12,
    color: '#1C5089',
    flex: 1,
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  doneBannerText: {
    fontSize: 12,
    color: '#15803D',
    flex: 1,
  },
  rejectedBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
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
    marginBottom: 8,
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
  photoThumbStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  photoThumbTouch: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImg: {
    width: '90%',
    height: '80%',
  },
});
