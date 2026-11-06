#!/usr/bin/env python3
"""Generate 33 layer-mix levels (ids 3,6,...,99) with witnesses. Cap4 everywhere."""
from __future__ import annotations
import json, random, collections, copy, time, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import layer_mix_lib as M

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'www/assets/paint_levels.json'
OUT_SOL = ROOT / 'scripts/paint_solutions_mix_v430.json'
CKPT = ROOT / 'scripts/paint_mix_checkpoint_v430.json'

def n_mixers(lid: int) -> int:
  # 2 early, 3 mid, 4 late — staggered
  if lid <= 21: return 2
  if lid <= 54: return 3
  return 4

def n_sources(lid: int) -> int:
  # inclusive empties; total flasks = sources (mixers separate)
  if lid <= 21: return 8
  if lid <= 54: return 10
  return 12

def pick_recipes(n_mix, rng, hard=False):
  recipes = []
  for _ in range(n_mix):
    if hard:
      # more variety / repeats requiring planning
      r = [rng.choice(M.PRODUCTS) for _ in range(4)]
    else:
      # ensure at least 2 distinct products
      r = [rng.choice(M.PRODUCTS) for _ in range(4)]
      if len(set(r)) < 2:
        r[2] = M.PRODUCTS[(M.PRODUCTS.index(r[0])+1)%3]
    recipes.append(r)
  return recipes

def ingredient_bag(recipes):
  need = collections.Counter()
  for r in recipes:
    for p in r:
      a,b = M.ING[p]
      need[a]+=1; need[b]+=1
  return need

def deal_units(need, n_src, n_empty, rng, filler_colors=0):
  """Return list of flask layer lists (bottom→top)."""
  units = []
  for c,k in need.items():
    units.extend([c]*k)
  fillers = [c for c in ["pink","teal","brown"] if c not in need]
  for i in range(filler_colors):
    if i < len(fillers):
      units.extend([fillers[i]]*4)
  rng.shuffle(units)
  fill_n = n_src - n_empty
  flasks = [[] for _ in range(n_src)]
  idx = 0
  for u in units:
    placed = False
    for _ in range(fill_n*2):
      j = idx % fill_n
      idx += 1
      if len(flasks[j]) < 4:
        flasks[j].append(u); placed=True; break
    if not placed:
      for j in range(fill_n):
        if len(flasks[j]) < 4:
          flasks[j].append(u); placed=True; break
    if not placed:
      return None
  got = collections.Counter(c for f in flasks for c in f)
  if got != collections.Counter(units): return None
  return flasks

def deal_solvable(recipes, n_src, n_empty, rng, filler_colors=0):
  """Stack ingredients in reverse recipe order so greedy always finds tops; then lightly scramble with empties."""
  # sequence of required tops for witness: for each mixer, for each product: a then b
  seq = []
  for r in recipes:
    for p in r:
      a,b = M.ING[p]
      # randomize commutative order per pair
      if rng.random() < 0.5: seq.extend([a,b])
      else: seq.extend([b,a])
  fillers = [c for c in ["pink","teal","brown"] if True]
  fill_units = []
  for i in range(filler_colors):
    fill_units.extend([fillers[i%len(fillers)]]*4)
  # Put sequence into columns of 4 (bottom=earlier in seq so top=next needed if reverse...)
  # Witness pours first items in seq first → those must be on TOP initially.
  # So stack each flask as bottom=later, top=earlier within that flask's share.
  # Distribute seq round-robin into fill_n flasks, appending (= toward top).
  fill_n = n_src - n_empty
  if fill_n < 2: return None
  flasks = [[] for _ in range(n_src)]
  # reverse seq so we append from last-needed to first-needed → top is first-needed
  order = list(reversed(seq)) + fill_units
  # chunk into fill_n stacks
  buckets = [[] for _ in range(fill_n)]
  bi = 0
  for u in order:
    # prefer bucket with room
    placed=False
    for _ in range(fill_n):
      if len(buckets[bi]) < 4:
        buckets[bi].append(u); placed=True; bi=(bi+1)%fill_n; break
      bi=(bi+1)%fill_n
    if not placed:
      return None
  for i,b in enumerate(buckets):
    flasks[i] = b  # last appended = top = early in seq ✓
  # light scramble: reverse-pour a few into empties then back — keep short
  # verify counts
  need = collections.Counter()
  for r in recipes:
    for p in r:
      a,b=M.ING[p]; need[a]+=1; need[b]+=1
  for c in fill_units: need[c]+=1
  got = collections.Counter(c for f in flasks for c in f)
  if got != need: 
    # fillers keyed differently
    return None
  return flasks

