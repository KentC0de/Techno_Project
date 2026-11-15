import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
  fetchScheduleRules,
  fetchTaskLogs,
  getSavedWorkerSelection,
  saveWorkerSelection,
} from '../../lib/dataService';
import {
  formatDate,
  addDays,
  getWorkWeek,
  buildDueTasks,
  computePerformance,
} from '../../utils/schedule';
import FrequencyBadge from '../../components/FrequencyBadge';
import ProgressBar from '../../components/ProgressBar';
import { colors } from '../../theme';

export default function ChooseWorkScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets?.top || 0,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0
  );

  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedArea, setSelectedArea] = useState('All');
  const [loading, setLoading] = useState(true);

  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);

  const todayStr = formatDate(new Date());
  const workWeek = useMemo(() => getWorkWeek(todayStr), [todayStr]);

  const categoryIcons = {
    A: 'hardware-chip-outline',
    B: 'sunny-outline',
    C: 'flash-outline',
    D: 'build-outline',
  };

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [cats, saved] = await Promise.all([
          fetchCategories(),
          getSavedWorkerSelection(user?.id),
        ]);
        setCategories(cats);

        if (saved && saved.categoryId) {
          setSelectedCatId(saved.categoryId);
          setSelectedArea(saved.area || 'All');
        } else if (cats.length > 0) {
          setSelectedCatId(cats[0].id);
        }
      } catch (err) {
        if (__DEV__) console.log('Error loading systems:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [user?.id]);

  // Fetch groups and equipment reference for the selected system
  useEffect(() => {
    if (!selectedCatId) return;

    async function loadSystemDetails() {
      try {
        const [grps, eq, rls, lgs] = await Promise.all([
          fetchGroups(selectedCatId),
          fetchEquipment({ activeOnly: true }),
          fetchScheduleRules({ categoryId: selectedCatId }),
          fetchTaskLogs(workWeek.start, workWeek.end),
        ]);
        setGroups(grps);
        setRules(rls);
        setLogs(lgs);

        // Filter equipment belonging to groups of this category
        const grpIds = new Set(grps.map((g) => g.id));
        const filteredEq = eq.filter((item) => grpIds.has(item.group_id));
        setEquipmentList(filteredEq);
      } catch (err) {
        if (__DEV__) console.log('Error loading system details:', err);
      }
    }

    loadSystemDetails();
  }, [selectedCatId, workWeek.start, workWeek.end]);

  const selectedCategory = categories.find((c) => c.id === selectedCatId);
  const isPVField = selectedCategory?.code === 'B';

  // Compute tasks for this week to show weekly overview
  const weekTasks = useMemo(() => {
    if (rules.length === 0) return [];
    return buildDueTasks(rules, logs, workWeek.start, workWeek.end);
  }, [rules, logs, workWeek.start, workWeek.end]);

  // Today tasks for the selected category
  const todayTasks = useMemo(() => {
    return weekTasks.filter((t) => {
      const matchDate = t.due_date === todayStr;
      const matchArea = !isPVField || selectedArea === 'All' || t.equipment?.area === selectedArea;
      return matchDate && matchArea;
    });
  }, [weekTasks, todayStr, isPVField, selectedArea]);

  const todayPerf = computePerformance(todayTasks);

  // Day-by-day weekly breakdown (Mon to Sun)
  const daysOfWeek = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const dStr = formatDate(addDays(new Date(workWeek.start), i));
      const dTasks = weekTasks.filter((t) => {
        const matchDate = t.due_date === dStr;
        const matchArea = !isPVField || selectedArea === 'All' || t.equipment?.area === selectedArea;
        return matchDate && matchArea;
      });
      const p = computePerformance(dTasks);
      list.push({ date: dStr, ...p });
    }
    return list;
  }, [weekTasks, workWeek.start, isPVField, selectedArea]);

  const handleSelectCategory = async (cat) => {
    setSelectedCatId(cat.id);
    const newArea = cat.code === 'B' ? selectedArea : 'All';
    await saveWorkerSelection(
      {
        categoryId: cat.id,
        categoryName: cat.name,
        area: newArea,
      },
      user?.id
    );
  };

  const handleSelectArea = async (area) => {
    setSelectedArea(area);
    if (selectedCategory) {
      await saveWorkerSelection(
        {
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          area,
        },
        user?.id
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Slim Header */}
      <View style={[styles.topBar, { paddingTop: topInset + 6, height: topInset + 52 }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.sunLogo}>
            <Ionicons name="sunny" size={16} color={colors.white} />
          </View>
          <Text style={styles.topBarTitle}>My System</Text>
        </View>
        <Text style={styles.topBarSubtitle}>Choose Your Station</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>SELECT YOUR SYSTEM</Text>

        {/* 4 System Cards */}
        <View style={styles.systemsGrid}>
          {categories.map((cat) => {
            const isSelected = cat.id === selectedCatId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.systemCard, isSelected && styles.systemCardActive]}
                onPress={() => handleSelectCategory(cat)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                  <Ionicons
                    name={categoryIcons[cat.code] || 'grid-outline'}
                    size={24}
                    color={isSelected ? colors.white : colors.primary}
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.systemName, isSelected && styles.systemNameActive]}>
                    {cat.name}
                  </Text>
                  <Text style={styles.systemCode}>System {cat.code}</Text>
                </View>
                {isSelected && (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Area Selection (PV Field Area) */}
        {isPVField && (
          <View style={styles.areaSection}>
            <Text style={styles.sectionHeader}>PV FIELD SUB-AREA</Text>
            <View style={styles.areaPillsRow}>
              {['Area 1', 'Area 2', 'Area 3', 'All'].map((areaName) => {
                const isActive = selectedArea === areaName;
                return (
                  <TouchableOpacity
                    key={areaName}
                    style={[styles.areaPill, isActive && styles.areaPillActive]}
                    onPress={() => handleSelectArea(areaName)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.areaPillText, isActive && styles.areaPillTextActive]}>
                      {areaName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Today's Tasks Summary for Selection */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryTitle}>Today's Assigned Work</Text>
              <Text style={styles.summarySub}>
                {selectedCategory?.name || 'Selected System'}
                {isPVField ? ` • ${selectedArea}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewTasksBtn}
              onPress={() => navigation.navigate('WorkerTodayTab')}
              activeOpacity={0.8}
            >
              <Text style={styles.viewTasksBtnText}>View Tasks</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 14 }}>
            <ProgressBar
              completed={todayPerf.completed}
              total={todayPerf.total}
              percent={todayPerf.percent}
            />
          </View>
        </View>

        {/* Weekly Overview (Mon–Sun) */}
        <View style={styles.weekOverviewCard}>
          <Text style={styles.sectionHeader}>THIS WEEK'S OVERVIEW (MON–SUN)</Text>
          <View style={styles.weekGrid}>
            {daysOfWeek.map((day, idx) => {
              const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const isToday = day.date === todayStr;
              return (
                <View key={day.date} style={[styles.dayCol, isToday && styles.dayColToday]}>
                  <Text style={[styles.dayName, isToday && styles.dayTextActive]}>
                    {dayLabels[idx]}
                  </Text>
                  <Text style={[styles.dayTotal, isToday && styles.dayTextActive]}>
                    {day.total}
                  </Text>
                  <Text style={[styles.dayDone, isToday && styles.dayTextActive]}>
                    {day.completed} done
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Groups and Equipment Reference */}
        <View style={styles.equipmentSection}>
          <Text style={styles.sectionHeader}>
            SYSTEM EQUIPMENT REFERENCE ({equipmentList.length})
          </Text>
          {groups.map((grp) => {
            const grpEq = equipmentList.filter((e) => e.group_id === grp.id);
            if (grpEq.length === 0) return null;
            return (
              <View key={grp.id} style={styles.groupCard}>
                <Text style={styles.groupCardTitle}>{grp.name}</Text>
                {grpEq.map((eq) => (
                  <View key={eq.id} style={styles.eqItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eqName}>{eq.name}</Text>
                      {eq.area ? <Text style={styles.eqArea}>{eq.area}</Text> : null}
                    </View>
                    <View style={styles.freqRow}>
                      {(eq.default_freq || ['d']).map((f) => (
                        <FrequencyBadge key={f} frequency={f} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sunLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.darkMuted,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  systemsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  systemCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  systemCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconBoxActive: {
    backgroundColor: colors.primary,
  },
  cardContent: {
    flex: 1,
  },
  systemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 2,
  },
  systemNameActive: {
    color: colors.primaryDark || '#0284C7',
  },
  systemCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaSection: {
    marginBottom: 20,
  },
  areaPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  areaPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  areaPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  areaPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  areaPillTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  summarySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewTasksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  viewTasksBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  weekOverviewCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dayColToday: {
    backgroundColor: colors.primary,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    marginVertical: 4,
  },
  dayDone: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  dayTextActive: {
    color: colors.white,
  },
  equipmentSection: {
    marginBottom: 20,
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 6,
  },
  eqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  eqName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  eqArea: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 4,
  },
});
