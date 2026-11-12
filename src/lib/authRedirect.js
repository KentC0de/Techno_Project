import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

/**
 * Generates a clean redirect URL for Supabase Auth flows (password recovery, email confirmation, etc.)
 *
 * Requirements handled:
 * 1. Web: `window.location.origin + path`
 * 2. Expo Go / Development native: `http://<LAN-IP>:<PORT><path>` so opening emails on physical devices
 *    navigates to the local Metro web server instead of failing on "localhost refused to connect".
 * 3. Standalone / Production native: `Linking.createURL(path)` (using custom scheme e.g. "solarpm://").
 * 4. Logs the computed redirect in __DEV__ mode once for easy Supabase URL Configuration copy-paste.
 *
 * @param {string} path - relative path starting with '/' or route path, e.g. '/auth/reset-password'
 * @returns {string} Fully qualified redirect URL
 */
export function getAuthRedirectUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 1. Web browser
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const url = `${window.location.origin}${normalizedPath}`;
      if (__DEV__) {
        console.log(`[authRedirect] Web redirect URL: ${url}`);
      }
      return url;
    }
    return `http://localhost:8081${normalizedPath}`;
  }

  // 2. Mobile platforms (Android / iOS)
  // Check if running inside Expo Go or standard dev client
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient';

  if (__DEV__ || isExpoGo) {
    // Attempt to extract LAN IP from hostUri or linkingUri
    // e.g., "192.168.1.50:8081"
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoClient?.hostUri ||
      Constants.manifest?.debuggerHost ||
      '';

    if (hostUri) {
      // Clean hostUri of any path
      const hostAndPort = hostUri.split('/')[0];
      const lanUrl = `http://${hostAndPort}${normalizedPath}`;
      if (__DEV__) {
        console.log(`[authRedirect] LAN dev redirect URL (for phone email links): ${lanUrl}`);
      }
      return lanUrl;
    }

    // Fallback if hostUri not found but linkingUri exists
    const linkingUri = Constants.linkingUri || '';
    if (linkingUri.includes('http://') || linkingUri.includes('https://')) {
      const parsed = linkingUri.split('?')[0].replace(/\/+$/, '');
      const fallbackUrl = `${parsed}${normalizedPath}`;
      if (__DEV__) {
        console.log(`[authRedirect] Fallback HTTP linking URL: ${fallbackUrl}`);
      }
      return fallbackUrl;
    }
  }

  // 3. Native standalone build (production scheme)
  try {
    const schemeUrl = Linking.createURL(normalizedPath.replace(/^\//, ''), {
      scheme: 'solarpm',
    });
    if (__DEV__) {
      console.log(`[authRedirect] Standalone scheme redirect URL: ${schemeUrl}`);
    }
    return schemeUrl;
  } catch (err) {
    return `solarpm:/${normalizedPath}`;
  }
}

export default getAuthRedirectUrl;

