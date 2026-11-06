import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchCategories,
  fetchGroups,
  fetchEquipment,
  createEquipment,
  updateEquipment,
  createGroup,
} from '../../lib/dataService';
import Header from '../../components/Header';
import FrequencyBadge from '../../components/FrequencyBadge';
import { colors, layout } from '../../theme';

export default function ManageEquipmentScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Equipment Modal (Add/Edit)
  const [eqModalVisible, setEqModalVisible] = useState(false);
  const [editingEq, setEditingEq] = useState(null);
  const [eqName, setEqName] = useState('');
  const [eqGroupId, setEqGroupId] = useState(null);
  const [eqArea, setEqArea] = useState('None');
  const [eqUnitCount, setEqUnitCount] = useState('1');
  const [eqDefaultFreq, setEqDefaultFreq] = useState(['d']);
  const [eqIsActive, setEqIsActive] = useState(true);
  const [eqSaving, setEqSaving] = useState(false);

  // Group Modal (Add)
  const [grpModalVisible, setGrpModalVisible] = useState(false);
  const [grpItemNo, setGrpItemNo] = useState('');
  const [grpName, setGrpName] = useState('');
  const [grpSaving, setGrpSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, eq] = await Promise.all([
        fetchCategories(),
        fetchEquipment({ activeOnly: false }),
      ]);
      setCategories(cats);
      setEquipmentList(eq);

      if (cats.length > 0) {
        const catId = selectedCatId || cats[0].id;
        setSelectedCatId(catId);
        const grps = await fetchGroups(catId);
        setGroups(grps);
      }
    } catch (err) {
      console.warn('Error loading equipment data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategorySelect = async (catId) => {
    setSelectedCatId(catId);
    try {
      const grps = await fetchGroups(catId);
      setGroups(grps);
    } catch (err) {
      console.warn('Failed to load groups for category:', err);
    }
  };

  const openAddEquipment = () => {
    setEditingEq(null);
    setEqName('');
    setEqGroupId(groups.length > 0 ? groups[0].id : null);
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

  const handleSaveEquipment = async () => {
    if (!eqName.trim() || !eqGroupId) {
      alert('Please provide equipment name and group.');
      return;
    }

    try {
      setEqSaving(true);
      const payload = {
        name: eqName.trim(),
        group_id: eqGroupId,
        area: eqArea === 'None' ? null : eqArea,
        unit_count: parseInt(eqUnitCount, 10) || 1,
        default_freq: eqDefaultFreq,
        is_active: eqIsActive,
      };

      if (editingEq) {
        await updateEquipment(editingEq.id, payload);
      } else {
        await createEquipment(payload);
      }

      setEqModalVisible(false);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to save equipment.');
    } finally {
      setEqSaving(false);
    }
  };

  const handleToggleActive = async (eq) => {
    try {
      await updateEquipment(eq.id, { is_active: !eq.is_active });
      await loadData();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleSaveGroup = async () => {
    if (!grpName.trim() || !selectedCatId) {
      alert('Please provide a group name.');
      return;
    }
    try {
      setGrpSaving(true);
      await createGroup({
        category_id: selectedCatId,
        item_no: grpItemNo ? parseInt(grpItemNo, 10) : groups.length + 1,
        name: grpName.trim(),
      });
      setGrpModalVisible(false);
      setGrpName('');
      setGrpItemNo('');
      await loadData();
    } catch (err) {
      alert('Failed to create group.');
    } finally {
      setGrpSaving(false);
    }
  };

  // Filter equipment
  const filteredEq = equipmentList.filter((eq) => {
    const matchesCat = eq.group?.category_id === selectedCatId;
    const matchesSearch =
      !searchQuery.trim() ||
      eq.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.group?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.area?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

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
              <Text style={styles.topBtnText}>Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topBtn, { backgroundColor: colors.darkSurface, borderColor: '#333', borderWidth: 1 }]}
              onPress={() => setGrpModalVisible(true)}
            >
              <Ionicons name="folder-add-outline" size={18} color={colors.white} />
              <Text style={styles.topBtnText}>Group</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Category Filter Pills */}
        <View style={styles.categoryBar}>
          {categories.map((cat) => {
            const isSelected = selectedCatId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catPill, isSelected && styles.catPillActive]}
                onPress={() => handleCategorySelect(cat.id)}
              >
                <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                  {cat.code}. {cat.name}
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

        {/* Equipment List */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        ) : filteredEq.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No equipment found for this category.</Text>
          </View>
        ) : (
          filteredEq.map((eq) => (
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
                  {!eq.is_active && (
                    <View style={styles.inactiveTag}>
                      <Text style={styles.inactiveText}>Inactive</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.eqSubinfo}>
                  Group: {eq.group?.name || 'Unassigned'}
                  {eq.area ? ` • ${eq.area}` : ''}
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
                >
                  <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Equipment Modal */}
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
                  {groups.map((grp) => (
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

              <Text style={styles.fieldLabel}>Item Number (e.g. 6)</Text>
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

