import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  fetchScheduleRules,
  fetchTaskLogs,
  upsertTaskLog,
  undoTaskLog,
  getSavedWorkerSelection,
  fetchCategories,
} from '../../lib/dataService';
import {
  formatDate,
  parseDate,
  addDays,
  getWorkWeek,
  buildDueTasks,
  computePerformance,
} from '../../utils/schedule';
import Header from '../../components/Header';
import TaskCard from '../../components/TaskCard';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import { colors, layout } from '../../theme';

export default function TodayScreen({ navigation, route }) {
  const { user } = useAuth();

  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));
  const [selection, setSelection] = useState({
    categoryId: route?.params?.categoryId || null,
    categoryName: route?.params?.categoryName || 'All Systems',
    area: route?.params?.area || 'All',
  });

  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load selection and rules
  const loadData = useCallback(async () => {
    try {
      setError(null);
      let currentSelection = selection;
      if (!currentSelection.categoryId) {
        const saved = await getSavedWorkerSelection();
        if (saved && saved.categoryId) {
          currentSelection = saved;
          setSelection(saved);
        } else {
          // If no selection yet, fetch first category
          const cats = await fetchCategories();
          if (cats.length > 0) {
            currentSelection = {
              categoryId: cats[0].id,
              categoryName: cats[0].name,
              area: 'All',
            };
            setSelection(currentSelection);
          }
        }
      }

      // Query window: 30 days ago to end of next week (covers overdue tasks + current week)
      const today = new Date();
      const pastWindowStart = formatDate(addDays(today, -30));
      const futureWindowEnd = formatDate(addDays(today, 14));

      const [loadedRules, loadedLogs] = await Promise.all([
        fetchScheduleRules({
          categoryId: currentSelection.categoryId,
          area: currentSelection.area,
        }),
        fetchTaskLogs(pastWindowStart, futureWindowEnd),
      ]);

      setRules(loadedRules);
      setLogs(loadedLogs);

      const computed = buildDueTasks(loadedRules, loadedLogs, pastWindowStart, futureWindowEnd);
      setAllTasks(computed);
    } catch (err) {
      console.warn('Error loading tasks:', err);
      setError(err.message || 'Failed to load maintenance tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selection.categoryId, selection.area]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When returning with new selection params
  useEffect(() => {
    if (route?.params?.categoryId) {
      setSelection({
        categoryId: route.params.categoryId,
        categoryName: route.params.categoryName || 'Selected System',
        area: route.params.area || 'All',
      });
    }
  }, [route?.params]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUpdateStatus = async (task, status, note) => {
    try {
      await upsertTaskLog({
        rule_id: task.rule_id,
        due_date: task.due_date,
        status,
        notes: note,
        done_by: user?.id || 'worker',
      });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update task.');
    }
  };

  const handleUndoStatus = async (task) => {
    try {
      await undoTaskLog(task.rule_id, task.due_date);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to undo task.');
    }
  };

  // Week strip calculation
  const weekInfo = getWorkWeek(currentDateStr);
  const todayStr = formatDate(new Date());

  // Overdue tasks: past due and still pending
  const overdueTasks = allTasks.filter(
    (t) => t.isOverdue && t.due_date < todayStr
  );

  // Selected date tasks
  const selectedDateTasks = allTasks.filter((t) => t.due_date === currentDateStr);

  // Group selected date tasks by group name
  const groupedTasks = selectedDateTasks.reduce((acc, t) => {
    const groupName = t.group?.name || 'General Tasks';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(t);
    return acc;
  }, {});

  const perf = computePerformance(selectedDateTasks);

  return (
    <View style={styles.screen}>
      <Header
        title="Today's Tasks"
        subtitle={`${selection.categoryName} • ${selection.area}`}
        navigation={navigation}
        rightAction={
          <TouchableOpacity
            style={styles.changeWorkBtn}
            onPress={() => navigation.navigate('ChooseWork', { isChangingWork: true })}
          >
            <Ionicons name="swap-horizontal" size={16} color={colors.white} />
            <Text style={styles.changeWorkText}>Change</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Quick Date Switcher: Yesterday / Today / Tomorrow */}
        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === formatDate(addDays(new Date(), -1)) && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(formatDate(addDays(new Date(), -1)))}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === formatDate(addDays(new Date(), -1)) && styles.quickDateTextActive,
              ]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === todayStr && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(todayStr)}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === todayStr && styles.quickDateTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickDateBtn,
              currentDateStr === formatDate(addDays(new Date(), 1)) && styles.quickDateActive,
            ]}
            onPress={() => setCurrentDateStr(formatDate(addDays(new Date(), 1)))}
          >
            <Text
              style={[
                styles.quickDateText,
                currentDateStr === formatDate(addDays(new Date(), 1)) && styles.quickDateTextActive,
              ]}
            >
              Tomorrow
            </Text>
          </TouchableOpacity>
        </View>

        {/* This Week (Mon-Sun strip) */}
        <View style={styles.weekStripContainer}>
          <Text style={styles.stripLabel}>WORK WEEK STRIP</Text>
          <View style={styles.weekStrip}>
            {weekInfo.days.map((day) => {
              const isSelected = day.date === currentDateStr;
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    day.isToday && !isSelected && styles.dayPillToday,
                  ]}
                  onPress={() => setCurrentDateStr(day.date)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayShort,
                      isSelected && styles.dayShortSelected,
                    ]}
                  >
                    {day.shortLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  {day.isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        isSelected && { backgroundColor: colors.white },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Progress Bar */}
        <ProgressBar
          completed={perf.completedCount}
          total={perf.totalCount}
          title={currentDateStr === todayStr ? 'Today\'s Progress' : `Progress for ${currentDateStr}`}
        />

        {/* Loading / Error states */}
        {loading && !refreshing ? (
          <LoadingSkeleton message="Loading today's maintenance schedule..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={loadData} />
        ) : (
          <>
            {/* OVERDUE TASKS SECTION */}
            {overdueTasks.length > 0 && (
              <View style={styles.overdueSection}>
                <View style={styles.overdueHeader}>
                  <Ionicons name="warning" size={20} color={colors.danger} />
                  <Text style={styles.overdueTitle}>
                    Overdue Tasks ({overdueTasks.length})
                  </Text>
                </View>
                <Text style={styles.overdueNotice}>
                  Past scheduled maintenance pending completion
                </Text>
                {overdueTasks.map((task) => (
                  <TaskCard
                    key={`overdue-${task.id}`}
                    task={task}
                    onUpdateStatus={handleUpdateStatus}
                    onUndoStatus={handleUndoStatus}
                    currentUserId={user?.id}
                  />
                ))}
              </View>
            )}

            {/* SCHEDULED TASKS FOR SELECTED DATE */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>
                Scheduled for {currentDateStr === todayStr ? 'Today' : currentDateStr}
              </Text>
              <Text style={styles.taskCountText}>
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>

            {selectedDateTasks.length === 0 ? (
              <EmptyState
                title="No tasks for today"
                message="All scheduled maintenance is up to date or no activities planned for this day."
                icon="checkmark-done-circle-outline"
                actionLabel="Switch System or Area"
                onAction={() => navigation.navigate('ChooseWork', { isChangingWork: true })}
              />
            ) : (
              Object.entries(groupedTasks).map(([groupName, tasksInGroup]) => (
                <View key={groupName} style={styles.groupContainer}>
                  <View style={styles.groupHeaderBar}>
                    <Ionicons name="layers-outline" size={16} color={colors.primaryDark} />
                    <Text style={styles.groupHeaderTitle}>{groupName}</Text>
                    <Text style={styles.groupHeaderCount}>
                      ({tasksInGroup.length})
                    </Text>
                  </View>
                  {tasksInGroup.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdateStatus={handleUpdateStatus}
                      onUndoStatus={handleUndoStatus}
                      currentUserId={user?.id}
                    />
                  ))}
                </View>
              ))
            )}
          </>
        )}
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
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  changeWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  changeWorkText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  quickDateRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  quickDateActive: {
    backgroundColor: colors.dark,
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickDateTextActive: {
    color: colors.white,
  },
  weekStripContainer: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  stripLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  dayPillToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  dayPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dayShortSelected: {
    color: colors.white,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  dayNumSelected: {
    color: colors.white,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  overdueSection: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  overdueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 6,
  },
  overdueNotice: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
  },
  taskCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginLeft: 6,
  },
  groupHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginLeft: 6,
  },
});

