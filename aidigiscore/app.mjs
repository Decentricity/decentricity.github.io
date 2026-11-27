import { MockHarnessClient } from './client.mjs';

const api = new MockHarnessClient();
const $ = id => document.getElementById(id);
const panel = $('panel');
const screens = { graph:'Decision graph', board:'Flag board', detail:'Decision detail', console:'Agent console',
  agents:'Agent scoreboard', audit:'Audit log', timeline:'Timeline replay' };
let view = 'graph', selected, scenario, step = 0, timer, busy = false;
let agentId, consoleDecisionId, filters = {}, auditFilters = {}, chainMessage = '';
const esc = (input = '') => String(input ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const option = (id, name, current) => `<option value="${esc(id)}" ${id === current ? 'selected' : ''}>${esc(name)}</option>`;
const select = (id, label, items, current, all) => `<label>${label}<select id="${id}">${all ? option('',all,current) : ''}${items.map(item => option(item.id,item.name,current)).join('')}</select></label>`;
const badge = status => `<span class="badge ${esc(status)}">${esc(status)}</span>`;
const link = (id, label) => `<button class="link" data-decision="${esc(id)}">${esc(label)}</button>`;
const score = value => value == null ? '—' : value.toFixed(1);
const short = (value, length) => value.length > length ? value.slice(0,length - 1) + '…' : value;
const time = value => new Date(value).toLocaleTimeString(undefined,{timeZone:'UTC',hour12:false}) + ' UTC';
const table = (headers, rows, empty) => rows.length ? `<div class="scroller"><table><thead><tr>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="muted">${empty}</p>`;
const filtersOn = (vars, ids) => ids.forEach(([id,key]) => $(id).onchange = event => action(async () => { vars[key] = event.target.value; }));
function showError(error) { $('error').hidden = !error; $('error').textContent = error?.message ?? ''; }
function stop() { clearInterval(timer); timer = undefined; $('play').textContent = 'Play'; }
async function action(task) {
  if (busy) return;
  busy = true;
  showError();
  try { await task(); await render(); } catch (error) { stop(); showError(error); }
  finally { busy = false; }
}
async function loadTenant(id) {
  stop(); await api.setTenant(id);
  scenario = (await api.listScenarios())[0];
  selected = undefined; agentId = undefined; consoleDecisionId = undefined; step = 0;
  filters = {}; auditFilters = {}; chainMessage = '';
}
async function jump(index) {
  if (index < 0 || index >= scenario.steps.length) { stop(); return; }
  const state = await api.stepScenario(scenario.id, scenario.steps[index].id);
  step = state.step;
  chainMessage = '';
  if (step === scenario.steps.length - 1) stop();
}
function diagram(graph, decisions, projects) {
  const kinds = [projects, graph.nodes.filter(item => item.statement), graph.nodes.filter(item => item.kind || item.allowedTools)];
  const coordinates = new Map();
  const columns = [18, 299, 605];
  const widths = [223, 251, 223];
  const targets = new Set(decisions.map(item => item.id));
  const height = Math.max(...kinds.map(items => items.length)) * 51 + 45;
  for (const [column, items] of kinds.entries()) {
    items.forEach((item,i) => coordinates.set(item.id, { x:columns[column], y:40+i*51, w:widths[column], item, column }));
  }
  const edges = [...graph.edges, ...kinds[1].map(item => ({ fromId:item.projectId,toId:item.id,type:'contains' }))];
  return `<div class="graph"><svg viewBox="0 0 848 ${height}" role="group" aria-label="Decision dependencies by project" xmlns="http://www.w3.org/2000/svg">
  <text x="18" y="24">Projects</text><text x="299" y="24">Decisions</text><text x="605" y="24">Sources and agents</text>
  ${edges.map(edge => {
    const from = coordinates.get(edge.fromId), to = coordinates.get(edge.toId);
    if (!from || !to) return '';
    const cross = from.item.projectId && to.item.projectId && from.item.projectId !== to.item.projectId;
    const start = from.x + from.w, end = from.column === to.column ? to.x + to.w : to.x;
    const bend = from.column === to.column ? start + (cross ? 37 : 21) : (start+end)/2;
    return `<path class="edge ${cross ? 'cross' : ''}" d="M ${start} ${from.y+19} C ${bend} ${from.y+19}, ${bend} ${to.y+19}, ${end} ${to.y+19}"><title>${esc(edge.type)}${cross ? ' · cross-project' : ''}</title></path>`;
  }).join('')}
  ${[...coordinates.values()].map(({x,y,w,item}) => {
    const label = item.statement ?? item.title ?? item.name;
    const graphic = `<title>${esc(label)}</title><rect class="node ${targets.has(item.id) ? esc(item.disposition) : ''}" x="${x}" y="${y}" width="${w}" height="38" rx="6"/><text x="${x+8}" y="${y+15}">${esc(short(label, w > 230 ? 36 : 31))}</text><text class="sub" x="${x+8}" y="${y+29}">${esc(item.statement ? `v${item.version} · ${item.disposition}` : item.kind ?? (item.allowedTools ? 'Agent' : 'Project'))}</text>`;
    return item.statement ? `<a href="#detail" data-decision="${esc(item.id)}" aria-label="${esc(label)}">${graphic}</a>` : `<g>${graphic}</g>`;
  }).join('')}</svg></div>`;
}
async function graphView(decisions, projects, agents) {
  const visible = await api.listDecisions(filters);
  const graph = await api.getGraph(filters);
  const templates = [...new Set(decisions.map(item => item.templateId))].map(id => ({ id,name:id.replace('tmpl-','').replaceAll('-',' ') }));
  panel.innerHTML = `<div class="strip">${[['Projects',projects.length],['Decisions',decisions.length],['Accepted',decisions.filter(item=>item.disposition==='accepted').length],['Flagged',(await api.getFlags()).length]].map(([name,value])=>`<div class="card"><span class="muted">${name}</span><strong class="metric">${value}</strong></div>`).join('')}</div>
  <div class="filters">${select('g-project','Project',projects,filters.projectId,'All projects')}${select('g-status','Disposition',['accepted','rejected','stale','held'].map(id=>({id,name:id})),filters.disposition,'All dispositions')}${select('g-agent','Agent',agents,filters.agentId,'All agents')}${select('g-template','Template',templates,filters.templateId,'All templates')}</div>
  ${visible.length ? diagram(graph,visible,projects) : '<p>No decisions match these filters.</p>'}
  <p class="muted">Dashed lines connect decisions across projects. Select a decision to inspect its premises.</p>
  ${table(['Decision','Disposition','Trust','Coverage'],visible.map(item=>[link(item.id,item.statement),badge(item.disposition),score(item.score.T),esc(item.result.reasons.join(', ') || 'Required premises verified')]),'No matching decisions.')}`;
  filtersOn(filters,[['g-project','projectId'],['g-status','disposition'],['g-agent','agentId'],['g-template','templateId']]);
}
async function boardView(projects, people) {
  const flags = await api.getFlags();
  const events = await api.listAudit();
  panel.innerHTML = `<div class="card">${table(['Project','Decision','Disposition','Reason','Since','Responsible'],flags.map(item=>{
    const project = projects.find(project=>project.id===item.projectId);
    const event = events.findLast(event=>event.decisionId===item.id && event.type=== 'decision.'+item.disposition);
    return [esc(project?.name),link(item.id,item.statement),badge(item.disposition),esc(item.result.reasons.join(', ') || 'Recorded override'),event ? time(event.at) : '—',esc(people.find(person=>person.id===project?.ownerPersonId)?.name)];
  }),'No flagged decisions in this state.')}</div>`;
}
async function detailView(decisions, people) {
  if (!decisions.some(item=>item.id===selected)) selected = decisions[0].id;
  const item = await api.getDecision(selected);
  const result = item.result;
  const formatted = value => esc(JSON.stringify(value,null,2));
  panel.innerHTML = `${select('detail-select','Decision',decisions.map(item=>({...item,name:item.statement})),selected)}
  <section class="card"><div class="row">${badge(item.disposition)}<span class="muted">${esc(item.id)} · v${item.version}</span></div><h3>${esc(item.statement)}</h3><p>${esc(result.verdict)} · ${esc(result.reasons.join(', ') || 'All required checks passed')}</p><button id="rerun">Re-run current checker</button> <output id="rerun-result"></output></section>
  <div class="detail-grid">
  <section class="card"><h2>Premises and template</h2><p><code>${esc(item.templateId)}</code> · ${esc(item.template.version)}</p><ul>${item.premises.map((ref,i)=>`<li>${esc(ref.type)} · ${item.evidence[i]?.statement ? link(ref.refId,item.evidence[i].statement) : esc(item.evidence[i]?.title || ref.refId)} · v${ref.version}</li>`).join('')}</ul><details><summary>Policy axioms</summary><ul>${item.policies.map(policy=>`<li>${esc(policy.statement)}</li>`).join('')}</ul></details></section>
  <section class="card"><h2>Score and approvals</h2><p>${esc(result.score.ruleId)}</p><dl>${Object.entries({Base:result.score.B,Penalty:result.score.P,'Human adjustment':result.score.H,Ceiling:result.score.C,Trust:result.score.T}).map(([name,value])=>`<dt>${name}</dt><dd>${score(value)}</dd>`).join('')}</dl><ul>${item.approvals.map(approval=>`<li>${esc(people.find(person=>person.id===approval.personId)?.name)} · ${esc(approval.kind)} · ${time(approval.at)}</li>`).join('')}</ul></section>
  <section class="card"><h2>Certificates</h2>${item.history.map(({input,...cert})=>`<details><summary>v${cert.decisionVersion} · ${cert.verdict}</summary><pre>${formatted(cert)}</pre><button class="verify-certificate" data-version="${cert.decisionVersion}">Re-run stored certificate</button> <output></output></details>`).join('') || '<p>No acceptance certificate.</p>'}</section>
  <section class="card"><h2>Point-in-time snapshots</h2>${item.snapshots.map(snapshot=>`<details><summary>${snapshot.label} · trust ${score(snapshot.trustValue)}</summary><pre>${formatted(snapshot)}</pre></details>`).join('') || '<p>No accepted snapshots.</p>'}</section></div>`;
  $('detail-select').onchange = event => action(async()=>{selected=event.target.value;});
  $('rerun').onclick = async () => { const value=await api.rerunChecker(selected); $('rerun-result').textContent=value.verdict + ' ' + value.reasons.join(', '); };
  panel.querySelectorAll('.verify-certificate').forEach(button=>{button.onclick=async()=>{const result=await api.rerunChecker(selected,Number(button.dataset.version));button.nextElementSibling.textContent=result.verdict+' · '+result.checkerVersion;};});
}
async function consoleView(agents, decisions) {
  agentId ||= agents[0].id;
  if (!decisions.some(item=>item.id===consoleDecisionId)) consoleDecisionId = decisions[0].id;
  const agent = await api.getAgent(agentId);
  panel.innerHTML = `<div class="filters">${select('console-agent','Agent thread',agents,agentId)}</div>
  <div class="card stack">${agent.interactions.map(item=>`<article class="message"><span class="muted">${time(item.at)} · ${esc(item.id)}</span><p>${esc(item.proposal)}</p><p>${link(item.decisionId,decisions.find(decision=>decision.id===item.decisionId)?.statement || item.decisionId)}</p><details><summary>${esc(item.tool)} · ${esc(item.gateway)} · ${esc(item.verdict)} · ${score(item.score)}</summary><p>${esc(item.reasons?.join(', ') || item.flag)}</p><code>Input ${esc(item.inputDigest)}<br>Output ${esc(item.outputDigest)}</code></details></article>`).join('') || '<p>No interactions for this agent.</p>'}</div>
  <form id="proposal-form" class="card"><h2>Submit a simulated proposal</h2><div class="filters">${select('console-decision','Decision',decisions.map(item=>({...item,name:short(item.statement,65)})),consoleDecisionId)}
  ${select('console-tool','Tool',[...new Set(agents.flatMap(item=>item.allowedTools))].map(id=>({id,name:id})),agent.allowedTools[0])}
  <label>Message <input id="proposal" type="text" maxlength="220" placeholder="Review the current evidence"></label><button type="submit">Send proposal</button></div></form>`;
  $('console-agent').onchange = event=>action(async()=>{agentId=event.target.value;});
  $('console-decision').onchange = event=>{consoleDecisionId=event.target.value;};
  $('proposal-form').onsubmit = event=>{
    event.preventDefault();
    action(async()=>{await api.proposeStep({decisionId:consoleDecisionId,agentId,tool:$('console-tool').value,proposal:$('proposal').value});});
  };
}
function agentsView(agents) {
  panel.innerHTML = `<div class="card">${table(['Agent','Score','Accepted','Rejected','Invalidated','Drift','Permitted tools'],agents.map(item=>[
    `<button class="link" data-agent="${esc(item.id)}">${esc(item.name)}</button><br><span class="muted">${esc(item.brief)}</span>`,
    score(item.score),item.accepted,item.rejected,item.invalidated,item.rejected>item.accepted?'Review':'Clear',esc(item.allowedTools.join(', '))]),'No agents.')}</div>`;
}
async function auditView(projects, decisions, agents) {
  const types = [...new Set((await api.listAudit()).map(event=>event.type))].map(id=>({id,name:id}));
  const events = await api.listAudit(auditFilters);
  panel.innerHTML = `<div class="card"><div class="controls"><button id="verify">Verify chain</button><button id="tamper">Demonstrate tamper</button><button id="restore">Restore record</button><output role="status">${esc(chainMessage)}</output></div></div>
  <div class="filters">${select('a-project','Project',projects,auditFilters.projectId,'All projects')}${select('a-decision','Decision',decisions.map(item=>({...item,name:short(item.statement,39)})),auditFilters.decisionId,'All decisions')}${select('a-actor','Agent',agents,auditFilters.actorId,'All actors')}${select('a-type','Event',types,auditFilters.type,'All events')}</div>
  <div class="card">${table(['Time','Event','Record','Details'],events.map(event=>[time(event.at),esc(event.type),`<code>${esc(event.id)}</code>`,`<details><summary>${esc(event.payload.summary ?? event.actorId)}</summary><pre>${esc(JSON.stringify(event,null,2))}</pre></details>`]),'No matching audit events.')}</div>`;
  const verify = async () => {const value=await api.verifyAuditChain();chainMessage=value.ok?value.details:`First break at ${value.brokenAt}. ${value.details}`;};
  $('verify').onclick = ()=>action(verify);
  $('tamper').onclick = ()=>action(async()=>{await api.demonstrateTamper();await verify();});
  $('restore').onclick = ()=>action(async()=>{await api.resetTamper();await verify();});
  filtersOn(auditFilters,[['a-project','projectId'],['a-decision','decisionId'],['a-actor','actorId'],['a-type','type']]);
}
async function timelineView(decisions) {
  const entries = await api.getTimeline();
  panel.innerHTML = `<div class="card"><label>Scenario step <input id="scrub" type="range" min="0" max="${scenario.steps.length-1}" value="${step}"></label><p>${esc(scenario.steps[step].title)}</p>
  ${table(['Decision','Disposition','Trust'],decisions.map(item=>[link(item.id,item.statement),badge(item.disposition),score(item.score.T)]),'No decisions.')}</div>
  <div class="card"><h2>Recorded events</h2><label>Inspect audit timestamp <select id="audit-point">${entries.map(event=>option(event.at,`${time(event.at)} · ${event.type}`,entries.at(-1)?.at)).join('')}</select></label><p id="audit-point-result" class="muted"></p>${table(['Time','Event','Scenario state'],entries.map(event=>[time(event.at),esc(event.type),esc(event.title)]),'No recorded events.')}</div>`;
  $('scrub').onchange=event=>action(async()=>{stop();await jump(Number(event.target.value));});
  $('audit-point').onchange=async event=>{
    const point=await api.peekAt(event.target.value);
    $('audit-point-result').textContent=`${point.audit.length} audit records through this timestamp · ${point.decisions.filter(item=>item.disposition==='accepted').length} accepted decisions at the recorded scenario step.`;
  };
}
async function render() {
  const [tenant, scenarios, decisions, projects, agents, people, chain] = await Promise.all([api.getTenant(),api.listScenarios(),api.listDecisions(),api.listProjects(),api.listAgents(),api.listPeople(),api.verifyAuditChain()]);
  $('medical').hidden=tenant.slug!=='medical'; $('medical').textContent=tenant.disclaimer;
  $('chain').textContent=chain.ok?'● Chain verified':'● Chain broken'; $('chain').className='badge '+(chain.ok?'accepted':'rejected');
  $('scenario').innerHTML=scenarios.map(item=>option(item.id,item.title,scenario.id)).join('');
  $('step').innerHTML=scenario.steps.map((item,i)=>option(i,item.title,step)).join('');
  $('next').disabled=step>=scenario.steps.length-1;
  $('heading').textContent=screens[view];
  $('nav').innerHTML=Object.entries(screens).map(([id,name])=>`<button data-view="${id}" ${view===id?'aria-current="page"':''}>${name}</button>`).join('');
  if(view==='graph') await graphView(decisions,projects,agents);
  if(view==='board') await boardView(projects,people);
  if(view==='detail') await detailView(decisions,people);
  if(view==='console') await consoleView(agents,decisions);
  if(view==='agents') agentsView(agents);
  if(view==='audit') await auditView(projects,decisions,agents);
  if(view==='timeline') await timelineView(decisions);
  panel.setAttribute('aria-busy','false');
}
$('nav').onclick=event=>{const id=event.target.dataset.view;if(id)action(async()=>{view=id;});};
panel.onclick=event=>{
  const decision=event.target.closest('[data-decision]')?.dataset.decision;
  const agent=event.target.closest('[data-agent]')?.dataset.agent;
  if(decision){event.preventDefault();action(async()=>{selected=decision;view='detail';});}
  if(agent) action(async()=>{agentId=agent;view='console';});
};
$('tenant').onchange=event=>action(()=>loadTenant(event.target.value));
$('scenario').onchange=event=>action(async()=>{
  stop();scenario=(await api.listScenarios()).find(item=>item.id===event.target.value);await api.resetScenario(scenario.id);step=0;chainMessage='';
});
$('step').onchange=event=>action(async()=>{stop();await jump(Number(event.target.value));});
$('next').onclick=()=>action(()=>jump(step+1));
$('reset').onclick=()=>action(async()=>{stop();await api.resetScenario(scenario.id);step=0;chainMessage='';});
$('play').onclick=()=>{
  if(timer){stop();return;}
  action(async()=>{
    if(step===scenario.steps.length-1){await api.resetScenario(scenario.id);step=0;}
    $('play').textContent='Pause';
    timer=setInterval(()=>action(()=>jump(step+1)),1900);
  });
};
action(async()=>{
  const tenants=await api.listTenants();
  $('tenant').innerHTML=tenants.map(item=>option(item.id,item.name)).join('');
  await loadTenant(tenants[0].id);
});
