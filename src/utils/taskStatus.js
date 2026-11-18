export const TASK_STATUS_CONFIG = {
  pending: {
    key: 'pending',
    label: 'Pending',
    icon: 'time-outline',
    textColor: '#52525B',
    borderColor: '#D4D4D8',
    bgColor: '#F4F4F5',
    isOutline: true,
  },
  overdue: {
    key: 'overdue',
    label: 'Overdue',
    icon: 'alert-circle-outline',
    textColor: '#DC2626',
    borderColor: '#F87171',
    bgColor: '#FEF2F2',
    isOutline: true,
  },
  submitted: {
    key: 'submitted',
    label: 'Waiting for admin approval',
    shortLabel: 'Waiting',
    icon: 'time',
    textColor: '#0284C7',
    borderColor: '#0EA5E9',
    bgColor: '#F0F9FF',
    isOutline: true,
  },
  done: {
    key: 'done',
    label: 'Done',
    shortLabel: 'Done',
    icon: 'checkmark-circle',
    textColor: '#FFFFFF',
    borderColor: '#0EA5E9',
    bgColor: '#0EA5E9',
    isOutline: false,
  },
  rejected: {
    key: 'rejected',
    label: 'Rejected',
    shortLabel: 'Rejected',
    icon: 'close-circle-outline',
    textColor: '#DC2626',
    borderColor: '#DC2626',
    bgColor: '#FEF2F2',
    isOutline: true,
  },
  issue: {
    key: 'issue',
    label: 'Issue',
    shortLabel: 'Issue',
    icon: 'warning-outline',
    textColor: '#0A0A0A',
    borderColor: '#0A0A0A',
    bgColor: '#FFFFFF',
    isOutline: true,
  },
  skipped: {
    key: 'skipped',
    label: 'Skipped',
    shortLabel: 'Skipped',
    icon: 'play-forward-outline',
    textColor: '#71717A',
    borderColor: '#E4E4E7',
    bgColor: '#F4F4F5',
    isOutline: true,
  },
};

export function getTaskState(dueDate, log, todayLocal) {
  if (!log) {
    if (dueDate && todayLocal && dueDate < todayLocal) {
      return 'overdue';
    }
    return 'pending';
  }

  const status = log.status;
  if (status === 'submitted') return 'submitted';
  if (status === 'done') return 'done';
  if (status === 'rejected') {
    if (dueDate && todayLocal && dueDate < todayLocal) {
      return 'overdue';
    }
    return 'rejected';
  }
  if (status === 'issue') return 'issue';
  if (status === 'skipped') return 'skipped';

  if (dueDate && todayLocal && dueDate < todayLocal) {
    return 'overdue';
  }
  return 'pending';
}

export function computeTaskCounts(tasks = []) {
  const total = tasks.length;
  let done = 0;
  let submitted = 0;
  let rejected = 0;
  let pending = 0;
  let overdue = 0;
  let issue = 0;
  let skipped = 0;

  for (const t of tasks) {
    const s = t.status;
    if (s === 'done') {
      done++;
    } else if (s === 'submitted') {
      submitted++;
    } else if (s === 'rejected') {
      rejected++;
      if (t.isOverdue) overdue++;
    } else if (s === 'issue') {
      issue++;
    } else if (s === 'skipped') {
      skipped++;
    } else {
      pending++;
      if (t.isOverdue) overdue++;
    }
  }

  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    done,
    submitted,
    waiting: submitted,
    rejected,
    pending,
    overdue,
    issue,
    skipped,
    rate,
  };
}
