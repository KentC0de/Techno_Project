import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import { useSubmittedReportsCount } from '../../hooks/useSubmittedReportsCount';
import { supabase, isConfigured } from '../../lib/supabase';
import { fetchScheduleRules, fetchTaskLogs } from '../../lib/dataService';
import { formatDate, buildDueTasks, addDays, getWorkWeek, parseDate } from '../../utils/schedule';
import { useWorkerGroups } from '../../hooks/useWorkerGroups';
import { DonutChart, LineChart } from '../../components/DashboardCharts';
import { computeTaskCounts } from '../../utils/taskStatus';
import { fetchCleaningTargets, ACTIVITIES } from '../../lib/siteMapService';
import { colors } from '../../theme';

const REPORT_STATUS = {
  submitted: { label: 'Pending review', bg: '#FFFBEF', fg: '#92400E' },
  reviewed: { label: 'Approved', bg: '#E8F6EE', fg: '#166534' },
  returned: { label: 'Returned', bg: '#FEE2E2', fg: '#B91C1C' },
  draft: { label: 'Draft', bg: '#F1F5F9', fg: '#475569' },
};

async function fetchTodayReports(date) {
  if (!isConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, worker_group_id, report_date, status, tasks_assigned, tasks_completed, submitted_by, submitted_at')
    .eq('report_date', date);
  if (error) {
    if (['42P01', '42703'].includes(error.code)) return [];
    throw error;
  }
  const rows = data || [];
  const groupIds = [...new Set(rows.map((r) => r.worker_group_id))];
  const userIds = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
  const [g, p] = await Promise.all([
    groupIds.length ? supabase.from('worker_groups').select('id, name').in('id', groupIds) : { data: [] },
    userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] },
  ]);
  const gm = Object.fromEntries((g.data || []).map((x) => [x.id, x.name]));
  const pm = Object.fromEntries((p.data || []).map((x) => [x.id, x.full_name]));
  return rows.map((r) => ({ ...r, groupName: gm[r.worker_group_id] || 'Group', head: pm[r.submitted_by] || '' }));
}

async function fetchCleaningSummary() {
  if (!isConfigured || !supabase) return null;
  const [targets, recs] = await Promise.all([
    fetchCleaningTargets(),
    supabase.from('cleaning_records').select('activity').eq('cycle', 1).eq('round', 1),
  ]);
  if (recs.error) throw recs.error;
  const done = {};
  (recs.data || []).forEach((r) => { done[r.activity] = (done[r.activity] || 0) + 1; });
  return ACTIVITIES.map((a) => ({
    ...a,
    done: done[a.value] || 0,
    total: targets.find((t) => t.activity === a.value)?.target_per_round || 0,
  }));
}

function KpiCard({ title, value, icon, tint, tintBg, note, onPress }) {
  return (
    <TouchableOpacity style={styles.kpi} onPress={onPress} activeOpacity={0.8} accessibilityLabel={`${title}: ${value}`}>
      <View style={styles.kpiTop}>
        <Text style={styles.kpiTitle}>{title}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: tintBg }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiNote}>{note}</Text>
    </TouchableOpacity>
  );
}

