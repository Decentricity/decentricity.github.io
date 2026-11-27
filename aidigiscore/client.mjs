import { append, byId, canonical, check, copy, hash, round, verify } from './engine.mjs';

const start = Date.parse('2026-11-01T09:00:00Z');
const collections = ['people','agents','projects','templates','policies','sources','decisions','edges','interactions','approvals','audit','scenarios'];
async function read(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw Error(`Failed to load ${path} (${response.status})`);
  return response.json();
}
export class MockHarnessClient {
  async listTenants() { return (await read('./data/tenants.json')).tenants; }
  async setTenant(id) {
    this.tenant = byId(await this.listTenants(), id);
    if (!this.tenant) throw Error('Unknown tenant.');
    const dir = './data/' + this.tenant.slug + '/';
    this.fixture = Object.fromEntries(await Promise.all(collections.map(async key => [key, (await read(dir + key + '.json'))[key === 'audit' ? 'records' : key]])));
    await this.resetScenario(this.fixture.scenarios[0].id);
  }
  async getTenant() { return copy(this.tenant); }
  async listProjects() { return copy(this.state.projects); }
  async getProject(id) { return byId(await this.listProjects(), id); }
  async listScenarios() { return copy(this.state.scenarios); }
  async listPeople() { return copy(this.state.people); }
  async listAgents() { return Promise.all(this.state.agents.map(agent => this.getAgent(agent.id))); }
  async getAgent(id) {
    const agent = byId(this.state.agents, id);
    const interactions = await this.listInteractions({ agentId:id });
    const accepted = interactions.filter(item => item.verdict === 'ACCEPT' && item.flag !== 'later-invalidated').length;
    const rejected = interactions.filter(item => item.verdict === 'REJECT').length;
    const invalidated = interactions.filter(item => item.flag === 'later-invalidated').length;
    const score = interactions.length ? round(interactions.reduce((total, item) => total + item.score, 0) / interactions.length * (0.5 + 0.5 * accepted / interactions.length)) : 0;
    return { ...copy(agent), interactions, score, accepted, rejected, invalidated };
  }
  async listInteractions(filter = {}) {
    return copy(this.state.interactions.filter(item => Object.entries(filter).every(([key, value]) => !value || item[key] === value)));
  }
  async listDecisions(filter = {}) {
    return copy(this.state.decisions.filter(item => Object.entries(filter).every(([key, value]) => !value || (key === 'agentId'
      ? this.state.interactions.some(interaction => interaction.agentId === value && interaction.decisionId === item.id)
      : item[key] === value))));
  }
  async getDecision(id) {
    const item = byId(this.state.decisions, id);
    return copy({ ...item, template: byId(this.state.templates, item.templateId),
      evidence: item.premises.map(ref => byId(this.state.sources, ref.refId) ?? byId(this.state.decisions, ref.refId)),
      approvals: this.state.approvals.filter(approval => approval.decisionId === id && approval.decisionVersion === item.version),
      policies: this.state.policies, history: this.state.certificates.filter(certificate => certificate.decisionId === id),
      snapshots: this.state.snapshots.filter(snapshot => snapshot.decisionId === id), result: item.result });
  }
  async getGraph(scope) {
    const decisions = await this.listDecisions(scope);
    const visible = new Set(decisions.map(item => item.id));
    const edges = this.state.edges.filter(edge => visible.has(edge.fromId) || visible.has(edge.toId));
    const linked = new Set(edges.flatMap(edge => [edge.fromId, edge.toId]));
    const nodes = [ ...this.state.projects, ...this.state.decisions, ...this.state.sources, ...this.state.agents ]
      .filter(item => visible.has(item.id) || linked.has(item.id));
    return copy({ nodes, edges });
  }
  async getFlags() { return (await this.listDecisions()).filter(item => item.disposition !== 'accepted' || item.overridden); }
  async getCertificate(id, version) {
    return copy(this.state.certificates.findLast(item => item.decisionId === id && (version == null || item.decisionVersion === version)));
  }
  async rerunChecker(id, version) {
    const record = await this.getCertificate(id, version);
    if (version != null && record) return check(record.input);
    const decision = byId(this.state.decisions, id);
    return check(decision.rejectedInput ?? this.input(decision));
  }
  async listAudit(filter = {}) {
    return copy(this.state.audit.filter(item => Object.entries(filter).every(([key, value]) => !value ||
      (key === 'projectId' ? byId(this.state.decisions, item.decisionId)?.projectId === value : item[key] === value))));
  }
  async verifyAuditChain() { return verify(this.state.audit); }
  async demonstrateTamper() {
    if (!this.beforeTamper) this.beforeTamper = copy(this.state.audit);
    this.state.audit[0].payload.summary = 'Demonstration: a stored record was altered.';
    return this.verifyAuditChain();
  }
  async resetTamper() {
    if (this.beforeTamper) this.state.audit[0] = this.beforeTamper[0];
    this.beforeTamper = undefined;
  }
  now() { return new Date(start + (this.step * 60 + this.clock++) * 1000).toISOString(); }
  async log(type, decisionId, actorId, payload) {
    await append(this.state.audit, { id: `aud-${this.tenant.slug}-${String(this.state.audit.length + 1).padStart(4,'0')}`,
      at: this.now(), type, decisionId, actorId, payload });
  }
  input(decision) {
    const approvals = this.state.approvals.filter(item => item.decisionId === decision.id && item.decisionVersion === decision.version);
    return copy({ decision: { id:decision.id, version:decision.version, statement:decision.statement, premises:decision.premises,
        base:decision.base, composed:decision.composed, tonnes:decision.tonnes, declaredTrust:decision.declaredTrust },
      template: byId(this.state.templates, decision.templateId), policies: this.state.policies, at: this.now(),
      sources: decision.premises.map(ref => byId(this.state.sources, ref.refId)).filter(Boolean),
      children: decision.premises.map(ref => byId(this.state.decisions, ref.refId)).filter(Boolean)
        .map(({ id, version, disposition, templateId, score, certificateId }) => ({ id, version, disposition, templateId, score, certificateId })),
      approvals: approvals.map(item => {
        const person = byId(this.state.people, item.personId);
        return { ...item, authorized: Boolean(person?.roles.includes(item.role) && person.projectIds.includes(decision.projectId)) };
      }) });
  }
  async evaluate(decision, rejectionDisposition = 'rejected') {
    const input = this.input(decision);
    const result = check(input);
    decision.result = result;
    decision.score = result.score;
    decision.disposition = result.verdict === 'ACCEPT' ? 'accepted' : rejectionDisposition;
    if (result.verdict === 'ACCEPT') {
      const cert = { id: `cert-${decision.id}-v${decision.version}`, decisionId: decision.id, decisionVersion: decision.version,
        statement:decision.statement, checkerVersion:result.checkerVersion, scoreRuleId:result.score.ruleId, verdict:result.verdict, reasons:result.reasons,
        at:input.at, approvals:input.approvals.map(item => item.id), axiomsUsed:input.template.requiredAxioms,
        premiseDigests:await Promise.all(decision.premises.map(async ref => hash(canonical({ ref, source:byId(input.sources, ref.refId), child:byId(input.children, ref.refId) })))),
        citations:input.children.map(({id,version,certificateId}) => ({decisionId:id, version, certificateId})), input };
      cert.digest = await hash(canonical(cert));
      this.state.certificates.push(cert);
      decision.certificateId = cert.id;
      const snapshot = { id:`snap-${decision.id}-v${decision.version}`, decisionId:decision.id, label:decision.version === 1 ? 'T0' : 'T1',
        at:input.at, sourceVersions:Object.fromEntries(input.sources.map(item => [item.id,item.version])),
        policyVersions:Object.fromEntries(input.policies.map(item => [item.id,item.version])), trustValue:result.score.T,
        ceilingState: result.score.C, checkerVersion: result.checkerVersion, certificateId:cert.id, certificateDigest:cert.digest };
      snapshot.digest = await hash(canonical(snapshot));
      this.state.snapshots.push(snapshot);
    }
    await this.log('decision.' + decision.disposition, decision.id, 'checker', { summary:decision.statement, reasons:result.reasons, version:decision.version, score:result.score, certificateId: result.verdict === 'ACCEPT' ? decision.certificateId : null });
    return result;
  }
  async recordInteraction(item) {
    item.inputDigest = await hash(canonical({ tool:item.tool, proposal:item.proposal, sourceId:item.sourceId }));
    item.outputDigest = await hash(canonical({ verdict:item.verdict, reasons:item.reasons, gateway:item.gateway }));
    this.state.interactions.push(item);
    this.state.edges.push({ id:item.id, fromId:item.decisionId, toId:item.agentId, type:'produced-by', interactionId:item.id });
    await this.log('agent.tool', item.decisionId, item.agentId, { ...item, summary:item.proposal });
  }
  async resetScenario(id) {
    this.scenario = byId(this.fixture.scenarios, id);
    if (!this.scenario) throw Error('Unknown scenario.');
    this.state = copy(this.fixture);
    this.state.certificates = [];
    this.state.snapshots = [];
    this.state.interactions = [];
    this.state.audit = [];
    this.step = 0;
    this.clock = 0;
    this.beforeTamper = undefined;
    this.timeline = [];
    for (const event of this.fixture.audit) await append(this.state.audit, event);
    for (const decision of this.state.decisions) await this.evaluate(decision);
    for (const interaction of this.fixture.interactions) await this.recordInteraction(copy(interaction));
    this.capture();
  }
  capture() {
    this.timeline.push({ step:this.step, title:this.scenario.steps[this.step].title, at:this.state.audit.at(-1).at, state:copy(this.state) });
  }
  async stepScenario(id, stepId) {
    const scenario = byId(this.fixture.scenarios, id);
    if (!scenario) throw Error('Unknown scenario.');
    const target = stepId ? scenario.steps.findIndex(step => step.id === stepId) : this.step + 1;
    if (target < 0 || target >= scenario.steps.length) return { step:this.step };
    if (id !== this.scenario.id || target < this.step) await this.resetScenario(id);
    await this.resetTamper();
    while (this.step < target) {
      this.step++;
      this.clock = 0;
      for (const action of scenario.steps[this.step].actions) {
        if (action.op === 'supersedeSource') await this.applySourceChange(action);
        if (action.op === 'repair') await this.repair(action);
        if (action.op === 'negative') await this.proposeStep({ ...action, stale:true });
      }
      this.capture();
    }
    return { step:this.step };
  }
  async runScenario(id) {
    await this.resetScenario(id);
    return this.stepScenario(id, this.scenario.steps.at(-1).id);
  }
  async getTimeline() {
    return this.timeline.flatMap(({title,step,state}, index) => {
      const priorLength = this.timeline[index - 1]?.state.audit.length ?? 0;
      return state.audit.slice(priorLength).map(event => ({ id:event.id, type:event.type, title, step, at:event.at }));
    });
  }
  async peekAt(at) {
    const point = this.timeline.find(item => item.at >= at) ?? this.timeline.at(-1);
    return copy({ decisions:point.state.decisions, edges:point.state.edges, audit:point.state.audit.filter(event => event.at <= at), step:point.step });
  }
  async applySourceChange({ sourceId, newSourceId }) {
    const source = byId(this.state.sources, sourceId);
    const next = byId(this.state.sources, newSourceId);
    if (!source || !next || source.kind !== next.kind || next.version <= source.version) throw Error('Invalid source revision.');
    source.supersededBy = next.id;
    await this.log('source.superseded', null, 'source-registry', { summary:`${source.title} → ${next.title}` });
    const invalidated = new Set();
    for (const decision of this.state.decisions) {
      if (!decision.premises.some(ref => ref.refId === source.id || invalidated.has(ref.refId))) continue;
      invalidated.add(decision.id);
      const stale = decision.premises.some(ref => ref.refId === source.id) && decision.templateId !== 'tmpl-formulary-addition';
      await this.evaluate(decision, stale ? 'stale' : 'rejected');
    }
    for (const item of this.state.interactions.filter(item => invalidated.has(item.decisionId))) {
      item.flag = 'later-invalidated';
      await this.log('agent.invalidated', item.decisionId, item.agentId, { summary:item.proposal, interactionId:item.id });
    }
  }
  async approve({ decisionId, personId, reason = 'Scenario review', kind = 'approval' }) {
    const decision = byId(this.state.decisions, decisionId);
    const person = byId(this.state.people, personId);
    if (!decision?.approverIds.includes(personId) || !person?.projectIds.includes(decision.projectId)) throw Error('unauthorized-approver');
    if (this.tenant.slug === 'medical' && this.looksIdentifying(reason)) throw Error('Direct patient identifiers are refused.');
    if (this.state.approvals.some(item => item.decisionId === decisionId && item.decisionVersion === decision.version && item.personId === personId && item.kind === kind)) return;
    const approval = { id:`app-${decisionId}-${this.state.approvals.length + 1}`, decisionId, decisionVersion:decision.version,
      personId, role:person.roles[0], at:this.now(), kind, reason };
    this.state.approvals.push(approval);
    await this.log('decision.' + kind, decisionId, personId, { ...approval, summary:reason });
  }
  async override(input) {
    await this.approve({ ...input, kind:'override' });
    byId(this.state.decisions, input.decisionId).overridden = true;
  }
  looksIdentifying(text) { return /\b(?:mrn|medical record|patient)\s*[:#-]?\s*(?:\d{4,}|[A-Z][a-z]+\s+[A-Z][a-z]+)/i.test(text); }
  async proposeStep({ decisionId, agentId, proposal, tool, stale, prepared = false }) {
    const decision = byId(this.state.decisions, decisionId);
    const agent = byId(this.state.agents, agentId);
    if (!decision || !agent) throw Error('Select a decision and agent.');
    tool ??= agent.allowedTools[0];
    proposal ||= stale ? 'Propose using the original citation.' : 'Review the current decision evidence.';
    if (this.tenant.slug === 'medical' && this.looksIdentifying(proposal)) throw Error('Direct patient identifiers are refused.');
    const input = copy(decision);
    if (stale) input.premises.find(ref => ref.type === 'PriorDecision').version = 1;
    const gateway = agent.allowedTools.includes(tool) ? 'allow' : 'hold';
    const checkerInput = this.input(input);
    const result = gateway === 'hold' ? { verdict:'REJECT', reasons:['tool-not-permitted'] } :
      prepared ? { verdict:'PENDING', reasons:['awaiting-checker'] } : check(checkerInput);
    if (stale && result.verdict === 'REJECT') {
      input.id += '-candidate';
      input.version = 1;
      input.statement = 'Candidate revision · ' + decision.statement;
      input.disposition = 'rejected';
      input.result = result;
      input.score = result.score;
      input.certificateId = null;
      input.rejectedInput = checkerInput;
      this.state.decisions.push(input);
      for (const ref of input.premises) this.state.edges.push({ id:input.id+'-'+ref.refId, fromId:input.id, toId:ref.refId, type:'cites' });
      decisionId = input.id;
      await this.log('decision.rejected', decisionId, 'checker', { summary:input.statement, reasons:result.reasons });
    }
    const item = { id:`int-${this.tenant.slug}-${String(this.state.interactions.length+1).padStart(3,'0')}`, agentId, decisionId, tool,
      at:this.now(), gateway, proposal, flag:result.verdict === 'ACCEPT' ? 'used' : prepared ? 'supporting' : 'contradicting', score:result.verdict === 'ACCEPT' ? 8 : prepared ? 6 : 2,
      verdict:result.verdict, reasons:result.reasons };
    await this.recordInteraction(item);
    return result;
  }
  async repair({ decisionId, oldSourceId, newSourceId, agentId }) {
    const renewed = new Set();
    for (const item of this.state.decisions) {
      const direct = item.id === decisionId;
      if (!direct && !item.premises.some(ref => renewed.has(ref.refId))) continue;
      item.version++;
      for (const ref of item.premises) {
        if (ref.refId === oldSourceId) ref.refId = newSourceId;
        const current = byId(this.state.sources, ref.refId) ?? byId(this.state.decisions, ref.refId);
        ref.version = current.version;
      }
      this.state.edges = this.state.edges.filter(edge => edge.fromId !== item.id || edge.type === 'produced-by');
      for (const ref of item.premises) this.state.edges.push({ id:item.id+'-'+ref.refId, fromId:item.id, toId:ref.refId,
        type:ref.type === 'Evidence' ? 'supports' : item.composed.includes(ref.refId) ? 'composed-of' : 'cites', fromVersion:item.version, toVersion:ref.version });
      const proposer = direct ? agentId : item.templateId === 'tmpl-treatment-pathway-approval' ? 'agt-galen' : null;
      if (proposer) await this.proposeStep({ decisionId:item.id, agentId:proposer, proposal:'Propose a revision with current evidence and citations.', prepared:true });
      for (const personId of item.approverIds) await this.approve({ decisionId:item.id, personId });
      const result = await this.evaluate(item);
      if (proposer) {
        const interaction = this.state.interactions.findLast(entry => entry.decisionId === item.id && entry.agentId === proposer);
        interaction.verdict = result.verdict;
        interaction.reasons = result.reasons;
        interaction.flag = result.verdict === 'ACCEPT' ? 'used' : 'contradicting';
        interaction.score = result.verdict === 'ACCEPT' ? 8.8 : 2;
        await this.log('agent.proposal-reviewed', item.id, proposer, { interactionId:interaction.id, verdict:result.verdict, summary:interaction.proposal });
      }
      renewed.add(item.id);
    }
  }
}
