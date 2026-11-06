#!/usr/bin/env python3
"""Generate exact-BFS collector levels and splice into paint_levels.json at cadence slots."""
from __future__ import annotations
import json, random, collections, time, copy
from pathlib import Path

COLORS = [
  "red","orange","yellow","green","teal","blue",
  "purple","pink","brown","lime","indigo","coral"
]

# Collector slots: 12,22,...,92 (1-based); skip multiples of 5 (bosses) — none of these are %5==0
COLLECTOR_IDS = list(range(12, 100, 10))  # 12,22,32,42,52,62,72,82,92

def top_run(f):
  if not f: return None, 0
  c = f[-1]; n = 0
  for x in reversed(f):
    if x != c: break
    n += 1
  return c, n

def can_pour(flasks, caps, locked, thaw, mixer, collector, coll_color, i, j):
  if i == j: return 0
  if locked[i] or locked[j]: return 0
  if thaw[i] > 0 or thaw[j] > 0: return 0
  if collector[i]: return 0  # cannot pour OUT of collector
  src, dst = flasks[i], flasks[j]
  if not src: return 0
  color, run = top_run(src)
  if not run: return 0
  if collector[j]:
    if color != coll_color: return 0
    space = caps[j] - len(dst)
    if space <= 0: return 0
    return min(run, space)
  if mixer[j]:
    if not dst: return min(run, 1)
    if len(dst) >= 2: return 0
    a = dst[-1]
    if a == color: return 0
    MIX = {frozenset(("yellow","blue")), frozenset(("red","yellow")), frozenset(("red","blue"))}
    return 1 if frozenset((a, color)) in MIX else 0
  if len(dst) >= caps[j]: return 0
  if not dst: return min(run, caps[j] - len(dst))
  if dst[-1] != color: return 0
  return min(run, caps[j] - len(dst))

def apply_pour(flasks, caps, i, j, amt, mixer=None):
  MIX = {
    frozenset(("yellow","blue")): "green",
    frozenset(("red","yellow")): "orange",
    frozenset(("red","blue")): "purple",
  }
  nf = [list(f) for f in flasks]
  mixer = mixer or [False]*len(flasks)
  if mixer[j] and nf[j] and frozenset((nf[j][-1], nf[i][-1])) in MIX:
    poured = nf[i].pop(); existing = nf[j].pop()
    nf[j].append(MIX[frozenset((existing, poured))])
  else:
    for _ in range(amt):
      nf[j].append(nf[i].pop())
  return nf

def is_won_collector(flasks, caps, collector, coll_color, need):
  for i, f in enumerate(flasks):
    if collector[i]:
      return len(f) >= need and all(c == coll_color for c in f)
  return False

def bfs_collector(flasks, caps, locked, thaw, mixer, collector, coll_color, need,
                  max_states=200000, max_depth=60):
  start = (tuple(tuple(f) for f in flasks),)
  if is_won_collector(flasks, caps, collector, coll_color, need):
    return [], 0
  q = collections.deque([(flasks, [])])
  seen = {tuple(tuple(f) for f in flasks)}
  while q:
    fl, path = q.popleft()
    if len(path) > max_depth: continue
    if is_won_collector(fl, caps, collector, coll_color, need):
      return path, len(seen)
    n = len(fl)
    for i in range(n):
      for j in range(n):
        amt = can_pour(fl, caps, locked, thaw, mixer, collector, coll_color, i, j)
        if amt <= 0: continue
        nf = apply_pour(fl, caps, i, j, amt, mixer)
        key = tuple(tuple(f) for f in nf)
        if key in seen: continue
        seen.add(key)
        if len(seen) > max_states:
          return None, len(seen)
        q.append((nf, path + [(i, j)]))
  return None, len(seen)

def slack_for(idx, sol):
  if idx < 25: return max(6, int(sol * 0.55) + 3)
  if idx < 50: return max(4, int(sol * 0.40) + 2)
  if idx < 75: return max(3, int(sol * 0.30) + 2)
  return max(2, int(sol * 0.22) + 1)

