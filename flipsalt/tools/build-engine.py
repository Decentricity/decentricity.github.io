#!/usr/bin/env python3
"""Apply auditable game-module hooks to the actual recovered Saltline engine."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source = (root / 'upstream/saltline.original.js').read_text()
patches = [
    ('async function cL(){', 'async function cL(){window.FLIPSALT.configure({sun:Z0,sky:T0,materials:ug,qualities:jr});'),
    ('t.physics=v_(t),t.props=fv(t)', 'window.FLIPSALT.prepare(t),t.physics=v_(t),t.props=fv(t)'),
    ('async function I5(n){', 'async function I5(n){if(window.FLIPSALT)return window.FLIPSALT.weapon(n);'),
    ('async function W5(n){', 'async function W5(n){if(window.FLIPSALT)return window.FLIPSALT.friends(n);'),
    ('function yE(n){', 'function yE(n){if(window.FLIPSALT)return{items:[],reset(){},update(){}};'),
    ('function sT(n){', 'function sT(n){if(window.FLIPSALT)return window.FLIPSALT.hud(n);'),
    ('function pT(n){', 'function pT(n){if(window.FLIPSALT)return window.FLIPSALT.game(n);'),
    ('await fa("Waiting for first light",.92);', 'await window.FLIPSALT.decorate(t);await fa("Waiting for first light",.92);'),
]
output = source
for before, after in patches:
    assert output.count(before) == 1, f'Upstream changed: {before}'
    output = output.replace(before, after)
reverse = output
for before, after in reversed(patches):
    reverse = reverse.replace(after, before)
assert reverse == source, 'Unexpected engine modification'
(root / 'saltline.engine.js').write_text(output)
audit = {
    'source': 'https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp',
    'original_sha256': hashlib.sha256(source.encode()).hexdigest(),
    'engine_sha256': hashlib.sha256(output.encode()).hexdigest(),
    'patches': [{'anchor': a, 'replacement': b} for a, b in patches],
    'unchanged_systems': ['Three.js runtime', 'ov renderer and postprocessing shaders', 'lv procedural material generation', 'Pg harbor geometry', 'Iv backdrop', 'Vg water and ground', 'v_ collision and navigation', 'xE player movement and camera', 'gE keyboard/mouse/touch/gamepad input', 'cE procedural audio', 'cL frame loop (apart from listed hooks)'],
    'verification': 'Reversing exactly these eight hooks reproduces the original source byte-for-byte.',
    'credit': 'Original Saltline game by Felix; original engine retained. Storybook adaptation by Decentricity.',
}
(root / 'engine-provenance.json').write_text(json.dumps(audit, indent=2) + '\n')
print('Saltline engine built; reverse-patch equality verified.')
