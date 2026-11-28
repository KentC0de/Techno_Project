import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../../lib/supabase';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
} from '../../lib/dataService';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { colors } from '../../theme';

const PAGE_SIZE = 25;

function formatTimestamp(isoStr) {
  if (!isoStr) return { relative: '', exact: '' };
  const d = new Date(isoStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  let relative = '';
  if (diffSec < 45) relative = 'just now';
  else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
  else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
  else if (diffSec < 604800) relative = `${Math.floor(diffSec / 86400)}d ago`;
  else relative = d.toLocaleDateString();

  const exact = d.toLocaleString();
  return { relative, exact };
}

function getActionColor(action) {
  if (!action) return { bg: '#F4F4F5', text: '#52525B', border: '#E4E4E7' };
  if (action.startsWith('auth.')) return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
  if (action.startsWith('task_logs.')) return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
  if (action.startsWith('schedule_rules.')) return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
  if (action.startsWith('equipment.')) return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
  if (action.startsWith('profiles.')) return { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' };
  return { bg: '#F4F4F5', text: '#52525B', border: '#E4E4E7' };
}

function getActionTag(action) {
  if (!action) return 'Activity';
  const parts = action.split('.');
  if (parts.length === 2) {
    const noun = parts[0].replace('_', ' ');
    const verb = parts[1];
    return `${noun}: ${verb}`;
  }
  return action;
}

export default function ActivityLogsScreen({ navigation }) {
  const { isDesktop } = useBreakpoint();

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Filters
  const [actionCategory, setActionCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Auxiliary data for deriving location if missing on old logs
  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: fetchEquipment,
    staleTime: 5 * 60 * 1000,
  });

  const { data: groupsList = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchGroups,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesList = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  // Fast maps
  const eqMap = useMemo(() => new Map(equipmentList.map((e) => [e.id, e])), [equipmentList]);
  const grpMap = useMemo(() => new Map(groupsList.map((g) => [g.id, g])), [groupsList]);
  const catMap = useMemo(() => new Map(categoriesList.map((c) => [c.id, c])), [categoriesList]);

  // Derive human-readable location for a log
  const resolveLocation = useCallback(
    (item) => {
      if (item.location && typeof item.location === 'string' && item.location.trim()) {
        return item.location;
      }

      // Check details record for equipment_id
      const record = item.details?.record || item.details?.new || item.details || {};
      const eqId = record.equipment_id || (item.entity_type === 'equipment' ? item.entity_id : null);

      if (eqId && eqMap.has(eqId)) {
        const eq = eqMap.get(eqId);
        const grp = grpMap.get(eq.group_id);
        const cat = grp ? catMap.get(grp.category_id) : null;

        const parts = [];
        if (cat) parts.push(`${cat.code}. ${cat.name}`);
        if (grp) parts.push(grp.name);
        parts.push(eq.name + (eq.area ? ` - ${eq.area}` : ''));
        return parts.join(' > ');
      }

      // Non-plant event: return device / platform
      const p = (item.platform || '').toLowerCase();
      if (p.includes('android')) return 'Mobile app (Android)';
      if (p.includes('ios')) return 'Mobile app (iOS)';
      if (p.includes('web')) return 'Web Admin';
      return item.platform ? `Device (${item.platform})` : 'System Event';
    },
    [eqMap, grpMap, catMap]
  );

  // Derive readable summary for older logs
  const resolveSummary = useCallback((item) => {
    if (item.summary && typeof item.summary === 'string' && item.summary.trim()) {
      return item.summary;
    }
    const user = item.user_name || 'User';
    const action = item.action || '';
    if (action === 'auth.login') return `${user} logged in`;
    if (action === 'auth.logout') return `${user} logged out`;
    if (action === 'auth.password_changed') return `${user} changed account password`;
    if (action === 'daily_reports.insert' || action === 'daily_reports.submit') {
      const rec = item.details?.record || item.details?.new || item.details || {};
      const dateStr = rec.report_date || '';
      return `${user} submitted daily report${dateStr ? ` for ${dateStr}` : ''}`;
    }
    if (action === 'daily_reports.review' || action === 'daily_reports.update') {
      const rec = item.details?.record || item.details?.new || item.details || {};
      const dateStr = rec.report_date || '';
      if (rec.status === 'reviewed') {
        return `${user} approved daily report${dateStr ? ` for ${dateStr}` : ''}`;
      }
      if (rec.status === 'returned') {
        return `${user} returned daily report${dateStr ? ` for ${dateStr}` : ''}`;
      }
    }
    if (action === 'task_logs.insert' || action === 'task_logs.update' || action === 'task_log.review') {
      const rec = item.details?.record || item.details?.new || item.details || {};
      const status = (rec.status || '').toLowerCase();
      const result = (rec.result || '').toLowerCase();
      const dueDate = rec.due_date || '';
      const dateSuffix = dueDate ? ` for ${dueDate}` : '';
      if (status === 'draft' && result === 'issue') {
        return `${user} reported an issue${dateSuffix}`;
      }
      if (status === 'draft') {
        return `${user} marked completed${dateSuffix}`;
      }
      if (status === 'submitted') {
        return `${user} submitted maintenance task${dateSuffix}`;
      }
      if (status === 'done') {
        return `${user} approved maintenance task${dateSuffix}`;
      }
      if (status === 'rejected') {
        return `${user} returned maintenance task${dateSuffix}`;
      }
      return `${user} updated maintenance task${dateSuffix}`;
    }
    if (action === 'schedule_rules.insert') return `${user} created a new schedule rule`;
    if (action === 'schedule_rules.update') return `${user} updated a schedule rule`;
    if (action === 'schedule_rules.delete') return `${user} deleted a schedule rule`;
    if (action === 'equipment.insert') return `${user} registered new equipment`;
    if (action === 'profiles.update') return `${user} updated user permissions`;
    return `${user} performed ${action.replace('.', ' ')}`;
  }, []);

  // Fetch logs with server-side pagination & count
  const fetchLogs = useCallback(
    async (pageIndex = 1, showSpinner = true) => {
      if (!isConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        if (showSpinner) setLoading(true);

        const from = (pageIndex - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from('activity_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (actionCategory !== 'ALL') {
          query = query.ilike('action', `${actionCategory}%`);
        }

        if (searchQuery.trim()) {
          const q = searchQuery.trim();
          query = query.or(
            `user_name.ilike.%${q}%,summary.ilike.%${q}%,location.ilike.%${q}%,action.ilike.%${q}%`
          );
        }

        const { data, count, error } = await query;

        if (error) {
          console.warn('[ActivityLogs] Fetch error:', error.message);
          return;
        }

        setLogs(data || []);
        setTotalCount(count || 0);
        setLastRefreshedAt(new Date());
        setBufferedCount(0);
      } catch (err) {
        console.warn('[ActivityLogs] Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    },
    [actionCategory, searchQuery]
  );

  // Trigger fetch on filter/page change
  useEffect(() => {
    fetchLogs(page, true);
  }, [page, actionCategory, searchQuery, fetchLogs]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [actionCategory, searchQuery]);

  // Realtime subscription
  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    const channelId = `activity_logs_feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          if (!payload?.new) return;

          // If on page 1 with no search filter, prepend immediately
          if (page === 1 && !searchQuery.trim() && actionCategory === 'ALL') {
            setLogs((prev) => [payload.new, ...prev.slice(0, PAGE_SIZE - 1)]);
            setTotalCount((c) => c + 1);
            setLastRefreshedAt(new Date());
          } else {
            // Buffer notification pill
            setBufferedCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, searchQuery, actionCategory]);

  // 30s background poll fallback
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(page, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [page, fetchLogs]);

  // Apply buffered updates
  const handleApplyBuffer = () => {
    setPage(1);
    setActionCategory('ALL');
    setSearchQuery('');
    fetchLogs(1, true);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Activity Logs"
        subtitle="Live audit trail of maintenance tasks and administrative changes"
        navigation={navigation}
        rightAction={
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        }
      />

      <PageContainer>
        {/* Buffered notification pill */}
        {bufferedCount > 0 ? (
          <TouchableOpacity
            style={styles.bufferPill}
            onPress={handleApplyBuffer}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle" size={18} color={colors.white} />
            <Text style={styles.bufferPillText}>
              {bufferedCount} new {bufferedCount === 1 ? 'activity' : 'activities'} • Tap to show
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Filter bar */}
        <View style={styles.controlsBar}>
          {/* Action category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPills}
          >
            {[
              { id: 'ALL', label: 'All Activities' },
              { id: 'task_logs', label: 'Tasks' },
              { id: 'schedule_rules', label: 'Schedules' },
              { id: 'equipment', label: 'Equipment' },
              { id: 'auth', label: 'Auth / Security' },
              { id: 'profiles', label: 'User Roles' },
            ].map((f) => {
              const isSelected = actionCategory === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  onPress={() => setActionCategory(f.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search user, summary or location..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Logs Table / Cards */}
        {loading && logs.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching activity stream...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No activity logs match your filters</Text>
            <Text style={styles.emptySub}>
              Actions performed across the system will automatically appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            {/* Header row on desktop */}
            {isDesktop && (
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { flex: 2 }]}>Timestamp</Text>
                <Text style={[styles.th, { flex: 2 }]}>User</Text>
                <Text style={[styles.th, { flex: 4 }]}>What Happened</Text>
                <Text style={[styles.th, { flex: 3 }]}>Location / Device</Text>
                <Text style={[styles.th, { width: 90, textAlign: 'center' }]}>Action</Text>
                <Text style={[styles.th, { width: 40 }]}></Text>
              </View>
            )}

            {logs.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const { relative, exact } = formatTimestamp(item.created_at);
              const tagColors = getActionColor(item.action);
              const summary = resolveSummary(item);
              const location = resolveLocation(item);
              const isPlantLoc = location.includes('>');

              const record = item.details?.record || item.details?.new || item.details || {};

              return (
                <View key={item.id || idx} style={styles.logRowWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.logRow,
                      idx % 2 === 1 && styles.logRowAlt,
                      isExpanded && styles.logRowExpanded,
                    ]}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Timestamp */}
                    <View style={[styles.colTimestamp, isDesktop && { flex: 2 }]}>
                      <Text style={styles.timeRelative}>{relative}</Text>
                      <Text style={styles.timeExact} numberOfLines={1}>
                        {exact}
                      </Text>
                    </View>

                    {/* User */}
                    <View style={[styles.colUser, isDesktop && { flex: 2 }]}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.user_name || 'System'}
                      </Text>
                      <View
                        style={[
                          styles.roleBadge,
                          item.user_role === 'admin' ? styles.roleAdmin : styles.roleWorker,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            item.user_role === 'admin'
                              ? styles.roleAdminText
                              : styles.roleWorkerText,
                          ]}
                        >
                          {item.user_role || 'worker'}
                        </Text>
                      </View>
                    </View>

                    {/* Summary */}
                    <View style={[styles.colSummary, isDesktop && { flex: 4 }]}>
                      <Text style={styles.summaryText} numberOfLines={2}>
                        {summary}
                      </Text>
                    </View>

                    {/* Location Breadcrumb */}
                    <View style={[styles.colLocation, isDesktop && { flex: 3 }]}>
                      {isPlantLoc ? (
                        <View style={styles.locChip}>
                          <Ionicons name="location-outline" size={12} color={colors.primary} />
                          <Text style={styles.locChipText} numberOfLines={1} ellipsizeMode="tail">
                            {location}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.deviceChip}>
                          <Ionicons
                            name={location.includes('Mobile') ? 'phone-portrait-outline' : 'laptop-outline'}
                            size={12}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.deviceChipText} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action Tag */}
                    <View style={[styles.colTag, isDesktop && { width: 90 }]}>
                      <View
                        style={[
                          styles.actionTag,
                          {
                            backgroundColor: tagColors.bg,
                            borderColor: tagColors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.actionTagText, { color: tagColors.text }]}>
                          {getActionTag(item.action)}
                        </Text>
                      </View>
                    </View>

                    {/* Expand Chevron */}
                    <View style={[styles.colChevron, isDesktop && { width: 40 }]}>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Key-Value Details (Never Raw JSON) */}
                  {isExpanded && (
                    <View style={styles.detailsContainer}>
                      <View style={styles.detailsHeader}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                        <Text style={styles.detailsHeading}>Activity Record Details</Text>
                      </View>

                      <View style={styles.detailsGrid}>
                        <View style={styles.kvItem}>
                          <Text style={styles.kvKey}>Action Identifier</Text>
                          <Text style={styles.kvVal}>{item.action}</Text>
                        </View>

                        <View style={styles.kvItem}>
                          <Text style={styles.kvKey}>Entity Target</Text>
                          <Text style={styles.kvVal}>
                            {item.entity_type} {item.entity_id ? `(${item.entity_id})` : ''}
                          </Text>
                        </View>

                        {record.status ? (
                          <View style={styles.kvItem}>
                            <Text style={styles.kvKey}>Status</Text>
                            <Text style={styles.kvVal}>{record.status}</Text>
                          </View>
                        ) : null}

                        {record.frequency ? (
                          <View style={styles.kvItem}>
                            <Text style={styles.kvKey}>Frequency</Text>
                            <Text style={styles.kvVal}>{record.frequency}</Text>
                          </View>
                        ) : null}

                        {record.due_date ? (
                          <View style={styles.kvItem}>
                            <Text style={styles.kvKey}>Scheduled Due Date</Text>
                            <Text style={styles.kvVal}>{record.due_date}</Text>
                          </View>
                        ) : null}

                        {record.completed_at ? (
                          <View style={styles.kvItem}>
                            <Text style={styles.kvKey}>Completed At</Text>
                            <Text style={styles.kvVal}>{record.completed_at}</Text>
                          </View>
                        ) : null}

                        {record.note || record.notes ? (
                          <View style={[styles.kvItem, { width: '100%' }]}>
                            <Text style={styles.kvKey}>Technician / Admin Note</Text>
                            <Text style={styles.kvVal}>{record.note || record.notes}</Text>
                          </View>
                        ) : null}

                        {record.reason ? (
                          <View style={[styles.kvItem, { width: '100%' }]}>
                            <Text style={styles.kvKey}>Reason</Text>
                            <Text style={[styles.kvVal, { color: '#EF4444' }]}>{record.reason}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Standard Pagination Pager */}
            <Pagination
              currentPage={page}
              pageSize={PAGE_SIZE}
              totalItems={totalCount}
              onPageChange={(p) => setPage(p)}
              style={styles.paginationRow}
            />
          </View>
        )}
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.4,
  },
  bufferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bufferPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 34,
    gap: 6,
    minWidth: 220,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textDark,
  },
  tableCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    flexWrap: 'wrap',
  },
  logRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  logRowExpanded: {
    backgroundColor: '#F5F7FA',
  },
  colTimestamp: {
    minWidth: 120,
  },
  timeRelative: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
  },
  timeExact: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  colUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 130,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  roleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleAdmin: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  roleWorker: {
    backgroundColor: '#F4F4F5',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  roleAdminText: {
    color: colors.primaryDark,
  },
  roleWorkerText: {
    color: '#52525B',
  },
  colSummary: {
    minWidth: 200,
    flex: 1,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    lineHeight: 18,
  },
  colLocation: {
    minWidth: 160,
  },
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F4F4F5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deviceChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  colTag: {
    alignItems: 'center',
  },
  actionTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  colChevron: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContainer: {
    backgroundColor: '#F5F7FA',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 14,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  detailsHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.dark,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kvItem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 6,
    padding: 8,
    minWidth: 180,
  },
  kvKey: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  kvVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  paginationRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
