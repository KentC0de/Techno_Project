import { supabase } from './supabase';

export const AREAS = ['Area 1', 'Area 2', 'Area 3'];

export const ACTIVITIES = [
  { value: 'module', label: 'Module Cleaning', short: 'Module' },
  { value: 'pathway', label: 'Pathway / Grass Cutting', short: 'Pathway' },
  { value: 'undertable', label: 'Under-table Cleaning', short: 'Under-table' },
];

export function activityLabel(value) {
  return ACTIVITIES.find((a) => a.value === value)?.label || value;
}

// 42P01 = table missing, 42703 = column missing, 42883 = function missing
export function isSiteMapSetupError(error) {
  return Boolean(error && ['42P01', '42703', '42883', 'PGRST205'].includes(error.code));
}

export async function fetchSiteMapCells() {
  const { data, error } = await supabase
    .from('site_map_cells')
    .select('id, area, row_no, col_no, label, kind')
    .order('area')
    .order('row_no')
    .order('col_no');
  if (error) throw error;
  return data || [];
}

export async function fetchCleaningTargets() {
  const { data, error } = await supabase
    .from('cleaning_targets')
    .select('activity, cycles_per_year, rounds_per_cycle, target_per_round, confirmed');
  if (error) throw error;
  return data || [];
}

export async function fetchCleaningRecords({ activity, cycle }) {
  const { data, error } = await supabase
    .from('cleaning_records')
    .select('id, cell_id, activity, cycle, round, remarks, recorded_by, recorded_at')
    .eq('activity', activity)
    .eq('cycle', cycle);
  if (error) throw error;
  return data || [];
}

export async function fetchProfileNames(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p.full_name]));
}

export async function recordCleaning({ cellId, activity, cycle, round = 1, remarks, userId }) {
  const { error } = await supabase.from('cleaning_records').upsert(
    { cell_id: cellId, activity, cycle, round, remarks: remarks || null, recorded_by: userId },
    { onConflict: 'cell_id,activity,cycle,round', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function undoCleaning(recordId) {
  const { error } = await supabase.from('cleaning_records').delete().eq('id', recordId);
  if (error) throw error;
}
