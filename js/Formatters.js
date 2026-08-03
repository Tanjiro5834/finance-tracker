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

// Monogram + real brand color per institution (no external logo dependency = no broken images, no hotlink/CORS risk)
const BANK_BRANDING = {
  'BDO':                    { initials: 'BDO', color: '#003DA5' },
  'BPI':                    { initials: 'BPI', color: '#C8102E' },
  'Metrobank':              { initials: 'MB',  color: '#002F6C' },
  'Landbank':               { initials: 'LB',  color: '#00563F' },
  'PNB':                    { initials: 'PNB', color: '#8A1538' },
  'Chinabank':              { initials: 'CB',  color: '#00468B' },
  'RCBC':                   { initials: 'RCBC',color: '#0033A0' },
  'Security Bank':          { initials: 'SB',  color: '#F47920' },
  'UnionBank':              { initials: 'UB',  color: '#F7941D' },
  'EastWest':               { initials: 'EW',  color: '#DA291C' },
  'PSBank':                 { initials: 'PS',  color: '#F58220' },
  'DBP':                    { initials: 'DBP', color: '#004B87' },
  'Maybank':                { initials: 'MAY', color: '#FFC72C' },
  'RobinsonsBank':          { initials: 'RB',  color: '#00A651' },
  'GoTyme':                 { initials: 'GT',  color: '#00D2B4' },
  'Maya Bank':              { initials: 'M',   color: '#00C56C' },
  'Tonik':                  { initials: 'TN',  color: '#6C2EB5' },
  'UNO Digital':            { initials: 'UNO', color: '#1B1B1B' },
  'UnionDigital':           { initials: 'UD',  color: '#F7941D' },
  'Overseas Filipino Bank': { initials: 'OF',  color: '#00563F' },
  'GCash':                  { initials: 'G',   color: '#0074E4' },
  'Maya':                   { initials: 'M',   color: '#00C56C' },
  'ShopeePay':              { initials: 'SP',  color: '#EE4D2D' },
  'GrabPay':                { initials: 'GP',  color: '#00B14F' },
  'Coins.ph':               { initials: 'C',   color: '#409CFF' },
  'PayMaya':                { initials: 'PM',  color: '#00C56C' },
  'MariBank':               { initials: 'M',   color: '#F5A623' },
};

export function bankBranding(bank) {
  return BANK_BRANDING[bank] || null;
}