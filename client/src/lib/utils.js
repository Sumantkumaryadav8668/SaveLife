/**
 * General utility helpers
 */

/** Format a date to a readable string */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/** Compute time ago label */
export const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

/** Capitalize first letter */
export const capitalize = (str = '') => str.charAt(0).toUpperCase() + str.slice(1);

/** Truncate string */
export const truncate = (str = '', maxLen = 80) =>
  str.length > maxLen ? str.slice(0, maxLen) + '…' : str;

/** Generate initials from name */
export const initials = (name = '') =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

/** Merge class names (simple version of clsx) */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
