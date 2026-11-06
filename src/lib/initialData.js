// Initial seed data structured exactly according to the database schema:
// categories, groups, equipment, schedule_rules, profiles
import { formatDate } from '../utils/schedule';

export const INITIAL_CATEGORIES = [
  { id: 'cat-a', code: 'A', name: 'Inverter Station Area', sort_order: 1 },
  { id: 'cat-b', code: 'B', name: 'PV Field Area', sort_order: 2 },
  { id: 'cat-c', code: 'C', name: 'MV & LV System', sort_order: 3 },
  { id: 'cat-d', code: 'D', name: 'Other System', sort_order: 4 },
];

export const INITIAL_GROUPS = [
  // A. Inverter Station Area
  { id: 'grp-a1', category_id: 'cat-a', item_no: 1, name: 'Station RMU/ MV Switchgear' },
  { id: 'grp-a2', category_id: 'cat-a', item_no: 2, name: 'Transformer' },
  { id: 'grp-a3', category_id: 'cat-a', item_no: 3, name: 'Inverter' },
  { id: 'grp-a4', category_id: 'cat-a', item_no: 4, name: 'Station Aux Power Supply Set-up' },
  { id: 'grp-a5', category_id: 'cat-a', item_no: 5, name: 'Structure, Inverter Station' },

  // B. PV Field Area
  { id: 'grp-b1', category_id: 'cat-b', item_no: 1, name: 'PV Module Cleaning' },
  { id: 'grp-b2', category_id: 'cat-b', item_no: 2, name: 'Grass Cutting' },
  { id: 'grp-b3', category_id: 'cat-b', item_no: 3, name: 'PV Mod & Structure' },
  { id: 'grp-b4', category_id: 'cat-b', item_no: 4, name: 'PV Combiner Boxes' },
  { id: 'grp-b5', category_id: 'cat-b', item_no: 5, name: 'Drainage System' },

  // C. MV & LV System
  { id: 'grp-c1', category_id: 'cat-c', item_no: 1, name: 'Main Switchboard-34Kv' },
  { id: 'grp-c2', category_id: 'cat-c', item_no: 2, name: 'Main Aux Switchboard-0.4Kv' },
  { id: 'grp-c3', category_id: 'cat-c', item_no: 3, name: 'Main Aux Transformer Bank' },
  { id: 'grp-c4', category_id: 'cat-c', item_no: 4, name: 'Main Battery bank, charger and DC panel' },

  // D. Other System
  { id: 'grp-d1', category_id: 'cat-d', item_no: 1, name: 'Aircon Setup' },
  { id: 'grp-d2', category_id: 'cat-d', item_no: 2, name: 'Building Structure' },
  { id: 'grp-d3', category_id: 'cat-d', item_no: 3, name: 'CCTV Set-up' },
  { id: 'grp-d4', category_id: 'cat-d', item_no: 4, name: 'Communication & Controller System' },
  { id: 'grp-d5', category_id: 'cat-d', item_no: 5, name: 'Fire Fighting and Alarm Set-up' },
  { id: 'grp-d6', category_id: 'cat-d', item_no: 6, name: 'Lighting Setup' },
  { id: 'grp-d7', category_id: 'cat-d', item_no: 7, name: 'Ventilation Setup' },
  { id: 'grp-d8', category_id: 'cat-d', item_no: 8, name: 'Water Supply Setup' },
];