function Panel({ title, subtitle, actionLabel, onAction, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.flex}>
          <Text style={styles.panelTitle}>{title}</Text>
          {subtitle ? <Text style={styles.panelSub}>{subtitle}</Text> : null}
        </View>
        {actionLabel ? (
          <TouchableOpacity onPress={onAction} accessibilityLabel={actionLabel}>
            <Text style={styles.panelAction}>{actionLabel} →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function BarRow({ label, value, total, color, suffix }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{suffix || value} <Text style={styles.barPct}>{pct}%</Text></Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const today = useMemo(() => formatDate(new Date()), []);
  const { count: pendingReports } = useSubmittedReportsCount();

  const rulesQ = useQuery({ queryKey: ['schedule_rules', 'all'], queryFn: () => fetchScheduleRules(null), staleTime: 60 * 1000 });
  const rangeStart = useMemo(() => formatDate(addDays(parseDate(today), -13)), [today]);
  const logsQ = useQuery({ queryKey: ['task_logs', rangeStart, today], queryFn: () => fetchTaskLogs(rangeStart, today), staleTime: 30 * 1000 });
  const { groups = [] } = useWorkerGroups();
  const [period, setPeriod] = useState('week');
  const reportsQ = useQuery({ queryKey: ['dashboard_reports', today], queryFn: () => fetchTodayReports(today), staleTime: 15 * 1000 });

  const cleaningQ = useQuery({ queryKey: ['dashboard_cleaning'], queryFn: fetchCleaningSummary, staleTime: 60 * 1000, retry: false });

  const counts = useMemo(
    () => computeTaskCounts(buildDueTasks(rulesQ.data || [], logsQ.data || [], today, today)),
    [rulesQ.data, logsQ.data, today]
  );
  const week = useMemo(() => getWorkWeek(today), [today]);
  const periodCounts = useMemo(() => {
    const [a, b] = period === 'today' ? [today, today] : [week.start, today];
    return computeTaskCounts(buildDueTasks(rulesQ.data || [], logsQ.data || [], a, b));
  }, [rulesQ.data, logsQ.data, period, today, week.start]);
  const donut = useMemo(() => {
    const c = periodCounts;
    const waiting = c.submitted + c.completed + c.issue;
    const overdue = c.overdue;
    const pending = Math.max(c.pending + c.returned - overdue, 0);
    return [
      { key: 'done', label: 'Approved', color: '#2E9B64', value: c.done },
      { key: 'waiting', label: 'Completed (waiting approval)', color: '#2563A6', value: waiting },
      { key: 'pending', label: 'Pending', color: '#F4C542', value: pending },
      { key: 'overdue', label: 'Overdue', color: '#D94B4B', value: overdue },
    ];
  }, [periodCounts]);

  const groupChart = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => formatDate(addDays(parseDate(rangeStart), i)));
    const tasks = buildDueTasks(rulesQ.data || [], logsQ.data || [], rangeStart, today);
    const palette = ['#38BDF8', '#F4C542', '#34D399', '#F472B6', '#A78BFA', '#FB923C'];
    const series = groups.filter((g) => g.is_active !== false).map((g, idx) => {
      const mine = tasks.filter((t) => t.rule?.worker_group_id === g.id);
      const values = days.map((d) => {
        const day = mine.filter((t) => t.due_date === d);
        return day.length ? Math.round((day.filter((t) => t.log?.status === 'done').length / day.length) * 100) : null;
      });
      const done = mine.filter((t) => t.log?.status === 'done').length;
      return { key: g.id, name: g.name, color: palette[idx % palette.length], values, done, total: mine.length, rate: mine.length ? Math.round((done / mine.length) * 100) : 0 };
    });
    return { series, labels: days.map((d) => `${parseDate(d).toLocaleString('en-US', { month: 'short' })} ${parseDate(d).getDate()}`) };
  }, [groups, rulesQ.data, logsQ.data, rangeStart, today]);

  const reports = reportsQ.data || [];
  const reportedWaiting = counts.submitted + counts.completed + counts.issue;
  const go = (screen, params) => navigation.navigate(screen, params);
  const loading = rulesQ.isLoading || logsQ.isLoading;

  return (
    <View style={styles.screen}>
      <Header title="Maintenance Dashboard" subtitle="Here is what is happening at the plant today." />
      <PageContainer>
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <>
            <View style={styles.kpiRow}>
              <KpiCard title="Tasks Today" value={counts.total} icon="calendar-number-outline" tint="#1D4ED8" tintBg="#EFF6FF" note="Scheduled for today" onPress={() => go('AdminCalendar')} />
              <KpiCard title="Approved Tasks" value={counts.done} icon="shield-checkmark-outline" tint="#047857" tintBg="#ECFDF5" note={`${counts.rate}% of today's tasks`} onPress={() => go('AdminCalendar')} />
              <KpiCard title="Pending Tasks" value={counts.pending + counts.returned} icon="hourglass-outline" tint="#B45309" tintBg="#FFFBEB" note="Awaiting completion" onPress={() => go('AdminCalendar')} />
              <KpiCard title="Pending Reports" value={pendingReports} icon="clipboard-outline" tint="#1D4ED8" tintBg="#EFF6FF" note="Ready for your review" onPress={() => go('AdminCalendar', { view: 'reports' })} />
              <KpiCard title="Reported Issues" value={counts.issue} icon="warning-outline" tint="#B91C1C" tintBg="#FEF2F2" note="Need attention" onPress={() => go('AdminCalendar')} />
            </View>

            <Panel title="Today's Group Reports" subtitle="Review and approve daily submissions." actionLabel="View all" onAction={() => go('AdminCalendar', { view: 'reports' })}>
              {reports.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="document-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No reports submitted yet today.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, styles.flex]}>GROUP / SUBMITTED BY</Text>
                    <Text style={[styles.th, styles.colProgress]}>PROGRESS</Text>
                    <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
                    <Text style={[styles.th, styles.colAction]} />
                  </View>
                  {reports.map((r) => {
                    const st = REPORT_STATUS[r.status] || REPORT_STATUS.draft;
                    return (
                      <View key={r.id} style={styles.reportRow}>
                        <View style={styles.flex}>
                          <Text style={styles.reportGroup}>{r.groupName}</Text>
                          {r.head ? <Text style={styles.reportHead}>{r.head}</Text> : null}
                        </View>
                        <Text style={[styles.reportProgress, styles.colProgress]}>{r.tasks_completed}/{r.tasks_assigned} tasks</Text>
                        <View style={styles.colStatus}>
                          <View style={[styles.pill, { backgroundColor: st.bg }]}>
                            <Text style={[styles.pillText, { color: st.fg }]}>{st.label}</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.colAction} onPress={() => go('AdminCalendar', { view: 'reports', reportGroupId: r.worker_group_id, reportDate: r.report_date })} accessibilityLabel={`View report ${r.groupName}`}>
                          <Text style={styles.link}>View report</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </Panel>

            <Panel title="Overall Maintenance Progress" subtitle={period === 'today' ? 'Today' : 'This week'}>
              <View style={styles.periodRow}>
                {[['week', 'This week'], ['today', 'Today']].map(([k, l]) => (
                  <TouchableOpacity key={k} style={[styles.periodChip, period === k && styles.periodChipOn]} onPress={() => setPeriod(k)} accessibilityLabel={l}>
                    <Text style={[styles.periodText, period === k && styles.periodTextOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.donutRow}>
                <DonutChart
                  segments={donut}
                  centerValue={`${periodCounts.rate}%`}
                  centerLabel="Approved"
                />
                <View style={styles.donutLegend}>
                  {donut.map((d) => {
                    const pct = periodCounts.total > 0 ? Math.round((d.value / periodCounts.total) * 1000) / 10 : 0;
                    return (
                      <View key={d.key} style={styles.donutLegendRow}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={styles.donutLegendLabel}>{d.label}</Text>
                        <Text style={styles.donutLegendValue}>{d.value}</Text>
                        <Text style={styles.donutLegendPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                  <Text style={styles.donutTotal}>{periodCounts.total} scheduled tasks</Text>
                </View>
              </View>
            </Panel>

            <View style={styles.darkPanel}>
              <View style={styles.darkHeader}>
                <Text style={styles.darkTitle}>Group Performance</Text>
                <Text style={styles.darkSub}>Approved tasks per day, last 14 days</Text>
              </View>
              {groupChart.series.length === 0 ? (
                <Text style={styles.darkEmpty}>No worker groups yet.</Text>
              ) : (
                <>
                  <LineChart series={groupChart.series} labels={groupChart.labels} />
                  <View style={styles.groupLegend}>
                    {groupChart.series.map((g) => (
                      <View key={g.key} style={styles.groupLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: g.color }]} />
                        <Text style={styles.groupName}>{g.name}</Text>
                        <Text style={styles.groupRate}>{g.rate}%</Text>
                        <Text style={styles.groupCount}>{g.done}/{g.total}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            <Panel title="Cleaning Progress" subtitle="Cycle 1 · tracked independently per activity" actionLabel="Open Site Map" onAction={() => go('SiteMap')}>
              <View style={styles.cleanGrid}>
                {(cleaningQ.data || ACTIVITIES.map((a) => ({ ...a, done: 0, total: 0 }))).map((a) => (
                  <View key={a.value} style={styles.cleanItem}>
                    <BarRow label={a.label} value={a.done} total={a.total} color="#2563A6" suffix={`${a.done} / ${a.total}`} />
                  </View>
                ))}
              </View>
            </Panel>

            {counts.issue > 0 ? (
              <View style={styles.banner}>
                <Ionicons name="alert-outline" size={20} color="#B45309" />
                <Text style={styles.bannerText}><Text style={styles.bold}>{counts.issue} reported issues</Text> need attention.</Text>
                <TouchableOpacity onPress={() => go('AdminCalendar')}><Text style={styles.bannerLink}>View →</Text></TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  periodChip: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  periodChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  periodTextOn: { color: colors.white },
  donutRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 32, padding: 20 },
  donutLegend: { flexGrow: 1, flexBasis: 260, minWidth: 240 },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  donutLegendLabel: { flex: 1, fontSize: 14, color: colors.dark },
  donutLegendValue: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.dark },
  donutLegendPct: { width: 60, textAlign: 'right', fontSize: 13, color: colors.textMuted },
  donutTotal: { fontSize: 13, color: colors.textMuted, marginTop: 10 },
  darkPanel: { backgroundColor: '#142D4E', borderRadius: 12, marginBottom: 16, paddingBottom: 8, overflow: 'hidden' },
  darkHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  darkTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  darkSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  darkEmpty: { fontSize: 14, color: '#CBD5E1', padding: 20 },
  groupLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingHorizontal: 20, paddingVertical: 12 },
  groupLegendItem: { flexDirection: 'row', alignItems: 'center' },
  groupName: { fontSize: 14, color: '#FFFFFF', marginRight: 8 },
  groupRate: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginRight: 6 },
  groupCount: { fontSize: 12, color: '#94A3B8' },
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  flex: { flex: 1 },
  loader: { margin: 40 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
  kpi: { flexGrow: 1, flexBasis: 190, minWidth: 170, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 18 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiTitle: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  kpiIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 32, fontWeight: '600', color: colors.dark, marginTop: 10 },
  kpiNote: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  th: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.6 },
  colProgress: { width: 120 },
  colStatus: { width: 150 },
  colAction: { width: 100, alignItems: 'flex-end' },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  bigPct: { fontSize: 34, fontWeight: '600', color: colors.dark },
  bigLabel: { fontSize: 14, color: colors.textSecondary, marginLeft: 10 },
  segBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E2E8F0', marginBottom: 16 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { fontSize: 14, color: colors.textSecondary, marginRight: 8 },
  legendValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  cleanGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, padding: 20 },
  cleanItem: { flexGrow: 1, flexBasis: 240 },
  panel: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  panelTitle: { fontSize: 16, fontWeight: '600', color: colors.dark },
  panelSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  panelAction: { fontSize: 14, fontWeight: '600', color: colors.primary },
  panelBody: { padding: 20 },
  reportRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  reportGroup: { fontSize: 14, fontWeight: '600', color: colors.dark },
  reportHead: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  reportProgress: { fontSize: 13, color: colors.textSecondary },
  pill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '600', color: colors.primary },
  barRow: { marginBottom: 4 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 14, color: colors.dark },
  barValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  barPct: { fontWeight: '400', color: colors.textMuted },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEF', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 16, marginTop: 4 },
  bannerText: { flex: 1, fontSize: 14, color: '#78350F', marginLeft: 10 },
  bold: { fontWeight: '700' },
  bannerLink: { fontSize: 14, fontWeight: '700', color: '#78350F' },
});
