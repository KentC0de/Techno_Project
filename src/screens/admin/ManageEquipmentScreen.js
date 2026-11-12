import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
  createEquipment,
  updateEquipment,
  createGroup,
} from '../../lib/dataService';
import Header from '../../components/Header';
import PageContainer from '../../components/PageContainer';
import FrequencyBadge from '../../components/FrequencyBadge';
import { useSystemFilter } from '../../context/SystemFilterContext';
import { colors, layout } from '../../theme';

// Normalization helper for duplicate detection
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\u00D7\u2715]/g, 'x')
    .replace(/\s*x\s*\d+/g, '')
    .replace(/\bunit\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ManageEquipmentScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { selectedSystem, setSelectedSystem, systemOptions } = useSystemFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDedupeBanner, setShowDedupeBanner] = useState(true);
  const [expandDuplicates, setExpandDuplicates] = useState(false);

  // Equipment Modal (Add/Edit)
  const [eqModalVisible, setEqModalVisible] = useState(false);
  const [editingEq, setEditingEq] = useState(null);
  const [eqName, setEqName] = useState('');
  const [eqGroupId, setEqGroupId] = useState(null);
  const [eqArea, setEqArea] = useState('None');
  const [eqUnitCount, setEqUnitCount] = useState('1');
  const [eqDefaultFreq, setEqDefaultFreq] = useState(['d']);
  const [eqIsActive, setEqIsActive] = useState(true);

  // Group Modal (Add)
  const [grpModalVisible, setGrpModalVisible] = useState(false);
  const [grpCatId, setGrpCatId] = useState(null);
  const [grpItemNo, setGrpItemNo] = useState('');
  const [grpName, setGrpName] = useState('');

  // 1. Categories query (reference data: 10m cache)
  const {
    data: categories = [],
    isLoading: loadingCats,
    isError: errorCats,
    refetch: refetchCats,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  // 2. Groups query (all groups across systems: 10m cache)
  const {
    data: allGroups = [],
    isLoading: loadingGroups,
    isError: errorGroups,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ['groups_all'],
    queryFn: () => fetchGroups(null),
    staleTime: 10 * 60 * 1000,
  });

  // 3. Equipment query (all equipment with relations: 10m cache)
  const {
    data: equipmentList = [],
    isLoading: loadingEq,
    isError: errorEq,
    refetch: refetchEq,
  } = useQuery({
    queryKey: ['equipment_all'],
    queryFn: () => fetchEquipment({ activeOnly: false, includeRelations: true }),
    staleTime: 10 * 60 * 1000,
  });

  // Keep grpCatId synced with current selected category (or first category if 'ALL')
  useEffect(() => {
    if (categories.length > 0) {
      if (selectedSystem !== 'ALL') {
        const matchingCat = categories.find((c) => c.code === selectedSystem);
        if (matchingCat) setGrpCatId(matchingCat.id);
      } else if (!grpCatId) {
        setGrpCatId(categories[0].id);
      }
    }
  }, [categories, selectedSystem, grpCatId]);

  // Mutations
  const saveEquipmentMutation = useMutation({
    mutationFn: async ({ isEditing, id, payload }) => {
      if (isEditing) {
        return updateEquipment(id, payload);
      }
      return createEquipment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment_all'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setEqModalVisible(false);
    },
    onError: (err) => {
      const msg = err.message || 'Failed to save equipment.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateEquipment(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment_all'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
    onError: (err) => {
      const msg = err.message || 'Failed to update status.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const saveGroupMutation = useMutation({
    mutationFn: (newGrp) => createGroup(newGrp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups_all'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setGrpModalVisible(false);
      setGrpName('');
      setGrpItemNo('');
    },
    onError: (err) => {
      const msg = err.message || 'Failed to create group.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const loading = loadingCats || loadingEq || loadingGroups;
  const hasQueryError = errorCats || errorEq || errorGroups;
  const eqSaving = saveEquipmentMutation.isPending;
  const grpSaving = saveGroupMutation.isPending;

  // Equipment count per category
  const countsPerCategory = useMemo(() => {
    const counts = { ALL: equipmentList.length };
    categories.forEach((cat) => {
      counts[cat.code] = 0;
    });
    equipmentList.forEach((eq) => {
      const code = eq.group?.category?.code;
      if (code && counts[code] !== undefined) {
        counts[code] += 1;
      }
    });
    return counts;
  }, [equipmentList, categories]);

  // Duplicate detection scan (Groups with same normalized name in category, Equipment with same normalized name in group)
  const duplicatesReport = useMemo(() => {
    const duplicateGroups = [];
    const duplicateEquipment = [];

    // Group-level duplicates
    const groupsByCat = {};
    allGroups.forEach((g) => {
      const catKey = g.category_id || 'unknown';
      if (!groupsByCat[catKey]) groupsByCat[catKey] = [];
      groupsByCat[catKey].push(g);
    });

    Object.values(groupsByCat).forEach((grpList) => {
      const seen = {};
      grpList.forEach((g) => {
        const norm = normalizeName(g.name);
        if (!norm) return;
        if (!seen[norm]) seen[norm] = [];
        seen[norm].push(g);
      });
      Object.entries(seen).forEach(([norm, list]) => {
        if (list.length > 1) {
          duplicateGroups.push({
            name: list[0].name,
            normalized: norm,
            items: list,
          });
        }
      });
    });

    // Equipment-level duplicates
    const eqByGroup = {};
    equipmentList.forEach((eq) => {
      const gId = eq.group_id || 'unknown';
      if (!eqByGroup[gId]) eqByGroup[gId] = [];
      eqByGroup[gId].push(eq);
    });

    Object.values(eqByGroup).forEach((eqItemList) => {
      const seen = {};
      eqItemList.forEach((e) => {
        const norm = `${normalizeName(e.name)}|${e.area || ''}`;
        if (!seen[norm]) seen[norm] = [];
        seen[norm].push(e);
      });
      Object.entries(seen).forEach(([norm, list]) => {
        if (list.length > 1) {
          duplicateEquipment.push({
            name: list[0].name,
            area: list[0].area,
            groupName: list[0].group?.name,
            items: list,
          });
        }
      });
    });

    const totalDuplicates = duplicateGroups.length + duplicateEquipment.length;
    return {
      total: totalDuplicates,
      duplicateGroups,
      duplicateEquipment,
    };
  }, [allGroups, equipmentList]);

  // Filter equipment based on selected system and search query
  const filteredEq = useMemo(() => {
    return equipmentList.filter((eq) => {
      const catCode = eq.group?.category?.code;
      const matchesSystem = selectedSystem === 'ALL' || catCode === selectedSystem;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        eq.name?.toLowerCase().includes(q) ||
        eq.group?.name?.toLowerCase().includes(q) ||
        eq.area?.toLowerCase().includes(q);
      return matchesSystem && matchesSearch;
    });
  }, [equipmentList, selectedSystem, searchQuery]);

  // Group filtered equipment by group for organized display
  const groupedEquipment = useMemo(() => {
    const map = new Map();
    filteredEq.forEach((eq) => {
      const grp = eq.group || { id: 'unassigned', item_no: 999, name: 'Unassigned Group' };
      const grpId = grp.id || 'unassigned';
      if (!map.has(grpId)) {
        map.set(grpId, {
          group: grp,
          items: [],
        });
      }
      map.get(grpId).items.push(eq);
    });

    // Sort by item_no
    return Array.from(map.values()).sort((a, b) => (a.group.item_no || 0) - (b.group.item_no || 0));
  }, [filteredEq]);

  // Dev diagnostic logging
  useEffect(() => {
    if (__DEV__) {
      console.log('[ManageEquipmentScreen Dev Diagnostics]', {
        totalCategories: categories.length,
        totalGroups: allGroups.length,
        totalEquipment: equipmentList.length,
        selectedSystem,
        countInSelectedSystem: countsPerCategory[selectedSystem] || 0,
        searchQuery: searchQuery || '(none)',
        filteredCount: filteredEq.length,
        groupsRendered: groupedEquipment.length,
        detectedDuplicates: duplicatesReport.total,
      });
    }
  }, [
    categories.length,
    allGroups.length,
    equipmentList.length,
    selectedSystem,
    countsPerCategory,
    searchQuery,
    filteredEq.length,
    groupedEquipment.length,
    duplicatesReport.total,
  ]);

  const handleSystemTabSelect = (code) => {
    setSelectedSystem(code);
  };

  const openAddEquipment = () => {
    setEditingEq(null);
    setEqName('');
    const availableGroups =
      selectedSystem === 'ALL'
        ? allGroups
        : allGroups.filter((g) => {
            const cat = categories.find((c) => c.id === g.category_id);
            return cat?.code === selectedSystem;
          });
    setEqGroupId(availableGroups.length > 0 ? availableGroups[0].id : allGroups[0]?.id || null);
    setEqArea('None');
    setEqUnitCount('1');
    setEqDefaultFreq(['d']);
    setEqIsActive(true);
    setEqModalVisible(true);
  };

  const openEditEquipment = (eq) => {
    setEditingEq(eq);
    setEqName(eq.name || '');
    setEqGroupId(eq.group_id);
    setEqArea(eq.area || 'None');
    setEqUnitCount(String(eq.unit_count || 1));
    setEqDefaultFreq(eq.default_freq || []);
    setEqIsActive(eq.is_active ?? true);
    setEqModalVisible(true);
  };

  const toggleFreq = (code) => {
    if (eqDefaultFreq.includes(code)) {
      setEqDefaultFreq(eqDefaultFreq.filter((f) => f !== code));
    } else {
      setEqDefaultFreq([...eqDefaultFreq, code]);
    }
  };

  const handleSaveEquipment = () => {
    if (!eqName.trim() || !eqGroupId) {
      const msg = 'Please provide equipment name and group.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Validation Error', msg);
      }
      return;
    }

    const payload = {
      name: eqName.trim(),
      group_id: eqGroupId,
      area: eqArea === 'None' ? null : eqArea,
      unit_count: parseInt(eqUnitCount, 10) || 1,
      default_freq: eqDefaultFreq,
      is_active: eqIsActive,
    };

    saveEquipmentMutation.mutate({
      isEditing: !!editingEq,
      id: editingEq?.id,
      payload,
    });
  };

  const handleToggleActive = (eq) => {
    toggleActiveMutation.mutate({ id: eq.id, is_active: !eq.is_active });
  };

  const handleSaveGroup = () => {
    if (!grpName.trim() || !grpCatId) {
      const msg = 'Please provide a group name and category.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Validation Error', msg);
      }
      return;
    }

    const catGroups = allGroups.filter((g) => g.category_id === grpCatId);
    saveGroupMutation.mutate({
      category_id: grpCatId,
      item_no: grpItemNo ? parseInt(grpItemNo, 10) : catGroups.length + 1,
      name: grpName.trim(),
    });
  };

  const handleRetry = () => {
    refetchCats();
    refetchGroups();
    refetchEq();
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Manage Equipment"
        subtitle="Configure solar field equipment, groups and systems"
        navigation={navigation}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.topBtn} onPress={openAddEquipment}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.topBtnText}>Add Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topBtn, { backgroundColor: colors.darkSurface, borderColor: '#333', borderWidth: 1 }]}
              onPress={() => setGrpModalVisible(true)}
            >
              <Ionicons name="folder-outline" size={18} color={colors.white} />
              <Text style={styles.topBtnText}>Add Group</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <PageContainer>
        {/* Error Banner with Retry */}
        {hasQueryError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.errorBannerText}>
              Unable to load equipment data. Please check your Supabase connection.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Duplicate Notice Banner (Dismissible) */}
        {showDedupeBanner && duplicatesReport.total > 0 && (
          <View style={styles.dedupeBanner}>
            <View style={styles.dedupeHeaderRow}>
              <View style={styles.dedupeLeft}>
                <Ionicons name="copy-outline" size={18} color="#D97706" />
                <Text style={styles.dedupeTitle}>
                  Possible duplicates found ({duplicatesReport.total}). Review before scheduling.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setExpandDuplicates((v) => !v)}
                  style={styles.dedupeActionBtn}
                >
                  <Text style={styles.dedupeActionText}>
                    {expandDuplicates ? 'Hide details' : 'Review details'}
                  </Text>
                  <Ionicons
                    name={expandDuplicates ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#D97706"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDedupeBanner(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#78716C" />
                </TouchableOpacity>
              </View>
            </View>

            {expandDuplicates && (
              <View style={styles.dedupeDetails}>
                <Text style={styles.dedupeHelpText}>
                  A SQL script with a safe ROLLBACK transaction is ready at docs/dedupe_review.sql to merge these records cleanly.
                </Text>
                {duplicatesReport.duplicateGroups.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.dedupeSubheading}>Duplicate Groups ({duplicatesReport.duplicateGroups.length}):</Text>
                    {duplicatesReport.duplicateGroups.map((g, idx) => (
                      <Text key={idx} style={styles.dedupeItemText}>
                        • "{g.name}" ({g.items.length} records)
                      </Text>
                    ))}
                  </View>
                )}
                {duplicatesReport.duplicateEquipment.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.dedupeSubheading}>Duplicate Equipment ({duplicatesReport.duplicateEquipment.length}):</Text>
                    {duplicatesReport.duplicateEquipment.map((e, idx) => (
                      <Text key={idx} style={styles.dedupeItemText}>
                        • "{e.name}" in {e.groupName || 'group'}{e.area ? ` (${e.area})` : ''} ({e.items.length} records)
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Category Filter Pills (Unified with Sidebar SystemFilterContext) */}
        <View style={styles.categoryBar}>
          {systemOptions.map((opt) => {
            const isSelected = selectedSystem === opt.id;
            const count = countsPerCategory[opt.id] ?? 0;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.catPill, isSelected && styles.catPillActive]}
                onPress={() => handleSystemTabSelect(opt.id)}
              >
                <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                  {opt.id === 'ALL' ? 'All Systems' : `${opt.code}. ${opt.label.split(' - ')[1] || opt.label}`} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search equipment by name, group, or area..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Equipment List grouped by group */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        ) : filteredEq.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {equipmentList.length === 0
                ? 'No equipment found in the database. Run the seed SQL script in Supabase to initialize.'
                : searchQuery
                ? `No equipment matching "${searchQuery}" in ${selectedSystem === 'ALL' ? 'any system' : `System ${selectedSystem}`}.`
                : `No equipment found for ${selectedSystem === 'ALL' ? 'All Systems' : `System ${selectedSystem}`}.`}
            </Text>
            {(searchQuery || selectedSystem !== 'ALL') && equipmentList.length > 0 && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedSystem('ALL');
                }}
              >
                <Text style={styles.clearFilterText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          groupedEquipment.map(({ group, items }) => (
            <View key={group.id} style={styles.groupSection}>
              {/* Group Header */}
              <View style={styles.groupSectionHeader}>
                <View style={styles.groupHeaderLeft}>
                  <View style={styles.groupItemBadge}>
                    <Text style={styles.groupItemBadgeText}>{group.item_no || '•'}</Text>
                  </View>
                  <Text style={styles.groupSectionTitle}>{group.name}</Text>
                  <Text style={styles.groupSectionCount}>({items.length})</Text>
                </View>
              </View>

              {/* Equipment Items in this group */}
              {items.map((eq) => (
                <View
                  key={eq.id}
                  style={[
                    styles.eqRowCard,
                    !eq.is_active && styles.eqRowCardInactive,
                  ]}
                >
                  <View style={styles.eqDetails}>
                    <View style={styles.eqTitleRow}>
                      <Text style={[styles.eqName, !eq.is_active && styles.textMuted]}>
                        {eq.name}
                      </Text>
                      {eq.area && (
                        <View style={styles.areaChip}>
                          <Text style={styles.areaChipText}>{eq.area}</Text>
                        </View>
                      )}
                      {!eq.is_active && (
                        <View style={styles.inactiveTag}>
                          <Text style={styles.inactiveText}>Inactive</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.eqSubinfo}>
                      {eq.group?.category ? `System ${eq.group.category.code} • ` : ''}
                      {group.name}
                      {eq.unit_count > 1 ? ` • ${eq.unit_count} units` : ''}
                    </Text>

                    {eq.default_freq && eq.default_freq.length > 0 && (
                      <View style={styles.freqRow}>
                        <Text style={styles.freqLabel}>Default:</Text>
                        {eq.default_freq.map((f) => (
                          <FrequencyBadge key={f} freq={f} size="small" />
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.eqActions}>
                    {/* Active switch */}
                    <View style={styles.switchWrap}>
                      <Text style={styles.switchLabel}>
                        {eq.is_active ? 'Active' : 'Off'}
                      </Text>
                      <Switch
                        value={eq.is_active}
                        onValueChange={() => handleToggleActive(eq)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.white}
                      />
                    </View>

                    {/* Edit button */}
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditEquipment(eq)}
                      title="Edit Equipment"
                    >
                      <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        {/* Equipment Modal (Add / Edit) */}
        <Modal
          visible={eqModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEqModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingEq ? 'Edit Equipment' : 'Add New Equipment'}
                </Text>
                <TouchableOpacity onPress={() => setEqModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={styles.fieldLabel}>Equipment Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={eqName}
                  onChangeText={setEqName}
                  placeholder="E.g., Inverter 13, Transformer 7..."
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Group *</Text>
                <View style={styles.groupPills}>
                  {allGroups.map((grp) => (
                    <TouchableOpacity
                      key={grp.id}
                      style={[
                        styles.groupPill,
                        eqGroupId === grp.id && styles.groupPillSelected,
                      ]}
                      onPress={() => setEqGroupId(grp.id)}
                    >
                      <Text
                        style={[
                          styles.groupPillText,
                          eqGroupId === grp.id && styles.groupPillTextSelected,
                        ]}
                      >
                        {grp.item_no}. {grp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Area (Optional)</Text>
                <View style={styles.areaOptionsRow}>
                  {['None', 'Area 1', 'Area 2', 'Area 3'].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[
                        styles.areaOptBtn,
                        eqArea === a && styles.areaOptBtnSelected,
                      ]}
                      onPress={() => setEqArea(a)}
                    >
                      <Text
                        style={[
                          styles.areaOptText,
                          eqArea === a && styles.areaOptTextSelected,
                        ]}
                      >
                        {a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Units Count</Text>
                <TextInput
                  style={styles.modalInput}
                  value={eqUnitCount}
                  onChangeText={setEqUnitCount}
                  placeholder="1"
                  keyboardType="numeric"
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Default Frequencies</Text>
                <View style={styles.freqToggleRow}>
                  {['d', 'w', 'M', 'Q', 'SA'].map((f) => {
                    const isSelected = eqDefaultFreq.includes(f);
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[
                          styles.freqToggleBtn,
                          isSelected && styles.freqToggleBtnSelected,
                        ]}
                        onPress={() => toggleFreq(f)}
                      >
                        <FrequencyBadge freq={f} size="small" />
                        <Text style={[styles.freqToggleText, isSelected && { color: colors.white }]}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalSwitchRow}>
                  <Text style={styles.fieldLabel}>Active Status</Text>
                  <Switch
                    value={eqIsActive}
                    onValueChange={setEqIsActive}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setEqModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveEquipment}
                    disabled={eqSaving}
                  >
                    {eqSaving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Group Modal */}
        <Modal
          visible={grpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGrpModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Equipment Group</Text>
                <TouchableOpacity onPress={() => setGrpModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.groupPills}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.groupPill,
                      grpCatId === c.id && styles.groupPillSelected,
                    ]}
                    onPress={() => setGrpCatId(c.id)}
                  >
                    <Text
                      style={[
                        styles.groupPillText,
                        grpCatId === c.id && styles.groupPillTextSelected,
                      ]}
                    >
                      {c.code}. {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Item Number (e.g. 6)</Text>
              <TextInput
                style={styles.modalInput}
                value={grpItemNo}
                onChangeText={setGrpItemNo}
                placeholder="Item No"
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Group Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={grpName}
                onChangeText={setGrpName}
                placeholder="E.g., Solar Tracker Motors..."
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setGrpModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveGroup}
                  disabled={grpSaving}
                >
                  {grpSaving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Create Group</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  topBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  dedupeBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  dedupeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dedupeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  dedupeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  dedupeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FEF3C7',
  },
  dedupeActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  dedupeDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  dedupeHelpText: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 6,
  },
  dedupeSubheading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  dedupeItemText: {
    fontSize: 11,
    color: '#78350F',
    marginLeft: 6,
    marginBottom: 2,
  },
  categoryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  catPill: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  catPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  catPillTextActive: {
    color: colors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: layout.minTouchTarget,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 420,
  },
  clearFilterBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 8,
  },
  clearFilterText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  groupSection: {
    marginBottom: 18,
  },
  groupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupItemBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupItemBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  groupSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  groupSectionCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  eqRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  eqRowCardInactive: {
    backgroundColor: '#F8FAFC',
    opacity: 0.7,
  },
  eqDetails: {
    flex: 1,
    marginRight: 12,
  },
  eqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  eqName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  areaChip: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  areaChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  textMuted: {
    color: colors.textMuted,
  },
  inactiveTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  inactiveText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
  },
  eqSubinfo: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  freqLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginRight: 2,
  },
  eqActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchWrap: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryVeryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 480,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
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
  groupPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  groupPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
  },
  groupPillTextSelected: {
    color: colors.white,
  },
  areaOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  areaOptBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  areaOptBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  areaOptText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
  },
  areaOptTextSelected: {
    color: colors.white,
  },
  freqToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  freqToggleBtnSelected: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  freqToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dark,
  },
  modalSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
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
