// Preventive Maintenance Schedule expansion utilities
// Handles frequency codes:
// d  = Daily (every day from start_date until end_date if set)
// w  = Weekly (every week on specified weekday 1-7, 1=Mon ... 7=Sun)
// M  = Monthly (same day-of-month as start_date, clamped to month's last day)
// Q  = Quarterly (every 3 months from start_date, clamped to month's last day)
// SA = Semi-annual (every 6 months from start_date, clamped to month's last day)

/**
 * Format a Date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD into a local Date object at midnight
 * @param {string} str
 * @returns {Date}
 */
export function parseDate(str) {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

/**
 * Get number of days in a given month (month is 1-12)
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Get ISO weekday (1=Monday ... 7=Sunday)
 * @param {Date} date
 * @returns {number}
 */
export function getIsoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Add days to a Date object, returning a new Date
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const res = new Date(date.getTime());
  res.setDate(res.getDate() + days);
  return res;
}

/**
 * Get Monday to Sunday range for the week of a given date string (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {{ start: string, end: string, days: Array<{ date: string, weekday: number, label: string, isToday: boolean }> }}
 */
export function getWorkWeek(dateStr) {
  const target = parseDate(dateStr);
  const weekday = getIsoWeekday(target); // 1=Mon, ..., 7=Sun
  const monday = addDays(target, -(weekday - 1));
  const todayStr = formatDate(new Date());

  const days = [];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const dStr = formatDate(d);
    days.push({
      date: dStr,
      weekday: i + 1,
      shortLabel: dayLabels[i],
      dayNumber: d.getDate(),
      isToday: dStr === todayStr,
    });
  }

  return {
    start: days[0].date,
    end: days[6].date,
    days,
  };
}

/**
 * Get ISO work week number (1-53) for a given date
 * @param {string} dateStr
 * @returns {number}
 */
