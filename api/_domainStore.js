// Domain verification persistence and tenant binding store.
//
// Dual-backend:
//   - Upstash Redis / Vercel KV REST when env vars are present.
//   - In-memory Map fallback for local dev.

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || null;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || null;

export const storeBackend = UPSTASH_URL && UPSTASH_TOKEN ? 'upstash' : 'memory';

// In-memory token -> { orgId, domain, status, createdAt, verifiedAt }
const memVerifications = new Map();

async function upstash(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

/**
 * Register or bind a token to an organization and domain in the database.
 */
export async function bindTokenToOrg({ token, orgId, domain }) {
  const record = {
    token,
    orgId,
    domain: domain.toLowerCase(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    verifiedAt: null,
  };

  const key = `bastion:domain_verification:${token}`;

  if (storeBackend === 'upstash') {
    // Check if token already belongs to another org
    const existingRaw = await upstash(['GET', key]);
    if (existingRaw) {
      const existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
      if (existing.orgId && existing.orgId !== orgId) {
        return { success: false, conflict: true, existingOrgId: existing.orgId };
      }
    }
    await upstash(['SET', key, JSON.stringify(record)]);
  } else {
    const existing = memVerifications.get(token);
    if (existing && existing.orgId !== orgId) {
      return { success: false, conflict: true, existingOrgId: existing.orgId };
    }
    memVerifications.set(token, record);
  }

  return { success: true, record };
}

/**
 * Get domain verification record by token.
 */
export async function getVerificationByToken(token) {
  const key = `bastion:domain_verification:${token}`;

  if (storeBackend === 'upstash') {
    const raw = await upstash(['GET', key]);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  return memVerifications.get(token) || null;
}

/**
 * Mark a token and domain as verified in the database.
 */
export async function markDomainVerified({ token, orgId, domain }) {
  const record = {
    token,
    orgId,
    domain: domain.toLowerCase(),
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  };

  const tokenKey = `bastion:domain_verification:${token}`;
  const orgDomainKey = `bastion:org_domains:${orgId}:${domain.toLowerCase()}`;

  if (storeBackend === 'upstash') {
    await upstash(['SET', tokenKey, JSON.stringify(record)]);
    await upstash(['SET', orgDomainKey, JSON.stringify(record)]);
  } else {
    memVerifications.set(token, record);
    memVerifications.set(orgDomainKey, record);
  }

  return record;
}
