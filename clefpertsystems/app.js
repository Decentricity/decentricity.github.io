(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const svg = $('.bridge-art');
  if (reducedMotion.matches && svg.pauseAnimations) svg.pauseAnimations();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    $$('.reveal').forEach(element => observer.observe(element));
  } else $$('.reveal').forEach(element => element.classList.add('visible'));

  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      const available = document.documentElement.scrollHeight - innerHeight;
      $('.scroll-progress').style.transform = `scaleX(${available > 0 ? scrollY / available : 0})`;
      scrollQueued = false;
    });
  }, { passive: true });

  const menu = $('.menu-toggle');
  const navigation = $('#navigation');
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
  menu.addEventListener('click', () => {
    const opened = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(opened));
    navigation.classList.toggle('open', opened);
  });
  $$('#navigation a').forEach(anchor => anchor.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
  });
  if (!reducedMotion.matches && matchMedia('(hover: hover)').matches) {
    const art = $('.hero-art');
    art.addEventListener('pointermove', event => {
      const rect = art.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      art.style.transform = `perspective(1000px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
    });
    art.addEventListener('pointerleave', () => { art.style.transform = ''; });
  }

  const stages = [
    ['IMPLEMENTED / RECONSTRUCTED', 'Reconstruct the knowledge base', 'The cement-industry knowledge base combines thesis-derived facts with explicitly marked reconstruction assumptions and a separately sourced current ambient-reference profile.'],
    ['IMPLEMENTED / SWI-PROLOG', 'Run queries in SWI-Prolog', 'The adapter runs evaluate/3 inside SWI-Prolog. Inputs produce structured decisions and rule IDs. A missing relation can remain explicitly unresolved.'],
    ['IMPLEMENTED / VALID INPUT STATES', 'Generate valid input combinations', 'Enumerate or sample valid state combinations. Exercise thresholds, alternate paths, supported cases and missing-data boundaries while respecting the input contract.'],
    ['IMPLEMENTED / 3,136 LABELED CASES', 'Export labeled examples', 'Keep generic input/target records, grouped train/validation/test splits, and a separate provenance audit. Clean exports carry the query and the oracle-produced target.'],
    ['UNDER CONSTRUCTION / TRAINING', 'Train the decision model', 'Confirm Clef’s model and dataset specification, run training and publish the configuration. No trained-model outputs or accuracy results are published yet.'],
    ['TOOLS IMPLEMENTED / MODEL RUN PENDING', 'Compare model outputs with Prolog', 'Compare complete predictions with fresh Prolog outputs. Report exact agreement, per-class accuracy, coverage and disagreements; evaluate confidence when the model supplies it.']
  ];
  $$('[data-stage]').forEach(button => button.addEventListener('click', () => {
    $$('[data-stage]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    const [status, title, copy] = stages[Number(button.dataset.stage)];
    $('#stage-status').textContent = status;
    $('#stage-title').textContent = title;
    $('#stage-copy').textContent = copy;
  }));

  let recordings;
  let mode = 'water';
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function format(value) { return Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 }); }
  function unit(value) { return ({ 'ug/m3': 'µg/m³', 'mg/m3': 'mg/m³', 'count_per_year': 'count/year' })[value] || value; }
  function facts(rows) {
    const list = $('#input-facts'); list.replaceChildren();
    rows.forEach(([key, value]) => { list.append(node('dt', '', key), node('dd', '', String(value))); });
  }
  function resultNumber(value, suffix = '', word = false) {
    const result = $('#result-number'); result.replaceChildren(); result.classList.toggle('word', word);
    result.append(document.createTextNode(value));
    if (suffix) result.append(node('small', '', suffix));
  }
  function display() {
    if (!recordings) return;
    const day = $('#day-select').value;
    const id = `day-${day}-${mode}`;
    const record = recordings.records.find(item => item.id === id);
    if (!record) throw new Error('Recorded case is missing');
    const input = record.inputs;
    const answer = record.answer;
    const target = answer.target;
    $('#case-id').textContent = id;
    const badge = $('#decision-badge');
    badge.textContent = target.decision;
    badge.className = 'decision-badge' + (['within_reference', 'no_detected_impact'].includes(target.decision) ? ' good' : target.decision === 'insufficient_data' ? ' gap' : '');
    $('#pathway-view').replaceChildren(); $('#alternative-view').replaceChildren();
    $('#alternative-view').hidden = true;
    if (mode === 'water') {
      $('#case-title').textContent = 'Surface-water assessment';
      $('#case-subtitle').textContent = 'A supplied impact magnitude follows documented direct and indirect environmental relationships.';
      facts([['Pollutant', input.pollutant], ['Process', input.processes.join(', ')], ['Magnitude', input.magnitude], ['Receptors', input.receptors.join(', ')]]);
      resultNumber(format(target.maximum_score), '/ 100 · inferred score');
      $('#result-description').textContent = input.magnitude === 0 ? 'Zero supplied magnitude retains supported paths. Indirect effects and mitigation are not triggered in this recorded case.' : 'Maximum direct-impact score returned by the reconstructed program. The action category follows explicitly inferred POC priority bands.';
      if (target.indirect_impacts.length) {
        target.indirect_impacts.forEach(effect => {
          const chip = node('div', 'path-chip');
          effect.path.forEach((label, index) => {
            if (index) chip.append(node('b', '', '→'));
            chip.append(node('span', '', label));
          });
          $('#pathway-view').append(chip);
        });
      } else $('#pathway-view').append(node('p', 'pathway-note', 'No indirect effects triggered.'));
      const alternative = recordings.records.find(item => item.id === `day-${day}-alternative`);
      if (alternative) {
        const view = $('#alternative-view'); view.hidden = false;
        view.append(node('strong', '', 'Hypothetical alternative: '));
        view.append(document.createTextNode(`magnitude ${alternative.inputs.magnitude} → score ${format(alternative.answer.target.maximum_score)} → ${alternative.answer.target.decision}. Separate input; effectiveness is unmeasured.`));
      }
    } else if (mode === 'ambient') {
      const summary = input.summary;
      $('#case-title').textContent = `${target.pollutant} · current reference screen`;
      $('#case-subtitle').textContent = 'A stored statistical summary is checked against its explicitly selected US EPA ambient-reference row.';
      facts([['Standard', input.standard], ['Summary', `${format(summary.value)} ${unit(summary.unit)}`], ['Statistic', summary.statistic], ['Reference', `${format(summary.reference_level)} ${unit(summary.reference_unit)}`], ['Data status', summary.data_status]]);
      if (target.decision === 'insufficient_data') {
        resultNumber('Incomplete', '', true);
        $('#result-description').textContent = 'The reference screen abstains because the supplied summary is incomplete or unverified. A threshold alone is insufficient.';
        $('#pathway-view').append(node('div', 'path-chip', target.reason));
      } else {
        resultNumber(format(target.normalized_value), unit(target.comparison_unit));
        $('#result-description').textContent = `Normalized supplied statistic; comparison limit ${format(target.comparison_limit)} ${unit(target.comparison_unit)}. ${target.decision === 'exceeds_reference' ? 'The statistic exceeds this reference.' : 'The statistic is at or below this reference.'}`;
        $('#pathway-view').append(node('div', 'path-chip', `${target.averaging_time} averaging period`), node('div', 'path-chip', target.protection.replaceAll('_', ' + ')));
      }
    } else {
      $('#case-title').textContent = 'Unsupported impact relationship';
      $('#case-subtitle').textContent = 'This reconstructed knowledge base has no supported CO-to-aquatic-plants relationship for the selected case.';
      facts([['Pollutant', input.pollutant], ['Process', input.processes.join(', ')], ['Magnitude', input.magnitude], ['Receptor', input.receptors.join(', ')]]);
      resultNumber('Unresolved', '', true);
      $('#result-description').textContent = 'Prolog returns insufficient_data and preserves the unsupported receptor. An absent rule does not establish that a proposed impact is absent.';
      target.unresolved_receptors.forEach(receptor => $('#pathway-view').append(node('div', 'path-chip', `Unresolved: ${receptor}`)));
    }
    $('#trace-count').textContent = `${answer.rule_ids.length} rule IDs in the recorded proof trace`;
    $('#record-source').href = `${recordings.source_repository}/blob/${recordings.source_commit}/docs/runs/daily-use/outputs/${id}.json`;
    $('#raw-input').textContent = JSON.stringify(input, null, 2);
    $('#raw-result').textContent = JSON.stringify(answer, null, 2);
    $('#oracle-panel').dataset.record = id;
    $('#oracle-panel').setAttribute('aria-busy', 'false');
  }
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    $$('[data-mode]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    display();
  }));
  $('#day-select').addEventListener('change', display);
  fetch('data/oracle-recordings.json').then(response => {
    if (!response.ok) throw new Error('Recorded data request failed');
    return response.json();
  }).then(data => { recordings = data; display(); }).catch(() => {
    $('#data-error').hidden = false;
    $('#oracle-panel').setAttribute('aria-busy', 'false');
    $('#case-id').textContent = 'Recorded data unavailable';
    $('#decision-badge').textContent = 'Unavailable';
    $('#result-description').textContent = 'Use the data link below to inspect the saved executions.';
  });
})();
