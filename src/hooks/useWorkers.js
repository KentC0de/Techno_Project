import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';

/**
 * Hook to load workers for admin screens using admin_list_users() RPC.
 * Fallback to profiles table (without email) if the RPC is missing.
 */
export function useWorkers() {
  return useQuery({
    queryKey: ['admin_workers'],
    queryFn: async () => {
      if (!isConfigured || !supabase) {
        return { allUsers: [], workers: [], activeWorkers: [], missingRpc: false };
      }

      // 1. Try admin_list_users RPC
      const { data, error } = await supabase.rpc('admin_list_users');

      if (!error && data) {
        const workers = data.filter((u) => u.role === 'worker');
        const activeWorkers = workers.filter((u) => (u.status || 'active') === 'active');

        if (__DEV__) {
          console.log('[useWorkers]', data.length, activeWorkers.length);
        }

        return {
          allUsers: data,
          workers,
          activeWorkers,
          missingRpc: false,
        };
      }

      // If error is not a missing RPC, throw to trigger React Query error state
      const isMissingRpc =
        error?.code === '42883' ||
        error?.code === 'PGRST202' ||
        error?.message?.includes('function admin_list_users() does not exist') ||
        error?.message?.includes('Could not find the function admin_list_users');

      if (!isMissingRpc && error) {
        throw error;
      }

      // Fallback: Query profiles table without email
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, created_at');

      if (profError) throw profError;

      const profList = (profData || []).map((p) => ({
        ...p,
        email: 'Email in auth.users',
      }));

      const workers = profList.filter((u) => u.role === 'worker');
      const activeWorkers = workers.filter((u) => (u.status || 'active') === 'active');

      if (__DEV__) {
        console.log('[useWorkers fallback]', profList.length, activeWorkers.length);
      }

      return {
        allUsers: profList,
        workers,
        activeWorkers,
        missingRpc: true,
      };
    },
    staleTime: 60 * 1000,
  });
}

