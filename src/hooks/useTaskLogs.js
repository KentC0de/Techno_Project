import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { fetchTaskLogs } from '../lib/dataService';

export function useTaskLogs(rangeStart, rangeEnd, options = {}) {
  const query = useQuery({
    queryKey: ['task_logs', rangeStart, rangeEnd],
    queryFn: async () => {
      if (!rangeStart || !rangeEnd) return [];
      return await fetchTaskLogs(rangeStart, rangeEnd);
    },
    enabled: !!rangeStart && !!rangeEnd && (options.enabled !== false),
    staleTime: 30 * 1000,
  });

  return query;
}
export default useTaskLogs;
