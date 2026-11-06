import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCategories, getSavedWorkerSelection, saveWorkerSelection } from '../../lib/dataService';
import Header from '../../components/Header';
import { colors, layout } from '../../theme';

export default function ChooseWorkScreen({ navigation, route }) {
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedArea, setSelectedArea] = useState('All');
  const [loading, setLoading] = useState(true);

  const isChangingWork = route?.params?.isChangingWork ?? false;

  const categoryIcons = {
    A: 'hardware-chip-outline',
    B: 'sunny-outline',
    C: 'flash-outline',
    D: 'build-outline',
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [cats, saved] = await Promise.all([
          fetchCategories(),
          getSavedWorkerSelection(),
        ]);
        setCategories(cats);

        if (saved && saved.categoryId) {
          setSelectedCatId(saved.categoryId);
          setSelectedArea(saved.area || 'All');
          // If not changing work explicitly and already selected, automatically jump to TodayScreen
          if (!isChangingWork) {
            navigation.replace('WorkerToday', {
              categoryId: saved.categoryId,
              categoryName: saved.categoryName,
              area: saved.area || 'All',
            });
            return;
          }
        } else if (cats.length > 0) {
          setSelectedCatId(cats[0].id);
        }
      } catch (err) {
        console.warn('Error loading categories:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isChangingWork]);

  const activeCategory = categories.find((c) => c.id === selectedCatId);
  const hasAreas = activeCategory?.code === 'B'; // PV Field Area has Area 1, 2, 3

  const handleConfirm = async () => {
    if (!activeCategory) return;
    const finalArea = hasAreas ? selectedArea : 'All';
    const selection = {
      categoryId: activeCategory.id,
      categoryCode: activeCategory.code,
      categoryName: activeCategory.name,
      area: finalArea,
    };
    await saveWorkerSelection(selection);

    if (navigation.canGoBack() && isChangingWork) {
      navigation.navigate('WorkerToday', selection);
    } else {
      navigation.replace('WorkerToday', selection);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading systems...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title="Choose My Work"
        subtitle="Select your assigned system and work area"
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1: Pick System */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Pick Maintenance System</Text>
        </View>

        <View style={styles.cardGrid}>
          {categories.map((cat) => {
            const isSelected = selectedCatId === cat.id;
            const iconName = categoryIcons[cat.code] || 'cube-outline';
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                ]}
                onPress={() => {
                  setSelectedCatId(cat.id);
                  if (cat.code !== 'B') setSelectedArea('All');
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.cardIconBox,
                    isSelected && styles.cardIconBoxSelected,
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={28}
                    color={isSelected ? colors.white : colors.primary}
                  />
                </View>

                <View style={styles.cardTextBox}>
                  <Text style={[styles.codeTag, isSelected && styles.codeTagSelected]}>
                    SYSTEM {cat.code}
                  </Text>
                  <Text
                    style={[styles.catName, isSelected && styles.catNameSelected]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                </View>

                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primary}
                    style={styles.checkIcon}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Step 2: Pick Area (if applies) */}
        {hasAreas && (
          <View style={styles.areaSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <Text style={styles.sectionTitle}>Select PV Field Area</Text>
            </View>

            <View style={styles.areaRow}>
              {['All', 'Area 1', 'Area 2', 'Area 3'].map((areaOption) => {
                const isAreaSelected = selectedArea === areaOption;
                return (
                  <TouchableOpacity
                    key={areaOption}
                    style={[
                      styles.areaChip,
                      isAreaSelected && styles.areaChipSelected,
                    ]}
                    onPress={() => setSelectedArea(areaOption)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.areaChipText,
                        isAreaSelected && styles.areaChipTextSelected,
                      ]}
                    >
                      {areaOption}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Start Work Action Button */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>
            View Today's Tasks
          </Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  content: {
    padding: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumber: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  cardGrid: {
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: layout.minTouchTarget * 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVeryLight,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primaryVeryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconBoxSelected: {
    backgroundColor: colors.primary,
  },
  cardTextBox: {
    flex: 1,
  },
  codeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  codeTagSelected: {
    color: colors.primaryDark,
  },
  catName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
  },
  catNameSelected: {
    color: colors.dark,
  },
  checkIcon: {
    marginLeft: 8,
  },
  areaSection: {
    marginBottom: 24,
  },
  areaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  areaChip: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  areaChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  areaChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  areaChipTextSelected: {
    color: colors.white,
  },
  confirmBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

