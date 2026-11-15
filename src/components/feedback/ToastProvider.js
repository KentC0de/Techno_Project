import React, { createContext, useContext, useState, useCallback, useMemo, Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { liveRegion } from '../../utils/a11y';

const ToastContext = createContext(null);

class ToastErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    if (__DEV__) console.log('[ToastErrorBoundary caught error]', error);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWide = width >= 768;

  const removeToast = useCallback((id) => {
    try {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } catch (_) {}
  }, []);

  const addToast = useCallback(
    (type, message, opts = {}) => {
      try {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const title = opts.title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Notice' : 'Information');
        const duration = opts.duration || (type === 'error' ? 6000 : 4000);

        const newToast = {
          id,
          type,
          title,
          message: typeof message === 'string' ? message : (message?.message || String(message)),
          actionLabel: opts.actionLabel || null,
          onAction: opts.onAction || null,
        };

        setToasts((prev) => {
          const next = [...prev, newToast];
          return next.slice(-3);
        });

        if (duration > 0) {
          setTimeout(() => {
            removeToast(id);
          }, duration);
        }
      } catch (err) {
        if (__DEV__) console.log('[addToast error]', err);
      }
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (msg, opts) => addToast('success', msg, opts),
      error: (msg, opts) => addToast('error', msg, opts),
      info: (msg, opts) => addToast('info', msg, opts),
      warning: (msg, opts) => addToast('warning', msg, opts),
      remove: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <ToastErrorBoundary>
        {toasts.length > 0 && (
          <View
            style={[
              styles.container,
              isWide && isWeb
                ? styles.containerWebWide
                : [styles.containerMobile, { top: Math.max(insets.top + 8, 12) }],
            ]}
            pointerEvents="box-none"
          >
            {toasts.map((t) => {
              const isSuccess = t.type === 'success';
              const isError = t.type === 'error';
              const isWarning = t.type === 'warning';

              const accentColor = isSuccess
                ? colors.primary
                : isError
                ? '#DC2626'
                : isWarning
                ? '#F59E0B'
                : '#0A0A0A';

              const iconName = isSuccess
                ? 'checkmark-circle'
                : isError
                ? 'alert-circle'
                : isWarning
                ? 'warning'
                : 'information-circle';

              return (
                <View
                  key={t.id}
                  style={[
                    styles.card,
                    isSuccess && styles.cardSuccess,
                    isError && styles.cardError,
                    isWarning && styles.cardWarning,
                  ]}
                  {...liveRegion(isError ? false : true)}
                >
                  <View style={[styles.colorBar, { backgroundColor: accentColor }]} />

                  <View style={styles.iconBox}>
                    <Ionicons name={iconName} size={22} color={accentColor} />
                  </View>

                  <View style={styles.contentBox}>
                    {t.title ? <Text style={styles.toastTitle}>{t.title}</Text> : null}
                    <Text style={styles.toastMessage} numberOfLines={3}>
                      {t.message}
                    </Text>

                    {t.actionLabel && t.onAction ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          try {
                            t.onAction();
                          } catch (_) {}
                          removeToast(t.id);
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.actionBtnText, { color: accentColor }]}>
                          {t.actionLabel}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => removeToast(t.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close notification"
                  >
                    <Ionicons name="close" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ToastErrorBoundary>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  containerMobile: {
    paddingHorizontal: 12,
    alignItems: 'stretch',
  },
  containerWebWide: {
    top: 24,
    right: 24,
    left: 'auto',
    width: 380,
    alignItems: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  cardSuccess: {
    borderColor: '#BAE6FD',
  },
  cardError: {
    borderColor: '#FECACA',
  },
  cardWarning: {
    borderColor: '#FDE68A',
  },
  colorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconBox: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBox: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 16,
  },
  actionBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
    alignSelf: 'flex-start',
  },
});

export default ToastProvider;
