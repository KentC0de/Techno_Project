import { Platform } from 'react-native';
import { supabase, isConfigured } from './supabase';

/**
 * logActivity — logs user actions to public.activity_logs.
 * Fire-and-forget: wrapped in try/catch, never throws, never blocks the UI.
 * Does NOT log passwords or sensitive tokens.
 */
export async function logActivity(action, entityType = null, entityId = null, details = {}) {
  try {
    if (!isConfigured || !supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    // Fetch user profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    // Clean details to ensure no passwords or sensitive keys exist
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.access_token;
    delete sanitizedDetails.refresh_token;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.user_metadata?.full_name || user.email || 'User',
      user_role: profile?.role || 'worker',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: sanitizedDetails,
      platform: Platform.OS, // 'web' | 'android' | 'ios'
    });
  } catch (err) {
    if (__DEV__) {
      console.log('[logActivity] non-blocking notice:', err.message);
    }
  }
}

