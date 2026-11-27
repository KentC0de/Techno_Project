export const TASK_STATUS_CONFIG = {
  pending: {
    key: 'pending',
    label: 'Pending',
    shortLabel: 'Pending',
    icon: 'time-outline',
    textColor: '#52525B',
    borderColor: '#D4D4D8',
    bgColor: '#F4F4F5',
    isOutline: true,
  },
  overdue: {
    key: 'overdue',
    label: 'Overdue',
    shortLabel: 'Overdue',
    icon: 'alert-circle-outline',
    textColor: '#DC2626',
    borderColor: '#F87171',
    bgColor: '#FEF2F2',
    isOutline: true,
  },
  completed: {
    key: 'completed',
    label: 'Completed (not reported yet)',
    shortLabel: 'Completed',
    icon: 'checkmark-circle-outline',
    textColor: '#0284C7',
    borderColor: '#0EA5E9',
    bgColor: '#F0F9FF',
    isOutline: true,
  },
  issue: {
    key: 'issue',
    label: 'Completed with issue',
    shortLabel: 'Issue',
    icon: 'warning-outline',
    textColor: '#B45309',
    borderColor: '#F59E0B',
    bgColor: '#FEF3C7',
    isOutline: true,
  },
  submitted: {
    key: 'submitted',
    label: 'Submitted, waiting review',
    shortLabel: 'Submitted',
    icon: 'time',
    textColor: '#0284C7',
    borderColor: '#0EA5E9',
    bgColor: '#E0F2FE',
    isOutline: true,
  },
  done: {
    key: 'done',
    label: 'Approved',
    shortLabel: 'Approved',
    icon: 'checkmark-circle',
    textColor: '#FFFFFF',
    borderColor: '#0EA5E9',
    bgColor: '#0EA5E9',
    isOutline: false,
  },
  returned: {
    key: 'returned',
    label: 'Returned for correction',
    shortLabel: 'Returned',
    icon: 'close-circle-outline',
    textColor: '#DC2626',
    borderColor: '#DC2626',
    bgColor: '#FEF2F2',
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
  const result = log.result;

  if (status === 'draft') {
    return result === 'issue' ? 'issue' : 'completed';
  }
  if (status === 'submitted') return 'submitted';
  if (status === 'done') return 'done';
  if (status === 'rejected') return 'returned';

  if (dueDate && todayLocal && dueDate < todayLocal) {
    return 'overdue';
  }
  return 'pending';
}

export function computeTaskCounts(tasks = []) {
  const total = tasks.length;
  let done = 0;
  let submitted = 0;
  let completed = 0;
  let issue = 0;
  let returned = 0;
  let pending = 0;
  let overdue = 0;

  for (const t of tasks) {
    const log = t.log || (t.status && t.status !== 'pending' && t.status !== 'overdue' ? t : null);
    const state = t.taskState || getTaskState(t.due_date, log, null);
    if (state === 'done') {
      done++;
    } else if (state === 'submitted') {
      submitted++;
    } else if (state === 'completed') {
      completed++;
    } else if (state === 'issue') {
      issue++;
    } else if (state === 'returned') {
      returned++;
      if (t.isOverdue) overdue++;
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
    completed,
    issue,
    returned,
    rejected: returned,
    pending,
    overdue,
    rate,
  };
}
