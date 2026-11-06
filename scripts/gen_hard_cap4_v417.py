#!/usr/bin/env python3
"""v4.1.7: progressive harder pack — reverse-mix construction, all ordinary CAP=4."""
from __future__ import annotations
import json, random, time, copy
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
LEVELS_PATH = ROOT / 'www' / 'assets' / 'paint_levels.json'
SPEC = importlib.util.spec_from_file_location('rv', ROOT / 'scripts' / 'revalidate_engine_v414.py')
rv = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rv)

COLORS = [
  'red','orange','yellow','green','blue','purple','pink','cyan',
  'lime','teal','magenta','brown','navy','olive','coral','indigo',
]
COLLECTOR_IDS = {12,22,32,42,52,62,72,82,92}
MIXER_IDS = {40,47,54,61,68,75,89,96}
COLL_NEED = {12:6,22:6,32:6,42:6,52:8,62:8,72:8,82:8,92:8}

def top_run(f):
  if not f: return 0, None
  c = f[-1]; n = 0
  for x in reversed(f):
    if x != c: break
    n += 1
  return n, c

def reverse_mix(flasks, caps, steps, rng, min_empty=2, frag=0.35):
  """Create interleaved stacks via reverse pours; try to keep min_empty empties."""
  n = len(flasks)
  for _ in range(steps):
    srcs = [i for i,f in enumerate(flasks) if f]
    if not srcs: break
    si = srcs[rng.randrange(len(srcs))]
    run, col = top_run(flasks[si])
    empty_n = sum(1 for f in flasks if not f)
    dests = []
    for j in range(n):
      if j == si or len(flasks[j]) >= caps[j]: continue
      if not flasks[j] and empty_n <= min_empty:
        continue  # protect last empties
      dests.append(j)
    if not dests:
      # allow pouring into empty as last resort
      dests = [j for j in range(n) if j != si and len(flasks[j]) < caps[j]]
    if not dests: continue
    mixed_d = [j for j in dests if flasks[j] and flasks[j][-1] != col]
    empty_d = [j for j in dests if not flasks[j]]
    same_d = [j for j in dests if flasks[j] and flasks[j][-1] == col]
    pool = mixed_d * 3 + empty_d * 2 + same_d
    if not pool: continue
    di = pool[rng.randrange(len(pool))]
    space = caps[di] - len(flasks[di])
    if rng.random() < frag:
      amt = 1
    else:
      amt = rng.randint(1, min(run, space))
    amt = min(amt, run, space)
    for _ in range(amt):
      flasks[di].append(flasks[si].pop())
  return flasks

def count_struct(flasks, caps, skip=()):
  mixed = pre = empty = 0
  cols = set()
  for i, f in enumerate(flasks):
    if i in skip: continue
    for c in f: cols.add(c)
    if not f: empty += 1
    elif len(set(f)) > 1: mixed += 1
    elif len(f) == caps[i] and len(set(f)) == 1: pre += 1
  return mixed, pre, empty, len(cols)

def blank_flags(n, mixer_i=None, coll_i=None):
  return {
    'hidden': [[] for _ in range(n)],  # filled later
    'locked': [False]*n,
    'lockColor': [None]*n,
    'thawAfter': [0]*n,
    'frozen': [False]*n,
    'mixer': [False]*n if mixer_i is None else [i==mixer_i for i in range(n)],
    'collector': [False]*n if coll_i is None else [i==coll_i for i in range(n)],
  }

def finalize_hidden(flasks, dens, rng):
  hidden = []
  for f in flasks:
    h = [False]*len(f)
    if dens > 0 and len(f) >= 2:
      for k in range(len(f)-1):  # never hide top
        if rng.random() < dens:
          h[k] = True
    hidden.append(h)
  return hidden

def curve(lid):
  """n_colors, n_empty, min_sol, mix_steps, want_hidden/freeze/lock/timer"""
  hid = lid >= 8 and (lid % 4 != 1)
  frz = lid >= 18 and (lid % 5 == 0 or lid in (27,31,45,55,65,75,85,95))
  loc = lid >= 20 and (lid % 8 == 0 or lid in (26,27,28,34,90,100))
  tim = lid >= 44 and lid % 12 == 0
  if lid <= 3: return 2, 2, 4, 14, hid, False, False, False
  if lid <= 5: return 3, 2, 6, 20, hid, False, False, False
  if lid <= 9: return 4, 2, 8, 28, hid, False, False, False
  if lid <= 14: return 5, 2, 10, 36, True, frz, False, False
  if lid <= 20: return 5, 2, 11, 40, True, frz, loc, False
  if lid <= 24: return 6, 2, 11, 45, True, frz, loc, False
  if lid <= 30: return 7, 2, 12, 52, True, frz or lid==27, True if lid>=26 else loc, False
  if lid <= 45: return 7, 2, 12, 55, True, frz, loc, tim
  if lid <= 60: return 7, 2, 12, 58, True, frz, loc, tim
  if lid <= 80: return 8, 2, 12, 62, True, True, loc, tim
  if lid <= 95: return 8, 2, 13, 65, True, True, True, tim
  return 8, 2, 13, 68, True, True, True, tim

