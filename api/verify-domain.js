import dns from 'node:dns/promises';
import { json, fail, readJson, requirePost } from './arena/_http.js';
import { bindTokenToOrg, getVerificationByToken, markDomainVerified } from './_domainStore.js';

/**
 * Fetch TXT records from Cloudflare DNS-over-HTTPS
 */
async function queryCloudflareDoH(host) {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.Answer || !Array.isArray(data.Answer)) return [];
    return data.Answer
      .filter((record) => record.type === 16 && record.data) // 16 = TXT
      .map((record) => record.data.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim());
  } catch {
    return null; // indicates network/timeout failure
  }
}

/**
 * Fetch TXT records from Google DNS-over-HTTPS
 */
async function queryGoogleDoH(host) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.Answer || !Array.isArray(data.Answer)) return [];
    return data.Answer
      .filter((record) => record.type === 16 && record.data)
      .map((record) => record.data.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim());
  } catch {
    return null;
  }
}

/**
 * Fallback local Node.js DNS resolver
 */
async function queryNodeDns(host) {
  try {
    const records = await dns.resolveTxt(host);
    return records.map((chunk) => chunk.join('').replace(/^"|"$/g, '').trim());
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND' || err.code === 'ESERVFAIL') {
      return [];
    }
    return null;
  }
}

/**
 * Sanitize domain/host string
 */
function sanitizeHost(input) {
  if (!input || typeof input !== 'string') return '';
  let host = input.trim();
  // Strip protocol (http://, https://, ws://, wss://)
  host = host.replace(/^[a-z]+:\/\//i, '');
  // Strip paths, query strings, and hashes
  host = host.split('/')[0].split('?')[0].split('#')[0];
  // Strip port
  host = host.split(':')[0];
  return host.toLowerCase();
}

/**
 * Web Standard Handler for domain verification
 */
export default async function handler(request) {
  const notPost = requirePost(request);
  if (notPost) return notPost;

  const body = await readJson(request);
  if (!body) return fail(400, 'Invalid JSON body');

  const { domain, token, orgId } = body;
  const cleanHost = sanitizeHost(domain);
  const activeOrgId = (orgId && typeof orgId === 'string' ? orgId.trim() : 'org_bastion');

  if (!cleanHost) {
    return fail(400, 'Invalid or missing target domain / hostname');
  }
  if (!token || typeof token !== 'string') {
    return fail(400, 'Missing verification token');
  }

  const expectedToken = token.trim();

  // Basic format validation: Ensure standard prefix
  if (!expectedToken.startsWith('bastion-site-verification=bst_')) {
    return fail(400, 'Token must follow the standard prefix format: bastion-site-verification=bst_<random_secret>');
  }

  // 1. Check Database Tenant Binding (Cross-tenant hijack protection)
  const existingRecord = await getVerificationByToken(expectedToken);
  if (existingRecord && existingRecord.orgId && existingRecord.orgId !== activeOrgId) {
    return fail(403, 'This verification token is already registered to a different organization.', {
      code: 'tenant_mismatch',
    });
  }

  // 2. Query dual DoH resolvers in parallel (Cloudflare + Google)
  const [cfResult, googleResult] = await Promise.all([
    queryCloudflareDoH(cleanHost),
    queryGoogleDoH(cleanHost),
  ]);

  let allDiscoveredRecords = [];
  let sourcesUsed = [];

  if (cfResult !== null) {
    allDiscoveredRecords.push(...cfResult);
    sourcesUsed.push('cloudflare-doh');
  }
  if (googleResult !== null) {
    allDiscoveredRecords.push(...googleResult);
    sourcesUsed.push('google-doh');
  }

  // Fallback to Node DNS if DoH was unreachable
  if (sourcesUsed.length === 0) {
    const nodeResult = await queryNodeDns(cleanHost);
    if (nodeResult !== null) {
      allDiscoveredRecords.push(...nodeResult);
      sourcesUsed.push('node-dns-fallback');
    }
  }

  // Deduplicate discovered TXT records
  const uniqueRecords = [...new Set(allDiscoveredRecords.map((r) => r.trim()))];

  // 3. Strict host verification: Check if the token is published on this exact host
  const isMatch = uniqueRecords.some((record) => {
    return record === expectedToken || record.includes(expectedToken);
  });

  if (isMatch) {
    // 4. Bind and mark as verified in the database for this organization
    const verifiedRecord = await markDomainVerified({
      token: expectedToken,
      orgId: activeOrgId,
      domain: cleanHost,
    });

    return json({
      verified: true,
      domain: cleanHost,
      orgId: activeOrgId,
      sources: sourcesUsed,
      verifiedAt: verifiedRecord.verifiedAt,
      matchedRecord: expectedToken,
    });
  }

  // Register token as pending for this organization in the database
  await bindTokenToOrg({
    token: expectedToken,
    orgId: activeOrgId,
    domain: cleanHost,
  });

  return json({
    verified: false,
    domain: cleanHost,
    orgId: activeOrgId,
    sources: sourcesUsed,
    error: `Verification token not found on ${cleanHost}. Please add the TXT record to your DNS and allow a moment for propagation.`,
    recordsFoundCount: uniqueRecords.length,
    recordsFound: uniqueRecords.slice(0, 5),
  });
}
