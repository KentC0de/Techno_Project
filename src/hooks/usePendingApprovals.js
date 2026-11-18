import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { fetchProfiles } from '../lib/dataService';

export function usePendingApprovals(options = {}) {
  const query = useQuery({
    queryKey: ['pending_approvals'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return { items: [], count: 0, errorMessage: null };

      try {
        // Query ALL submitted task_logs
        const { data: logs, error: logsErr } = await supabase
          .from('task_logs')
          .select('*')
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: false, nullsFirst: false });

        if (logsErr) {
          if (logsErr.code === '42703') {
            return { items: [], count: 0, errorMessage: 'Run the approval SQL in Supabase' };
          }
          throw logsErr;
        }

        if (!logs || logs.length === 0) {
          return { items: [], count: 0, errorMessage: null };
        }

        // Collect rule IDs and submitter user IDs
        const ruleIds = Array.from(new Set(logs.map((l) => l.rule_id).filter(Boolean)));
        const submitterIds = Array.from(new Set(logs.map((l) => l.done_by).filter(Boolean)));

        // Fetch rule details with equipment, group, and category
        let rulesMap = new Map();
        if (ruleIds.length > 0) {
          const { data: rulesData } = await supabase
            .from('schedule_rules')
            .select(`
              id,
              frequency,
              start_date,
              end_date,
              weekday,
              notes,
              worker_group_id,
              worker_group:worker_groups(id, name, color),
              equipment:equipment_id(
                id,
                name,
                code,
                area,
                group:group_id(
                  id,
                  name,
                  category:category_id(id, code, name)
                )
              )
            `)
            .in('id', ruleIds);

          if (rulesData) {
            rulesData.forEach((r) => rulesMap.set(r.id, r));
          }
        }

        // Fetch submitter names with ONE query to profiles (id, full_name)
        let profilesMap = new Map();
        if (submitterIds.length > 0) {
          try {
            const { data: profs, error: pErr } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', submitterIds);

            if (!pErr && profs) {
              profs.forEach((p) => profilesMap.set(p.id, p.full_name));
            }
          } catch (_) {}
        }

        const items = logs.map((log) => {
          const rule = rulesMap.get(log.rule_id) || null;
          const submitterName = log.done_by ? profilesMap.get(log.done_by) || 'Worker' : 'Worker';

          return {
            ...log,
            rule,
            equipment: rule?.equipment || null,
            group: rule?.equipment?.group || null,
            category: rule?.equipment?.group?.category || null,
            worker_group: rule?.worker_group || null,
            submitterName,
          };
        });

        return { items, count: items.length, errorMessage: null };
      } catch (err) {
        if (err?.code === '42703') {
          return { items: [], count: 0, errorMessage: 'Run the approval SQL in Supabase' };
        }
        throw err;
      }
    },
    staleTime: 15 * 1000,
    ...options,
  });

  return {
    ...query,
    items: query.data?.items || [],
    count: query.data?.count || 0,
    errorMessage: query.data?.errorMessage || null,
  };
}

export default usePendingApprovals;
