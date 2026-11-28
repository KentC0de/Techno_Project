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
  Switch,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { fetchCategories, fetchGroups, fetchEquipment } from '../lib/dataService';
import { formatDate } from '../utils/schedule';
import { modalA11y } from '../utils/a11y';
import WorkerGroupSelect from './WorkerGroupSelect';
import { useWorkerGroups } from '../hooks/useWorkerGroups';
import { useToast } from './feedback/ToastProvider';
import { colors } from '../theme';

const FREQUENCY_OPTIONS = [
  { value: 'd', label: 'Daily', desc: 'Every day' },
  { value: 'w', label: 'Weekly', desc: 'Selected weekday' },
  { value: 'M', label: 'Monthly', desc: 'Same day each month' },
  { value: 'Q', label: 'Quarterly', desc: 'Every 3 months' },
  { value: 'SA', label: 'Semi-annual', desc: 'Every 6 months' },
];

const WEEKDAY_NAMES = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

/**
 * Module-level SelectField dropdown component for lists with > 8 items.
 */
function SelectField({
  options = [],
  selectedValue,
  onSelect,
  placeholder = 'Select an option...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <View style={styles.selectContainer}>
      <TouchableOpacity
        style={[styles.selectTrigger, isOpen && styles.selectTriggerOpen]}
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.selectTriggerText,
            !selectedOption && styles.selectTriggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#A1A1AA"
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.selectDropdown}>
          <ScrollView
            nestedScrollEnabled
            style={styles.selectDropdownScroll}
            showsVerticalScrollIndicator
          >
            {options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.selectOptionRow,
                    isSelected && styles.selectOptionRowSelected,
                  ]}
                  onPress={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      isSelected && styles.selectOptionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function TaskFormModal({
  visible,
  onClose,
  initialStartDate = null,
  onCreated = null,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Responsive modal dimensions: max-width ~720-760px, width 92vw (95vw on mobile)
  const isMobile = windowWidth < 640;
  const modalWidth = Math.min(windowWidth * (isMobile ? 0.95 : 0.92), 740);
  const isTwoCol = windowWidth >= 640;

  // Selections
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());
  const [equipmentSearch, setEquipmentSearch] = useState('');

  // Schedule parameters
  const [frequency, setFrequency] = useState('d');
  const [startDate, setStartDate] = useState(initialStartDate || formatDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [notes, setNotes] = useState('');

  // Worker group assignment
  const [selectedWorkerGroupId, setSelectedWorkerGroupId] = useState(null);
  const [allowUnassigned, setAllowUnassigned] = useState(false);

  const { groups: workerGroupsList = [], membersByGroup = {} } = useWorkerGroups();

  // Reset/sync startDate when initialStartDate changes and modal opens
  useEffect(() => {
    if (visible) {
      if (initialStartDate) {
        setStartDate(initialStartDate);
      } else {
        setStartDate(formatDate(new Date()));
      }
    }
  }, [visible, initialStartDate]);

  // 1. Categories Query
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
    enabled: visible,
  });

  // Auto-select first category if none selected
  useEffect(() => {
    if (visible && !selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    }
  }, [visible, categories, selectedCatId]);

  // 2. Equipment Groups Query
  const { data: allGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => fetchGroups(null),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups', selectedCatId],
    queryFn: () => fetchGroups(selectedCatId),
    enabled: visible && !!selectedCatId,
    staleTime: 10 * 60 * 1000,
  });

  // 3. All Active Equipment Query (for counts and duplicate naming)
  const { data: allActiveEquipment = [] } = useQuery({
    queryKey: ['equipment', 'all_active'],
    queryFn: () => fetchEquipment({ activeOnly: true }),
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  // Equipment count map per group
  const equipmentCountByGroup = useMemo(() => {
    const map = {};
    allActiveEquipment.forEach((eq) => {
      if (eq.group_id) {
        map[eq.group_id] = (map[eq.group_id] || 0) + 1;
      }
    });
    return map;
  }, [allActiveEquipment]);

  // Set of group names that appear more than once across systems/groups
  const duplicateGroupNames = useMemo(() => {
    const counts = {};
    allGroups.forEach((g) => {
      const name = (g.name || '').trim();
      counts[name] = (counts[name] || 0) + 1;
    });
    const dupes = new Set();
    Object.entries(counts).forEach(([name, count]) => {
      if (count > 1) dupes.add(name);
    });
    return dupes;
  }, [allGroups]);

  // Auto-select first equipment group when categories change or if unselected
  useEffect(() => {
    if (visible && groups.length > 0 && !selectedGroupId) {
      const firstGroup = groups[0];
      setSelectedGroupId(firstGroup.id);
    }
  }, [visible, groups, selectedGroupId]);

  // 4. Equipment Query for the selected group
  const { data: equipmentList = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ['equipment', selectedGroupId],
    queryFn: () => fetchEquipment(selectedGroupId),
    enabled: visible && !!selectedGroupId,
    staleTime: 5 * 60 * 1000,
  });

  // When equipment list loads, if no equipment is selected, pick the first one by default
  useEffect(() => {
    if (visible && equipmentList.length > 0 && selectedEquipmentIds.size === 0) {
      const first = equipmentList[0];
      if (first) {
        setSelectedEquipmentIds(new Set([first.id]));
        const firstFreq = first.default_freq?.[0];
        if (firstFreq) {
          setFrequency(firstFreq);
        }
      }
    }
  }, [visible, equipmentList, selectedEquipmentIds.size]);

  // Event handlers that explicitly reset child selections
  const handleCategoryChange = useCallback((catId) => {
    setSelectedCatId(catId);
    setSelectedGroupId(null);
    setSelectedArea('All');
    setSelectedEquipmentIds(new Set());
    setEquipmentSearch('');
  }, []);

  const handleGroupChange = useCallback((groupId) => {
    setSelectedGroupId(groupId);
    setSelectedArea('All');
    setSelectedEquipmentIds(new Set());
    setEquipmentSearch('');
  }, []);

  // Distinct areas from equipmentList
  const distinctAreas = useMemo(() => {
    const set = new Set();
    equipmentList.forEach((eq) => {
      if (eq.area) set.add(eq.area);
    });
    return Array.from(set).sort();
  }, [equipmentList]);

  // Filtered equipment list based on Area and Search
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      if (selectedArea !== 'All' && eq.area !== selectedArea) return false;
      if (equipmentSearch.trim()) {
        const query = equipmentSearch.toLowerCase().trim();
        const matchesName = (eq.name || '').toLowerCase().includes(query);
        const matchesCode = (eq.code || '').toLowerCase().includes(query);
        const matchesArea = (eq.area || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesArea) return false;
      }
      return true;
    });
  }, [equipmentList, selectedArea, equipmentSearch]);

  const toggleEquipment = useCallback((id) => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      filteredEquipment.forEach((eq) => next.add(eq.id));
      return next;
    });
  }, [filteredEquipment]);

  const clearAllFiltered = useCallback(() => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      filteredEquipment.forEach((eq) => next.delete(eq.id));
      return next;
    });
  }, [filteredEquipment]);

  // Validation
  const validationError = useMemo(() => {
    if (selectedEquipmentIds.size === 0) {
      return 'Please select at least one piece of equipment.';
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return 'Start date must be in YYYY-MM-DD format.';
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return 'End date must be in YYYY-MM-DD format.';
    }
    if (endDate && endDate < startDate) {
      return 'End date cannot be earlier than start date.';
    }
    if (!allowUnassigned && !selectedWorkerGroupId) {
      return 'Please choose a worker group to continue.';
    }
    return null;
  }, [selectedEquipmentIds.size, startDate, endDate, allowUnassigned, selectedWorkerGroupId]);

  // Specific hint next to disabled button
  const disabledHint = useMemo(() => {
    if (!validationError) return null;
    if (selectedEquipmentIds.size === 0) {
      return 'Select at least 1 equipment';
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return 'Enter valid start date';
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return 'Enter valid end date';
    }
    if (endDate && endDate < startDate) {
      return 'End date is before start date';
    }
    if (!allowUnassigned && !selectedWorkerGroupId) {
      return 'Choose a worker group to continue';
    }
    return validationError;
  }, [validationError, selectedEquipmentIds.size, startDate, endDate, allowUnassigned, selectedWorkerGroupId]);

  // Warnings
  const warnings = useMemo(() => {
    const list = [];
    if (selectedWorkerGroupId) {
      const members = membersByGroup[selectedWorkerGroupId] || [];
      if (members.length === 0) {
        list.push('Selected worker group currently has 0 active workers assigned to it.');
      }
    }
    if (frequency === 'M' || frequency === 'Q' || frequency === 'SA') {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const dayNum = parseInt(parts[2], 10);
        if (dayNum >= 29) {
          list.push(`Tasks scheduled on day ${dayNum} may skip shorter months (like February).`);
        }
      }
    }
    return list;
  }, [selectedWorkerGroupId, membersByGroup, frequency, startDate]);

  // Mutation
  const createRulesMutation = useMutation({
    mutationFn: async (payload) => {
      console.log('[Create Task Payload]:', payload);

      if (!isConfigured || !supabase) {
        throw new Error('Supabase is not configured.');
      }

      const targetGroupId = payload.groupId;

      // 1. Try create_schedule_rules_for_group RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_schedule_rules_for_group',
        {
          p_equipment_ids: payload.equipmentIds,
          p_frequency: payload.frequency,
          p_start_date: payload.startDate,
          p_end_date: payload.endDate || null,
          p_weekday: payload.frequency === 'w' ? payload.weekday : null,
          p_notes: payload.notes || null,
          p_group_id: targetGroupId,
        }
      );

      if (!rpcError) {
        return rpcData;
      }

      if (rpcError.code === '23505') {
        throw new Error('A task with the same equipment, frequency, and start date already exists.');
      }

      // 2. Direct table insert fallback if RPC is missing
      console.warn('[Create Task] RPC returned error, attempting direct table insert fallback:', rpcError.message);

      const rowsToInsert = payload.equipmentIds.map((eqId) => ({
        equipment_id: eqId,
        frequency: payload.frequency,
        start_date: payload.startDate,
        end_date: payload.endDate || null,
        weekday: payload.frequency === 'w' ? payload.weekday : null,
        notes: payload.notes || null,
        worker_group_id: targetGroupId,
      }));

      const { data: tableData, error: tableError } = await supabase
        .from('schedule_rules')
        .insert(rowsToInsert)
        .select();

      if (tableError) {
        if (tableError.code === '23505') {
          throw new Error('A task with the same equipment, frequency, and start date already exists.');
        }
        throw tableError;
      }

      return tableData;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
      queryClient.invalidateQueries({ queryKey: ['recent_schedule_rules'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['worker_groups'] });
      queryClient.invalidateQueries({ queryKey: ['schedule_rules_group_counts'] });

      const count = variables.equipmentIds.length;
      toast.success(`Successfully created ${count} ${count === 1 ? 'task' : 'tasks'}!`);

      if (onCreated) {
        onCreated({
          count,
          startDate: variables.startDate,
          equipmentIds: variables.equipmentIds,
        });
      }

      onClose();
    },
    onError: (err) => {
      console.error('[Create Task Error]:', err);
      toast.error(err.message || 'Failed to create task. Please try again.');
    },
  });

  // Direct Submission handler
  const handleSubmit = useCallback(async () => {
    if (validationError) return;

    const payload = {
      equipmentIds: Array.from(selectedEquipmentIds),
      frequency,
      startDate,
      endDate: endDate.trim() ? endDate.trim() : null,
      weekday: frequency === 'w' ? weekday : null,
      notes: notes.trim() ? notes.trim() : null,
      groupId: allowUnassigned ? null : selectedWorkerGroupId || null,
    };

    createRulesMutation.mutate(payload);
  }, [
    validationError,
    selectedEquipmentIds,
    frequency,
    startDate,
    endDate,
    weekday,
    notes,
    allowUnassigned,
    selectedWorkerGroupId,
    createRulesMutation,
  ]);

  // Options for Dropdown when groups > 8
  const groupDropdownOptions = useMemo(() => {
    return groups.map((grp) => {
      const eqCount = equipmentCountByGroup[grp.id] || 0;
      return {
        value: grp.id,
        label: `${grp.name} (${eqCount})`,
      };
    });
  }, [groups, equipmentCountByGroup]);

  // Active group object for duplicate check
  const currentActiveGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCatId) || null;
  }, [categories, selectedCatId]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...modalA11y('Add Task Modal')}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            {
              width: modalWidth,
              maxHeight: windowHeight * 0.90, // Strict 90vh max height
            },
          ]}
        >
          {/* Fixed Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>Add Task</Text>
              <Text style={styles.subtitleText}>
                Schedule a maintenance task and assign it to a worker group
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {/* Row 1: System & Equipment Group */}
            <View style={[styles.responsiveRow, isTwoCol && styles.twoColRow]}>
              {/* Category / System */}
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>System</Text>
                {loadingCategories ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.wrappingChipRow}>
                    {categories.map((cat) => {
                      const isSelected = selectedCatId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.chip, isSelected && styles.chipActive]}
                          onPress={() => handleCategoryChange(cat.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.chipText, isSelected && styles.chipTextActive]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Equipment Group */}
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Equipment Group</Text>
                {loadingGroups ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : groups.length === 0 ? (
                  <Text style={styles.emptyText}>No groups found</Text>
                ) : groups.length > 8 ? (
                  <SelectField
                    options={groupDropdownOptions}
                    selectedValue={selectedGroupId}
                    onSelect={handleGroupChange}
                    placeholder="Choose equipment group..."
                  />
                ) : (
                  <View style={styles.wrappingChipRow}>
                    {groups.map((grp) => {
                      const isSelected = selectedGroupId === grp.id;
                      const eqCount = equipmentCountByGroup[grp.id] || 0;
                      return (
                        <TouchableOpacity
                          key={grp.id}
                          style={[styles.chip, isSelected && styles.chipActive]}
                          onPress={() => handleGroupChange(grp.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.chipText, isSelected && styles.chipTextActive]}
                          >
                            {grp.name} ({eqCount})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Row 2: Area Filter & Frequency */}
            <View style={[styles.responsiveRow, isTwoCol && styles.twoColRow]}>
              {/* Area */}
              {distinctAreas.length > 0 && (
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Area Filter</Text>
                  <View style={styles.wrappingChipRow}>
                    <TouchableOpacity
                      style={[styles.chip, selectedArea === 'All' && styles.chipActive]}
                      onPress={() => setSelectedArea('All')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedArea === 'All' && styles.chipTextActive,
                        ]}
                      >
                        All Areas
                      </Text>
                    </TouchableOpacity>
                    {distinctAreas.map((area) => {
                      const isSelected = selectedArea === area;
                      return (
                        <TouchableOpacity
                          key={area}
                          style={[styles.chip, isSelected && styles.chipActive]}
                          onPress={() => setSelectedArea(area)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {area}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Frequency */}
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.wrappingChipRow}>
                  {FREQUENCY_OPTIONS.map((opt) => {
                    const isSelected = frequency === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setFrequency(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Weekday Picker (if Weekly) */}
            {frequency === 'w' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.fieldLabel}>Run on Day of Week</Text>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_NAMES.map((w) => {
                    const isSelected = weekday === w.day;
                    return (
                      <TouchableOpacity
                        key={w.day}
                        style={[
                          styles.weekdayChip,
                          isSelected && styles.weekdayChipActive,
                        ]}
                        onPress={() => setWeekday(w.day)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.weekdayText,
                            isSelected && styles.weekdayTextActive,
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

            {/* Row 3: Dates */}
            <View style={[styles.responsiveRow, isTwoCol && styles.twoColRow]}>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Start date</Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>End date (optional)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>
            </View>

            {/* Full-width: Target Equipment */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.fieldLabel}>Target Equipment</Text>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>
                      {selectedEquipmentIds.size} / {filteredEquipment.length} selected
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={selectAllFiltered}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionLinkText}>Select All</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#3F3F46', fontSize: 13 }}>|</Text>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={clearAllFiltered}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionLinkText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Filter */}
              <View style={styles.searchInputWrap}>
                <Ionicons
                  name="search-outline"
                  size={15}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={equipmentSearch}
                  onChangeText={setEquipmentSearch}
                  placeholder="Filter equipment by name or code..."
                  placeholderTextColor="#64748B"
                />
                {equipmentSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setEquipmentSearch('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Scrollable Checklist */}
              {loadingEquipment ? (
                <View style={styles.equipmentLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.emptyText}>Loading equipment...</Text>
                </View>
              ) : filteredEquipment.length === 0 ? (
                <View style={styles.equipmentEmpty}>
                  <Text style={styles.emptyText}>No matching equipment found.</Text>
                </View>
              ) : (
                <View style={styles.equipmentListContainer}>
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.equipmentScroll}
                    showsVerticalScrollIndicator
                  >
                    {filteredEquipment.map((eq) => {
                      const isChecked = selectedEquipmentIds.has(eq.id);
                      const isDupeGroupName = currentActiveGroup && duplicateGroupNames.has(currentActiveGroup.name);
                      const systemPrefix = activeCategory?.code ? `System ${activeCategory.code}` : null;
                      const groupSubtitle = isDupeGroupName && currentActiveGroup
                        ? `${systemPrefix ? `${systemPrefix} • ` : ''}${currentActiveGroup.name}`
                        : null;

                      return (
                        <TouchableOpacity
                          key={eq.id}
                          style={[
                            styles.equipmentItemRow,
                            isChecked && styles.equipmentItemRowChecked,
                          ]}
                          onPress={() => toggleEquipment(eq.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={isChecked ? colors.primary : '#64748B'}
                          />
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text
                              style={[
                                styles.equipmentItemName,
                                isChecked && styles.equipmentItemNameChecked,
                              ]}
                            >
                              {eq.name}
                            </Text>
                            <Text style={styles.equipmentItemSub}>
                              {groupSubtitle ? `${groupSubtitle} • ` : ''}
                              {eq.area ? `Area: ${eq.area}` : 'Main'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Full-width: Worker Group Assignment */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.fieldLabel}>Assign to Worker Group</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.switchLabel}>Allow unassigned</Text>
                  <Switch
                    value={allowUnassigned}
                    onValueChange={(val) => {
                      setAllowUnassigned(val);
                      if (val) setSelectedWorkerGroupId(null);
                    }}
                    trackColor={{ false: '#26262B', true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>

              {!allowUnassigned ? (
                <WorkerGroupSelect
                  selectedGroupId={selectedWorkerGroupId}
                  onSelectGroup={(id) => setSelectedWorkerGroupId(id)}
                  allowUnassigned={false}
                />
              ) : (
                <View style={styles.unassignedBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#A1A1AA" />
                  <Text style={styles.unassignedBannerText}>
                    Tasks will be created with no assigned group (open to all).
                  </Text>
                </View>
              )}
            </View>

            {/* Full-width: Notes */}
            <View style={styles.sectionBlock}>
              <Text style={styles.fieldLabel}>Notes / Instructions (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Specific instructions or tools required..."
                placeholderTextColor="#52525B"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Warnings Box */}
            {warnings.length > 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color="#FBBF24" />
                <View style={{ flex: 1, gap: 2 }}>
                  {warnings.map((warn, i) => (
                    <Text key={i} style={styles.warningText}>
                      • {warn}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Validation Error Line */}
            {validationError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color="#F87171" />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}
          </ScrollView>

          {/* Fixed Footer */}
          <View style={styles.footerRow}>
            {/* Disabled hint message when form is invalid */}
            <View style={styles.hintContainer}>
              {disabledHint ? (
                <View style={styles.hintRow}>
                  <Ionicons name="information-circle" size={14} color="#94A3B8" />
                  <Text style={styles.hintText} numberOfLines={1}>{disabledHint}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerButtonsGroup}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !!validationError && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!!validationError || createRulesMutation.isPending}
                activeOpacity={0.8}
              >
                {createRulesMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={15} color={colors.white} />
                    <Text style={styles.submitBtnText}>
                      Create {selectedEquipmentIds.size > 0 ? `${selectedEquipmentIds.size} ` : ''}
                      {selectedEquipmentIds.size === 1 ? 'Task' : 'Tasks'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: '#26262B',
    borderRadius: 14,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F24',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#18181B',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  responsiveRow: {
    flexDirection: 'column',
    gap: 12,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4D4D8',
    letterSpacing: 0.3,
  },
  wrappingChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'center',
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#1C5089',
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4D4D8',
    textAlign: 'center',
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  weekdayChip: {
    flex: 1,
    minWidth: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  weekdayChipActive: {
    backgroundColor: '#1C5089',
    borderColor: colors.primary,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  weekdayTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: colors.white,
    fontSize: 13,
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingVertical: 8,
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  badgeCount: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  actionBtn: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  equipmentLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#15151A',
    borderRadius: 8,
    justifyContent: 'center',
  },
  equipmentEmpty: {
    padding: 14,
    backgroundColor: '#15151A',
    borderRadius: 8,
    alignItems: 'center',
  },
  equipmentListContainer: {
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    backgroundColor: '#121216',
    maxHeight: 180,
    overflow: 'hidden',
  },
  equipmentScroll: {
    flex: 1,
  },
  equipmentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A20',
  },
  equipmentItemRowChecked: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  equipmentItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4D4D8',
  },
  equipmentItemNameChecked: {
    color: colors.white,
    fontWeight: '700',
  },
  equipmentItemSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  unassignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unassignedBannerText: {
    fontSize: 12,
    color: '#A1A1AA',
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 10,
  },
  warningText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F87171',
    flex: 1,
  },
  emptyText: {
    fontSize: 12,
    color: '#71717A',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F1F24',
    backgroundColor: '#0F0F12',
    flexWrap: 'wrap',
    gap: 8,
  },
  hintContainer: {
    flex: 1,
    minWidth: 160,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  footerButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4D4D8',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 8,
    minWidth: 120,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  // Dropdown Select styles
  selectContainer: {
    width: '100%',
    position: 'relative',
  },
  selectTrigger: {
    height: 38,
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerOpen: {
    borderColor: colors.primary,
  },
  selectTriggerText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  selectTriggerPlaceholder: {
    color: '#52525B',
  },
  selectDropdown: {
    marginTop: 4,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    maxHeight: 180,
    overflow: 'hidden',
  },
  selectDropdownScroll: {
    flex: 1,
  },
  selectOptionRow: {
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
  },
  selectOptionRowSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  selectOptionText: {
    fontSize: 12,
    color: '#D4D4D8',
    fontWeight: '500',
  },
  selectOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
