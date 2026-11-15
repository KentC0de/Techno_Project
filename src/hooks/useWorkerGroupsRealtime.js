import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useToast } from '../components/feedback';

let channelInstanceCounter = 0;

/**
 * useWorkerGroupsRealtime:
 * One dedicated hook that subscribes to realtime changes on schedule_rules, task_logs, worker_groups & worker_group_members.
 * - Created inside useEffect with a unique channel name per mount.
 * - Attaches listeners BEFORE calling .subscribe().
 * - Debounces (500ms) query invalidations.
 * - Safely removes the channel on cleanup.
 * - If workerUserId is passed, filters worker_group_members and triggers toast notices.
 */
export function useWorkerGroupsRealtime({ workerUserId = null } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    channelInstanceCounter += 1;
    const channelId = `wg_rt_${Date.now()}_${channelInstanceCounter}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelId);

    const triggerInvalidation = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['worker_groups'] });
        queryClient.invalidateQueries({ queryKey: ['worker_group_members'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_group_counts'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules_all'] });
        queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task_logs'] });
      }, 500);
    };

    // 1. Listen to schedule_rules changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schedule_rules' },
      (payload) => {
        try {
          triggerInvalidation();
          if (payload.eventType === 'INSERT') {
            toast?.info('New task for your group');
          }
        } catch (err) {
          if (__DEV__) console.log('[Realtime schedule_rules error]', err);
        }
      }
    );

    // 2. Listen to task_logs changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'task_logs' },
      () => {
        try {
          triggerInvalidation();
        } catch (err) {
          if (__DEV__) console.log('[Realtime task_logs error]', err);
        }
      }
    );

    // 3. Listen to worker_groups changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'worker_groups' },
      () => {
        try {
          triggerInvalidation();
        } catch (err) {
          if (__DEV__) console.log('[Realtime worker_groups error]', err);
        }
      }
    );

    // 4. Listen to worker_group_members changes
    const memberFilter = workerUserId ? `user_id=eq.${workerUserId}` : undefined;
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'worker_group_members',
        ...(memberFilter ? { filter: memberFilter } : {}),
      },
      (payload) => {
        try {
          triggerInvalidation();

          if (workerUserId && toast) {
            if (payload.eventType === 'INSERT') {
              toast.info('You were added to a worker group');
            } else if (payload.eventType === 'UPDATE') {
              toast.info('You were moved to another worker group');
            } else if (payload.eventType === 'DELETE') {
              toast.info('You were removed from your group');
            }
          }
        } catch (err) {
          if (__DEV__) console.log('[Realtime worker_group_members error]', err);
        }
      }
    );

    // 5. Subscribe AFTER listeners are registered
    channel.subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient, workerUserId, toast]);
}

