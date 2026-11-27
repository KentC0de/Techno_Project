import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { a11yRole } from '../utils/a11y';

const DEFAULTS = { range: 'day', system: 'ALL' };

export default function FilterSheet({
  visible,
  onClose,
  sections = [],
  value = {},
  onChange,
  resultCount,
  resultLabel = 'results',
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleSelect = (key, optValue) => {
    if (onChange) onChange({ ...value, [key]: optValue });
  };

  const handleClear = () => {
    if (!onChange) return;
    const cleared = { ...value };
    sections.forEach((sec) => {
      cleared[sec.key] = DEFAULTS[sec.key] !== undefined ? DEFAULTS[sec.key] : 'all';
    });
    onChange(cleared);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: Math.round(height * 0.75), paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {sections.map((sec) => (
              <View key={sec.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{sec.label}</Text>
                <View style={styles.chips}>
                  {(sec.options || []).map((opt) => {
                    const selected = String(value[sec.key]) === String(opt.value);
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => handleSelect(sec.key, opt.value)}
                        {...a11yRole('button')}
                        accessibilityState={{ selected }}
                      >
                        {opt.dot ? <View style={[styles.dot, { backgroundColor: opt.dot }]} /> : null}
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.footerBtn} onPress={onClose} {...a11yRole('button')}>
            <Text style={styles.footerBtnText}>
              {typeof resultCount === 'number' ? `Show ${resultCount} ${resultLabel}` : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4D4D8', marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0A0A0A' },
  clear: { fontSize: 14, fontWeight: '600', color: colors.primary },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 8 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#52525B', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 14, color: '#0A0A0A' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