def min_mixed(lid, nc):
  if lid <= 3: return 1
  if lid <= 5: return 2
  if nc <= 4: return max(2, nc - 1)
  if nc <= 6: return max(3, nc - 2)
  return max(4, nc - 3)

def make_classic(lid, rng):
  nc, ne, min_sol, steps, hid, frz, loc, tim = curve(lid)
  cols = COLORS[:nc]
  flasks = [[c]*4 for c in cols] + [[] for _ in range(ne)]
  caps = [4]*len(flasks)
  flasks = reverse_mix(flasks, caps, steps, rng, min_empty=ne, frag=0.3 + min(0.25, lid/200))
  # extra pass if under-mixed
  for _ in range(4):
    mixed, pre, empty, _ = count_struct(flasks, caps)
    if mixed >= min_mixed(lid, nc) and pre == 0 and empty >= ne:
      break
    flasks = reverse_mix(flasks, caps, 8 + nc, rng, min_empty=ne, frag=0.5)

  n = len(flasks)
  flags = blank_flags(n)
  tags = []
  dens = 0.22 if hid else 0
  if hid: tags.append('hidden')
  flags['hidden'] = finalize_hidden(flasks, dens, rng)

  if frz:
    cands = [i for i,f in enumerate(flasks) if f and not (len(f)==4 and len(set(f))==1)]
    rng.shuffle(cands)
    for i in cands[:1 + (1 if lid > 50 else 0)]:
      flags['frozen'][i] = True
      flags['thawAfter'][i] = rng.randint(1, 3 if lid < 60 else 4)
    if cands: tags.append('frozen')

  if loc:
    empties = [i for i,f in enumerate(flasks) if not f]
    key = cols[rng.randrange(len(cols))]
    if empties:
      ei = empties[-1]
      flags['locked'][ei] = True
      flags['lockColor'][ei] = key
      tags.append('locked')
    else:
      flasks.append([]); caps.append(4)
      for k,v in flags.items():
        if k == 'hidden': v.append([])
        elif k == 'lockColor': v.append(key)
        elif k == 'thawAfter': v.append(0)
        elif k == 'locked': v.append(True)
        else: v.append(False)
      flags['locked'][-1] = True
      flags['lockColor'][-1] = key
      tags.append('locked')
      n = len(flasks)

  move_limit = max(28, min_sol * 3 + nc * 2)
  if tim:
    # fair margin over expected sol, not punitive
    move_limit = max(min_sol + 10, int(min_sol * 1.7) + 8)
    tags.append('timer')

  L = {
    'id': lid, 'flasks': flasks, 'caps': caps,
    'hidden': flags['hidden'], 'locked': flags['locked'], 'lockColor': flags['lockColor'],
    'thawAfter': flags['thawAfter'], 'frozen': flags['frozen'],
    'mixer': flags['mixer'], 'collector': flags['collector'],
    'collectorColor': None, 'collectorNeed': 0,
    'tags': tags, 'par': min_sol + 4, 'moveLimit': move_limit,
  }
  return L, min_sol

