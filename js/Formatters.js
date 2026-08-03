'use strict';

export function formatPeso(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₱${Math.abs(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
         ' · ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

export function iconFor(type) {
  const icons = { wallet: '💳', savings: '🏦', cash: '💵', credit: '📇' };
  return icons[type] || '💰';
}

export function bankLabel(bank) {
  return bank && bank !== 'Other' ? bank : null;
}