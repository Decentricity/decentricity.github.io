"""Browser-check the static showcase, verify recorded data and capture previews."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


def verify(base, source):
    payload=json.loads((ROOT/'data/oracle-recordings.json').read_text())
    original=json.loads((source/'docs/runs/daily-use/consultations.json').read_text())
    by_id={r['id']:r for r in original}
    checks=[]
    for record in payload['records']:
        assert record==by_id[record['id']],record['id']
        checks.append(record['id']+':unaltered_source_record')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base,wait_until='networkidle')
        page.wait_for_selector('#oracle-panel[data-record]')
        assert 'Pandu Sastrowardoyo' in page.locator('body').inner_text()
        assert page.locator('a[href="https://github.com/Decentricity/ClefpertSystems"]').count()>=2
        assert page.locator('a[href*="digilib.itb.ac.id"]').count()>=3
        checks.append('biography_and_source_links')
        for mode in ['water','ambient','gap']:
            page.locator(f'[data-mode="{mode}"]').click()
            for day in range(1,6):
                value=f'{day:02d}';page.locator('#day-select').select_option(value)
                event=f'day-{value}-{mode}'
                record=by_id[event]
                assert json.loads(page.locator('#raw-input').text_content())==record['inputs']
                assert json.loads(page.locator('#raw-result').text_content())==record['answer']
                assert page.locator('#decision-badge').inner_text()==record['answer']['target']['decision']
                assert payload['source_commit'] in page.locator('#record-source').get_attribute('href')
                if mode=='gap':assert page.locator('#result-number').inner_text()=='Unresolved'
                if mode=='water':
                    assert page.locator('#result-number').evaluate('(e)=>e.firstChild.textContent')==f'{record["answer"]["target"]["maximum_score"]:g}'
                if mode=='ambient' and record['answer']['target']['decision']!='insufficient_data':
                    assert page.locator('#result-number').evaluate('(e)=>e.firstChild.textContent')==f'{record["answer"]["target"]["normalized_value"]:g}'
                if mode=='water':
                    alternative=by_id[f'day-{value}-alternative']
                    assert str(alternative['answer']['target']['maximum_score']).removesuffix('.0') in page.locator('#alternative-view').inner_text()
                checks.append(event+':browser_output_matches_prolog')
        for stage in range(6):
            page.locator(f'[data-stage="{stage}"]').click()
            assert page.locator(f'[data-stage="{stage}"]').get_attribute('aria-pressed')=='true'
            checks.append(f'pipeline_stage_{stage}:accessible_selection')
        page.locator('[data-stage="4"]').click()
        assert 'UNDER CONSTRUCTION' in page.locator('#stage-status').inner_text()
        assert page.locator('.training-card .construction-tag').count()==3
        assert 'No trained-model results are published yet.' in page.locator('#roadmap').inner_text()
        checks.append('model_results_are_explicit_placeholders')
        page.locator('[data-stage="0"]').click()
        page.locator('[data-mode="water"]').click();page.locator('#day-select').select_option('02')
        page.locator('.raw-output summary').click()
        assert page.locator('.raw-output').get_attribute('open') is not None
        page.locator('.raw-output summary').click()
        checks.append('complete_raw_output_disclosure')
        for width in [320,375,768,1280,1440]:
            page.set_viewport_size({'width':width,'height':1000})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'overflow at {width}'
            checks.append(f'responsive_{width}:no_horizontal_overflow')
        page.set_viewport_size({'width':375,'height':844})
        page.locator('.menu-toggle').click()
        assert page.locator('#navigation').is_visible()
        page.keyboard.press('Escape')
        assert page.locator('.menu-toggle').get_attribute('aria-expanded')=='false'
        assert page.locator('.menu-toggle').evaluate('(element)=>element===document.activeElement')
        checks.append('mobile_menu_keyboard_escape_and_focus')
        page.set_viewport_size({'width':1440,'height':1050})
        page.evaluate('document.activeElement.blur()')
        for element in page.locator('.reveal').all():
            element.scroll_into_view_if_needed();page.wait_for_timeout(30)
        page.evaluate('window.scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(200)
        page.screenshot(path=str(ROOT/'verification/desktop.png'),full_page=True)
        page.screenshot(path=str(ROOT/'verification/hero.png'))
        page.locator('#oracle-panel').scroll_into_view_if_needed();page.wait_for_timeout(100)
        page.locator('#oracle-panel').screenshot(path=str(ROOT/'verification/explorer.png'))
        page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(100)
        page.screenshot(path=str(ROOT/'verification/mobile.png'),full_page=True)
        assert not errors,errors
        checks.append('no_javascript_runtime_errors')
        reduced=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
        reduced.goto(base,wait_until='networkidle')
        assert reduced.locator('.transfer-particles').evaluate('(e)=>getComputedStyle(e).display')=='none'
        assert reduced.locator('.bridge-art').evaluate('(e)=>e.animationsPaused()')
        checks.append('reduced_motion_css_and_svg')
        reduced.close()
        broken=browser.new_page()
        broken.route('**/data/oracle-recordings.json',lambda route:route.fulfill(status=404,body='missing'))
        broken.goto(base,wait_until='networkidle')
        assert broken.locator('#data-error').is_visible()
        assert broken.locator('#decision-badge').inner_text()=='Unavailable'
        checks.append('recording_load_failure_has_explicit_state')
        broken.close()
        nojs=browser.new_page(java_script_enabled=False)
        nojs.goto(base,wait_until='networkidle')
        assert nojs.locator('noscript a').is_visible()
        assert nojs.locator('h1').is_visible()
        checks.append('no_javascript_source_fallback')
        nojs.close()
        card=browser.new_page(viewport={'width':1200,'height':630},device_scale_factor=1)
        card.goto(urljoin(base,'assets/social-card.html'),wait_until='networkidle')
        card.screenshot(path=str(ROOT/'assets/social-card.png'))
        card.close()
        version=browser.version;browser.close()
    report={'checked_at':datetime.now(timezone.utc).isoformat(),'passed':True,'browser':'Chromium '+version,
            'check_count':len(checks),'checks':checks,'source_commit':payload['source_commit'],
            'oracle_fingerprint':payload['oracle_fingerprint'],
            'recording_sha256':hashlib.sha256((ROOT/'data/oracle-recordings.json').read_bytes()).hexdigest(),
            'model_results':'under_construction','screenshots':['desktop.png','hero.png','explorer.png','mobile.png']}
    (ROOT/'verification/browser-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'PASS {len(checks)} checks; 20 original Prolog records verified; 4 previews captured')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8765/clefpertsystems/')
    parser.add_argument('--source-repo',type=Path,required=True)
    args=parser.parse_args();verify(args.url,args.source_repo)


if __name__=='__main__':main()
