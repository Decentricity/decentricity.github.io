export const checkerVersion = 'checker-0.1.0';
export const byId = (items, id) => items.find(item => item.id === id);
export const copy = value => structuredClone(value);
export const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const round = value => Math.round(value * 10) / 10;
export function check({ decision, template, sources, children, approvals, policies, at }) {
  const reasons = new Set();
  const evidence = decision.premises.filter(ref => ref.type === 'Evidence').map(ref => ({ ref, item: byId(sources, ref.refId) }));
  const citations = decision.premises.filter(ref => ref.type === 'PriorDecision').map(ref => ({ ref, item: byId(children, ref.refId) }));
  if (template.requiredPremiseTypes.some(type => !decision.premises.some(ref => ref.type === type))
    || template.requiredChildTemplates.some(id => !citations.some(({ item }) => item?.templateId === id))
    || template.requiredSourceKinds.some(kind => !evidence.some(({ item }) => item?.kind === kind))) reasons.add('missing-premise');
  for (const { ref, item } of evidence) {
    if (!item) reasons.add('missing-premise');
    else if (item.supersededBy || item.validUntil <= at || item.version !== ref.version) reasons.add('stale-citation');
  }
  for (const { ref, item } of citations) {
    if (!item || item.version !== ref.version) reasons.add('invalid-citation-version');
    if (item?.disposition !== 'accepted' || item.version > ref.version) {
      reasons.add('stale-citation');
      reasons.add('mandatory-child-failed');
    }
  }
  if (template.requiredAxioms.some(id => !byId(policies, id)?.hard)) reasons.add('axiom-failed');
  if (decision.tonnes > 500 && !citations.some(({ item }) => item?.templateId === 'tmpl-forest-origin-release' && item.disposition === 'accepted')) reasons.add('axiom-failed');
  if (approvals.some(approval => !approval.authorized)) reasons.add('unauthorized-approver');
  if (template.requiredApproverRoles.some(role => !approvals.some(approval => approval.authorized && approval.role === role))) reasons.add('missing-approval');
  const C = approvals.some(approval => approval.authorized) ? 10 : 7;
  const B = decision.base;
  const P = 0;
  const H = 0;
  const weakest = template.scorePolicyId === 'weakest-link-v1';
  const childScores = citations.filter(({ ref }) => decision.composed.includes(ref.refId));
  if (weakest && (!childScores.length || childScores.some(({ item }) => item?.score?.T == null))) reasons.add('mandatory-child-failed');
  const candidate = weakest ? Math.min(...childScores.map(({ item }) => item?.score?.T ?? 0)) : B - P + H;
  const computed = round(Math.min(C, Math.max(0, candidate)));
  if (decision.declaredTrust > C) reasons.add('ai-ceiling');
  if (decision.declaredTrust != null && decision.declaredTrust !== computed) reasons.add('score-mismatch');
  const accepted = reasons.size === 0;
  return { verdict: accepted ? 'ACCEPT' : 'REJECT', reasons: [...reasons],
    score: { B, P, H, C, T: accepted ? computed : null, ruleId: template.scorePolicyId }, checkerVersion };
}

export async function append(records, { id, at, type, actorId, decisionId, payload }) {
  const prevHash = records.at(-1)?.recordHash ?? '0'.repeat(64);
  const payloadDigest = await hash(canonical({ actorId, decisionId, ...payload }));
  const recordHash = await hash(prevHash + payloadDigest + id + at + type);
  records.push({ id, at, type, actorId, decisionId, payload, payloadDigest, prevHash, recordHash });
}
export async function verify(records) {
  const rebuilt = [];
  for (const event of records) {
    await append(rebuilt, event);
    const expected = rebuilt.at(-1);
    if (event.recordHash !== expected.recordHash || event.prevHash !== expected.prevHash || event.payloadDigest !== expected.payloadDigest)
      return { ok: false, brokenAt: event.id, details: 'Digest or previous hash mismatch.' };
  }
  return { ok: true, details: `${records.length} records verified.` };
}
