// Unified Data and Auth Service
// Connects to Supabase when EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are provided.
// If unconfigured or offline, gracefully provides an in-memory & AsyncStorage backed mock store
// initialized with the exact Excel Master Maintenance Schedule data.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isConfigured } from './supabase';
import { getAuthRedirectUrl } from './authRedirect';
import {
  INITIAL_CATEGORIES,
  INITIAL_GROUPS,
  INITIAL_EQUIPMENT,
  INITIAL_PROFILES,
  createDefaultRules,
} from './initialData';

const STORAGE_KEYS = {
  CATEGORIES: '@pm_categories',
  GROUPS: '@pm_groups',
  EQUIPMENT: '@pm_equipment',
  RULES: '@pm_schedule_rules',
  LOGS: '@pm_task_logs',
  PROFILES: '@pm_profiles',
  MOCK_SESSION: '@pm_mock_session',
  WORKER_SELECTION: '@pm_worker_selection',
};

// --- Mock Store Helpers ---
async function getStored(key, defaultValue) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Storage read error:', err);
    return defaultValue;
  }
}

async function setStored(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Storage write error:', err);
  }
}

// Initialize mock data if not yet present
export async function initializeMockDataIfNeeded() {
  const categories = await getStored(STORAGE_KEYS.CATEGORIES, null);
  if (!categories) {
    await setStored(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    await setStored(STORAGE_KEYS.GROUPS, INITIAL_GROUPS);
    await setStored(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    await setStored(STORAGE_KEYS.RULES, createDefaultRules());
    await setStored(STORAGE_KEYS.LOGS, []);
    await setStored(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
  }
}

// --- AUTH METHODS ---

export async function getCurrentUser() {
  if (isConfigured) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      // Fetch profile for role using maybeSingle() to handle missing rows gracefully
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (pErr) {
        console.warn('Failed to fetch profile row:', pErr.message);
      }

      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.user_metadata?.full_name || 'User',
        role: profile?.role || 'worker',
      };
    } catch (e) {
      console.warn('Failed to fetch user from Supabase:', e);
      return null;
    }
  } else {
    await initializeMockDataIfNeeded();
    const session = await getStored(STORAGE_KEYS.MOCK_SESSION, null);
    return session;
  }
}

/**
 * signIn — plain sign in without role check (kept for AuthContext.signIn compat).
 * The new screens use signInWithRoleCheck instead.
 */
export async function signIn(email, password) {
  if (isConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', data.user.id)
      .maybeSingle();

    return {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name || data.user.user_metadata?.full_name || 'User',
      role: profile?.role || 'worker',
    };
  } else {
    await initializeMockDataIfNeeded();
    const profiles = await getStored(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const normalizedEmail = (email || '').toLowerCase().trim();

    let user;
    if (normalizedEmail.includes('admin')) {
      user = profiles.find((p) => p.role === 'admin') || profiles[0];
    } else {
      user = profiles.find((p) => p.role === 'worker') || profiles[1];
    }

    const sessionUser = {
      id: user.id,
      email: normalizedEmail || (user.role === 'admin' ? 'admin@solarpm.com' : 'worker@solarpm.com'),
      full_name: user.full_name,
      role: user.role,
    };

    await setStored(STORAGE_KEYS.MOCK_SESSION, sessionUser);
    return sessionUser;
  }
}

/**
 * signInWithRoleCheck — signs in and enforces role.
 * expectedRole: 'admin' | 'worker'
 * Throws an error with a user-friendly message if the role does not match.
 */
export async function signInWithRoleCheck(email, password, expectedRole) {
  if (!isConfigured) {
    throw new Error('Supabase is not configured. Please add your credentials to the .env file.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('banned') || error.code === 'user_banned') {
      const banErr = new Error('ACCOUNT_DISABLED');
      banErr.code = 'ACCOUNT_DISABLED';
      throw banErr;
    }
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      throw new Error('Wrong email or password');
    }
    if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
      throw new Error('This email is not confirmed yet. Confirm it in Supabase.');
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to fetch')) {
      throw new Error('Cannot reach Supabase. Check the URL and your internet.');
    }
    throw new Error(msg || 'Sign in failed. Please try again.');
  }

  // Fetch profiles row using maybeSingle() so missing profile doesn't crash silently
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileErr) {
    await supabase.auth.signOut();
    throw new Error(`Profile access error (${profileErr.code || 'RLS'}): ${profileErr.message}`);
  }

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('No profile found for this account. Ask the system owner to create it.');
  }

  if (profile.status === 'disabled') {
    await supabase.auth.signOut();
    const disErr = new Error('ACCOUNT_DISABLED');
    disErr.code = 'ACCOUNT_DISABLED';
    throw disErr;
  }

  const role = profile.role;

  if (expectedRole === 'admin' && role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('This account is not an administrator.');
  }

  if (expectedRole === 'worker' && role !== 'worker') {
    await supabase.auth.signOut();
    throw new Error('This account is for the admin website. Please sign in on the web.');
  }

  return {
    id: data.user.id,
    email: data.user.email,
    full_name: profile.full_name || data.user.user_metadata?.full_name || 'User',
    role,
  };
}

