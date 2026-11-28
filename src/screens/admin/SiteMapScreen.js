import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import {
  AREAS,
  ACTIVITIES,
  activityLabel,
  isSiteMapSetupError,
  fetchSiteMapCells,
  fetchCleaningTargets,
  fetchCleaningRecords,
  fetchProfileNames,
  recordCleaning,
  undoCleaning,
} from '../../lib/siteMapService';
import { colors } from '../../theme';

const CELL_W = 64;
const CELL_H = 44;

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityLabel={label}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipRow({ title, options, value, onChange }) {
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipGroupTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {subtitle ? <Text style={styles.panelSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ProgressRow({ label, done, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressTop}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {done} / {total} <Text style={styles.progressPct}>{pct}%</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function MapCell({ cell, done, selected, onPress }) {
  if (cell.kind === 'label') {
    return (
      <View style={styles.labelCell}>
        <Text style={styles.labelCellText} numberOfLines={1}>{cell.label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.cell, done && styles.cellDone, selected && styles.cellSelected]}
      onPress={onPress}
      accessibilityLabel={`${cell.label}${done ? ', completed' : ', pending'}`}
      activeOpacity={0.8}
    >
      <Text style={[styles.cellText, done && styles.cellTextDone]} numberOfLines={1}>{cell.label}</Text>
    </TouchableOpacity>
  );
}

export default function SiteMapScreen() {
  const { user } = useAuth();
  const runAction = useAction();
  const queryClient = useQueryClient();

  const [area, setArea] = useState(AREAS[0]);
  const [activity, setActivity] = useState('module');
  const [cycle, setCycle] = useState(1);
  const [round, setRound] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const cellsQ = useQuery({ queryKey: ['site_map_cells'], queryFn: fetchSiteMapCells, staleTime: 10 * 60 * 1000 });
  const targetsQ = useQuery({ queryKey: ['cleaning_targets'], queryFn: fetchCleaningTargets, staleTime: 10 * 60 * 1000 });
  const recordsQ = useQuery({
    queryKey: ['cleaning_records', activity, cycle],
    queryFn: () => fetchCleaningRecords({ activity, cycle }),
  });

  const cells = useMemo(() => cellsQ.data || [], [cellsQ.data]);
  const records = useMemo(() => recordsQ.data || [], [recordsQ.data]);
  const target = (targetsQ.data || []).find((t) => t.activity === activity);
  const rounds = target?.rounds_per_cycle || 1;
  const cycles = target?.cycles_per_year || 1;
  const perRound = target?.target_per_round || 0;
  const activeRound = Math.min(round, rounds);

  const cellById = useMemo(() => Object.fromEntries(cells.map((c) => [c.id, c])), [cells]);
  const recordByCell = useMemo(() => {
    const map = {};
    records.filter((r) => r.round === activeRound).forEach((r) => { map[r.cell_id] = r; });
    return map;
  }, [records, activeRound]);

  const namesQ = useQuery({
    queryKey: ['cleaning_names', records.map((r) => r.recorded_by).sort().join(',')],
    queryFn: () => fetchProfileNames(records.map((r) => r.recorded_by)),
    enabled: records.length > 0,
  });

  const rows = useMemo(() => {
    const byRow = {};
    cells.filter((c) => c.area === area).forEach((c) => {
      (byRow[c.row_no] = byRow[c.row_no] || []).push(c);
    });
    return Object.keys(byRow)
      .map(Number)
      .sort((a, b) => a - b)
      .map((rowNo) => {
        const list = byRow[rowNo].sort((a, b) => a.col_no - b.col_no);
        const out = [];
        let col = list[0].col_no;
        list.forEach((c) => {
          while (col < c.col_no) { out.push({ gap: true, key: `${rowNo}-gap-${col}` }); col += 1; }
          out.push(c);
          col = c.col_no + 1;
        });
        return { rowNo, items: out };
      });
  }, [cells, area]);

  const perArea = AREAS.map((a) => ({
    area: a,
    done: records.filter((r) => r.round === activeRound && cellById[r.cell_id]?.area === a).length,
  }));
  const totalDone = perArea.reduce((sum, a) => sum + a.done, 0);
  const selected = selectedId ? cellById[selectedId] : null;
  const selectedRecord = selected ? recordByCell[selected.id] : null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cleaning_records'] });

  const handleRecord = () => {
    if (!selected) return;
    runAction({
      loading: 'Saving...',
      action: () => recordCleaning({ cellId: selected.id, activity, cycle, round: activeRound, userId: user.id }),
      success: 'Recorded',
      onSuccess: refresh,
    });
  };

  const handleUndo = () => {
    if (!selectedRecord) return;
    runAction({
      confirm: { title: 'Undo this record?', message: 'The location will be pending again.', confirmText: 'Undo', tone: 'danger' },
      loading: 'Saving...',
      action: () => undoCleaning(selectedRecord.id),
      success: 'Record removed',
      onSuccess: refresh,
    });
  };

  const setupNeeded = isSiteMapSetupError(cellsQ.error) || isSiteMapSetupError(targetsQ.error);

  return (
    <View style={styles.screen}>
      <Header title="Site Map" subtitle="Cleaning tracker per area" />
      <PageContainer>
        {setupNeeded ? (
          <Panel title="Setup needed">
            <Text style={styles.note}>Run docs/site_map.sql in Supabase, then reload.</Text>
          </Panel>
        ) : (
          <>
            <View style={styles.filters}>
              <ChipRow title="Area" options={AREAS.map((a) => ({ value: a, label: a }))} value={area} onChange={(v) => { setArea(v); setSelectedId(null); }} />
              <ChipRow title="Activity" options={ACTIVITIES.map((a) => ({ value: a.value, label: a.short }))} value={activity} onChange={(v) => { setActivity(v); setCycle(1); setRound(1); setSelectedId(null); }} />
              <ChipRow title="Cycle" options={Array.from({ length: cycles }, (_, i) => ({ value: i + 1, label: `Cycle ${i + 1}` }))} value={cycle} onChange={(v) => { setCycle(v); setSelectedId(null); }} />
              {rounds > 1 ? (
                <ChipRow title="Round" options={Array.from({ length: rounds }, (_, i) => ({ value: i + 1, label: `Round ${i + 1}` }))} value={activeRound} onChange={setRound} />
              ) : null}
            </View>

            <View style={styles.columns}>
              <View style={styles.mainCol}>
                <Panel title={`${area} · ${activityLabel(activity)}`} subtitle={`Cycle ${cycle}${rounds > 1 ? ` · Round ${activeRound}` : ''} · tracked independently`}>
                  {cellsQ.isLoading || recordsQ.isLoading ? (
                    <ActivityIndicator style={styles.loader} color={colors.primary} />
                  ) : rows.length === 0 ? (
                    <View style={styles.empty}>
                      <Ionicons name="map-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.emptyTitle}>No layout for {area} yet</Text>
                      <Text style={styles.note}>Import the cells from the Excel tracker into site_map_cells.</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <ScrollView nestedScrollEnabled style={styles.gridScroll}>
                        {rows.map((row) => (
                          <View key={row.rowNo} style={styles.gridRow}>
                            {row.items.map((c) =>
                              c.gap ? (
                                <View key={c.key} style={styles.gap} />
                              ) : (
                                <MapCell key={c.id} cell={c} done={Boolean(recordByCell[c.id])} selected={c.id === selectedId} onPress={() => setSelectedId(c.id)} />
                              )
                            )}
                          </View>
                        ))}
                      </ScrollView>
                    </ScrollView>
                  )}
                  <View style={styles.legend}>
                    <View style={[styles.legendDot, styles.cellDone]} /><Text style={styles.legendText}>Completed</Text>
                    <View style={[styles.legendDot, styles.legendPending]} /><Text style={styles.legendText}>Pending</Text>
                  </View>
                </Panel>
              </View>

              <View style={styles.sideCol}>
                <Panel title="Progress" subtitle={target?.confirmed ? 'Quota confirmed' : 'Preliminary quota'}>
                  <View style={styles.panelBody}>
                    <ProgressRow label={`${activityLabel(activity)} · Round ${activeRound}`} done={totalDone} total={perRound} />
                    {perArea.map((a) => (
                      <Text key={a.area} style={styles.areaLine}>{a.area}: {a.done} completed</Text>
                    ))}
                  </View>
                </Panel>
                <Panel title={selected ? selected.label : 'Location'}>
                  <View style={styles.panelBody}>
                    {!selected ? (
                      <Text style={styles.note}>Select a location.</Text>
                    ) : (
                      <>
                        <Text style={styles.detailLine}>{selected.area} · {activityLabel(activity)}</Text>
                        {selectedRecord ? (
                          <Text style={styles.detailLine}>
                            Done by {namesQ.data?.[selectedRecord.recorded_by] || 'Worker'} · {new Date(selectedRecord.recorded_at).toLocaleString()}
                          </Text>
                        ) : (
                          <Text style={styles.detailLine}>Pending</Text>
                        )}
                        {activity === 'pathway' ? (
                          <Text style={styles.hint}>Table is a reference only. It is not marked cleaned.</Text>
                        ) : null}
                        <TouchableOpacity
                          style={[styles.actionBtn, selectedRecord && styles.actionBtnDanger]}
                          onPress={selectedRecord ? handleUndo : handleRecord}
                          accessibilityLabel={selectedRecord ? 'Undo record' : 'Mark completed'}
                        >
                          <Text style={[styles.actionBtnText, selectedRecord && styles.actionBtnTextDanger]}>
                            {selectedRecord ? 'Undo' : 'Mark completed'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </Panel>
              </View>
            </View>
          </>
        )}
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  filters: { marginBottom: 16 },
  chipGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  chipGroupTitle: { width: 72, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center', marginRight: 8, marginBottom: 6 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: colors.white },
  columns: { flexDirection: 'row', flexWrap: 'wrap' },
  mainCol: { flexGrow: 2, flexBasis: 560, minWidth: 320, marginRight: 16, marginBottom: 16 },
  sideCol: { flexGrow: 1, flexBasis: 300, minWidth: 280 },
  panel: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  panelHeader: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  panelTitle: { fontSize: 16, fontWeight: '600', color: '#202B3C' },
  panelSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  panelBody: { padding: 20 },
  loader: { margin: 32 },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.dark, marginTop: 8 },
  note: { fontSize: 14, color: colors.textSecondary, padding: 4 },
  hint: { fontSize: 13, color: '#92400E', backgroundColor: colors.warningLight, borderRadius: 8, padding: 10, marginTop: 8 },
  gridScroll: { maxHeight: 520, padding: 12 },
  gridRow: { flexDirection: 'row', marginBottom: 4 },
  gap: { width: CELL_W + 4, height: CELL_H },
  cell: { width: CELL_W, height: CELL_H, marginRight: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cellDone: { backgroundColor: '#BBF7D0', borderColor: '#4ADE80' },
  cellSelected: { borderColor: colors.dark, borderWidth: 2 },
  cellText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  cellTextDone: { color: '#14532D', fontWeight: '700' },
  labelCell: { width: CELL_W, height: CELL_H, marginRight: 4, justifyContent: 'center', alignItems: 'center' },
  labelCellText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  legend: { flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, marginRight: 6 },
  legendPending: { backgroundColor: colors.white, borderColor: colors.border },
  legendText: { fontSize: 12, color: colors.textSecondary, marginRight: 16 },
  progressRow: { marginBottom: 12 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 14, fontWeight: '500', color: colors.dark, flex: 1 },
  progressValue: { fontSize: 14, color: colors.textSecondary },
  progressPct: { fontWeight: '700', color: colors.dark },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  areaLine: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  detailLine: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  actionBtn: { minHeight: 44, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  actionBtnDanger: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  actionBtnTextDanger: { color: colors.danger },
});
