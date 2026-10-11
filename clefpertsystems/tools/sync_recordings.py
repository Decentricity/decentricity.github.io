"""Copy selected, unaltered executed oracle cases from the ClefpertSystems repo."""
import argparse
import json
from pathlib import Path
import subprocess


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',type=Path,required=True)
    args=parser.parse_args()
    source=args.repo.resolve()
    destination=Path(__file__).resolve().parents[1]/'data/oracle-recordings.json'
    records=json.loads((source/'docs/runs/daily-use/consultations.json').read_text())
    selected=[r for r in records if r['id'].rsplit('-',1)[-1] in ['water','ambient','gap','alternative']]
    corpus=json.loads((source/'dataset/generated/manifest.json').read_text())
    run=json.loads((source/'docs/runs/daily-use/manifest.json').read_text())
    revision=subprocess.run(['git','rev-parse','HEAD'],cwd=source,capture_output=True,text=True,check=True).stdout.strip()
    payload={'source_repository':'https://github.com/Decentricity/ClefpertSystems','source_commit':revision,
             'source_path':'docs/runs/daily-use/consultations.json','oracle_fingerprint':run['oracle_fingerprint'],
             'prolog_version':run['prolog_version'],'executed_at':run['executed_at'],
             'corpus_count':corpus['case_count'],'covered_rules':len(corpus['covered_rule_ids']),
             'oracle_rules':corpus['oracle_rule_count'],'scenario_checks':run['check_count'],
             'consultation_count':run['consultation_count'],'records':selected}
    destination.write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False)+'\n')
    print(f'Copied {len(selected)} original oracle records from {revision}')


if __name__=='__main__':main()