/**
 * signUp — creates a new Supabase Auth account.
 * Does NOT send role — the DB trigger / RLS handles it (workers only via app).
 */
export async function signUp(email, password, fullName) {
  if (isConfigured) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed'),
      },
    });
    if (error) throw error;

    // If session is null, Supabase requires email confirmation
    if (data.user && !data.session) {
      return { requiresEmailConfirmation: true, email };
    }

    return {
      id: data.user?.id,
      email: data.user?.email,
      full_name: fullName,
      role: 'worker',
    };
  } else {
    await initializeMockDataIfNeeded();
    const profiles = await getStored(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const newId = `user-${Date.now()}`;
    const newProfile = {
      id: newId,
      full_name: fullName || 'New Worker',
      role: 'worker',
      created_at: new Date().toISOString(),
    };
    profiles.push(newProfile);
    await setStored(STORAGE_KEYS.PROFILES, profiles);

    const sessionUser = {
      id: newId,
      email,
      full_name: newProfile.full_name,
      role: newProfile.role,
    };
    await setStored(STORAGE_KEYS.MOCK_SESSION, sessionUser);
    return sessionUser;
  }
}

export async function signOut() {
  if (isConfigured) {
    await supabase.auth.signOut();
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.MOCK_SESSION);
  }
}

// --- DATA ACCESS METHODS ---

export async function fetchCategories() {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  } else {
    throw new Error('Supabase is not configured.');
  }
}

export async function fetchGroups(categoryId = null) {
  if (isConfigured) {
    let query = supabase.from('groups').select('*').order('item_no', { ascending: true });
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } else {
    throw new Error('Supabase is not configured.');
  }
}

export async function fetchEquipment(groupIdOrOptions = null) {
  let groupId = null;
  let activeOnly = false;
  let includeRelations = true;

  if (typeof groupIdOrOptions === 'string') {
    groupId = groupIdOrOptions;
    activeOnly = true;
  } else if (groupIdOrOptions && typeof groupIdOrOptions === 'object') {
    groupId = groupIdOrOptions.groupId || null;
    activeOnly = groupIdOrOptions.activeOnly !== undefined ? groupIdOrOptions.activeOnly : false;
    if (groupIdOrOptions.includeRelations !== undefined) {
      includeRelations = groupIdOrOptions.includeRelations;
    }
  }

  if (isConfigured) {
    const selectQuery = includeRelations
      ? '*, group:groups(*, category:categories(*))'
      : '*';
    let query = supabase.from('equipment').select(selectQuery);
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (groupId) {
      query = query.eq('group_id', groupId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } else {
    throw new Error('Supabase is not configured.');
  }
}

export async function fetchScheduleRules(filter = null) {
  if (isConfigured) {
    let allRules = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Check if filter is string (equipmentId) or object ({ categoryId, area, equipmentId })
    let equipmentId = typeof filter === 'string' ? filter : filter?.equipmentId;
    let categoryId = typeof filter === 'object' ? filter?.categoryId : null;
    let area = typeof filter === 'object' ? filter?.area : null;

    while (hasMore) {
      let query = supabase
        .from('schedule_rules')
        .select(`
          *,
          equipment:equipment(
            id,
            group_id,
            name,
            area,
            unit_count,
            default_freq,
            is_active,
            group:groups(
              id,
              category_id,
              item_no,
              name,
              category:categories(
                id,
                code,
                name,
                sort_order
              )
            )
          )
        `)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allRules.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Filter in JS for active equipment and optional category/area
    let filtered = allRules.filter((r) => r.equipment && r.equipment.is_active !== false);

    if (categoryId) {
      filtered = filtered.filter(
        (r) => r.equipment?.group?.category_id === categoryId || r.equipment?.group?.category?.id === categoryId
      );
    }

    if (area && area !== 'All') {
      filtered = filtered.filter((r) => r.equipment?.area === area);
    }

    return filtered;
  } else {
    // If Supabase was expected, throw an explicit error rather than silently showing mock data
    throw new Error('Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
  }
}

export async function fetchAllScheduleRules() {
  return fetchScheduleRules();
}

export async function createScheduleRule(rule) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('schedule_rules')
      .insert(rule)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const rules = await getStored(STORAGE_KEYS.RULES, []);
    const newRule = { id: `rule-${Date.now()}`, ...rule, created_at: new Date().toISOString() };
    rules.push(newRule);
    await setStored(STORAGE_KEYS.RULES, rules);
    return newRule;
  }
}

export async function updateScheduleRule(id, updates) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('schedule_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const rules = await getStored(STORAGE_KEYS.RULES, []);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx !== -1) rules[idx] = { ...rules[idx], ...updates };
    await setStored(STORAGE_KEYS.RULES, rules);
    return rules[idx];
  }
}

export async function deleteScheduleRule(id) {
  if (isConfigured) {
    const { error } = await supabase.from('schedule_rules').delete().eq('id', id);
    if (error) throw error;
  } else {
    await initializeMockDataIfNeeded();
    let rules = await getStored(STORAGE_KEYS.RULES, []);
    rules = rules.filter((r) => r.id !== id);
    await setStored(STORAGE_KEYS.RULES, rules);
  }
}

export async function fetchTaskLogs(rangeStartOrRuleIds = null, rangeEnd = null) {
  if (isConfigured) {
    let allLogs = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from('task_logs').select('*').range(page * pageSize, (page + 1) * pageSize - 1);

      if (Array.isArray(rangeStartOrRuleIds)) {
        if (rangeStartOrRuleIds.length > 0) {
          query = query.in('rule_id', rangeStartOrRuleIds);
        }
      } else if (typeof rangeStartOrRuleIds === 'string' && typeof rangeEnd === 'string') {
        query = query.gte('due_date', rangeStartOrRuleIds).lte('due_date', rangeEnd);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allLogs.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return allLogs;
  } else {
    throw new Error('Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
  }
}

export async function upsertTaskLog(log) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('task_logs')
      .upsert(log, { onConflict: 'rule_id,due_date' })
      .select()
      .single();
    if (error) {
      // Check for concurrent write conflict or permission notice
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        throw new Error('Already completed by someone else');
      }
      throw error;
    }
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const logs = await getStored(STORAGE_KEYS.LOGS, []);
    const idx = logs.findIndex(
      (l) => l.rule_id === log.rule_id && l.due_date === log.due_date
    );
    if (idx !== -1) {
      logs[idx] = { ...logs[idx], ...log };
    } else {
      logs.push({ id: `log-${Date.now()}`, ...log, done_at: new Date().toISOString() });
    }
    await setStored(STORAGE_KEYS.LOGS, logs);
    return log;
  }
}

