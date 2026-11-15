/**
 * Map PostgreSQL, Supabase, network, and auth error codes / messages
 * to human-friendly, readable English sentences.
 */
export function mapError(err, fallback = 'Action failed. Please try again.') {
  if (!err) return fallback;

  if (typeof err === 'string') {
    const lower = err.toLowerCase();
    if (lower.includes('network') || lower.includes('fetch')) {
      return 'Cannot reach the server. Please check your internet connection.';
    }
    return err;
  }

  const code = err.code || '';
  const message = (err.message || '').toLowerCase();
  const details = (err.details || '').toLowerCase();

  // 1. PostgreSQL Error Codes
  // Unique violation
  if (code === '23505' || message.includes('duplicate key') || message.includes('already exists')) {
    return 'This record already exists. Please check for duplicates.';
  }

  // Foreign key violation
  if (code === '23503' || message.includes('foreign key') || message.includes('still referenced')) {
    return 'This item cannot be modified or deleted because it is still used by other records.';
  }

  // Not null violation
  if (code === '23502') {
    return 'A required field is missing. Please complete all fields.';
  }

  // Permission denied / RLS
  if (
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('violates row-level security') ||
    message.includes('not authorized')
  ) {
    return 'You do not have permission to perform this action.';
  }

  // Missing RPC / function in PostgreSQL
  if (
    code === '42883' ||
    code === 'PGRST202' ||
    message.includes('function') && message.includes('does not exist') ||
    message.includes('could not find the function')
  ) {
    return 'Database update needed: please run the latest SQL script in Supabase.';
  }

  // Table not found
  if (code === '42P01') {
    return 'Database table missing: please run the setup SQL in Supabase.';
  }

  // 2. Auth Errors
  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid grant') ||
    message.includes('wrong email or password')
  ) {
    return 'Invalid email or password. Please verify and try again.';
  }

  if (message.includes('email not confirmed')) {
    return 'Your email has not been confirmed yet. Please check your inbox.';
  }

  if (message.includes('user already registered') || message.includes('user with this email already exists')) {
    return 'An account with this email address is already registered.';
  }

  if (message.includes('password should be at least')) {
    return 'Password is too short. It must be at least 6 characters.';
  }

  // 3. Network & Connectivity
  if (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('timeout')
  ) {
    return 'Cannot reach the server. Please check your internet connection.';
  }

  // Fallback to error.message if available and readable, else fallback
  if (err.message && err.message.length < 150) {
    return err.message;
  }

  return fallback;
}

