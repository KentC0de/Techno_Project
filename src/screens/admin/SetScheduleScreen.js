import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
  createScheduleRules,
} from '../../lib/dataService';
import { formatDate, parseDate, getIsoWeekday, addDays } from '../../utils/schedule';
import Header from '../../components/Header';
import FrequencyBadge from '../../components/FrequencyBadge';
import { colors, layout } from '../../theme';

export default function SetScheduleScreen({ navigation }) {
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());

  // Rule settings
  const [frequency, setFrequency] = useState('d');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [weekday, setWeekday] = useState(1); // 1 = Monday
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Load categories
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const cats = await fetchCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setSelectedCatId(cats[0].id);
        }
      } catch (err) {
        setErrorMessage('Failed to load categories.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Load groups when category changes
  useEffect(() => {
    if (!selectedCatId) return;
    async function loadGroups() {
      try {
        const grps = await fetchGroups(selectedCatId);
        setGroups(grps);
        if (grps.length > 0) {
          setSelectedGroupId(grps[0].id);
        } else {
          setSelectedGroupId(null);
          setEquipmentList([]);
        }
      } catch (err) {
        setErrorMessage('Failed to load groups.');
      }
    }
    loadGroups();
  }, [selectedCatId]);

  // 3. Load equipment when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setEquipmentList([]);
      setSelectedEquipmentIds(new Set());
      return;
    }
    async function loadEq() {
      try {
        const eq = await fetchEquipment({ groupId: selectedGroupId, activeOnly: true });
        setEquipmentList(eq);

        // Reset selected area and selection
        setSelectedArea('All');
        const initialSelected = new Set(eq.map((item) => item.id));
        setSelectedEquipmentIds(initialSelected);

        // Suggest frequency from first equipment's default_freq if present
        if (eq.length > 0 && eq[0].default_freq && eq[0].default_freq.length > 0) {
          setFrequency(eq[0].default_freq[0]);
        }
      } catch (err) {
        setErrorMessage('Failed to load equipment.');
      }
    }
    loadEq();
  }, [selectedGroupId]);

  // Filter equipment by area if applicable
  const availableAreas = Array.from(
    new Set(equipmentList.map((e) => e.area).filter(Boolean))
  );
  const hasAreas = availableAreas.length > 0;

  const displayedEquipment = equipmentList.filter((eq) => {
    if (!hasAreas || selectedArea === 'All') return true;
    return eq.area === selectedArea;
  });

  const toggleEquipment = (id) => {
    const next = new Set(selectedEquipmentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEquipmentIds(next);
  };

  const handleSelectAll = () => {
    if (selectedEquipmentIds.size === displayedEquipment.length) {
      setSelectedEquipmentIds(new Set());
    } else {
      setSelectedEquipmentIds(new Set(displayedEquipment.map((e) => e.id)));
    }
  };

  const handleSave = async () => {
    if (selectedEquipmentIds.size === 0) {
      setErrorMessage('Please select at least one equipment.');
      return;
    }
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage('Please enter start date as YYYY-MM-DD.');
      return;
    }
    if (endDate && !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage('Please enter end date as YYYY-MM-DD or leave blank.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const newRules = Array.from(selectedEquipmentIds).map((eqId) => ({
        equipment_id: eqId,
        frequency,
        start_date: startDate,
        end_date: endDate.trim() ? endDate.trim() : null,
        weekday: frequency === 'w' ? weekday : null,
        notes: notes.trim() ? notes.trim() : null,
        created_by: user?.id || null,
      }));

      await createScheduleRules(newRules);
      setSuccessMessage(`Successfully created ${newRules.length} maintenance schedule rule(s)!`);
      // Scroll to top or clear
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create schedule rules.');
    } finally {
      setSaving(false);
    }
  };

  const freqOptions = [
    { code: 'd', label: 'Daily' },
    { code: 'w', label: 'Weekly' },
    { code: 'M', label: 'Monthly' },
    { code: 'Q', label: 'Quarterly' },
    { code: 'SA', label: 'Semi-annual' },
  ];

  const weekdayNames = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 7, label: 'Sun' },
  ];

  return (
    <View style={styles.screen}>
      <Header
        title="Set Schedule"
        subtitle="Create recurring preventive maintenance rules"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Messages */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* 1. Pick System */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>1. System Category</Text>
          <View style={styles.pillRow}>
            {categories.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => setSelectedCatId(cat.id)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {cat.code}. {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Pick Group */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>2. Equipment Group</Text>
          <View style={styles.pillRow}>
            {groups.map((grp) => {
              const isSelected = selectedGroupId === grp.id;
              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => setSelectedGroupId(grp.id)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {grp.item_no}. {grp.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Pick Area (if applicable) */}
        {hasAreas && (
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeader}>3. Area Filter</Text>
            <View style={styles.pillRow}>
              {['All', ...availableAreas].map((a) => {
                const isSelected = selectedArea === a;
                return (
                  <TouchableOpacity
                    key={a}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => setSelectedArea(a)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 4. Equipment Selection */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeader}>
              4. Target Equipment ({selectedEquipmentIds.size} of {displayedEquipment.length} selected)
            </Text>
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
              <Text style={styles.selectAllText}>
                {selectedEquipmentIds.size === displayedEquipment.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {displayedEquipment.length === 0 ? (
            <Text style={styles.emptyNotice}>No active equipment in this group.</Text>
          ) : (
            <View style={styles.equipmentList}>
              {displayedEquipment.map((eq) => {
                const isChecked = selectedEquipmentIds.has(eq.id);
                return (
                  <TouchableOpacity
                    key={eq.id}
                    style={[styles.equipmentItem, isChecked && styles.equipmentItemSelected]}
                    onPress={() => toggleEquipment(eq.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isChecked ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.eqInfo}>
                      <Text style={[styles.eqName, isChecked && styles.eqNameSelected]}>
                        {eq.name}
                      </Text>
                      {eq.area ? (
                        <Text style={styles.eqArea}>{eq.area}</Text>
                      ) : null}
                    </View>

                    {eq.default_freq && eq.default_freq.length > 0 && (
                      <View style={styles.freqPillsRow}>
                        {eq.default_freq.map((f) => (
                          <FrequencyBadge key={f} freq={f} size="small" />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 5. Schedule Rule Configuration */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>5. Frequency & Recurrence</Text>

          {/* Frequency selector */}
          <Text style={styles.fieldLabel}>Frequency Code</Text>
          <View style={styles.freqRow}>
            {freqOptions.map((opt) => {
              const isSelected = frequency === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.freqOption, isSelected && styles.freqOptionSelected]}
                  onPress={() => setFrequency(opt.code)}
                >
                  <FrequencyBadge freq={opt.code} size="medium" />
                  <Text
                    style={[
                      styles.freqOptionLabel,
                      isSelected && styles.freqOptionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Weekday selector (only for w) */}
          {frequency === 'w' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Scheduled Work Weekday (1=Mon ... 7=Sun)</Text>
              <View style={styles.weekdayRow}>
                {weekdayNames.map((w) => {
                  const isDaySelected = weekday === w.day;
                  return (
                    <TouchableOpacity
                      key={w.day}
                      style={[
                        styles.weekdayBtn,
                        isDaySelected && styles.weekdayBtnSelected,
                      ]}
                      onPress={() => setWeekday(w.day)}
                    >
                      <Text
                        style={[
                          styles.weekdayText,
                          isDaySelected && styles.weekdayTextSelected,
                        ]}
                      >
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Dates: Start Date & End Date */}
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-11-01"
              />
              <View style={styles.quickDateSuggestions}>
                <TouchableOpacity
                  onPress={() => setStartDate(formatDate(new Date()))}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const now = new Date();
                    setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
                  }}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>1st of Month</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dateCol}>
              <Text style={styles.fieldLabel}>End Date (Optional)</Text>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="Indefinite (leave blank)"
              />
              {endDate ? (
                <TouchableOpacity
                  onPress={() => setEndDate('')}
                  style={styles.suggestionTag}
                >
                  <Text style={styles.suggestionText}>Clear End Date</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Admin / Procedure Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="E.g., Check inverter AC/DC cables, thermal scan switchboard, inspect grease..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>
                Create Schedule Rules ({selectedEquipmentIds.size} Equipment)
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  pillTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  equipmentList: {
    gap: 6,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    minHeight: layout.minTouchTarget,
  },
  equipmentItemSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primaryVeryLight,
  },
  eqInfo: {
    flex: 1,
    marginLeft: 10,
  },
  eqName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  eqNameSelected: {
    fontWeight: '700',
  },
  eqArea: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  freqPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyNotice: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  fieldGroup: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: layout.minTouchTarget,
  },
  freqOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  freqOptionLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  freqOptionLabelSelected: {
    color: colors.primaryDark,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekdayBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: layout.minTouchTarget,
  },
  weekdayBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  weekdayTextSelected: {
    color: colors.white,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  dateCol: {
    flex: 1,
    minWidth: 200,
  },
  dateInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.dark,
    minHeight: layout.minTouchTarget,
  },
  quickDateSuggestions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  suggestionTag: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  suggestionText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.dark,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

