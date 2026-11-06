import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchScheduleRules,
  fetchTaskLogs,
  updateScheduleRule,
  deleteScheduleRule,
} from '../../lib/dataService';
import {
  formatDate,
  parseDate,
  addDays,
  getMonthRange,
  getWorkWeek,
  getWorkWeekNumber,
  daysInMonth,
  getIsoWeekday,
  buildDueTasks,
} from '../../utils/schedule';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import FrequencyBadge from '../../components/FrequencyBadge';
import StatusBadge from '../../components/StatusBadge';
import { colors, layout } from '../../theme';

export default function ScheduleCalendarScreen({ navigation }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState(formatDate(new Date()));

  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Rule Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editFreq, setEditFreq] = useState('d');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editWeekday, setEditWeekday] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Load range depending on view mode
      let rangeStart, rangeEnd;
      if (viewMode === 'month') {
        const m = getMonthRange(currentDateStr);
        rangeStart = m.start;
        rangeEnd = m.end;
      } else {
        const w = getWorkWeek(currentDateStr);
        rangeStart = w.start;
        rangeEnd = w.end;
      }

      const [loadedRules, loadedLogs] = await Promise.all([
        fetchScheduleRules(),
        fetchTaskLogs(rangeStart, rangeEnd),
      ]);

      setRules(loadedRules);
      setLogs(loadedLogs);

      const computed = buildDueTasks(loadedRules, loadedLogs, rangeStart, rangeEnd);
      setTasks(computed);
    } catch (err) {
      setError(err.message || 'Failed to load schedule rules and task logs.');
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentDateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate dates
  const handlePrev = () => {
    const d = parseDate(currentDateStr);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    const newStr = formatDate(d);
    setCurrentDateStr(newStr);
    setSelectedDayStr(newStr);
  };

  const handleNext = () => {
    const d = parseDate(currentDateStr);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    const newStr = formatDate(d);
    setCurrentDateStr(newStr);
    setSelectedDayStr(newStr);
  };

  const handleToday = () => {
    const today = formatDate(new Date());
    setCurrentDateStr(today);
    setSelectedDayStr(today);
  };

  // Open edit rule
  const openEditRule = (rule) => {
    setEditingRule(rule);
    setEditFreq(rule.frequency || 'd');
    setEditStartDate(rule.start_date || '');
    setEditEndDate(rule.end_date || '');
    setEditWeekday(rule.weekday ? Number(rule.weekday) : 1);
    setEditNotes(rule.notes || '');
    setEditModalVisible(true);
  };

  const handleSaveEditRule = async () => {
    if (!editingRule) return;
    try {
      setModalSaving(true);
      await updateScheduleRule(editingRule.id, {
        frequency: editFreq,
        start_date: editStartDate,
        end_date: editEndDate.trim() ? editEndDate.trim() : null,
        weekday: editFreq === 'w' ? editWeekday : null,
        notes: editNotes.trim() ? editNotes.trim() : null,
      });
      setEditModalVisible(false);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update rule.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    const confirmed =
      typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to delete this schedule rule?')
        : true;

    if (!confirmed) return;

    try {
      await deleteScheduleRule(ruleId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete rule.');
    }
  };

  // Build Month Grid
  const renderMonthGrid = () => {
    const mRange = getMonthRange(currentDateStr);
    const d = parseDate(mRange.start);
    const firstWeekday = getIsoWeekday(d); // 1=Mon ... 7=Sun
    const totalDays = daysInMonth(mRange.year, mRange.month);

    // Map tasks by day
    const tasksByDay = new Map();
    for (const t of tasks) {
      if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
      tasksByDay.get(t.due_date).push(t);
    }

    const cells = [];
    // Blank padding cells before 1st of month
    for (let i = 1; i < firstWeekday; i++) {
      cells.push({ isBlank: true, key: `blank-${i}` });
    }

    // Actual month days
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${mRange.year}-${String(mRange.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayTasks = tasksByDay.get(dateStr) || [];
      const freqCounts = dayTasks.reduce((acc, t) => {
        acc[t.frequency] = (acc[t.frequency] || 0) + 1;
        return acc;
      }, {});

      cells.push({
        isBlank: false,
        dateStr,
        dayNum,
        dayTasks,
        freqCounts,
        isToday: dateStr === formatDate(new Date()),
        isSelected: dateStr === selectedDayStr,
        key: dateStr,
      });
    }

    return (
      <View style={styles.calendarContainer}>
        {/* Days of week header (Mon - Sun) */}
        <View style={styles.weekHeaderRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dName) => (
            <View key={dName} style={styles.weekHeaderCell}>
              <Text style={styles.weekHeaderText}>{dName}</Text>
            </View>
          ))}
        </View>

        {/* Days grid */}
        <View style={styles.gridRow}>
          {cells.map((cell) => {
            if (cell.isBlank) {
              return <View key={cell.key} style={styles.blankCell} />;
            }
            return (
              <TouchableOpacity
                key={cell.key}
                style={[
                  styles.dayCell,
                  cell.isSelected && styles.dayCellSelected,
                  cell.isToday && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDayStr(cell.dateStr)}
              >
                <View style={styles.dayCellHeader}>
                  <Text
                    style={[
                      styles.dayCellNum,
                      cell.isSelected && styles.dayCellNumSelected,
                    ]}
                  >
                    {cell.dayNum}
                  </Text>
                  {cell.dayTasks.length > 0 && (
                    <Text style={styles.dayCellCount}>
                      {cell.dayTasks.length}
                    </Text>
                  )}
                </View>

                {/* Frequency color badges in cell */}
                <View style={styles.cellBadgeRow}>
                  {Object.entries(cell.freqCounts).map(([freq, count]) => (
                    <View key={freq} style={styles.microBadge}>
                      <FrequencyBadge freq={freq} size="small" />
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Build Week View (Mon-Sun like Excel)
  const renderWeekView = () => {
    const wInfo = getWorkWeek(currentDateStr);
    const tasksByDay = new Map();
    for (const t of tasks) {
      if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
      tasksByDay.get(t.due_date).push(t);
    }

    return (
      <View style={styles.weekViewContainer}>
        <View style={styles.weekCardsRow}>
          {wInfo.days.map((day) => {
            const dayTasks = tasksByDay.get(day.date) || [];
            const isSelected = day.date === selectedDayStr;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.weekColumnCard,
                  isSelected && styles.weekColumnCardSelected,
                  day.isToday && styles.weekColumnCardToday,
                ]}
                onPress={() => setSelectedDayStr(day.date)}
              >
                <View
                  style={[
                    styles.weekColHeader,
                    isSelected && styles.weekColHeaderSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekColShort,
                      isSelected && styles.weekColShortSelected,
                    ]}
                  >
                    {day.shortLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekColDayNum,
                      isSelected && styles.weekColDayNumSelected,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                </View>

                <View style={styles.weekColBody}>
                  <Text style={styles.weekTaskCount}>
                    {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                  </Text>

                  <View style={styles.colBadges}>
                    {dayTasks.slice(0, 4).map((t) => (
                      <View key={t.id} style={{ marginBottom: 4 }}>
                        <FrequencyBadge freq={t.frequency} size="small" />
                      </View>
                    ))}
                    {dayTasks.length > 4 && (
                      <Text style={styles.moreCount}>+{dayTasks.length - 4} more</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Tasks for the selected day
  const selectedDayTasks = tasks.filter((t) => t.due_date === selectedDayStr);
  const weekNum = getWorkWeekNumber(currentDateStr);
  const monthInfo = getMonthRange(currentDateStr);

  return (
    <View style={styles.screen}>
      <Header
        title="Schedule Calendar"
        subtitle={`Week ${weekNum} • ${monthInfo.monthName} ${monthInfo.year}`}
        navigation={navigation}
        rightAction={
          <TouchableOpacity
            style={styles.newRuleBtn}
            onPress={() => navigation.navigate('SetSchedule')}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.newRuleText}>Add Rule</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Inline Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Navigation & Controls Bar */}
        <View style={styles.controlsBar}>
          <View style={styles.navButtonGroup}>
            <TouchableOpacity style={styles.iconNavBtn} onPress={handlePrev}>
              <Ionicons name="chevron-back" size={20} color={colors.dark} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.todayBtn} onPress={handleToday}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconNavBtn} onPress={handleNext}>
              <Ionicons name="chevron-forward" size={20} color={colors.dark} />
            </TouchableOpacity>

            <Text style={styles.currentRangeTitle}>
              {viewMode === 'month'
                ? `${monthInfo.monthName} ${monthInfo.year}`
                : `Work Week No. ${weekNum} (${getWorkWeek(currentDateStr).start} to ${getWorkWeek(currentDateStr).end})`}
            </Text>
          </View>

          {/* Toggle Week / Month */}
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
              onPress={() => setViewMode('week')}
            >
              <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
              onPress={() => setViewMode('month')}
            >
              <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>
                Month
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar View */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : viewMode === 'month' ? (
          renderMonthGrid()
        ) : (
          renderWeekView()
        )}

        {/* Selected Day Task List */}
        <View style={styles.dayTasksSection}>
          <View style={styles.dayTasksHeader}>
            <Text style={styles.dayTasksHeading}>
              Tasks Scheduled for {selectedDayStr}
            </Text>
            <Text style={styles.dayTasksSub}>
              {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'task' : 'tasks'}
            </Text>
          </View>

          {selectedDayTasks.length === 0 ? (
            <View style={styles.emptyDayBox}>
              <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyDayText}>No tasks scheduled for {selectedDayStr}</Text>
            </View>
          ) : (
            selectedDayTasks.map((t) => (
              <View key={t.id} style={styles.ruleCard}>
                <View style={styles.ruleCardTop}>
                  <View style={styles.badgeLine}>
                    <FrequencyBadge freq={t.frequency} size="medium" />
                    <View style={styles.ruleNameBox}>
                      <Text style={styles.ruleEqName}>{t.equipment?.name || 'Equipment'}</Text>
                      <Text style={styles.ruleGroupName}>
                        {t.category?.code}. {t.category?.name} • {t.group?.name}
                        {t.equipment?.area ? ` (${t.equipment.area})` : ''}
                      </Text>
                    </View>
                  </View>
                  <StatusBadge status={t.status} />
                </View>

                {t.notes ? (
                  <Text style={styles.ruleCardNotes}>Admin Note: {t.notes}</Text>
                ) : null}

                {/* Edit & Delete actions for Admin */}
                <View style={styles.ruleActionsRow}>
                  <TouchableOpacity
                    style={styles.ruleActionEdit}
                    onPress={() => openEditRule(t.rule)}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                    <Text style={styles.ruleActionEditText}>Edit Rule</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.ruleActionDelete}
                    onPress={() => handleDeleteRule(t.rule_id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={styles.ruleActionDeleteText}>Delete Rule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Dev Diagnostics Line */}
        {__DEV__ && (
          <View style={styles.devDiagnosticsBar}>
            <Text style={styles.devDiagnosticsText}>
              [DEV DIAGNOSTICS] Rules: {rules.length} | Active Equipment with Rules: {new Set(rules.map((r) => r.equipment_id)).size} | Role: {user?.role || 'none'} | Date: {selectedDayStr}
            </Text>
          </View>
        )}

        {/* Edit Rule Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Schedule Rule</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={styles.modalFieldLabel}>Frequency Code</Text>
                <View style={styles.modalFreqRow}>
                  {['d', 'w', 'M', 'Q', 'SA'].map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.modalFreqBtn, editFreq === f && styles.modalFreqBtnSelected]}
                      onPress={() => setEditFreq(f)}
                    >
                      <FrequencyBadge freq={f} size="small" />
                    </TouchableOpacity>
                  ))}
                </View>

                {editFreq === 'w' && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.modalFieldLabel}>Weekday (1=Mon ... 7=Sun)</Text>
                    <View style={styles.modalFreqRow}>
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.modalFreqBtn,
                            editWeekday === num && styles.modalFreqBtnSelected,
                          ]}
                          onPress={() => setEditWeekday(num)}
                        >
                          <Text
                            style={{
                              fontWeight: '700',
                              color: editWeekday === num ? colors.white : colors.dark,
                            }}
                          >
                            {num}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  Start Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editStartDate}
                  onChangeText={setEditStartDate}
                />

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  End Date (YYYY-MM-DD or blank)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEndDate}
                  onChangeText={setEditEndDate}
                  placeholder="Optional"
                />

                <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                  Notes
                </Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60 }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveEditRule}
                    disabled={modalSaving}
                  >
                    {modalSaving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  devDiagnosticsBar: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  devDiagnosticsText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  newRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newRuleText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  navButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  currentRangeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginLeft: 6,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.dark,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  calendarContainer: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  blankCell: {
    width: '14.28%',
    height: 70,
  },
  dayCell: {
    width: '14.28%',
    height: 70,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    padding: 4,
    justifyContent: 'flex-start',
  },
  dayCellSelected: {
    backgroundColor: colors.primaryVeryLight,
    borderColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  dayCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
  },
  dayCellNumSelected: {
    color: colors.primaryDark,
  },
  dayCellCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  cellBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  microBadge: {
    marginRight: 2,
    marginBottom: 2,
  },
  weekViewContainer: {
    marginBottom: 16,
  },
  weekCardsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  weekColumnCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  weekColumnCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekColumnCardToday: {
    borderColor: colors.primaryDark,
  },
  weekColHeader: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekColHeaderSelected: {
    backgroundColor: colors.primary,
  },
  weekColShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  weekColShortSelected: {
    color: colors.white,
  },
  weekColDayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  weekColDayNumSelected: {
    color: colors.white,
  },
  weekColBody: {
    padding: 8,
    alignItems: 'center',
    minHeight: 80,
  },
  weekTaskCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  colBadges: {
    alignItems: 'center',
  },
  moreCount: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  dayTasksSection: {
    marginTop: 8,
  },
  dayTasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTasksHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
  },
  dayTasksSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyDayBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyDayText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  ruleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  ruleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ruleNameBox: {
    marginLeft: 10,
    flex: 1,
  },
  ruleEqName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  ruleGroupName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ruleCardNotes: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primaryVeryLight,
    padding: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  ruleActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    marginTop: 4,
  },
  ruleActionEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primaryVeryLight,
  },
  ruleActionEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginLeft: 4,
  },
  ruleActionDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  ruleActionDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    width: '100%',
    maxWidth: 450,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.dark,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  modalFreqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalFreqBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFreqBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.dark,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    color: colors.white,
    fontWeight: '700',
  },
});