def make_mixer(lid, rng):
  # Harder mixer: ingredients interleaved among more colors; mixer empty cap4
  # yellow+blue→green; ensure totals work after mix
  # Start: green needs 4 total via 2 pre + 1 mix(=y+b); plus other full colors mixed
  nc = 4 if lid < 60 else 5
  # Build sorted then reverse-mix, then designate one empty as mixer
  cols = ['red','green','purple','pink','cyan'][:nc]
  # Ensure yellow & blue units exist for mixing into green
  # Simpler proven pattern expanded:
  flasks = [
    [],  # mixer
    ['yellow', 'red', 'red', 'red'],
    ['blue', 'green', 'green', 'pink'] if nc >= 4 else ['blue', 'green', 'green'],
    ['red', 'pink', 'pink', 'pink'] if nc >= 4 else ['red'],
    ['green'],  # will get +1 from mix → need pad
    [],
  ]
  if nc >= 5:
    flasks[2] = ['blue', 'green', 'cyan', 'cyan']
    flasks.append(['cyan', 'cyan', 'pink', 'green'])
    flasks.append([])
  # Fix conservation for green: want 3 green units + 1 from mix = 4
  # Count and rebuild more carefully
  flasks = [[], ['yellow','red','blue','green'], ['red','red','red','green'],
            ['pink','pink','pink','pink'] if nc>=4 else [],
            ['green'], []]
  if nc >= 5:
    flasks = [[], ['yellow','cyan','blue','green'], ['red','red','red','red'],
              ['pink','pink','pink','pink'], ['cyan','cyan','cyan','green'],
              ['green'], []]
  # pad green: count greens
  def rebuild():
    # yellow×1 blue×1 green×3 + full other colors, 2 empties + mixer
    bag = ['yellow','blue'] + ['green']*3
    others = [c for c in COLORS if c not in ('yellow','blue','green')][: max(1, nc-2)]
    for o in others:
      bag += [o]*4
    rng.shuffle(bag)
    sides = []
    cur = []
    for u in bag:
      cur.append(u)
      if len(cur) == 4:
        sides.append(cur); cur = []
    # leftover partial
    if cur:
      sides.append(cur)
    empties_needed = 2
    flasks2 = [[]] + sides + [[] for _ in range(empties_needed)]  # [0]=mixer
    caps2 = [4]*len(flasks2)
    # reverse mix sides only (not mixer index 0)
    side_f = flasks2[1:]
    side_c = caps2[1:]
    side_f = reverse_mix(side_f, side_c, 20 + nc*3, rng, min_empty=2, frag=0.35)
    return [flasks2[0]] + side_f, caps2

  flasks, caps = rebuild()
  n = len(flasks)
  mixer = [i == 0 for i in range(n)]
  L = {
    'id': lid, 'flasks': flasks, 'caps': caps,
    'hidden': finalize_hidden(flasks, 0.15 if lid>50 else 0, rng),
    'locked': [False]*n, 'lockColor': [None]*n,
    'thawAfter': [0]*n, 'frozen': [False]*n,
    'mixer': mixer, 'collector': [False]*n,
    'collectorColor': None, 'collectorNeed': 0,
    'tags': ['mixing'], 'par': 14, 'moveLimit': 36 + nc*3,
  }
  return L, 8