export function getWorkWeekNumber(dateStr) {
  const d = parseDate(dateStr);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

/**
 * Get month date range { start: 'YYYY-MM-01', end: 'YYYY-MM-XX' }
 * @param {string} dateStr
 * @returns {{ start: string, end: string, year: number, month: number, monthName: string }}
 */
export function getMonthRange(dateStr) {
  const d = parseDate(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const lastDay = daysInMonth(year, month);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    year,
    month,
    monthName: monthNames[month - 1],
  };
}

/**
 * Expand a schedule rule into due dates within a given date range [rangeStart, rangeEnd]
 * @param {Object} rule - schedule_rules row
 * @param {string} rangeStart - YYYY-MM-DD
 * @param {string} rangeEnd - YYYY-MM-DD
 * @returns {string[]} Array of YYYY-MM-DD strings
 */
export function expandRuleDueDates(rule, rangeStart, rangeEnd) {
  if (!rule || !rule.start_date || !rule.frequency) return [];

  const ruleStart = rule.start_date;
  const ruleEnd = rule.end_date || null;

  // If rule ends before the range starts, no tasks
  if (ruleEnd && ruleEnd < rangeStart) return [];
  // If rule starts after the range ends, no tasks
  if (ruleStart > rangeEnd) return [];

  const effectiveStart = ruleStart > rangeStart ? ruleStart : rangeStart;
  const effectiveEnd = ruleEnd && ruleEnd < rangeEnd ? ruleEnd : rangeEnd;

  if (effectiveStart > effectiveEnd) return [];

  const results = [];
  const freq = rule.frequency;

  if (freq === 'd') {
    // Daily: every day in effective range
    let cur = parseDate(effectiveStart);
    const end = parseDate(effectiveEnd);
    while (cur <= end) {
      results.push(formatDate(cur));
      cur = addDays(cur, 1);
    }
  } else if (freq === 'w') {
    // Weekly: on rule.weekday (1=Mon ... 7=Sun)
    // If not set, use start_date's weekday
    const targetWeekday = rule.weekday ? Number(rule.weekday) : getIsoWeekday(parseDate(ruleStart));
    let cur = parseDate(effectiveStart);
    const end = parseDate(effectiveEnd);
    while (cur <= end) {
      if (getIsoWeekday(cur) === targetWeekday) {
        results.push(formatDate(cur));
      }
      cur = addDays(cur, 1);
    }
  } else if (freq === 'M') {
    // Monthly: same day-of-month as start_date, clamped to the last day of month
    const [startYear, startMonth, startDay] = ruleStart.split('-').map(Number);
    const [eYear, eMonth] = effectiveEnd.split('-').map(Number);

    // Start checking from the month of effectiveStart
    const [sYear, sMonth] = effectiveStart.split('-').map(Number);

    let curYear = sYear;
    let curMonth = sMonth;

    while (curYear < eYear || (curYear === eYear && curMonth <= eMonth)) {
      // Don't generate if before start_date month
      if (curYear > startYear || (curYear === startYear && curMonth >= startMonth)) {
        const lastDay = daysInMonth(curYear, curMonth);
        const day = Math.min(startDay, lastDay);
        const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr >= effectiveStart && dateStr <= effectiveEnd) {
          results.push(dateStr);
        }
      }

      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  } else if (freq === 'Q' || freq === 'SA') {
    // Quarterly = step 3 months, Semi-annual = step 6 months
    const stepMonths = freq === 'Q' ? 3 : 6;
    const [startYear, startMonth, startDay] = ruleStart.split('-').map(Number);

    let k = 0;
    while (true) {
      const totalMonths = (startMonth - 1) + (k * stepMonths);
      const curYear = startYear + Math.floor(totalMonths / 12);
      const curMonth = (totalMonths % 12) + 1;

      const lastDay = daysInMonth(curYear, curMonth);
      const day = Math.min(startDay, lastDay);
      const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (dateStr > effectiveEnd) {
        break;
      }

      if (dateStr >= effectiveStart && dateStr <= effectiveEnd) {
        results.push(dateStr);
      }

      k++;
      if (k > 200) break; // safety guard
    }
  }

  return results;
}

/**
 * Expand multiple rules and match with task_logs to compute due tasks with completion status
 * @param {Array} rules - Array of schedule_rules with joined equipment, group, category
 * @param {Array} logs - Array of task_logs
 * @param {string} rangeStart - YYYY-MM-DD
 * @param {string} rangeEnd - YYYY-MM-DD
 * @returns {Array} List of task items
 */
export function buildDueTasks(rules, logs, rangeStart, rangeEnd) {
  // Index logs by rule_id + '_' + due_date
  const logMap = new Map();
  if (Array.isArray(logs)) {
    for (const log of logs) {
      logMap.set(`${log.rule_id}_${log.due_date}`, log);
    }
  }

  const tasks = [];
  const todayStr = formatDate(new Date());

  for (const rule of rules || []) {
    const dueDates = expandRuleDueDates(rule, rangeStart, rangeEnd);
    for (const dueDate of dueDates) {
      const key = `${rule.id}_${dueDate}`;
      const log = logMap.get(key) || null;
      const status = log ? log.status : 'pending';
      const isOverdue = status === 'pending' && dueDate < todayStr;

      tasks.push({
        id: `${rule.id}_${dueDate}`,
        rule_id: rule.id,
        due_date: dueDate,
        frequency: rule.frequency,
        notes: rule.notes || '',
        weekday: rule.weekday,
        status,
        isOverdue,
        log,
        rule,
        equipment: rule.equipment || null,
        group: rule.equipment?.group || null,
        category: rule.equipment?.group?.category || null,
      });
    }
  }

  // Sort tasks by due_date ascending, then category sort_order, then group item_no, then equipment name
  tasks.sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    const catA = a.category?.sort_order ?? 99;
    const catB = b.category?.sort_order ?? 99;
    if (catA !== catB) return catA - catB;
    const grpA = Number(a.group?.item_no) || 99;
    const grpB = Number(b.group?.item_no) || 99;
    if (grpA !== grpB) return grpA - grpB;
    return (a.equipment?.name || '').localeCompare(b.equipment?.name || '');
  });

  return tasks;
}

/**
 * Compute performance metrics for a list of due tasks
 * @param {Array} tasks
 * @returns {{ completedCount: number, totalCount: number, rate: number, overdueCount: number, issueCount: number, skippedCount: number }}
 */
export function computePerformance(tasks) {
  const totalCount = tasks.length;
  let completedCount = 0;
  let issueCount = 0;
  let skippedCount = 0;
  let overdueCount = 0;

  for (const t of tasks) {
    if (t.status === 'done') completedCount++;
    else if (t.status === 'issue') issueCount++;
    else if (t.status === 'skipped') skippedCount++;

    if (t.isOverdue) overdueCount++;
  }

  const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    completedCount,
    totalCount,
    rate,
    issueCount,
    skippedCount,
    overdueCount,
  };
}