export const INITIAL_EQUIPMENT = [
  // A1: RMU
  { id: 'eq-a1-1', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 1', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a1-2', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 2', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a1-3', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 3', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a1-4', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 4', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a1-5', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 5', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a1-6', group_id: 'grp-a1', name: 'Station RMU/ MV Switchgear 6', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },

  // A2: Transformer
  { id: 'eq-a2-1', group_id: 'grp-a2', name: 'Transformer 1', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a2-2', group_id: 'grp-a2', name: 'Transformer 2', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a2-3', group_id: 'grp-a2', name: 'Transformer 3', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a2-4', group_id: 'grp-a2', name: 'Transformer 4', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a2-5', group_id: 'grp-a2', name: 'Transformer 5', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a2-6', group_id: 'grp-a2', name: 'Transformer 6', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },

  // A3: Inverter 1-12
  { id: 'eq-a3-1', group_id: 'grp-a3', name: 'Inverter 1', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-2', group_id: 'grp-a3', name: 'Inverter 2', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-3', group_id: 'grp-a3', name: 'Inverter 3', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-4', group_id: 'grp-a3', name: 'Inverter 4', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-5', group_id: 'grp-a3', name: 'Inverter 5', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-6', group_id: 'grp-a3', name: 'Inverter 6', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-7', group_id: 'grp-a3', name: 'Inverter 7', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-8', group_id: 'grp-a3', name: 'Inverter 8', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-9', group_id: 'grp-a3', name: 'Inverter 9', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-10', group_id: 'grp-a3', name: 'Inverter 10', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-11', group_id: 'grp-a3', name: 'Inverter 11', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-a3-12', group_id: 'grp-a3', name: 'Inverter 12', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },

  // A4: Station Aux Power Supply
  { id: 'eq-a4-1', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 1', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-a4-2', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 2', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-a4-3', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 3', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-a4-4', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 4', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-a4-5', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 5', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-a4-6', group_id: 'grp-a4', name: 'Station Aux Power Supply Set-up 6', area: null, unit_count: 1, default_freq: ['M'], is_active: true },

  // A5: Structure Inverter Station
  { id: 'eq-a5-1', group_id: 'grp-a5', name: 'Structure, Inverter Station 1', area: null, unit_count: 1, default_freq: [], is_active: true },
  { id: 'eq-a5-2', group_id: 'grp-a5', name: 'Structure, Inverter Station 2', area: null, unit_count: 1, default_freq: [], is_active: true },
  { id: 'eq-a5-3', group_id: 'grp-a5', name: 'Structure, Inverter Station 3', area: null, unit_count: 1, default_freq: [], is_active: true },
  { id: 'eq-a5-4', group_id: 'grp-a5', name: 'Structure, Inverter Station 4', area: null, unit_count: 1, default_freq: [], is_active: true },
  { id: 'eq-a5-5', group_id: 'grp-a5', name: 'Structure, Inverter Station 5', area: null, unit_count: 1, default_freq: [], is_active: true },
  { id: 'eq-a5-6', group_id: 'grp-a5', name: 'Structure, Inverter Station 6', area: null, unit_count: 1, default_freq: ['Q'], is_active: true },

  // B1: PV Module Cleaning (Area 1, Area 2, Area 3)
  { id: 'eq-b1-1', group_id: 'grp-b1', name: 'PV Module Cleaning - Area 1', area: 'Area 1', unit_count: 1, default_freq: ['d'], is_active: true },
  { id: 'eq-b1-2', group_id: 'grp-b1', name: 'PV Module Cleaning - Area 2', area: 'Area 2', unit_count: 1, default_freq: ['d'], is_active: true },
  { id: 'eq-b1-3', group_id: 'grp-b1', name: 'PV Module Cleaning - Area 3', area: 'Area 3', unit_count: 1, default_freq: ['d'], is_active: true },

  // B2: Grass Cutting
  { id: 'eq-b2-1', group_id: 'grp-b2', name: 'Grass Cutting - Area 1', area: 'Area 1', unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-b2-2', group_id: 'grp-b2', name: 'Grass Cutting - Area 2', area: 'Area 2', unit_count: 1, default_freq: ['d'], is_active: true },
  { id: 'eq-b2-3', group_id: 'grp-b2', name: 'Grass Cutting - Area 3', area: 'Area 3', unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-b2-4', group_id: 'grp-b2', name: 'Grass Cutting - Main Station', area: null, unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-b2-5', group_id: 'grp-b2', name: 'Grass Cutting - Perimeter and Open Areas', area: null, unit_count: 1, default_freq: ['w'], is_active: true },

  // B3: PV Mod & Structure
  { id: 'eq-b3-1', group_id: 'grp-b3', name: 'PV Mod & Structure - Area 1', area: 'Area 1', unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-b3-2', group_id: 'grp-b3', name: 'PV Mod & Structure - Area 2', area: 'Area 2', unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-b3-3', group_id: 'grp-b3', name: 'PV Mod & Structure - Area 3', area: 'Area 3', unit_count: 1, default_freq: ['M'], is_active: true },

  // B4: PV Combiner Boxes (DCB-E01 to E12)
  { id: 'eq-b4-1', group_id: 'grp-b4', name: 'DCB-E01 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-2', group_id: 'grp-b4', name: 'DCB-E02 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-3', group_id: 'grp-b4', name: 'DCB-E03 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-4', group_id: 'grp-b4', name: 'DCB-E04 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-5', group_id: 'grp-b4', name: 'DCB-E05 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-6', group_id: 'grp-b4', name: 'DCB-E06 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-7', group_id: 'grp-b4', name: 'DCB-E07 x 5', area: null, unit_count: 5, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-8', group_id: 'grp-b4', name: 'DCB-E08 x 5', area: null, unit_count: 5, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-9', group_id: 'grp-b4', name: 'DCB-E09 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-10', group_id: 'grp-b4', name: 'DCB-E10 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-11', group_id: 'grp-b4', name: 'DCB-E11 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },
  { id: 'eq-b4-12', group_id: 'grp-b4', name: 'DCB-E12 x 6', area: null, unit_count: 6, default_freq: ['M'], is_active: true },

  // B5: Drainage System
  { id: 'eq-b5-1', group_id: 'grp-b5', name: 'Drainage System - Area 1', area: 'Area 1', unit_count: 1, default_freq: ['w', 'M'], is_active: true },
  { id: 'eq-b5-2', group_id: 'grp-b5', name: 'Drainage System - Area 2', area: 'Area 2', unit_count: 1, default_freq: ['w', 'M'], is_active: true },
  { id: 'eq-b5-3', group_id: 'grp-b5', name: 'Drainage System - Area 3', area: 'Area 3', unit_count: 1, default_freq: ['w', 'M'], is_active: true },

  // C: MV & LV System
  { id: 'eq-c1-1', group_id: 'grp-c1', name: 'Main Switchboard-34Kv', area: null, unit_count: 1, default_freq: ['d', 'M'], is_active: true },
  { id: 'eq-c2-1', group_id: 'grp-c2', name: 'Main Aux Switchboard-0.4Kv', area: null, unit_count: 1, default_freq: ['d'], is_active: true },
  { id: 'eq-c2-2', group_id: 'grp-c2', name: 'Distribution Board Guard House Station', area: null, unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-c2-3', group_id: 'grp-c2', name: 'Distribution Board Main Station Lighting', area: null, unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-c2-4', group_id: 'grp-c2', name: 'Distribution Board Water Pump Station', area: null, unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-c3-1', group_id: 'grp-c3', name: 'Main Aux Transformer Bank', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-c4-1', group_id: 'grp-c4', name: 'Main Battery bank, charger and DC panel', area: null, unit_count: 1, default_freq: ['d'], is_active: true },

  // D: Other System
  { id: 'eq-d1-1', group_id: 'grp-d1', name: 'Aircon Setup', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-d2-1', group_id: 'grp-d2', name: 'Building Structure', area: null, unit_count: 1, default_freq: ['w'], is_active: true },
  { id: 'eq-d3-1', group_id: 'grp-d3', name: 'CCTV Set-up', area: null, unit_count: 1, default_freq: ['d'], is_active: true },
  { id: 'eq-d4-1', group_id: 'grp-d4', name: 'Communication & Controller System', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
  { id: 'eq-d5-1', group_id: 'grp-d5', name: 'Fire Fighting and Alarm Set-up', area: null, unit_count: 1, default_freq: ['d', 'M'], is_active: true },
  { id: 'eq-d6-1', group_id: 'grp-d6', name: 'Lighting Setup', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-d7-1', group_id: 'grp-d7', name: 'Ventilation Setup', area: null, unit_count: 1, default_freq: ['M'], is_active: true },
  { id: 'eq-d8-1', group_id: 'grp-d8', name: 'Water Supply Setup', area: null, unit_count: 1, default_freq: ['d', 'w', 'M'], is_active: true },
];

export const INITIAL_PROFILES = [
  {
    id: 'user-admin-1',
    full_name: 'Alex Maintenance Lead',
    role: 'admin',
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-worker-1',
    full_name: 'Sam Solar Worker',
    role: 'worker',
    created_at: new Date().toISOString(),
  },
];

// Generate standard rules for demo mode so that tasks are populated right away
export function createDefaultRules() {
  const today = new Date();
  // Start from the beginning of this month
  const startOfYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  const rules = [];
  let ruleId = 1;

  for (const eq of INITIAL_EQUIPMENT) {
    if (!eq.is_active || !eq.default_freq) continue;
    for (const freq of eq.default_freq) {
      rules.push({
        id: `rule-${ruleId++}`,
        equipment_id: eq.id,
        frequency: freq,
        start_date: startOfYearMonth,
        end_date: null,
        weekday: freq === 'w' ? 1 : null, // Monday for weekly rules
        notes: `Standard ${freq === 'd' ? 'daily' : freq === 'w' ? 'weekly' : freq === 'M' ? 'monthly' : 'routine'} inspection`,
        created_by: 'user-admin-1',
        created_at: new Date().toISOString(),
      });
    }
  }

  return rules;
}