export async function fetchProfiles() {
  if (isConfigured) {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  } else {
    await initializeMockDataIfNeeded();
    return await getStored(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
  }
}

export async function updateProfile(id, updates) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const profiles = await getStored(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx !== -1) profiles[idx] = { ...profiles[idx], ...updates };
    await setStored(STORAGE_KEYS.PROFILES, profiles);
    return profiles[idx];
  }
}

export async function createEquipment(equipment) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('equipment')
      .insert(equipment)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const eq = await getStored(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const newEq = { id: `eq-${Date.now()}`, is_active: true, ...equipment };
    eq.push(newEq);
    await setStored(STORAGE_KEYS.EQUIPMENT, eq);
    return newEq;
  }
}

export async function updateEquipment(id, updates) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('equipment')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const eq = await getStored(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const idx = eq.findIndex((e) => e.id === id);
    if (idx !== -1) eq[idx] = { ...eq[idx], ...updates };
    await setStored(STORAGE_KEYS.EQUIPMENT, eq);
    return eq[idx];
  }
}

export async function createScheduleRules(rules) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('schedule_rules')
      .insert(rules)
      .select();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const storedRules = await getStored(STORAGE_KEYS.RULES, []);
    const newItems = rules.map((r) => ({
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ...r,
      created_at: new Date().toISOString(),
    }));
    storedRules.push(...newItems);
    await setStored(STORAGE_KEYS.RULES, storedRules);
    return newItems;
  }
}

export async function createGroup(group) {
  if (isConfigured) {
    const { data, error } = await supabase
      .from('groups')
      .insert(group)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    await initializeMockDataIfNeeded();
    const groups = await getStored(STORAGE_KEYS.GROUPS, INITIAL_GROUPS);
    const newGrp = { id: `grp-${Date.now()}`, ...group };
    groups.push(newGrp);
    await setStored(STORAGE_KEYS.GROUPS, groups);
    return newGrp;
  }
}

export async function undoTaskLog(ruleId, dueDate) {
  if (isConfigured) {
    const { error } = await supabase
      .from('task_logs')
      .delete()
      .eq('rule_id', ruleId)
      .eq('due_date', dueDate);
    if (error) throw error;
  } else {
    await initializeMockDataIfNeeded();
    let logs = await getStored(STORAGE_KEYS.LOGS, []);
    logs = logs.filter((l) => !(l.rule_id === ruleId && l.due_date === dueDate));
    await setStored(STORAGE_KEYS.LOGS, logs);
  }
}

export async function updateProfileRole(id, role) {
  return updateProfile(id, { role });
}

export async function getSavedWorkerSelection() {
  return await getStored(STORAGE_KEYS.WORKER_SELECTION, { categoryId: null, area: null });
}

export async function saveWorkerSelection(selection) {
  await setStored(STORAGE_KEYS.WORKER_SELECTION, selection);
}
