import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { modalA11y } from '../../utils/a11y';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [typedText, setTypedText] = useState('');
  const resolverRef = useRef(null);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 640;

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setTypedText('');
      setConfig({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        details: Array.isArray(opts.details) ? opts.details : [],
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        tone: opts.tone || 'default', // 'default' | 'danger'
        icon: opts.icon || (opts.tone === 'danger' ? 'trash-outline' : 'help-circle-outline'),
        requireText: opts.requireText || null,
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setConfig(null);
    setTypedText('');
  }, []);

  // Web keyboard support: Esc = cancel, Enter = confirm
  useEffect(() => {
    if (!config || !isWeb || typeof window === 'undefined') return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter') {
        if (config.requireText) {
          if (typedText.trim().toUpperCase() === config.requireText.trim().toUpperCase()) {
            e.preventDefault();
            handleClose(true);
          }
        } else {
          e.preventDefault();
          handleClose(true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [config, typedText, handleClose, isWeb]);

  const isDanger = config?.tone === 'danger';
  const isConfirmDisabled = config?.requireText
    ? typedText.trim().toUpperCase() !== config.requireText.trim().toUpperCase()
    : false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Modal
        visible={!!config}
        transparent
        animationType={isMobile ? 'slide' : 'fade'}
        onRequestClose={() => handleClose(false)}
        {...modalA11y(true)}
      >
        <View style={[styles.backdrop, isMobile && styles.backdropMobile]}>
          {/* Dismiss backdrop on press */}
          <TouchableOpacity
            style={styles.backdropClickable}
            activeOpacity={1}
            onPress={() => handleClose(false)}
          />

          <View
            style={[
              styles.card,
              isMobile ? [styles.bottomSheet, { paddingBottom: Math.max(insets.bottom + 16, 20) }] : styles.centerModal,
            ]}
          >
            {/* Sheet pill handle on mobile */}
            {isMobile && <View style={styles.sheetHandle} />}

            {/* Icon circle */}
            <View
              style={[
                styles.iconCircle,
                isDanger ? styles.iconCircleDanger : styles.iconCircleDefault,
              ]}
            >
              <Ionicons
                name={config?.icon || (isDanger ? 'trash-outline' : 'help-circle-outline')}
                size={28}
                color={isDanger ? '#DC2626' : colors.primary}
              />
            </View>

            {/* Title & Message */}
            <Text style={styles.title}>{config?.title}</Text>
            {config?.message ? <Text style={styles.message}>{config.message}</Text> : null}

            {/* Bullet details if provided */}
            {config?.details && config.details.length > 0 && (
              <View style={styles.detailsBox}>
                <ScrollView style={{ maxHeight: 120 }}>
                  {config.details.map((item, idx) => (
                    <Text key={idx} style={styles.detailItem}>
                      • {item}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Destructive requireText input if required */}
            {config?.requireText && (
              <View style={styles.requireBox}>
                <Text style={styles.requireLabel}>
                  Type <Text style={{ fontWeight: '800' }}>{config.requireText}</Text> to confirm:
                </Text>
                <TextInput
                  style={styles.requireInput}
                  value={typedText}
                  onChangeText={setTypedText}
                  placeholder={config.requireText}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  autoFocus={true}
                />
              </View>
            )}

            {/* Button Actions */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleClose(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={config?.cancelText || 'Cancel'}
              >
                <Text style={styles.cancelText}>{config?.cancelText || 'Cancel'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  isDanger ? styles.confirmBtnDanger : styles.confirmBtnDefault,
                  isConfirmDisabled && styles.btnDisabled,
                ]}
                onPress={() => handleClose(true)}
                disabled={isConfirmDisabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={config?.confirmText || 'Confirm'}
              >
                <Text style={styles.confirmText}>{config?.confirmText || 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  backdropMobile: {
    justifyContent: 'flex-end',
  },
  backdropClickable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  card: {
    backgroundColor: colors.white,
    zIndex: 100000,
  },
  centerModal: {
    width: '90%',
    maxWidth: 440,
    borderRadius: 20,
    paddingTop: 26,
    paddingBottom: 26,
    paddingLeft: 24,
    paddingRight: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  bottomSheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingLeft: 20,
    paddingRight: 20,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCircleDefault: {
    backgroundColor: '#F0F9FF',
  },
  iconCircleDanger: {
    backgroundColor: '#FEF2F2',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0A0A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 14,
  },
  detailItem: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  requireBox: {
    width: '100%',
    marginBottom: 16,
  },
  requireLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
    textAlign: 'center',
  },
  requireInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDefault: {
    backgroundColor: colors.primary,
  },
  confirmBtnDanger: {
    backgroundColor: '#DC2626',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default ConfirmProvider;
