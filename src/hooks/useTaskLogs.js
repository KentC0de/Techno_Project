import { useQuery } from '@tanstack/react-query';
import { fetchTaskLogs, loadTaskContext } from '../lib/dataService';

export function useTaskLogs(rangeStart, rangeEnd, options = {}) {
  const extraDate =
    options.extraDate &&
    rangeStart &&
    rangeEnd &&
    (options.extraDate < rangeStart || options.extraDate > rangeEnd)
      ? options.extraDate
      : null;

  const query = useQuery({
    queryKey: ['taskLogs', rangeStart, rangeEnd, extraDate],
    queryFn: async () => {
      if (!rangeStart || !rangeEnd) {
        return { logs: [], contexts: [] };
      }

      const rangeLogs = await fetchTaskLogs(rangeStart, rangeEnd);
      let allLogs = rangeLogs || [];

      if (extraDate) {
        const extraLogs = await fetchTaskLogs(extraDate, extraDate);
        if (extraLogs && extraLogs.length > 0) {
          const seen = new Set(allLogs.map((l) => l.id));
          for (const l of extraLogs) {
            if (!seen.has(l.id)) {
              allLogs.push(l);
              seen.add(l.id);
            }
          }
        }
      }

      const contexts = await loadTaskContext(allLogs);
      return { logs: allLogs, contexts };
    },
    enabled: !!rangeStart && !!rangeEnd && options.enabled !== false,
    staleTime: 30 * 1000,
  });

  return {
    ...query,
    logs: query.data?.logs || [],
    contexts: query.data?.contexts || [],
  };
}

export default useTaskLogs;
