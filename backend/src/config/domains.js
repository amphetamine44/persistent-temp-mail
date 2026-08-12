export const DOMAIN_MATRIX = [
  {
    domain: 'edu.as',
    primary: true,
    type: 'primary',
    label: 'Primary',
    mx: 'mx.edu.as',
    priority: 10,
    ttl: 3600,
    catchAll: true,
  },
  {
    domain: 'emails',
    primary: false,
    type: 'free',
    label: 'Free alternative',
    mx: 'mx.edu.as',
    priority: 20,
    ttl: 3600,
    catchAll: true,
  },
  {
    domain: 'steudent.edu.as',
    primary: false,
    type: 'free',
    label: 'Free alternative',
    mx: 'mx.edu.as',
    priority: 20,
    ttl: 3600,
    catchAll: true,
  },
  {
    domain: 'office.edu',
    primary: false,
    type: 'free',
    label: 'Free alternative',
    mx: 'mx.edu.as',
    priority: 20,
    ttl: 3600,
    catchAll: true,
  },
];

export const DEFAULT_PRIMARY = DOMAIN_MATRIX.find((d) => d.primary)?.domain || DOMAIN_MATRIX[0].domain;
export const DEFAULT_ALTS = DOMAIN_MATRIX.filter((d) => !d.primary).map((d) => d.domain);

export function domainRecord(name) {
  return DOMAIN_MATRIX.find((d) => d.domain === String(name || '').toLowerCase()) || null;
}

export function isUnderPrimary(name, primary = DEFAULT_PRIMARY) {
  const d = String(name || '').toLowerCase();
  return d === primary || d.endsWith(`.${primary}`);
}