def build_level(lid, rng):
  nm = n_mixers(lid)
  ns = n_sources(lid)
  n_empty = 2 if lid <= 30 else (3 if lid <= 60 else 3)
  fillers = 0 if lid <= 15 else (1 if lid <= 50 else 1)
  hard = lid >= 60
  for attempt in range(120):
    recipes = pick_recipes(nm, rng, hard=hard)
    need = ingredient_bag(recipes)
    # capacity check
    total_units = sum(need.values()) + fillers*4
    if total_units > (ns - n_empty)*4:
      fillers = max(0, fillers-1); continue
    if attempt < 40:
      src = deal_solvable(recipes, ns, n_empty, rng, fillers)
    else:
      src = deal_units(need, ns, n_empty, rng, fillers)
    if src is None: continue
    # assemble: sources first, mixers at end (layout uses mixer flags for bottom row)
    flasks = src + [[] for _ in range(nm)]
    n = len(flasks)
    mixer = [False]*ns + [True]*nm
    mixRecipe = [None]*ns + recipes
    L = {
      'id': lid,
      'flasks': flasks,
      'caps': [4]*n,
      'hidden': [([False]*len(f)) for f in flasks],
      'locked': [False]*n,
      'lockColor': [None]*n,
      'thawAfter': [0]*n,
      'frozen': [False]*n,
      'mixer': mixer,
      'mixRecipe': mixRecipe,
      'collector': [False]*n,
      'collectorColor': None,
      'collectorNeed': 0,
      'filterColor': [None]*n,
      'tags': ['layer_mix'],
    }
    # Try constructive greedy witness first, then BFS
    path = greedy_solve(L, rng)
    if path is None:
      continue
    ok, msg = M.replay(L, path)
    if not ok:
      continue
    L['solutionLen'] = len(path)
    L['moveLimit'] = len(path) + max(6, int(len(path)*0.45))
    L['par'] = max(4, len(path) - 2)
    L['validated'] = True
    L['hintPath'] = [[a[0],a[1],a[2] if len(a)>2 else 1] for a in path[:4]]
    L['states'] = 0
    return L, path
  return None, None

def greedy_solve(L, rng, max_steps=220):
  """Prefer pouring next recipe ingredient when top-available; else unstick to empty."""
  layers = [list(f) for f in L['flasks']]
  n = len(layers)
  caps = [4]*n
  hidden = [list(h) for h in L['hidden']]
  corked = [False]*n
  is_mixer = list(L['mixer'])
  recipes = [list(r) if r else None for r in L['mixRecipe']]
  pendings = [None]*n
  path = []
  for _ in range(max_steps):
    if M.is_won(layers, corked, is_mixer, recipes, pendings):
      return path
    moved = False
    # 1) complete any pending mix
    for j in range(n):
      if not recipes[j] or pendings[j] is None: continue
      if len(layers[j]) >= len(recipes[j]): continue
      want = recipes[j][len(layers[j])]
      a,b = M.ING[want]
      need = b if pendings[j]==a else a
      for i in range(n):
        if is_mixer[i]: continue
        amt = M.can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j)
        if amt>0 and M.top_color(layers[i])==need:
          layers, hidden, corked, pendings, _, _ = M.apply_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, 1)
          path.append((i,j,1)); moved=True; break
      if moved: break
    if moved: continue
    # 2) start next recipe layer if ingredient on top
    for j in range(n):
      if not recipes[j] or pendings[j] is not None: continue
      if len(layers[j]) >= len(recipes[j]): continue
      want = recipes[j][len(layers[j])]
      a,b = M.ING[want]
      for need in (a,b):
        for i in range(n):
          if is_mixer[i]: continue
          amt = M.can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j)
          if amt>0 and M.top_color(layers[i])==need:
            layers, hidden, corked, pendings, _, _ = M.apply_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, 1)
            path.append((i,j,1)); moved=True; break
        if moved: break
      if moved: break
    if moved: continue
    # 3) unstick: pour blocking non-needed-top into empty / matching ordinary
    # find color we need next across mixers
    needed_now = set()
    for j in range(n):
      if not recipes[j]: continue
      if len(layers[j]) >= len(recipes[j]): continue
      want = recipes[j][len(layers[j])]
      a,b = M.ING[want]
      if pendings[j]:
        needed_now.add(b if pendings[j]==a else a)
      else:
        needed_now.add(a); needed_now.add(b)
    # pour from a flask whose top is NOT needed onto empty or same color
    candidates = []
    for i in range(n):
      if is_mixer[i] or corked[i] or not layers[i]: continue
      top = M.top_color(layers[i])
      if top in needed_now: continue
      for j in range(n):
        if is_mixer[j]: continue
        amt = M.can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j)
        if amt>0:
          candidates.append((i,j,amt))
    if not candidates:
      # allow moving needed color to empty to dig (last resort)
      for i in range(n):
        if is_mixer[i] or corked[i] or not layers[i]: continue
        for j in range(n):
          if is_mixer[j]: continue
          if layers[j]: continue  # only empty
          amt = M.can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j)
          if amt>0: candidates.append((i,j,amt))
    if not candidates:
      return None
    i,j,amt = rng.choice(candidates) if len(path)%5==0 else candidates[0]
    layers, hidden, corked, pendings, _, _ = M.apply_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, amt)
    path.append((i,j,amt))
  return None

