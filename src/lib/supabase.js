import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Detect if real Supabase credentials are provided
export const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseAnonKey !== 'your-anon-key-here' &&
  supabaseUrl.startsWith('http')
);

if (!isConfigured) {
  console.warn(
    '[Supabase Configuration Error] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or invalid in .env!'
  );
}

export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://pm-scheduler-placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'dummy-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);
