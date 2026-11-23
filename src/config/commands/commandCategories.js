/**
 * Shared command category metadata.
 * Keep this as the single source of truth for category names and icons.
 */

export const CATEGORY_ICONS = {
  AI: '🤖',
  Birthday: '🎂',
  Community: '👥',
  Core: 'ℹ️',
  Economy: '💰',
  Fun: '🎮',
  Giveaway: '🎉',
  JoinToCreate: '🔌',
  Leveling: '📊',
  Logging: '📝',
  Moderation: '🛡️',
  Music: '🎵',
  Reaction_roles: '🎭',
  Search: '🔍',
  ServerStats: '📈',
  Ticket: '🎫',
  Tools: '🛠️',
  Utility: '🔧',
  Verification: '✅',
  Welcome: '👋',
};

export const PROTECTED_COMMANDS = new Set(['commands', 'configwizard']);

export function normalizeCategoryKey(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function formatCategoryName(rawCategory) {
  return String(rawCategory || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS[formatCategoryName(category)] || '📁';
}