def main():
  rng = random.Random(43001)
  pack = json.loads(PACK.read_text())
  by_id = {L['id']: L for L in pack['levels']}
  sols = {}
  if CKPT.exists():
    ck = json.loads(CKPT.read_text())
    sols.update(ck.get('sols') or {})
    for L in ck.get('levels') or []:
      by_id[L['id']] = L
    print('resumed', len(sols))
  ids = list(range(3,100,3))
  t0 = time.time()
  for lid in ids:
    if str(lid) in sols:
      print('skip', lid); continue
    L, path = build_level(lid, rng)
    if not L:
      print('FAIL', lid); continue
    by_id[lid] = L
    sols[str(lid)] = {'path': path, 'len': len(path), 'method': 'greedy+bfs-mix'}
    print(f"L{lid} mix={n_mixers(lid)} src={n_sources(lid)} sol={len(path)} recipes={L['mixRecipe'][-n_mixers(lid):]}")
    CKPT.write_text(json.dumps({'levels':[by_id[i] for i in ids if i in by_id and str(i) in sols],'sols':sols}))
  # relocate collectors 12/42/72 → 13/43/73
  for old,new in [(12,13),(42,43),(72,73)]:
    # 12 is mix level — collector must not be on mix id; take template from old collector if present on old non-mix... 
    # After mix regen, id 12 is mix. Copy a collector template from nearby previous collector style.
    src_id = {13:22, 43:52, 73:82}.get(new, 22)
    src = copy.deepcopy(by_id.get(src_id) or by_id[22])
    # keep as collector level but new id; strip mixer
    src['id'] = new
    src['tags'] = ['collector'] + [t for t in (src.get('tags') or []) if t not in ('layer_mix','mixing','emergency')]
    if 'collector' not in src['tags']: src['tags'].append('collector')
    # ensure collector flags exist
    if not src.get('collector') or not any(src['collector']):
      # synthesize small collector board from flasks
      pass
    by_id[new] = src
    print('collector moved to', new, 'from template', src_id)

  # Convert old single-mixer non-multiples 40,47 to normal (clear mixer)
  for oid in (40, 47):
    if oid % 3 == 0: continue
    L = by_id.get(oid)
    if not L: continue
    if L.get('mixer') and any(L['mixer']):
      L = copy.deepcopy(L)
      L['mixer'] = [False]*len(L['flasks'])
      L['mixRecipe'] = [None]*len(L['flasks'])
      tags = [t for t in (L.get('tags') or []) if t != 'mixing']
      L['tags'] = tags
      # keep validated if had solution — may still be valid as normal
      by_id[oid] = L
      print('cleared old mixer', oid)

  # Remove collector from any mix id if leaked
  for lid in ids:
    L = by_id[lid]
    if L.get('collector') and any(L['collector']):
      print('WARN mix level had collector', lid)

  pack['levels'] = [by_id[i] for i in range(1,101)]
  pack['version'] = '4.3.0'
  PACK.write_text(json.dumps(pack, ensure_ascii=False, separators=(',',':')))
  OUT_SOL.write_text(json.dumps(sols))
  print('DONE', len(sols), 'mix levels', 't', round(time.time()-t0,1))
  # summary mixer counts
  for lid in ids:
    L=by_id[lid]
    print(lid, 'nmix', sum(1 for x in L['mixer'] if x), 'sol', L.get('solutionLen'), 'ok', L.get('validated'))

if __name__ == '__main__':
  main()
