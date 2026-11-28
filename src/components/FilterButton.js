import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import FilterPanel from './FilterPanel';
import FilterSheet from './FilterSheet';
import { a11yRole } from '../utils/a11y';

export const FILTER_ICON = 'options-outline';

export default function FilterButton({
  icon = FILTER_ICON,
  sections = [],
  value = {},
  onChange,
  resultCount,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);

  // Compute active filters count (non-'all' values)
  const activeCount = Object.entries(value || {}).filter(([key, val]) => {
    if (key === 'view') return false; // view toggle
    if (key === 'range') return val !== 'day' && val !== 'all';
    return val !== 'all' && val !== 'ALL' && val != null && val !== '';
  }).length;

  const measureButton = useCallback(() => {
    if (Platform.OS === 'web' && buttonRef.current) {
      const node = buttonRef.current;
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        setAnchorRect({
          left: rect.left,
          top: rect.bottom + 8,
          bottom: rect.bottom,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
    }
    if (buttonRef.current?.measureInWindow) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setAnchorRect({
          left: x,
          top: y + height + 8,
          bottom: y + height,
          right: x + width,
          width,
          height,
        });
      });
    }
  }, []);

  // Update measurement on window resize and scroll when open
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web') return;

    const handleUpdate = () => {
      measureButton();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true });
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, measureButton]);

  const handleToggle = () => {
    if (!isOpen) {
      measureButton();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      if (Platform.OS === 'web' && buttonRef.current?.focus) {
        buttonRef.current.focus();
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (Platform.OS === 'web' && buttonRef.current?.focus) {
      buttonRef.current.focus();
    }
  };

  const handleRemoveFilter = (sectionKey, defaultValue = 'all') => {
    if (onChange) {
      onChange({
        ...value,
        [sectionKey]: defaultValue,
      });
    }
  };

  // Active filters list for removable chips
  const activeChips = [];
  sections.forEach((sec) => {
    const val = value[sec.key];
    const isDefault = sec.key === 'range' ? (val === 'day' || val === 'all') : (val === 'all' || val === 'ALL' || !val);
    if (!isDefault) {
      const matchedOpt = sec.options?.find((opt) => String(opt.value) === String(val));
      const label = matchedOpt?.label || String(val);
      activeChips.push({
        key: sec.key,
        label: `${sec.label}: ${label}`,
        defaultValue: sec.key === 'range' ? 'day' : (sec.key === 'system' ? 'ALL' : 'all'),
      });
    }
  });

  const visibleChips = activeChips.slice(0, 3);
  const hiddenChipsCount = activeChips.length - 3;

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <View
          ref={buttonRef}
          collapsable={false}
          style={styles.anchorWrapper}
        >
          <TouchableOpacity
            style={[styles.button, isOpen && styles.buttonActive]}
            onPress={handleToggle}
            activeOpacity={0.8}
            {...a11yRole('button')}
            accessibilityLabel={`Filter, ${activeCount} active filters`}
          >
            <Ionicons
              name={icon}
              size={18}
              color={activeCount > 0 ? colors.primary : colors.textPrimary}
            />
            <Text style={[styles.buttonText, activeCount > 0 && styles.buttonTextActive]}>
              Filter
            </Text>
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeChips.length > 0 && (
          <View style={styles.activeChipsRow}>
            {visibleChips.map((chip) => (
              <View key={chip.key} style={styles.activeChip}>
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveFilter(chip.key, chip.defaultValue)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.chipRemoveBtn}
                >
                  <Ionicons name="close" size={14} color="#1C5089" />
                </TouchableOpacity>
              </View>
            ))}
            {hiddenChipsCount > 0 && (
              <TouchableOpacity
                onPress={handleToggle}
                style={styles.moreChip}
              >
                <Text style={styles.moreChipText}>+{hiddenChipsCount}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {Platform.OS === 'web' ? (
        <FilterPanel
          visible={isOpen}
          onClose={handleClose}
          anchorRect={anchorRect}
          sections={sections}
          value={value}
          onChange={onChange}
          resultCount={resultCount}
        />
      ) : (
        <FilterSheet
          visible={isOpen}
          onClose={handleClose}
          sections={sections}
          value={value}
          onChange={onChange}
          resultCount={resultCount}
          resultLabel="tasks"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  anchorWrapper: {
    height: 40,
  },
  button: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonActive: {
    borderColor: colors.primary,
    backgroundColor: '#F5F9FD',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonTextActive: {
    color: colors.primary,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  activeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FA',
    borderWidth: 1,
    borderColor: '#C9DCF0',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C5089',
    maxWidth: 160,
  },
  chipRemoveBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreChip: {
    backgroundColor: colors.border,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  moreChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
