// Theme definitions: sky blue, black and white only.
// Soft greys for borders and light backgrounds.

export const colors = {
  primary: '#0EA5E9',         // Sky blue
  primaryLight: '#38BDF8',    // Light sky blue
  primaryVeryLight: '#E0F2FE',// Very light sky blue
  primaryDark: '#0284C7',     // Darker sky blue

  dark: '#0A0A0A',            // Black for headers, text, dark surfaces
  darkSurface: '#171717',     // Dark surface
  darkMuted: '#52525B',       // Muted dark text

  white: '#FFFFFF',           // Backgrounds and cards
  background: '#F8FAFC',      // Crisp light grey/slate background
  cardBg: '#FFFFFF',

  border: '#E2E8F0',          // Soft grey border
  borderLight: '#F1F5F9',     // Subtle border
  borderDark: '#0A0A0A',      // Strong black border

  // Status highlights within sky blue/black/white & muted accents
  textPrimary: '#0A0A0A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#F8FAFC',

  success: '#0284C7',
  successLight: '#E0F2FE',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',

  // Frequency badges: D, W, M, Q, SA - distinct shades in sky blue / black / white palette
  frequency: {
    d: {
      code: 'D',
      label: 'Daily',
      bg: '#E0F2FE',        // Very light sky
      text: '#0369A1',      // Deep sky blue
      border: '#BAE6FD',
    },
    w: {
      code: 'W',
      label: 'Weekly',
      bg: '#0EA5E9',        // Primary sky blue
      text: '#FFFFFF',      // White
      border: '#0284C7',
    },
    M: {
      code: 'M',
      label: 'Monthly',
      bg: '#0A0A0A',        // Black
      text: '#FFFFFF',      // White
      border: '#0A0A0A',
    },
    Q: {
      code: 'Q',
      label: 'Quarterly',
      bg: '#38BDF8',        // Light sky blue
      text: '#0A0A0A',      // Black
      border: '#0EA5E9',
    },
    SA: {
      code: 'SA',
      label: 'Semi-Annual',
      bg: '#0369A1',        // Deep ocean/sky blue
      text: '#FFFFFF',      // White
      border: '#075985',
    },
  },

  status: {
    done: {
      label: 'Done',
      bg: '#E0F2FE',
      text: '#0369A1',
      border: '#38BDF8',
      icon: 'checkmark-circle',
    },
    issue: {
      label: 'Issue',
      bg: '#FEE2E2',
      text: '#B91C1C',
      border: '#F87171',
      icon: 'alert-circle',
    },
    skipped: {
      label: 'Skipped',
      bg: '#F1F5F9',
      text: '#64748B',
      border: '#CBD5E1',
      icon: 'close-circle',
    },
    pending: {
      label: 'Pending',
      bg: '#FFFFFF',
      text: '#0A0A0A',
      border: '#E2E8F0',
      icon: 'ellipse-outline',
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.dark,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const layout = {
  minTouchTarget: 48,
  borderRadiusSm: 8,
  borderRadiusMd: 12,
  borderRadiusLg: 16,
  borderRadiusFull: 9999,
  maxContentWidth: 1200,
  sidebarWidth: 260,
};

