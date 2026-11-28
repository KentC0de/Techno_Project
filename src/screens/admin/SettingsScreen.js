import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { logActivity } from '../../lib/activityLog';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAction } from '../../hooks/useAction';
import { colors } from '../../theme';

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '#E4E4E7' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#F59E0B' };
  if (score === 3) return { score: 3, label: 'Good', color: colors.primary };
  return { score: 4, label: 'Strong', color: '#10B981' };
}

export default function SettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { settings, updateSettings } = useAppSettings();
  const { isDesktop } = useBreakpoint();
  const runAction = useAction();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Maintenance & Support Contact state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintError, setMaintError] = useState('');
  const [maintSuccess, setMaintSuccess] = useState('');

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setMaintenanceMode(!!settings.maintenance_mode);
      setMaintenanceMsg(settings.maintenance_message || '');
      setSupportContact(settings.support_contact || '');
    }
  }, [settings]);

  // Handle password change
  const handleChangePassword = async () => {
    setPassError('');
    setPassSuccess('');

    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPassError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setPassError('New password must be different from current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    try {
      setPassLoading(true);

      // Re-authenticate current password
      const email = user?.email;
      if (!email) {
        throw new Error('User email not found. Please log in again.');
      }

      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthErr) {
        throw new Error('Current password is incorrect.');
      }

      // Update password with confirmation and loader
      runAction({
        confirm: {
          title: 'Update Password?',
          message: 'Are you sure you want to change your administrator account password?',
          confirmText: 'Change Password',
          cancelText: 'Cancel',
          tone: 'default',
          icon: 'key-outline',
        },
        loading: 'Updating password...',
        action: async () => {
          const { error: updateErr } = await supabase.auth.updateUser({
            password: newPassword,
          });

          if (updateErr) {
            throw updateErr;
          }

          // Audit log password change
          await logActivity('auth.password_changed', 'user', user.id, {
            summary: `${user.full_name || 'Admin'} changed account password`,
          });
        },
        success: 'Password updated successfully',
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      });
    } catch (err) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setPassLoading(false);
    }
  };

  // Handle maintenance switch toggle
  const handleToggleMaintenance = (nextVal) => {
    if (nextVal) {
      runAction({
        confirm: {
          title: 'Turn ON Maintenance Mode?',
          message:
            'Field workers will be logged out and blocked from using the mobile app until you turn it off. Admins can still use this web console.',
          confirmText: 'Turn ON Maintenance',
          cancelText: 'Cancel',
          tone: 'danger',
          icon: 'warning-outline',
        },
        action: async () => {
          setMaintenanceMode(true);
        },
      });
    } else {
      setMaintenanceMode(false);
    }
  };

  // Handle save maintenance settings
  const handleSaveSettings = () => {
    runAction({
      confirm: {
        title: 'Save Application Settings?',
        message: `Save updated plant maintenance status (${maintenanceMode ? 'ENABLED' : 'DISABLED'}) and support contact info?`,
        confirmText: 'Save Settings',
        cancelText: 'Cancel',
        tone: 'default',
        icon: 'cog-outline',
      },
      loading: 'Saving application settings...',
      action: async () => {
        await updateSettings(
          {
            maintenance_mode: maintenanceMode,
            maintenance_message: maintenanceMsg.trim(),
            support_contact: supportContact.trim(),
          },
          user?.full_name || 'Admin'
        );
      },
      success: 'Plant maintenance settings saved successfully',
    });
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <View style={styles.screen}>
      <Header
        title="System Settings"
        subtitle="Administrator security, plant maintenance mode, and support contacts"
        navigation={navigation}
      />

      <PageContainer>
        <View style={[styles.grid, isDesktop ? styles.gridDesktop : styles.gridMobile]}>
          {/* Card 1: Account & Change Password */}
          <View style={[styles.card, isDesktop && styles.cardHalf]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="key-outline" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Account Security</Text>
                  <Text style={styles.cardSub}>Change administrator login password</Text>
                </View>
              </View>
            </View>

            {/* Admin identity pill */}
            <View style={styles.identityBox}>
              <Text style={styles.identityLabel}>Signed in as:</Text>
              <Text style={styles.identityName}>{user?.full_name || 'Administrator'}</Text>
              <Text style={styles.identityEmail}>{user?.email}</Text>
            </View>

            {passError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{passError}</Text>
              </View>
            ) : null}

            {passSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.successText}>{passSuccess}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showCurrent}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowCurrent(!showCurrent)}
                >
                  <Ionicons
                    name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>New Password (min 8 characters)</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showNew}
                  placeholder="Enter new strong password"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNew(!showNew)}
                >
                  <Ionicons
                    name={showNew ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Strength meter */}
              {newPassword ? (
                <View style={styles.strengthBox}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((step) => (
                      <View
                        key={step}
                        style={[
                          styles.strengthBar,
                          step <= strength.score && { backgroundColor: strength.color },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showConfirm}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, passLoading && styles.btnDisabled]}
              onPress={handleChangePassword}
              disabled={passLoading}
              activeOpacity={0.85}
            >
              {passLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.white} />
                  <Text style={styles.saveBtnText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Card 2: Plant Maintenance Mode & Support Contact */}
          <View style={[styles.card, isDesktop && styles.cardHalf]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="construct-outline" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Plant Maintenance Mode</Text>
                  <Text style={styles.cardSub}>Control worker app access during maintenance</Text>
                </View>
              </View>
            </View>

            {maintError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{maintError}</Text>
              </View>
            ) : null}

            {maintSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.successText}>{maintSuccess}</Text>
              </View>
            ) : null}

            {/* Toggle Row */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.statusBadgeRow}>
                  <Text style={styles.toggleRowTitle}>Maintenance Mode</Text>
                  <View
                    style={[
                      styles.statusPill,
                      maintenanceMode ? styles.statusPillOn : styles.statusPillOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        maintenanceMode ? styles.statusTextOn : styles.statusTextOff,
                      ]}
                    >
                      {maintenanceMode ? 'ENABLED (LOCKED)' : 'OFF (NORMAL)'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.toggleRowSub}>
                  When active, field workers on mobile are logged out and see the maintenance screen.
                </Text>
              </View>
              <Switch
                value={maintenanceMode}
                onValueChange={handleToggleMaintenance}
                trackColor={{ false: '#D4D4D8', true: '#2563A6' }}
                thumbColor={colors.white}
              />
            </View>

            {/* Broadcast Message */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Maintenance Message for Workers</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="The app is under maintenance. Please come back later."
                placeholderTextColor={colors.textMuted}
                value={maintenanceMsg}
                onChangeText={setMaintenanceMsg}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Support contact info */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                Support Contact (Shown to disabled users & during maintenance)
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginLeft: 10 }}
                />
                <TextInput
                  style={[styles.input, { paddingLeft: 6 }]}
                  placeholder="e.g. admin@solarpm.com or +1 (555) 019-2834"
                  placeholderTextColor={colors.textMuted}
                  value={supportContact}
                  onChangeText={setSupportContact}
                />
              </View>
            </View>

            {/* Last changed info */}
            {settings?.updated_at ? (
              <View style={styles.auditInfoBox}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.auditInfoText}>
                  Last modified by {settings.updated_by || 'Admin'} at{' '}
                  {new Date(settings.updated_at).toLocaleString()}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, maintLoading && styles.btnDisabled]}
              onPress={handleSaveSettings}
              disabled={maintLoading}
              activeOpacity={0.85}
            >
              {maintLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save Maintenance Settings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  grid: {
    gap: 20,
  },
  gridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gridMobile: {
    flexDirection: 'column',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  cardHalf: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textDark,
  },
  cardSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  identityBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  identityName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 2,
  },
  identityEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textDark,
  },
  textArea: {
    minHeight: 74,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  strengthBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E7',
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  toggleRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  toggleRowSub: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  statusPillOn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusPillOff: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTextOn: {
    color: '#DC2626',
  },
  statusTextOff: {
    color: '#059669',
  },
  auditInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  auditInfoText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    marginTop: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  successText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    flex: 1,
  },
});