def make_collector(lid, rng):
  need = COLL_NEED[lid]
  color = COLORS[(lid // 10) % len(COLORS)]
  # more side colors on later collectors
  n_other = 3 if lid < 50 else 4
  others = [c for c in COLORS if c != color][:n_other]
  bag = [color] * need
  for o in others:
    bag += [o] * 4
  # trim bag to multiple of 4
  while len(bag) % 4 != 0:
    # add another full other color
    extra = [c for c in COLORS if c != color and c not in others][0]
    others.append(extra)
    bag += [extra] * 4
    bag = [color]*need
    for o in others:
      bag += [o]*4
    if len(bag) % 4 == 0: break
    break
  rng.shuffle(bag)
  sides = []
  cur = []
  for u in bag:
    cur.append(u)
    if len(cur) == 4:
      sides.append(cur); cur = []
  if cur:
    while len(cur) < 4:
      cur.append(others[0])
    sides.append(cur)
  empties = 2
  flasks = sides + [[] for _ in range(empties)]
  caps_side = [4] * len(flasks)
  flasks = reverse_mix(flasks, caps_side, 18 + len(sides)*2, rng, min_empty=2, frag=0.35)
  # append collector empty
  flasks.append([])
  n = len(flasks)
  caps = [4]*(n-1) + [need]
  collector = [False]*(n-1) + [True]
  L = {
    'id': lid, 'flasks': flasks, 'caps': caps,
    'hidden': finalize_hidden(flasks, 0.12 if lid > 40 else 0, rng),
    'locked': [False]*n, 'lockColor': [None]*n,
    'thawAfter': [0]*n, 'frozen': [False]*n,
    'mixer': [False]*n, 'collector': collector,
    'collectorColor': color, 'collectorNeed': need,
    'tags': ['collector'], 'par': 12, 'moveLimit': 28 + need*3 + n_other*4,
  }
  return L, 8

def validate(L, budget, depth):
  path, states, ok = rv.bfs_solve(L, max_states=budget, max_depth=depth)
  if not ok or path is None:
    return None, states
  ok2, msg = rv.replay(L, path)
  if not ok2:
    return None, msg
  return path, states

def budget_for(lid, nc):
  if lid <= 5: return 80_000, 35
  if nc <= 5: return 150_000, 50
  if nc <= 7: return 220_000, 55
  if nc <= 8: return 280_000, 60
  return 320_000, 65

def accept(L, lid, min_sol, path):
  skip = set()
  if any(L.get('collector') or []):
    skip = {i for i,c in enumerate(L['collector']) if c}
  mixed, pre, empty, nc = count_struct(L['flasks'], L['caps'], skip=skip)
  if lid not in COLLECTOR_IDS and lid not in MIXER_IDS:
    if empty < 1: return False, 'empty'
    if pre > (1 if lid <= 5 else 0): return False, f'presolved={pre}'
    if mixed < min_mixed(lid, nc): return False, f'mixed={mixed}'
  if path is not None and len(path) < min_sol and lid > 5:
    return False, f'short={len(path)}'
  if path is not None and len(path) < 3:
    return False, f'short={len(path)}'
  return True, 'ok'

def generate(seed=41707):
  t0 = time.time()
  ck = ROOT / 'scripts' / 'paint_pack_checkpoint_v417.json'
  pack = []
  stats = []
  solutions = {}
  master = random.Random(seed)
  start_lid = 1
  if ck.exists():
    try:
      data = json.loads(ck.read_text())
      pack = data.get('levels') or []
      stats = data.get('stats') or []
      solutions = data.get('solutions') or {}
      if pack:
        start_lid = max(L['id'] for L in pack) + 1
        print(f'RESUME from L{start_lid} ({len(pack)} done)', flush=True)
    except Exception as e:
      print('checkpoint load fail', e, flush=True)

  for lid in range(start_lid, 101):
    ok = False
    last = ''
    best = None  # (L, path, states)
    tries = 30 if lid <= 30 else (16 if lid <= 60 else 12)
    nc_hint = curve(lid)[0]
    budget, depth = budget_for(lid, nc_hint)

    for attempt in range(tries):
      rng = random.Random(master.randrange(1 << 30) ^ (lid * 100003 + attempt * 17))
      if lid in COLLECTOR_IDS:
        L, min_sol = make_collector(lid, rng)
        budget, depth = 500_000, 80
      elif lid in MIXER_IDS:
        L, min_sol = make_mixer(lid, rng)
        budget, depth = 300_000, 60
      else:
        L, min_sol = make_classic(lid, rng)
        nc_hint = len({c for f in L['flasks'] for c in f})
        budget, depth = budget_for(lid, nc_hint)

      # structural pre-filter before expensive BFS
      skip = {i for i,c in enumerate(L.get('collector') or []) if c}
      mixed, pre, empty, nc = count_struct(L['flasks'], L['caps'], skip=skip)
      if lid not in COLLECTOR_IDS and lid not in MIXER_IDS:
        if pre > (1 if lid <= 5 else 0) or mixed < min_mixed(lid, nc) or empty < 1:
          last = f'struct m={mixed} p={pre} e={empty}'
          continue

      path, states = validate(L, budget, depth)
      if path is None:
        last = f'unsolvable/{states}'
        continue
      good, reason = accept(L, lid, min_sol, path)
      if not good:
        last = reason
        if best is None or (path and (best[1] is None or len(path) > len(best[1]))):
          best = (copy.deepcopy(L), path, states)
        continue

      # success
      plen = len(path)
      L['solutionLen'] = plen
      L['states'] = states if isinstance(states, int) else 0
      L['validated'] = True
      L['par'] = max(L.get('par', plen), plen + 2)
      L['moveLimit'] = max(L['moveLimit'], plen + max(8, plen // 2))
      # store hint path (list of [i,j,amt])
      solutions[str(lid)] = {'path': path, 'len': plen, 'method': 'bounded-BFS'}
      L['hintPath'] = [[a[0], a[1], a[2]] for a in path[:3]]  # first 3 for on-path hints lightweight
      pack.append(L)
      skip = {i for i,c in enumerate(L.get('collector') or []) if c}
      mixed, pre, empty, nc = count_struct(L['flasks'], L['caps'], skip=skip)
      stats.append(dict(id=lid, colors=nc, mixed=mixed, presolved=pre, empty=empty,
                        sol=plen, lim=L['moveLimit'], tags=L.get('tags'), goal='collector' if lid in COLLECTOR_IDS else ('mixer' if lid in MIXER_IDS else 'sort')))
      print(f'OK L{lid} col={nc} mixed={mixed} pre={pre} empty={empty} sol={plen} lim={L["moveLimit"]} tags={L.get("tags")} states={states}', flush=True)
      ok = True
      ck.write_text(json.dumps({'levels': pack, 'stats': stats, 'solutions': solutions}))
      break

    if not ok:
      # Relaxed accept of best longer solution, or emergency simplify
      if best and best[1] is not None:
        L, path, states = best
        plen = len(path)
        L['solutionLen'] = plen
        L['states'] = states if isinstance(states, int) else 0
        L['validated'] = True
        L['moveLimit'] = max(L.get('moveLimit', 30), plen + max(8, plen // 2))
        L['par'] = plen + 2
        solutions[str(lid)] = {'path': path, 'len': plen, 'method': 'bounded-BFS-relaxed'}
        L['hintPath'] = [[a[0], a[1], a[2]] for a in path[:3]]
        pack.append(L)
        skip = {i for i,c in enumerate(L.get('collector') or []) if c}
        mixed, pre, empty, nc = count_struct(L['flasks'], L['caps'], skip=skip)
        stats.append(dict(id=lid, colors=nc, mixed=mixed, presolved=pre, empty=empty,
                          sol=plen, lim=L['moveLimit'], tags=L.get('tags'), relaxed=True))
        print(f'RELAX L{lid} sol={plen} last={last} col={nc} mixed={mixed} pre={pre}', flush=True)
        ok = True
        ck.write_text(json.dumps({'levels': pack, 'stats': stats, 'solutions': solutions}))
      else:
        # Emergency: fewer colors, no features
        for attempt in range(60):
          rng = random.Random(master.randrange(1 << 30) ^ (lid * 13 + attempt))
          nc = max(2, nc_hint - 1 - attempt // 20)
          flasks = [[c]*4 for c in COLORS[:nc]] + [[], []]
          caps = [4]*len(flasks)
          flasks = reverse_mix(flasks, caps, 15 + nc*4, rng, min_empty=2)
          n = len(flasks)
          L = {
            'id': lid, 'flasks': flasks, 'caps': caps,
            'hidden': [[False]*len(f) for f in flasks],
            'locked': [False]*n, 'lockColor': [None]*n,
            'thawAfter': [0]*n, 'frozen': [False]*n,
            'mixer': [False]*n, 'collector': [False]*n,
            'collectorColor': None, 'collectorNeed': 0,
            'tags': ['emergency'], 'par': 12, 'moveLimit': 40 + nc*4,
          }
          path, states = validate(L, 300_000, 60)
          if path and len(path) >= 4:
            L['solutionLen'] = len(path)
            L['states'] = states if isinstance(states, int) else 0
            L['validated'] = True
            L['moveLimit'] = max(L['moveLimit'], len(path) + 10)
            solutions[str(lid)] = {'path': path, 'len': len(path), 'method': 'emergency-BFS'}
            L['hintPath'] = [[a[0], a[1], a[2]] for a in path[:3]]
            pack.append(L)
            mixed, pre, empty, nc = count_struct(L['flasks'], L['caps'])
            stats.append(dict(id=lid, colors=nc, mixed=mixed, presolved=pre, empty=empty,
                              sol=len(path), lim=L['moveLimit'], emergency=True))
            print(f'EMERGENCY L{lid} sol={len(path)} col={nc} mixed={mixed}', flush=True)
            ok = True
            ck.write_text(json.dumps({'levels': pack, 'stats': stats, 'solutions': solutions}))
            break
        if not ok:
          print(f'FAIL L{lid} last={last}', flush=True)
          return pack, stats, solutions, False

  payload = {
    'version': '4.1.7',
    'levels': pack,
    'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
  }
  LEVELS_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
  (ROOT / 'scripts' / 'paint_solutions_v417.json').write_text(json.dumps(solutions))
  (ROOT / 'scripts' / 'paint_diff_after_v417.json').write_text(json.dumps(stats, indent=2))
  print(f'TOTAL {len(pack)} in {time.time()-t0:.1f}s', flush=True)
  return pack, stats, solutions, True

if __name__ == '__main__':
  # quick sanity
  rng = random.Random(1)
  L, ms = make_classic(10, rng)
  path, st = validate(L, 200000, 55)
  print('sanity L10', 'sol', None if not path else len(path), 'struct', count_struct(L['flasks'], L['caps']), flush=True)
  pack, stats, sols, ok = generate()
  raise SystemExit(0 if ok else 1)
