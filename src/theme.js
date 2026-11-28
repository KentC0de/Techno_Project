// Theme definitions: sky blue, black and white only.
// Soft greys for borders and light backgrounds.

export const colors = {
  primary: '#2563A6',         // Sky blue
  primaryLight: '#5B8FC7',    // Light sky blue
  primaryVeryLight: '#EAF2FA',// Very light sky blue
  primaryDark: '#1C5089',     // Darker sky blue

  dark: '#202B3C',            // Ink for headings and text
  darkSurface: '#171717',     // Dark surface
  darkMuted: '#52525B',       // Muted dark text

  white: '#FFFFFF',           // Backgrounds and cards
  background: '#F5F7FA',      // Crisp light grey/slate background
  cardBg: '#FFFFFF',

  border: '#E2E8F0',          // Soft grey border
  borderLight: '#F1F5F9',     // Subtle border
  borderDark: '#0A0A0A',      // Strong black border

  // Status highlights within sky blue/black/white & muted accents
  textPrimary: '#202B3C',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#F5F7FA',

  success: '#2E9B64',
  successLight: '#E8F6EE',
  warning: '#E8A52B',
  warningLight: '#FFFBEF',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',

  // Frequency badges: D, W, M, Q, SA - distinct shades in sky blue / black / white palette
  frequency: {
    d: {
      code: 'D',
      label: 'Daily',
      bg: '#EAF2FA',        // Very light sky
      text: '#1C5089',      // Deep sky blue
      border: '#C9DCF0',
    },
    w: {
      code: 'W',
      label: 'Weekly',
      bg: '#2563A6',        // Primary sky blue
      text: '#FFFFFF',      // White
      border: '#1C5089',
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
      bg: '#5B8FC7',        // Light sky blue
      text: '#0A0A0A',      // Black
      border: '#2563A6',
    },
    SA: {
      code: 'SA',
      label: 'Semi-Annual',
      bg: '#1C5089',        // Deep ocean/sky blue
      text: '#FFFFFF',      // White
      border: '#075985',
    },
  },

  status: {
    done: {
      label: 'Done',
      bg: '#E8F6EE',
      text: '#166534',
      border: '#86D3A8',
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
      bg: '#FFFBEF',
      text: '#92400E',
      border: '#F4C542',
      icon: 'ellipse-outline',
    },
  },
};

// Shell palette (sidebar / page chrome) taken from the Solar Maintenance System reference.
export const shell = {
  sidebar: '#142D4E',
  sidebarActive: '#2B4666',
  sidebarBorder: 'rgba(255,255,255,0.10)',
  sidebarText: '#CBD5E1',
  accent: '#F4C542',
  pageBg: '#F5F7FA',
  text: '#202B3C',
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

