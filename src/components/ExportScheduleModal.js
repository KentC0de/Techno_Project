import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
  fetchAllScheduleRules,
  fetchTaskLogs,
  fetchProfiles,
} from '../lib/dataService';
import {
  formatDate,
  parseDate,
  getWorkWeek,
  getWorkWeekNumber,
  getMonthRange,
  getIsoWeekday,
  addDays,
} from '../utils/schedule';
import { logActivity } from '../lib/activityLog';
import { colors } from '../theme';

const STORAGE_KEY_SITE_NAME = '@pm_export_site_name';
const STORAGE_KEY_REVISION = '@pm_export_revision';

export default function ExportScheduleModal({ visible, onClose, initialPeriodType = 'month' }) {
  // Config state
  const [periodMode, setPeriodMode] = useState('this_month'); // 'this_month' | 'pick_month' | 'week_range'
  const [selectedMonthDate, setSelectedMonthDate] = useState(formatDate(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromWeek, setFromWeek] = useState(getWorkWeekNumber(formatDate(new Date())));
  const [toWeek, setToWeek] = useState(Math.min(52, getWorkWeekNumber(formatDate(new Date())) + 4));
  const [selectedSystemCode, setSelectedSystemCode] = useState('ALL');

  // Text inputs
  const [siteName, setSiteName] = useState('');
  const [revisionLabel, setRevisionLabel] = useState('REV A');
  const [monthLabel, setMonthLabel] = useState('');

  // Options
  const [showPlanned, setShowPlanned] = useState(true);
  const [addNotes, setAddNotes] = useState(true);

  // Status
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Load saved preferences
  useEffect(() => {
    async function loadSaved() {
      try {
        const savedSite = await AsyncStorage.getItem(STORAGE_KEY_SITE_NAME);
        if (savedSite) setSiteName(savedSite);
        const savedRev = await AsyncStorage.getItem(STORAGE_KEY_REVISION);
        if (savedRev) setRevisionLabel(savedRev);
      } catch (_) {}
    }
    loadSaved();
  }, []);

  // Update monthLabel automatically when month or range changes
  useEffect(() => {
    if (periodMode === 'this_month') {
      const m = getMonthRange(formatDate(new Date()));
      setMonthLabel(m.monthName.toUpperCase());
    } else if (periodMode === 'pick_month') {
      const m = getMonthRange(selectedMonthDate);
      setMonthLabel(m.monthName.toUpperCase());
    } else {
      // For week range, compute month of start week
      const jan4 = new Date(year, 0, 4);
      const jan4IsoWeekday = getIsoWeekday(jan4);
      const monW1 = addDays(jan4, -(jan4IsoWeekday - 1));
      const monday = addDays(monW1, (fromWeek - 1) * 7);
      const m = getMonthRange(formatDate(monday));
      setMonthLabel(m.monthName.toUpperCase());
    }
  }, [periodMode, selectedMonthDate, fromWeek, year]);

  // Compute actual date range [rangeStart, rangeEnd]
  const { exportFromWeek, exportToWeek, exportYear, rangeStart, rangeEnd } = useMemo(() => {
    if (periodMode === 'this_month' || periodMode === 'pick_month') {
      const targetDate = periodMode === 'this_month' ? formatDate(new Date()) : selectedMonthDate;
      const m = getMonthRange(targetDate);
      const fW = getWorkWeekNumber(m.start);
      const tW = getWorkWeekNumber(m.end);
      const yr = m.year;
      // Actual start is Monday of fW, actual end is Sunday of tW
      const wStart = getWorkWeek(m.start).start;
      const wEnd = getWorkWeek(m.end).end;
      return {
        exportFromWeek: fW,
        exportToWeek: tW,
        exportYear: yr,
        rangeStart: wStart,
        rangeEnd: wEnd,
      };
    } else {
      const jan4 = new Date(year, 0, 4);
      const jan4IsoWeekday = getIsoWeekday(jan4);
      const monW1 = addDays(jan4, -(jan4IsoWeekday - 1));
      const monday = addDays(monW1, (fromWeek - 1) * 7);
      const sunday = addDays(monW1, (toWeek - 1) * 7 + 6);
      return {
        exportFromWeek: fromWeek,
        exportToWeek: toWeek,
        exportYear: year,
        rangeStart: formatDate(monday),
        rangeEnd: formatDate(sunday),
      };
    }
  }, [periodMode, selectedMonthDate, fromWeek, toWeek, year]);

  // Query Data
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
    enabled: visible,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => fetchGroups(),
    staleTime: 10 * 60 * 1000,
    enabled: visible,
  });

  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => fetchEquipment(),
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  });

  const { data: scheduleRules = [] } = useQuery({
    queryKey: ['schedule_rules'],
    queryFn: () => fetchAllScheduleRules(),
    staleTime: 60 * 1000,
    enabled: visible,
  });

  const { data: taskLogs = [] } = useQuery({
    queryKey: ['task_logs', rangeStart, rangeEnd],
    queryFn: () => fetchTaskLogs(rangeStart, rangeEnd),
    staleTime: 30 * 1000,
    enabled: visible && !!rangeStart && !!rangeEnd,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  });

  // Live Summary calculation
  const summary = useMemo(() => {
    const totalWeeks = Math.max(1, exportToWeek - exportFromWeek + 1);

    // Filter equipment by system
    const matchingCats = categories.filter((c) => selectedSystemCode === 'ALL' || c.code === selectedSystemCode);
    const matchingCatIds = new Set(matchingCats.map((c) => c.id));
    const matchingGroupIds = new Set(groups.filter((g) => matchingCatIds.has(g.category_id)).map((g) => g.id));
    const includedEquipment = equipmentList.filter((e) => matchingGroupIds.has(e.group_id) && e.is_active !== false);

    const eqIdsSet = new Set(includedEquipment.map((e) => e.id));
    const relevantRules = scheduleRules.filter((r) => eqIdsSet.has(r.equipment_id));

    // Fast count of due and done
    let totalDue = 0;
    let totalDone = 0;

    const logMap = new Map();
    taskLogs.forEach((l) => logMap.set(`${l.rule_id}_${l.due_date}`, l));

    // Loop through each week and each day
    const jan4 = new Date(exportYear, 0, 4);
    const jan4IsoWeekday = getIsoWeekday(jan4);
    const monW1 = addDays(jan4, -(jan4IsoWeekday - 1));

    for (let w = exportFromWeek; w <= exportToWeek; w++) {
      const wMonday = addDays(monW1, (w - 1) * 7);
      for (let d = 0; d < 7; d++) {
        const curDate = addDays(wMonday, d);
        const curDateStr = formatDate(curDate);
        const curWd = d + 1;

        relevantRules.forEach((rule) => {
          const freq = rule.frequency;
          let isDue = false;
          if (curDateStr >= rule.start_date && (!rule.end_date || curDateStr <= rule.end_date)) {
            if (freq === 'd') isDue = true;
            else if (freq === 'w') {
              const targetWd = rule.weekday ? Number(rule.weekday) : getIsoWeekday(parseDate(rule.start_date));
              if (curWd === targetWd) isDue = true;
            } else if (freq === 'M') {
              const sDay = parseDate(rule.start_date).getDate();
              const lastD = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0).getDate();
              if (curDate.getDate() === Math.min(sDay, lastD)) isDue = true;
            } else if (freq === 'Q' || freq === 'SA') {
              const step = freq === 'Q' ? 3 : 6;
              const sDate = parseDate(rule.start_date);
              const mDiff = (curDate.getFullYear() - sDate.getFullYear()) * 12 + (curDate.getMonth() - sDate.getMonth());
              if (mDiff >= 0 && mDiff % step === 0) {
                const lastD = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0).getDate();
                if (curDate.getDate() === Math.min(sDate.getDate(), lastD)) isDue = true;
              }
            }
          }

          if (isDue) {
            totalDue++;
            const log = logMap.get(`${rule.id}_${curDateStr}`);
            if (log?.status === 'done') totalDone++;
          }
        });
      }
    }

    const pct = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;
    return {
      weeks: totalWeeks,
      rows: includedEquipment.length,
      due: totalDue,
      done: totalDone,
      rate: pct,
    };
  }, [
    exportFromWeek,
    exportToWeek,
    exportYear,
    categories,
    groups,
    equipmentList,
    scheduleRules,
    taskLogs,
    selectedSystemCode,
  ]);

  const handleGenerate = async () => {
    if (Platform.OS !== 'web') {
      setErrorMessage('Export to Excel is only available in web browsers.');
      return;
    }

    try {
      setExporting(true);
      setErrorMessage('');
      setSuccessToast('');

      // Persist preferences in localStorage
      if (siteName.trim()) {
        await AsyncStorage.setItem(STORAGE_KEY_SITE_NAME, siteName.trim());
      }
      if (revisionLabel.trim()) {
        await AsyncStorage.setItem(STORAGE_KEY_REVISION, revisionLabel.trim());
      }

      // Dynamic import of web generator
      const { generateMasterScheduleWorkbook, downloadWorkbook } = await import('../utils/exportSchedule.web');

      const profileMap = new Map();
      profiles.forEach((p) => {
        profileMap.set(p.id, p.full_name || p.email || 'Technician');
      });

      const wb = await generateMasterScheduleWorkbook({
        categories,
        groups,
        equipmentList,
        scheduleRules,
        taskLogs,
        profileMap,
        fromWeek: exportFromWeek,
        toWeek: exportToWeek,
        year: exportYear,
        monthLabel: monthLabel.trim() || 'MONTH',
        siteName: siteName.trim(),
        revisionLabel: revisionLabel.trim() || 'REV A',
        selectedSystemCode,
        showPlanned,
        addNotes,
      });

      const yyyyMm = rangeStart ? rangeStart.substring(0, 7) : formatDate(new Date()).substring(0, 7);
      const filename = `Master_Maintenance_Schedule_${yyyyMm}_WW${exportFromWeek}-${exportToWeek}.xlsx`;

      await downloadWorkbook(wb, filename);

      // Log activity (fire-and-forget)
      logActivity('export.excel', 'schedule', null, {
        filename,
        weeks: `${exportFromWeek}-${exportToWeek}`,
        system: selectedSystemCode,
        totalRows: summary.rows,
        rate: `${summary.rate}%`,
      });

      setSuccessToast('Excel downloaded successfully!');
      setTimeout(() => {
        setSuccessToast('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('[ExportScheduleModal] Export failed:', err);
      setErrorMessage(err.message || 'Failed to generate Excel file.');
    } finally {
      setExporting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Export Schedule to Excel</Text>
                <Text style={styles.modalSub}>
                  Generates an exact copy of the Master Maintenance Schedule template
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={exporting}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Feedback Messages */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successToast ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={styles.successText}>{successToast}</Text>
              </View>
            ) : null}

            {/* 1. Period Selector */}
            <Text style={styles.sectionHeading}>1. Export Period</Text>
            <View style={styles.pillRow}>
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'pick_month', label: 'Pick a Month' },
                { id: 'week_range', label: 'Work-Week Range' },
              ].map((p) => {
                const active = periodMode === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setPeriodMode(p.id)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {periodMode === 'pick_month' && (
              <View style={styles.fieldBox}>
                <Text style={styles.inputLabel}>Select Month (YYYY-MM-01)</Text>
                <TextInput
                  style={styles.textInput}
                  value={selectedMonthDate}
                  onChangeText={setSelectedMonthDate}
                  placeholder="2026-11-01"
                />
              </View>
            )}

            {periodMode === 'week_range' && (
              <View style={styles.rangeRow}>
                <View style={styles.rangeCol}>
                  <Text style={styles.inputLabel}>Year</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(year)}
                    onChangeText={(v) => setYear(Number(v) || new Date().getFullYear())}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rangeCol}>
                  <Text style={styles.inputLabel}>From Week</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(fromWeek)}
                    onChangeText={(v) => setFromWeek(Number(v) || 1)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rangeCol}>
                  <Text style={styles.inputLabel}>To Week</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(toWeek)}
                    onChangeText={(v) => setToWeek(Number(v) || 52)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            {/* 2. Systems to Include */}
            <Text style={styles.sectionHeading}>2. Systems to Include</Text>
            <View style={styles.pillRow}>
              {[
                { code: 'ALL', label: 'All Systems' },
                { code: 'A', label: 'A: Inverter Station Area' },
                { code: 'B', label: 'B: PV Field Area' },
                { code: 'C', label: 'C: MV & LV System' },
                { code: 'D', label: 'D: Other System' },
              ].map((s) => {
                const active = selectedSystemCode === s.code;
                return (
                  <TouchableOpacity
                    key={s.code}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSelectedSystemCode(s.code)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Text Header Fields */}
            <Text style={styles.sectionHeading}>3. Report Details</Text>
            <View style={styles.fieldGrid}>
              <View style={styles.fieldCol}>
                <Text style={styles.inputLabel}>Site Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={siteName}
                  onChangeText={setSiteName}
                  placeholder="e.g. 50MW Solar Plant - Area A"
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.inputLabel}>Revision Label</Text>
                <TextInput
                  style={styles.textInput}
                  value={revisionLabel}
                  onChangeText={setRevisionLabel}
                  placeholder="REV A"
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.inputLabel}>Month Header Label</Text>
                <TextInput
                  style={styles.textInput}
                  value={monthLabel}
                  onChangeText={setMonthLabel}
                  placeholder="NOVEMBER"
                />
              </View>
            </View>

            {/* 4. Formatting Checkboxes */}
            <Text style={styles.sectionHeading}>4. Options</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setShowPlanned(!showPlanned)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPlanned ? 'checkbox' : 'square-outline'}
                size={20}
                color={showPlanned ? colors.primary : colors.textMuted}
              />
              <Text style={styles.checkboxLabel}>
                Show planned frequency markers in future/pending cells (d, w, M, Q, SA)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAddNotes(!addNotes)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={addNotes ? 'checkbox' : 'square-outline'}
                size={20}
                color={addNotes ? colors.primary : colors.textMuted}
              />
              <Text style={styles.checkboxLabel}>
                Add notes to completed cells (Technician name, timestamp, and remark)
              </Text>
            </TouchableOpacity>

            {/* Live Summary Callout */}
            <View style={styles.summaryCallout}>
              <Ionicons name="stats-chart" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>
                {`${summary.weeks} work week${summary.weeks === 1 ? '' : 's'} • ${summary.rows} rows • ${summary.done} done / ${summary.due} due (${summary.rate}%)`}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={exporting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              disabled={exporting}
              activeOpacity={0.85}
            >
              {exporting ? (
                <>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={[styles.generateBtnText, { marginLeft: 8 }]}>Generating...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.generateBtnText}>Generate Excel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.dark,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
  },
  pillTextActive: {
    color: colors.white,
  },
  fieldBox: {
    marginTop: 6,
    marginBottom: 6,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  fieldCol: {
    flex: 1,
    minWidth: 160,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  rangeCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.dark,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    flex: 1,
  },
  summaryCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  successText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: '#FAFAFA',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 140,
  },
  generateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
});

