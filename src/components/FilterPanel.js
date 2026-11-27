import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReactDOM from 'react-dom';
import { colors } from '../theme';
import { a11yRole } from '../utils/a11y';

export default function FilterPanel({
  visible,
  onClose,
  anchorRect,
  sections = [],
  value = {},
  onChange,
  resultCount,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const isMobileSheet = windowWidth < 640;

  const handleSelectOption = (sectionKey, optValue) => {
    if (!onChange) return;
    onChange({
      ...value,
      [sectionKey]: optValue,
    });
  };

  const handleClearAll = () => {
    if (!onChange) return;
    const cleared = { ...value };
    sections.forEach((sec) => {
      if (sec.key === 'range') {
        cleared[sec.key] = 'day';
      } else if (sec.key === 'system') {
        cleared[sec.key] = 'ALL';
      } else {
        cleared[sec.key] = 'all';
      }
    });
    onChange(cleared);
  };

  // Dimensions & coordinates calculation
  let panelStyle = {};
  if (isMobileSheet) {
    panelStyle = {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      maxHeight: Math.round(windowHeight * 0.8),
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
    };
  } else {
    const panelWidth = Math.min(380, windowWidth - 24);
    let top = 48;
    let left = 16;

    if (anchorRect) {
      top = anchorRect.top;
      // Right-edge align with button's right edge
      const targetLeft = anchorRect.right - panelWidth;
      // Clamp left so it never leaves the viewport
      if (targetLeft < 12) {
        left = 12;
      } else if (targetLeft + panelWidth > windowWidth - 12) {
        left = Math.max(12, windowWidth - panelWidth - 12);
      } else {
        left = targetLeft;
      }
    } else {
      left = Math.max(12, windowWidth - panelWidth - 16);
    }

    const maxHeight = Math.max(260, windowHeight - top - 16);

    panelStyle = {
      position: 'fixed',
      top,
      left,
      width: panelWidth,
      maxHeight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
    };
  }

  const content = (
    <View style={styles.portalOverlay}>
      <TouchableOpacity
        style={[styles.backdrop, isMobileSheet && styles.dimmedBackdrop]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        ref={panelRef}
        style={[styles.panelBase, panelStyle]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
              {...a11yRole('button')}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sections Scrollable */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {sections.map((sec) => {
            const currentValue = value[sec.key];
            return (
              <View key={sec.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{sec.label}</Text>
                <View style={styles.chipsContainer}>
                  {sec.options?.map((opt) => {
                    const isSelected = String(currentValue) === String(opt.value);
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                        ]}
                        onPress={() => handleSelectOption(sec.key, opt.value)}
                        activeOpacity={0.8}
                        {...a11yRole('button')}
                      >
                        {opt.dot ? (
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: opt.dot },
                            ]}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={onClose}
            activeOpacity={0.8}
            {...a11yRole('button')}
          >
            <Text style={styles.applyButtonText}>
              {resultCount != null ? `Show ${resultCount} results` : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(content, document.body);
  }

  return content;
}

const styles = StyleSheet.create({
  portalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  dimmedBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  panelBase: {
    overflow: 'hidden',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  closeBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
