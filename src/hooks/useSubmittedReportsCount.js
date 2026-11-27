import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';

export function useSubmittedReportsCount(options = {}) {
  const query = useQuery({
    queryKey: ['submitted_reports_count'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return 0;
      const { count, error } = await supabase
        .from('daily_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted');
      if (error) {
        if (error.code === '42P01' || error.code === '42703') return 0;
        throw error;
      }
      return count || 0;
    },
    staleTime: 15 * 1000,
    ...options,
  });

  return {
    ...query,
    count: query.data || 0,
  };
}

export default useSubmittedReportsCount;
