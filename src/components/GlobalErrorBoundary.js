import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// ─── Global Error Boundary (full-screen, wraps the whole app) ─────────────────
export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, detailsOpen: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ componentStack: errorInfo?.componentStack || null });
    if (__DEV__) {
      console.warn('GlobalErrorBoundary caught error:', error, errorInfo);
    }
  }

  handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, componentStack: null, detailsOpen: false });
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack, detailsOpen } = this.state;
      return (
        <ScrollView
          style={styles.scrollOuter}
          contentContainerStyle={styles.container}
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={44} color="#DC2626" />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              An unexpected error occurred. Please reload the page to continue.
            </Text>

            {/* Dev-only details disclosure */}
            {__DEV__ && error ? (
              <View style={styles.devBox}>
                <TouchableOpacity
                  style={styles.devToggle}
                  onPress={() => this.setState((s) => ({ detailsOpen: !s.detailsOpen }))}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#7C3AED"
                  />
                  <Text style={styles.devToggleText}>
                    {detailsOpen ? 'Hide' : 'Show'} error details (dev only)
                  </Text>
                </TouchableOpacity>

                {detailsOpen && (
                  <ScrollView style={styles.devScroll} nestedScrollEnabled>
                    <Text style={styles.devErrorMsg} selectable>
                      {error.toString()}
                    </Text>
                    {componentStack ? (
                      <Text style={styles.devStack} selectable>
                        {componentStack.trim()}
                      </Text>
                    ) : null}
                  </ScrollView>
                )}
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={this.handleReload} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Reload Application</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// ─── Page Error Boundary (inline card, keeps sidebar intact) ──────────────────
export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, detailsOpen: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ componentStack: errorInfo?.componentStack || null });
    if (__DEV__) {
      console.warn('[PageErrorBoundary] Error on page:', this.props.pageName || '(unnamed)', error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null, detailsOpen: false });
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack, detailsOpen } = this.state;
      const pageName = this.props.pageName || 'This page';
      return (
        <ScrollView
          style={pageStyles.scrollOuter}
          contentContainerStyle={pageStyles.container}
        >
          <View style={pageStyles.card}>
            <View style={pageStyles.iconRow}>
              <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
              <Text style={pageStyles.title}>{pageName} failed to load</Text>
            </View>
            <Text style={pageStyles.sub}>
              An error occurred on this screen. Your other tabs are still working.
            </Text>

            {/* Dev-only details */}
            {__DEV__ && error ? (
              <View style={pageStyles.devBox}>
                <TouchableOpacity
                  style={pageStyles.devToggle}
                  onPress={() => this.setState((s) => ({ detailsOpen: !s.detailsOpen }))}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color="#7C3AED"
                  />
                  <Text style={pageStyles.devToggleText}>
                    {detailsOpen ? 'Hide' : 'Show'} details
                  </Text>
                </TouchableOpacity>
                {detailsOpen && (
                  <ScrollView style={pageStyles.devScroll} nestedScrollEnabled>
                    <Text style={pageStyles.devMsg} selectable>
                      {error.toString()}
                    </Text>
                    {componentStack ? (
                      <Text style={pageStyles.devStack} selectable>
                        {componentStack.trim()}
                      </Text>
                    ) : null}
                  </ScrollView>
                )}
              </View>
            ) : null}

            <TouchableOpacity style={pageStyles.retryBtn} onPress={this.handleRetry} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color={colors.white} />
              <Text style={pageStyles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollOuter: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    padding: 36,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  devBox: {
    width: '100%',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 20,
    overflow: 'hidden',
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  devToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  devScroll: {
    maxHeight: 240,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  devErrorMsg: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginBottom: 8,
  },
  devStack: {
    fontSize: 10,
    color: '#52525B',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 15,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

const pageStyles = StyleSheet.create({
  scrollOuter: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    maxWidth: 520,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#DC2626',
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  devBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 16,
    overflow: 'hidden',
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  devToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  devScroll: {
    maxHeight: 200,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  devMsg: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginBottom: 6,
  },
  devStack: {
    fontSize: 10,
    color: '#52525B',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 14,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
