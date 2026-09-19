(() => {
  'use strict';
  const data = window.JEV_RECORDING;
  const byId = id => document.getElementById(id);
  if (!data) { byId('replay-counter').textContent = 'Recording unavailable; use the transcript link.'; return; }
  const selector = byId('scenario-select');
  const params = new URLSearchParams(location.search);
  let scenarioIndex = Math.max(0, data.conversations.findIndex(s => s.id === params.get('scenario')));
  let turnIndex = Math.max(0, Math.min(Number(params.get('turn') || 4) - 1, data.conversations[scenarioIndex].turns.length - 1));
  if (!Number.isFinite(turnIndex)) turnIndex = 0;
  const pretty = text => text.replaceAll('_', ' ');
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const cash = n => n === null ? 'not stated' : `IDR ${(n / 1000000).toLocaleString('en-US')}m`;
  data.conversations.forEach((s, i) => {const option = node('option', s.title); option.value = i; selector.append(option);});

  function judgment(parent, label, value, max = 1, score = false) {
    const row = node('div', undefined, 'judgment-row' + (score ? ' score' : ''));
    const dt = node('dt'); dt.append(node('span', label), node('strong', value.toFixed(2) + (score ? ' / 3' : '')));
    const dd = node('dd'); const meter = node('div', undefined, 'meter');
    meter.setAttribute('aria-hidden','true'); const bar = node('span'); bar.style.width = `${Math.max(0,Math.min(100,value / max * 100))}%`;
    meter.append(bar); dd.append(meter); row.append(dt,dd); parent.append(row);
  }

  function render() {
    const scenario = data.conversations[scenarioIndex]; const turn = scenario.turns[turnIndex]; const a = turn.answers;
    selector.value = scenarioIndex;
    byId('turn-label').textContent = `Turn ${turnIndex + 1} of ${scenario.turns.length}`;
    byId('previous-turn').disabled = turnIndex === 0;
    byId('next-turn').disabled = turnIndex === scenario.turns.length - 1;
    byId('replay-counter').textContent = `${data.summary.turns} calls / ${data.summary.conversations} paths`;
    byId('buyer-name').textContent = `${turn.buyer.name} / ${turn.buyer.role}`;
    byId('buyer-text').textContent = `“${turn.buyer.text}”`;
    byId('seller-text').textContent = turn.seller_reply;
    byId('selected-branch').textContent = turn.branch;
    const match = turn.branch === turn.expected_branch;
    byId('branch-expectation').textContent = match ? '✓ Matched the prewritten expectation' : `Mismatch · expected ${turn.expected_branch}`;
    byId('branch-expectation').classList.toggle('mismatch', !match);
    byId('state-transition').textContent = `${pretty(turn.before.stage)} → ${pretty(turn.after.stage)} · ${turn.elapsed_seconds.toFixed(3)}s end to end`;
    const prior = [...scenario.initial_history];
    scenario.turns.slice(0,turnIndex).forEach(t=>prior.push({speaker:t.buyer.name,text:t.buyer.text},{speaker:'Raya',text:t.seller_reply}));
    byId('prior-context').hidden = prior.length === 0;
    byId('prior-context').open = false;
    byId('prior-dialogue').replaceChildren(...prior.map(m=>{const p=node('p');p.append(node('strong',m.speaker),document.createTextNode(m.text));return p;}));
    const judgments = byId('judgments'); judgments.replaceChildren();
    const choice = node('div',undefined,'choice-readout');const dt=node('dt','Choice · topic');const dd=node('dd');dd.style.margin='0';dd.append(node('strong',a.topic.choice),node('div',`confidence ${a.topic.confidence.toFixed(2)}`,'small muted'));choice.append(dt,dd);judgments.append(choice);
    judgment(judgments,'Noul · conditional yes',a.conditional_yes.noul);
    judgment(judgments,'Noul · unconditional yes',a.unconditional_yes.noul);
    judgment(judgments,'Score · expressed commitment',a.commitment_strength.score,3,true);
    judgment(judgments,'Score · objection strength',a.objection_strength.score,3,true);
    const gates = byId('approval-gates'); gates.replaceChildren();
    [['budget_approved','Budget owner'],['security_approved','IT / security'],['procurement_approved','Procurement']].forEach(([key,label])=>{
      const approved = turn.after[key]; const exempt = turn.after.package === 'discovery' && key !== 'budget_approved';
      const gate=node('div',undefined,'gate'+(approved?' approved':exempt?' exempt':''));
      gate.append(node('div',label),node('span',approved?'✓ RECORDED':exempt?'EXEMPT':'MISSING'));gates.append(gate);
    });
    byId('package-budget').textContent = `${pretty(turn.after.package)} · stated budget ${cash(turn.after.budget_idr)} · accepted pilot ${turn.after.pilot_completed_and_accepted ? 'recorded' : 'not recorded'} · contact ${turn.after.contact_allowed ? 'allowed' : 'stopped'}`;
    byId('contract-status').textContent = turn.after.contract_signed ? 'YES' : 'NO';
    byId('scenario-note').textContent = `Author-only setup (not sent to Jev): ${scenario.hidden_setup} ${turn.author_note || ''}`;
    byId('state-events').replaceChildren(...turn.events.map(e=>node('li',e)));
    byId('all-answers').replaceChildren(...Object.entries(a).map(([name,answer])=>{
      const tr=node('tr');const th=node('th',pretty(name));th.scope='row';const value=answer.type==='choice'?answer.choice:answer.type==='noul'?answer.noul.toFixed(2):answer.score.toFixed(2);
      tr.append(th,node('td',answer.type),node('td',value),node('td',answer.confidence === undefined ? '—' : answer.confidence.toFixed(2)));return tr;
    }));
    byId('replay-app').dataset.scenario = scenario.id;
    byId('replay-app').dataset.turn = turnIndex+1;
  }
  selector.addEventListener('change',()=>{scenarioIndex=Number(selector.value);turnIndex=0;render();});
  byId('previous-turn').addEventListener('click',()=>{if(turnIndex>0){turnIndex--;render();}});
  byId('next-turn').addEventListener('click',()=>{if(turnIndex<data.conversations[scenarioIndex].turns.length-1){turnIndex++;render();}});
  document.querySelectorAll('[data-scenario][data-turn]').forEach(button=>button.addEventListener('click',()=>{
    scenarioIndex=data.conversations.findIndex(s=>s.id===button.dataset.scenario);turnIndex=Number(button.dataset.turn);render();
  }));
  render();
})();