def make_collector(level_id, seed):
  rng = random.Random(seed)
  # capacity grows later
  if level_id < 40: need = 6
  elif level_id < 70: need = 6 if rng.random() < 0.5 else 8
  else: need = rng.choice([6, 8, 10])
  color = COLORS[(level_id * 7 + 3) % len(COLORS)]
  # Side flasks: distribute exactly `need` units of target + some distractors + empties
  n_side = 5 if need <= 6 else 6
  # Build segments of target split across flasks
  parts = []
  rem = need
  while rem > 0:
    chunk = min(rem, rng.randint(1, 3))
    parts.append([color] * chunk)
    rem -= chunk
  # distractor colors
  others = [c for c in COLORS if c != color][:3]
  distractors = []
  for c in others:
    distractors.append([c] * rng.randint(1, 2))
  # Assemble side flasks: MUST keep all target parts, then distractors/empties
  side_slots = n_side  # non-collector count
  side = list(parts)  # all target chunks first
  # merge tiny parts if too many slots
  while len(side) > side_slots - 1:  # leave room for ≥1 empty/distractor
    side.sort(key=len)
    a = side.pop(0); b = side.pop(0)
    merged = (a + b)[:4]
    spill = (a + b)[4:]
    side.append(merged)
    if spill:
      side.append(spill[:4])
  for d in distractors:
    if len(side) >= side_slots - 1:
      break
    side.append(d[:4])
  while len(side) < side_slots - 1:
    side.append([])
  side.append([])  # guaranteed empty
  side = side[:side_slots]
  rng.shuffle(side)
  flasks = [f[:4] for f in side] + [[]]  # last is collector
  caps = [4] * (len(flasks) - 1) + [need]
  collector = [False] * (len(flasks) - 1) + [True]
  locked = [False] * len(flasks)
  thaw = [0] * len(flasks)
  mixer = [False] * len(flasks)
  # Verify before scramble
  total = sum(f.count(color) for f in flasks)
  if total != need:
    return None
  # Light scramble among non-collector (conserves colors)
  for _ in range(4 + level_id % 5):
    idxs = [i for i, f in enumerate(flasks) if f and not collector[i]]
    if not idxs: break
    i = rng.choice(idxs)
    jc = [j for j in range(len(flasks)) if j != i and not collector[j] and len(flasks[j]) < caps[j]]
    if not jc: break
    j = rng.choice(jc)
    c, run = top_run(flasks[i])
    amt = min(run, caps[j] - len(flasks[j]), 1)
    if amt <= 0: continue
    for __ in range(amt):
      flasks[j].append(flasks[i].pop())
  total = sum(f.count(color) for f in flasks)
  if total != need:
    return None
  return flasks, caps, collector, color, need, locked, thaw, mixer

def main():
  t0 = time.time()
  pack = json.loads(Path('www/assets/paint_levels.json').read_text())
  levels = pack['levels']
  assert len(levels) == 100
  stats = []
  for lid in COLLECTOR_IDS:
    idx = lid - 1
    best = None
    for attempt in range(60):
      seed = 41200 + lid * 91 + attempt * 17
      made = make_collector(lid, seed)
      if not made: continue
      flasks, caps, collector, color, need, locked, thaw, mixer = made
      if is_won_collector(flasks, caps, collector, color, need):
        continue
      path, states = bfs_collector(flasks, caps, locked, thaw, mixer, collector, color, need)
      if path is None:
        continue
      sol = len(path)
      if sol < 3: continue
      slack = slack_for(idx, sol)
      level = {
        "id": lid,
        "colors": len({c for f in flasks for c in f}),
        "par": sol + max(1, slack // 2),
        "moveLimit": sol + slack,
        "solutionLen": sol,
        "states": states,
        "validated": "bfs",
        "flasks": flasks,
        "caps": caps,
        "tags": ["collector"],
        "collector": collector,
        "collectorColor": color,
        "collectorNeed": need,
      }
      # Preserve timer if this slot had timer?  None of 12..92 step 10 are timer slots (20,35,...)
      best = level
      break
    if best is None:
      raise SystemExit(f'failed collector L{lid}')
    # Keep unrelated fields from old level? Replace entirely.
    levels[idx] = best
    stats.append({"id": lid, "sol": best["solutionLen"], "lim": best["moveLimit"],
                  "color": best["collectorColor"], "need": best["collectorNeed"],
                  "states": best["states"]})
    print(f"L{lid:03d} collector {best['collectorColor']} {best['collectorNeed']} sol={best['solutionLen']} lim={best['moveLimit']} st={best['states']}")

  pack['levels'] = levels
  pack['mechanics'] = dict(pack.get('mechanics') or {})
  pack['mechanics']['collector'] = COLLECTOR_IDS
  pack['mechanics']['collectorFirst'] = COLLECTOR_IDS[0]
  Path('www/assets/paint_levels.json').write_text(
    json.dumps(pack, ensure_ascii=False, separators=(',', ':')))
  Path('scripts/collector_stats_v412.json').write_text(
    json.dumps({"count": len(stats), "ids": COLLECTOR_IDS, "levels": stats,
                "elapsed_s": round(time.time()-t0, 2)}, indent=2))
  print('DONE collectors', len(stats), 'elapsed', round(time.time()-t0, 2))

if __name__ == '__main__':
  main()
