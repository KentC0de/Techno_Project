import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';

/**
 * useWorkerGroups: Pure DATA hook.
 * Loads worker_groups, worker_group_members, and group task counts.
 * Realtime subscriptions are isolated in useWorkerGroupsRealtime.
 */
export function useWorkerGroups() {
  // 1. Fetch worker groups
  const {
    data: groups = [],
    isLoading: loadingGroups,
    error: errorGroups,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ['worker_groups'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('worker_groups')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Run the worker groups SQL in Supabase');
        }
        throw error;
      }
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // 2. Fetch group members
  const {
    data: members = [],
    isLoading: loadingMembers,
    error: errorMembers,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['worker_group_members'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('worker_group_members')
        .select('user_id, group_id, added_by, added_at');
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Run the worker groups SQL in Supabase');
        }
        throw error;
      }
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // 3. Fetch task counts per group
  const {
    data: rulesSummary = [],
    isLoading: loadingRules,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['schedule_rules_group_counts'],
    queryFn: async () => {
      if (!isConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('schedule_rules')
        .select('worker_group_id');
      if (error) return [];
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // Indexed mappings
  const { membersByGroup, groupByUser, taskCountByGroup } = useMemo(() => {
    const byGroup = {};
    const byUser = {};
    const taskCounts = {};

    members.forEach((m) => {
      if (!byGroup[m.group_id]) {
        byGroup[m.group_id] = [];
      }
      byGroup[m.group_id].push(m.user_id);
      byUser[m.user_id] = m.group_id;
    });

    rulesSummary.forEach((r) => {
      const gId = r.worker_group_id || 'unassigned';
      taskCounts[gId] = (taskCounts[gId] || 0) + 1;
    });

    return {
      membersByGroup: byGroup,
      groupByUser: byUser,
      taskCountByGroup: taskCounts,
    };
  }, [members, rulesSummary]);

  const refetch = async () => {
    await Promise.all([refetchGroups(), refetchMembers(), refetchRules()]);
  };

  return {
    groups,
    members,
    membersByGroup,
    groupByUser,
    taskCountByGroup,
    isLoading: loadingGroups || loadingMembers || loadingRules,
    error: errorGroups || errorMembers,
    refetch,
  };
}
