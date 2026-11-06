import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchCategories,
  fetchScheduleRules,
  fetchTaskLogs,
} from '../../lib/dataService';
import {
  formatDate,
  parseDate,
  getMonthRange,
  getWorkWeek,
  getWorkWeekNumber,
  buildDueTasks,
  computePerformance,
} from '../../utils/schedule';
import Header from '../../components/Header';
import StatusBadge from '../../components/StatusBadge';
import FrequencyBadge from '../../components/FrequencyBadge';
import { colors, layout } from '../../theme';

export default function PerformanceScreen({ navigation }) {
  const [periodType, setPeriodType] = useState('week'); // 'week' | 'month'
  const [currentDateStr, setCurrentDateStr] = useState(formatDate(new Date()));

  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let rangeStart, rangeEnd;
      if (periodType === 'month') {
        const m = getMonthRange(currentDateStr);
        rangeStart = m.start;
        rangeEnd = m.end;
      } else {
        const w = getWorkWeek(currentDateStr);
        rangeStart = w.start;
        rangeEnd = w.end;
      }

      const [cats, rules, logs] = await Promise.all([
        fetchCategories(),
        fetchScheduleRules(),
        fetchTaskLogs(rangeStart, rangeEnd),
      ]);

      setCategories(cats);
      const computed = buildDueTasks(rules, logs, rangeStart, rangeEnd);
      setTasks(computed);
    } catch (err) {
      console.warn('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  }, [periodType, currentDateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall performance
  const overallPerf = computePerformance(tasks);

  // Group breakdown by System
  const systemBreakdowns = categories.map((cat) => {
    const catTasks = tasks.filter((t) => t.category?.id === cat.id);
    const catPerf = computePerformance(catTasks);

    // If PV Field Area (Cat B), also breakdown by Area 1, 2, 3
    let areaBreakdown = null;
    if (cat.code === 'B') {
      areaBreakdown = ['Area 1', 'Area 2', 'Area 3'].map((areaName) => {
        const areaTasks = catTasks.filter((t) => t.equipment?.area === areaName);
        return {
          areaName,
          ...computePerformance(areaTasks),
        };
      });
    }

    return {
      cat,
      ...catPerf,
      areaBreakdown,
    };
  });

  // Daily performance for simple bar chart
  const weekInfo = getWorkWeek(currentDateStr);
  const dailyBarData = weekInfo.days.map((day) => {
    const dayTasks = tasks.filter((t) => t.due_date === day.date);
    const p = computePerformance(dayTasks);
    return {
      label: day.shortLabel,
      date: day.date,
      rate: p.rate,
      total: p.totalCount,
      completed: p.completedCount,
    };
  });

  // Overdue and Issue tasks lists
  const issueTasks = tasks.filter((t) => t.status === 'issue');
  const overdueTasks = tasks.filter((t) => t.isOverdue);

  const weekNum = getWorkWeekNumber(currentDateStr);
  const monthInfo = getMonthRange(currentDateStr);

  return (
    <View style={styles.screen}>
      <Header
        title="Performance Report"
        subtitle="% Performance to Maintenance Schedule"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Period Selector Bar */}
        <View style={styles.periodBar}>
          <View style={styles.periodToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, periodType === 'week' && styles.toggleBtnActive]}
              onPress={() => setPeriodType('week')}
            >
              <Text style={[styles.toggleText, periodType === 'week' && styles.toggleTextActive]}>
                Work Week No. {weekNum}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, periodType === 'month' && styles.toggleBtnActive]}
              onPress={() => setPeriodType('month')}
            >
              <Text style={[styles.toggleText, periodType === 'month' && styles.toggleTextActive]}>
                {monthInfo.monthName} {monthInfo.year}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {/* Top Key Metrics Banner */}
            <View style={styles.metricsGrid}>
              {/* Highlight Performance % */}
              <View style={[styles.metricCard, styles.metricCardPrimary]}>
                <Text style={styles.primaryMetricLabel}>% PERFORMANCE TO SCHEDULE</Text>
                <Text style={styles.primaryMetricVal}>{overallPerf.rate}%</Text>
                <Text style={styles.primaryMetricSub}>
                  {overallPerf.completedCount} of {overallPerf.totalCount} tasks completed
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Ionicons name="alert-circle" size={24} color={colors.danger} />
                <Text style={styles.metricVal}>{issueTasks.length}</Text>
                <Text style={styles.metricLabel}>Issues Reported</Text>
              </View>

              <View style={styles.metricCard}>
                <Ionicons name="time" size={24} color={colors.warning} />
                <Text style={styles.metricVal}>{overdueTasks.length}</Text>
                <Text style={styles.metricLabel}>Overdue Tasks</Text>
              </View>

              <View style={styles.metricCard}>
                <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                <Text style={styles.metricVal}>{overallPerf.skippedCount}</Text>
                <Text style={styles.metricLabel}>Skipped Tasks</Text>
              </View>
            </View>

            {/* Simple Bar Chart for Week Performance */}
            {periodType === 'week' && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Daily Schedule Performance (% Completion)</Text>
                <View style={styles.barContainer}>
                  {dailyBarData.map((bar) => (
                    <View key={bar.label} style={styles.barCol}>
                      <Text style={styles.barValue}>{bar.total > 0 ? `${bar.rate}%` : '-'}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${bar.rate}%`,
                              backgroundColor:
                                bar.rate >= 80 ? colors.primary : bar.rate > 0 ? colors.primaryLight : colors.border,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{bar.label}</Text>
                      <Text style={styles.barSubCount}>{bar.completed}/{bar.total}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Performance Table by System and Area */}
            <View style={styles.tableCard}>
              <Text style={styles.tableTitle}>Schedule Performance by System & Area</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { flex: 2 }]}>System / Area</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Due</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Done</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Issue</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>% Perf</Text>
                </View>

                {/* Rows */}
                {systemBreakdowns.map((item) => (
                  <React.Fragment key={item.cat.id}>
                    <View style={styles.tableRowMain}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.systemMainText}>
                          {item.cat.code}. {item.cat.name}
                        </Text>
                      </View>
                      <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>
                        {item.totalCount}
                      </Text>
                      <Text style={[styles.td, { flex: 1, textAlign: 'center', fontWeight: '700', color: colors.primaryDark }]}>
                        {item.completedCount}
                      </Text>
                      <Text style={[styles.td, { flex: 1, textAlign: 'center', color: item.issueCount > 0 ? colors.danger : colors.textSecondary }]}>
                        {item.issueCount}
                      </Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={[styles.rateTag, item.rate >= 80 && styles.rateTagHigh]}>
                          <Text style={[styles.rateText, item.rate >= 80 && styles.rateTextHigh]}>
                            {item.rate}%
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Area rows if PV Field Area */}
                    {item.areaBreakdown?.map((area) => (
                      <View key={area.areaName} style={styles.tableRowSub}>
                        <Text style={[styles.areaSubText, { flex: 2 }]}>
                          ↳ {area.areaName}
                        </Text>
                        <Text style={[styles.tdSub, { flex: 1, textAlign: 'center' }]}>
                          {area.totalCount}
                        </Text>
                        <Text style={[styles.tdSub, { flex: 1, textAlign: 'center' }]}>
                          {area.completedCount}
                        </Text>
                        <Text style={[styles.tdSub, { flex: 1, textAlign: 'center', color: area.issueCount > 0 ? colors.danger : colors.textMuted }]}>
                          {area.issueCount}
                        </Text>
                        <Text style={[styles.tdSub, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>
                          {area.rate}%
                        </Text>
                      </View>
                    ))}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Issues Log List */}
            {issueTasks.length > 0 && (
              <View style={styles.listSection}>
                <View style={styles.listSectionHeader}>
                  <Ionicons name="warning" size={20} color={colors.danger} />
                  <Text style={[styles.listSectionTitle, { color: colors.danger }]}>
                    Active Issues Reported ({issueTasks.length})
                  </Text>
                </View>

                {issueTasks.map((t) => (
                  <View key={`issue-${t.id}`} style={styles.issueCard}>
                    <View style={styles.issueTopRow}>
                      <Text style={styles.issueEqName}>{t.equipment?.name}</Text>
                      <StatusBadge status="issue" />
                    </View>
                    <Text style={styles.issueSub}>
                      {t.category?.code}. {t.category?.name} • Due: {t.due_date}
                    </Text>
                    {t.log?.notes ? (
                      <View style={styles.issueNoteBox}>
                        <Text style={styles.issueNoteText}>Issue: {t.log.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Overdue Tasks List */}
            {overdueTasks.length > 0 && (
              <View style={styles.listSection}>
                <View style={styles.listSectionHeader}>
                  <Ionicons name="time" size={20} color={colors.warning} />
                  <Text style={styles.listSectionTitle}>
                    Overdue Tasks Requiring Attention ({overdueTasks.length})
                  </Text>
                </View>

                {overdueTasks.map((t) => (
                  <View key={`overdue-${t.id}`} style={styles.overdueItemCard}>
                    <View style={styles.issueTopRow}>
                      <Text style={styles.issueEqName}>{t.equipment?.name}</Text>
                      <FrequencyBadge freq={t.frequency} size="small" />
                    </View>
                    <Text style={styles.issueSub}>
                      Due Date: {t.due_date} • {t.category?.name}
                    </Text>
                  </View>
                ))}
              </View>
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
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  periodBar: {
    alignItems: 'center',
    marginBottom: 16,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.dark,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardPrimary: {
    minWidth: '100%',
    backgroundColor: colors.dark,
    borderColor: colors.dark,
    paddingVertical: 20,
  },
  primaryMetricLabel: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  primaryMetricVal: {
    color: colors.white,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  primaryMetricSub: {
    color: '#D4D4D8',
    fontSize: 14,
    marginTop: 4,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.dark,
    marginVertical: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 16,
  },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
    paddingHorizontal: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  barTrack: {
    width: 24,
    height: 100,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 8,
  },
  barSubCount: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  tableRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  systemMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  td: {
    fontSize: 13,
    color: colors.dark,
  },
  rateTag: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rateTagHigh: {
    backgroundColor: '#DCFCE7',
  },
  rateText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  rateTextHigh: {
    color: '#15803D',
  },
  tableRowSub: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  areaSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    paddingLeft: 8,
  },
  tdSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listSection: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginLeft: 8,
  },
  issueCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  issueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueEqName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  issueSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  issueNoteBox: {
    marginTop: 6,
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 6,
  },
  issueNoteText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  overdueItemCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
});

