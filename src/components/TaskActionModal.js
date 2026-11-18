import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function TaskActionModal({
  visible,
  actionType = 'done', // 'done' | 'issue' | 'skipped'
  task = null,
  onClose,
  onSubmit,
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isIssue = actionType === 'issue';
  const isDone = actionType === 'done';
  const isSkipped = actionType === 'skipped';

  const title = isDone
    ? 'Mark Task as Done'
    : isIssue
    ? 'Report Issue on Equipment'
    : 'Skip Task';

  const actionColor = isIssue
    ? colors.danger
    : isDone
    ? colors.primary
    : colors.textSecondary;

  const handleConfirm = async () => {
    if (isIssue && !note.trim()) {
      setError('Please provide a note describing the issue.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit(actionType, note.trim());
      setNote('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons
                name={
                  isDone
                    ? 'checkmark-circle'
                    : isIssue
                    ? 'alert-circle'
                    : 'close-circle'
                }
                size={22}
                color={actionColor}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={handleCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Equipment Info */}
          {task && (
            <View style={styles.infoBox}>
              <Text style={styles.equipmentName}>
                {task.equipment?.name || 'Equipment'}
              </Text>
              <Text style={styles.groupInfo}>
                {task.group?.name || ''} {task.equipment?.area ? `• ${task.equipment.area}` : ''}
              </Text>
              {task.notes ? (
                <Text style={styles.ruleNotes}>Admin Note: {task.notes}</Text>
              ) : null}
            </View>
          )}

          {/* Note Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {isIssue ? 'Issue Description (Required) *' : 'Maintenance Notes (Optional)'}
            </Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              placeholder={
                isIssue
                  ? 'E.g., Inverter error code E04, high temperature alarm...'
                  : 'Add notes about readings, cleaning or parts serviced...'
              }
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={(text) => {
                setNote(text);
                if (error) setError('');
              }}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: actionColor }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {isIssue ? 'Submit Issue' : isDone ? 'Confirm Done' : 'Confirm Skip'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.white,
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  infoBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  groupInfo: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ruleNotes: {
    fontSize: 12,
    color: colors.primaryDark,
    marginTop: 6,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.dark,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  noticeText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});

