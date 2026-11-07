#!/usr/bin/env python3
"""Static no-mixing paint inventory guard; not a solvability proof."""
import json,collections,sys
from pathlib import Path
pack=json.loads(Path('www/assets/paint_levels.json').read_text())
errors=[]
for L in pack['levels']:
    counts=collections.Counter(c for f in L['flasks'] for c in f)
    coll=L.get('collector') or [False]*len(L['flasks'])
    goals=L.get('workshopOrder') or []
    if any(L.get('mixer') or []) or any(L.get('mixRecipe') or []): errors.append((L['id'],'mixing metadata'))
    if any(cap!=4 for i,cap in enumerate(L['caps']) if not coll[i]): errors.append((L['id'],'ordinary capacity'))
    if any(coll):
        if counts[L['collectorColor']]<L['collectorNeed']: errors.append((L['id'],'collector paint missing'))
    elif goals:
        if any(counts[c]<4*n for c,n in collections.Counter(goals).items()): errors.append((L['id'],'order paint missing'))
    elif any(n%4 for n in counts.values()): errors.append((L['id'],'nonmultiple of four',dict(counts)))
print(json.dumps({'levels':len(pack['levels']),'errors':errors},ensure_ascii=False))
sys.exit(bool(errors))
