import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme';
import { modalA11y } from '../../utils/a11y';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [isLongRunning, setIsLongRunning] = useState(false);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);
  const cancelCallbackRef = useRef(null);

  const show = useCallback((message = 'Loading...', opts = {}) => {
    startTimeRef.current = Date.now();
    setIsLongRunning(false);
    cancelCallbackRef.current = opts.onCancel || null;

    setConfig({
      message,
      progress: opts.progress !== undefined ? opts.progress : null, // 0..1 or null
      cancellable: !!opts.onCancel,
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsLongRunning(true);
    }, 30000); // 30s long-running hint
  }, []);

  const update = useCallback((message, progress = null) => {
    setConfig((prev) => {
      if (!prev) return { message, progress, cancellable: false };
      return {
        ...prev,
        message: message !== undefined ? message : prev.message,
        progress: progress !== null ? progress : prev.progress,
      };
    });
  }, []);

  const hide = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Enforce 300ms minimum display time to prevent jarring flicker
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 300 && startTimeRef.current > 0) {
      await new Promise((r) => setTimeout(r, 300 - elapsed));
    }

    setConfig(null);
    setIsLongRunning(false);
    cancelCallbackRef.current = null;
    startTimeRef.current = 0;
  }, []);

  const handleUserCancel = useCallback(() => {
    if (cancelCallbackRef.current) {
      cancelCallbackRef.current();
    }
    hide();
  }, [hide]);

  const loader = useMemo(
    () => ({
      show,
      update,
      hide,
    }),
    [show, update, hide]
  );

  return (
    <LoadingContext.Provider value={loader}>
      {children}

      <Modal
        visible={!!config}
        transparent
        animationType="fade"
        onRequestClose={() => {}} // Block Android back button during action loading
        {...modalA11y(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {/* Spinner */}
            <ActivityIndicator size="large" color={colors.primary} />

            {/* Message */}
            <Text style={styles.message}>{config?.message}</Text>

            {/* Progress bar if present */}
            {config?.progress !== null && config?.progress !== undefined && (
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(0, Math.round(config.progress * 100)))}%`,
                    },
                  ]}
                />
              </View>
            )}

            {/* Long running hint */}
            {isLongRunning ? (
              <View style={styles.longRunningBox}>
                <Text style={styles.longRunningText}>
                  Taking longer than usual... Please keep this window open.
                </Text>
                {config?.cancellable && (
                  <TouchableOpacity style={styles.cancelActionBtn} onPress={handleUserCancel}>
                    <Text style={styles.cancelActionText}>Cancel Action</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.subtext}>Please wait, do not close this window</Text>
            )}
          </View>
        </View>
      </Modal>
    </LoadingContext.Provider>
  );
}

export function useLoader() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoader must be used within a LoadingProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 28,
    paddingRight: 28,
    alignItems: 'center',
    width: '84%',
    maxWidth: 340,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  message: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 22,
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  longRunningBox: {
    marginTop: 14,
    alignItems: 'center',
  },
  longRunningText: {
    fontSize: 12,
    color: '#D97706',
    textAlign: 'center',
    lineHeight: 16,
  },
  cancelActionBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  cancelActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});

export default LoadingProvider;
