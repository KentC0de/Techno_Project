import { Platform } from 'react-native';

/**
 * Conservative set of accessibility roles supported across all React Native native versions.
 * Any role outside this set will throw RCTView "Invalid accessibility role value" on Android.
 */
export const NATIVE_ROLES = [
  'none',
  'button',
  'link',
  'search',
  'image',
  'keyboardkey',
  'text',
  'adjustable',
  'imagebutton',
  'header',
  'summary',
  'alert',
  'checkbox',
  'combobox',
  'menu',
  'menubar',
  'menuitem',
  'progressbar',
  'radio',
  'radiogroup',
  'scrollbar',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'timer',
  'toolbar',
];

const NATIVE_ROLES_SET = new Set(NATIVE_ROLES);

/**
 * Maps semantic roles to safe native accessibilityRole and web role props.
 * On native, unsupported values (status, dialog, alertdialog, heading, list, listitem, etc.)
 * map to valid equivalents or 'none'.
 * On web, returns the rich ARIA { role }.
 *
 * @param {string} role - The desired semantic/ARIA role
 * @returns {object} Props object: { accessibilityRole } on native, { role } on web
 */
export function a11yRole(role) {
  if (!role) return {};

  if (Platform.OS === 'web') {
    return { role };
  }

  // Native mappings (iOS & Android)
  if (NATIVE_ROLES_SET.has(role)) {
    return { accessibilityRole: role };
  }

  switch (role) {
    case 'status':
      return { accessibilityRole: 'alert' };
    case 'heading':
      return { accessibilityRole: 'header' };
    case 'dialog':
    case 'alertdialog':
    case 'region':
    case 'main':
    case 'navigation':
    case 'banner':
    case 'contentinfo':
    case 'list':
    case 'listitem':
    case 'log':
    case 'form':
    default:
      return { accessibilityRole: 'none' };
  }
}

/**
 * Safe live region helper for announcement views (toasts, notifications).
 * - Android: accessibilityLiveRegion: 'polite' | 'assertive'
 * - iOS: {}
 * - Web: 'aria-live': 'polite' | 'assertive'
 *
 * @param {boolean} polite - Whether the live region is polite (true) or assertive (false)
 * @returns {object} Platform-safe live region props
 */
export function liveRegion(polite = true) {
  const mode = polite ? 'polite' : 'assertive';

  if (Platform.OS === 'web') {
    return { 'aria-live': mode };
  }
  if (Platform.OS === 'android') {
    return { accessibilityLiveRegion: mode };
  }
  return {};
}

/**
 * Safe modal accessibility props helper.
 * - iOS: accessibilityViewIsModal: true
 * - Web: role: 'dialog' (or 'alertdialog'), aria-modal: true
 * - Android: handles backdrop focus traps natively in Modal
 *
 * @param {boolean} isAlertDialog - Whether dialog is an alertdialog
 * @returns {object} Platform-safe modal accessibility props
 */
export function modalA11y(isAlertDialog = false) {
  const roleName = isAlertDialog ? 'alertdialog' : 'dialog';

  if (Platform.OS === 'web') {
    return {
      role: roleName,
      'aria-modal': true,
    };
  }

  if (Platform.OS === 'ios') {
    return {
      accessibilityViewIsModal: true,
      accessibilityRole: 'none',
    };
  }

  return {
    accessibilityRole: 'none',
  };
}

