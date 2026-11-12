import { Platform } from 'react-native';

/**
 * Returns the default home route for a given user role and platform.
 *
 * @param {string} role - 'admin' | 'worker' | null/undefined
 * @param {string} [platform] - Platform.OS ('web' | 'android' | 'ios')
 * @returns {{ name: string, params?: object }}
 */
export function getHomeRoute(role, platform = Platform.OS) {
  if (role === 'admin' && platform === 'web') {
    return { name: 'AdminRoot', params: { screen: 'AdminCalendar' } };
  }
  if (role === 'admin') {
    return { name: 'AdminRoot', params: { screen: 'AdminCalendar' } };
  }
  // Worker or default
  return { name: 'WorkerRoot', params: { screen: 'WorkerTodayTab' } };
}

/**
 * Safely navigates if the route exists or falls back to home route.
 */
export function safeNavigate(navigation, target, params) {
  if (!navigation) return;
  try {
    if (params) {
      navigation.navigate(target, params);
    } else {
      navigation.navigate(target);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn(`[safeNavigate] Failed navigating to ${target}:`, err);
    }
  }
}

