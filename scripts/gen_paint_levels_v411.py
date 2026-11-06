#!/usr/bin/env python3
"""v4.1.1 — regenerate ~100 levels with thawable frozen flasks. Exact BFS for all."""
from __future__ import annotations
import json, random, collections, time, copy
from pathlib import Path

COLORS = [
  "red","orange","yellow","green","teal","blue",
  "purple","pink","brown","lime","indigo","coral"
]
MIX = {
  frozenset(("yellow","blue")): "green",
  frozenset(("red","yellow")): "orange",
  frozenset(("red","blue")): "purple",
}

def slack_for(idx: int, sol: int) -> int:
  if idx < 10: return max(8, int(sol * 0.9) + 4)
  if idx < 25: return max(6, int(sol * 0.55) + 3)
  if idx < 50: return max(4, int(sol * 0.40) + 2)
  if idx < 75: return max(3, int(sol * 0.30) + 2)
  return max(2, int(sol * 0.22) + 1)

def top_run(f):
  if not f: return None, 0
  c = f[-1]; n = 0
  for x in reversed(f):
    if x != c: break
    n += 1
  return c, n

def flask_full_mono(f, cap):
  return len(f) == cap and len(set(f)) == 1

def is_won(flasks, caps, locked, thaw, mixer):
  for i, f in enumerate(flasks):
    if locked[i]: return False
    if thaw[i] > 0: return False  # still frozen
    if mixer[i]:
      if f: return False
      continue
    if not f: continue
    if not flask_full_mono(f, caps[i]): return False
  return True

def can_pour(flasks, caps, locked, thaw, mixer, i, j):
  if i == j: return 0
  if locked[i] or locked[j]: return 0
  if thaw[i] > 0 or thaw[j] > 0: return 0
  src, dst = flasks[i], flasks[j]
  if not src: return 0
  color, run = top_run(src)
  if not run: return 0
  if mixer[j]:
    if not dst: return min(run, 1)
    if len(dst) >= 2: return 0
    a = dst[-1]
    if a == color: return 0
    return 1 if frozenset((a, color)) in MIX else 0
  if len(dst) >= caps[j]: return 0
  if not dst: return min(run, caps[j] - len(dst))
  if dst[-1] != color: return 0
  return min(run, caps[j] - len(dst))

def apply_pour(flasks, caps, locked, lock_color, thaw, mixer, corked, i, j, amt):
  nf = [list(f) for f in flasks]
  nl = list(locked)
  nt = list(thaw)
  nc = list(corked)
  if mixer[j] and nf[j] and frozenset((nf[j][-1], nf[i][-1])) in MIX:
    poured = nf[i].pop()
    existing = nf[j].pop()
    nf[j].append(MIX[frozenset((existing, poured))])
  else:
    for _ in range(amt):
      nf[j].append(nf[i].pop())

  # newly completed → unlock + thaw tick
  for fi, f in enumerate(nf):
    if nc[fi] or mixer[fi]: continue
    if flask_full_mono(f, caps[fi]):
      nc[fi] = True
      c = f[0]
      for k, lc in enumerate(lock_color):
        if nl[k] and lc == c:
          nl[k] = False
      for k in range(len(nt)):
        if nt[k] > 0:
          nt[k] -= 1
  return nf, nl, nt, nc

def normalize(flasks, locked, thaw, corked):
  return (tuple(tuple(f) for f in flasks), tuple(locked), tuple(thaw), tuple(corked))

def bfs_solve(flasks, caps, locked, lock_color, thaw, mixer,
              max_states=250000, max_depth=90, permanent_freeze=False):
  """If permanent_freeze, thaw never decreases (dead ice) — for 'thaw required' check."""
  corked = [flask_full_mono(f, caps[i]) and thaw[i] == 0 for i, f in enumerate(flasks)]
  thaw0 = list(thaw)
  start = normalize(flasks, locked, thaw0, corked)
  if is_won(flasks, caps, locked, thaw0, mixer):
    return [], 0
  q = collections.deque([(flasks, locked, thaw0, corked, [])])
  seen = {start}
  while q:
    fl, lk, th, ck, path = q.popleft()
    if len(path) > max_depth:
      continue
    if is_won(fl, caps, lk, th, mixer):
      return path, len(seen)
    n = len(fl)
    for i in range(n):
      for j in range(n):
        if i == j: continue
        amt = can_pour(fl, caps, lk, th, mixer, i, j)
        if amt <= 0: continue
        if permanent_freeze:
          nf = [list(f) for f in fl]
          nl = list(lk)
          nt = list(th)  # never thaw
          nc = list(ck)
          if mixer[j] and nf[j] and frozenset((nf[j][-1], nf[i][-1])) in MIX:
            poured = nf[i].pop(); existing = nf[j].pop()
            nf[j].append(MIX[frozenset((existing, poured))])
          else:
            for _ in range(amt): nf[j].append(nf[i].pop())
          for fi, f in enumerate(nf):
            if nc[fi] or mixer[fi]: continue
            if flask_full_mono(f, caps[fi]):
              nc[fi] = True
              c = f[0]
              for k, lc in enumerate(lock_color):
                if nl[k] and lc == c: nl[k] = False
        else:
          nf, nl, nt, nc = apply_pour(fl, caps, lk, lock_color, th, mixer, ck, i, j, amt)
        ns = normalize(nf, nl, nt, nc)
        if ns in seen: continue
        seen.add(ns)
        if len(seen) > max_states:
          return None, len(seen)
        q.append((nf, nl, nt, nc, path + [(i, j)]))
  return None, len(seen)

def scramble(n_colors, n_flasks, empty, seed, n_moves, caps):
  rng = random.Random(seed)
  cols = COLORS[:n_colors]
  flasks = []
  for i, c in enumerate(cols):
    cap = caps[i] if i < len(caps) else 4
    flasks.append([c] * cap)
  while len(flasks) < n_flasks:
    flasks.append([])
  while sum(1 for f in flasks if not f) < empty:
    flasks.append([])
  flasks = flasks[:n_flasks]
  while len(caps) < len(flasks):
    caps.append(4)
  for _ in range(n_moves):
    non_empty = [i for i, f in enumerate(flasks) if f]
    cands = []
    for i in non_empty:
      color, run = top_run(flasks[i])
      for j in range(len(flasks)):
        if i == j or len(flasks[j]) >= caps[j]: continue
        space = caps[j] - len(flasks[j])
        amt = min(run, space)
        if amt <= 0: continue
        score = 2 if (not flasks[j] or flasks[j][-1] != color) else 1
        cands.append((score, i, j, rng.randint(1, amt)))
    if not cands: break
    cands.sort(reverse=True)
    _, i, j, amt = cands[rng.randrange(min(6, len(cands)))]
    for __ in range(amt):
      flasks[j].append(flasks[i].pop())
  return flasks

def make_mixing_level(idx, seed):
  recipes = [
    (("yellow","blue"), "green"),
    (("red","yellow"), "orange"),
    (("red","blue"), "purple"),
  ]
  (a, b), result = recipes[idx % 3]
  flasks = [[a], [b], [result, result, result], [], []]
  caps = [4, 4, 4, 2, 4]
  mixer = [False, False, False, True, False]
  locked = [False]*5
  lock_color = [None]*5
  thaw = [0]*5
  return flasks, caps, locked, lock_color, mixer, thaw, [a,b,result]

def add_hidden(flasks, rng, chance):
  hidden = []
  for f in flasks:
    h = [(li < len(f)-1 and rng.random() < chance) for li in range(len(f))]
    hidden.append(h)
  return hidden

def params(idx):
  if idx < 8: return 3, 5, 2, 8 + idx
  if idx < 15: return 4, 6, 2, 14 + idx
  if idx < 25: return 5, 7, 2, 18 + idx
  if idx < 40: return 6, 8, 2, 22 + idx
  if idx < 55: return 7, 9, 2, 26 + idx
  if idx < 70: return 8, 10, 2, 30 + idx
  if idx < 85: return 9, 11, 2, 34 + idx
  return 10, 12, 2, 38 + idx

def place_required_freeze(flasks, caps, locked, rng, thaw_n):
  """Freeze a flask that holds colors needed to finish; return thaw list or None."""
  n = len(flasks)
  # color totals
  totals = collections.Counter(c for f in flasks for c in f)
  cands = []
  for i, f in enumerate(flasks):
    if not f or locked[i]: continue
    if len(f) == 0: continue
    # score: how critical — for each color in f, outside count vs need
    score = 0
    for c in set(f):
      in_f = f.count(c)
      outside = totals[c] - in_f
      # need at least one full flask of c somewhere → need caps for that color's flask ~4
      # if outside < min cap among color flasks, thaw required
      need = 4
      for j, ff in enumerate(flasks):
        if j == i: continue
        if c in ff: need = caps[j]
      if outside < need and in_f > 0:
        score += (need - outside) + in_f
    if score > 0 and 0 < len(f) <= caps[i]:
      cands.append((score, i))
  if not cands:
    # fallback: any non-empty non-locked non-full
    for i, f in enumerate(flasks):
      if f and not locked[i] and len(f) < caps[i]:
        cands.append((1, i))
  if not cands:
    return None
  cands.sort(reverse=True)
  fi = cands[0][1]
  thaw = [0]*n
  thaw[fi] = thaw_n
  return thaw

def main():
  t0 = time.time()
  levels, stats = [], []
  N = 100
  START_LOCK = 14
  START_VARCAP = 24
  START_MIX = 39
  START_FROZEN = 22  # level 23
  TIMER_LEVELS = {19, 34, 49, 64, 79, 94}

  for want in range(N):
    rng = random.Random(41100 + want * 97)
    is_mix = want >= START_MIX and (want - START_MIX) % 7 == 0
    best = None

    for attempt in range(50):
      seed = 41100 + want * 97 + attempt * 19
      if is_mix:
        flasks, caps, locked, lock_color, mixer, thaw, used_cols = make_mixing_level(want, seed)
        for _ in range(3 + want % 4):
          idxs = [i for i in range(len(flasks)) if not mixer[i] and flasks[i]]
          if not idxs: break
          i = rng.choice(idxs)
          j_cands = [j for j in range(len(flasks)) if j != i and not mixer[j] and len(flasks[j]) < caps[j]]
          if not j_cands: break
          j = rng.choice(j_cands)
          color, run = top_run(flasks[i])
          amt = min(run, caps[j]-len(flasks[j]), 1)
          if amt <= 0: continue
          for __ in range(amt):
            flasks[j].append(flasks[i].pop())
        tags = ["mixing"]
        nc = len(set(c for f in flasks for c in f) | set(used_cols))
      else:
        nc, nf, empty, moves = params(want)
        caps = [4] * nf
        if want >= START_VARCAP:
          for i in range(min(nc, nf - empty)):
            caps[i] = rng.choice([3, 4, 4, 5, 6] if want >= 50 else [3, 4, 4, 5])
        flasks = scramble(nc, nf, empty, seed, moves, list(caps))
        if len(flasks) != len(caps):
          caps = (caps + [4]*len(flasks))[:len(flasks)]
        locked = [False]*len(flasks)
        lock_color = [None]*len(flasks)
        mixer = [False]*len(flasks)
        thaw = [0]*len(flasks)
        tags = []

        if want >= START_LOCK and attempt % 2 == 0:
          color_counts = collections.Counter(c for f in flasks for c in f)
          cands = [i for i,f in enumerate(flasks) if f and len(f) < caps[i]]
          if cands:
            li = rng.choice(cands)
            viable = [c for c,n in color_counts.items() if n >= 3]
            if viable:
              locked[li] = True
              lock_color[li] = rng.choice(viable)
              tags.append("locked")

        if want >= START_FROZEN and not is_mix:
          thaw_n = 1 if want < 35 else (2 if want < 60 else rng.choice([2, 3]))
          # avoid locking same flask
          th = place_required_freeze(flasks, caps, locked, rng, thaw_n)
          if th:
            thaw = th
            tags.append("frozen")

      if sum(1 for f in flasks if not f) < 1 and not any(mixer):
        continue
      if is_won(flasks, caps, locked, thaw, mixer):
        continue

      max_states = 80000 if want < 20 else (160000 if want < 50 else 280000)
      max_depth = 55 if want < 20 else (75 if want < 60 else 95)

      path, states = bfs_solve(flasks, caps, locked, lock_color, thaw, mixer,
                               max_states=max_states, max_depth=max_depth)
      if path is None:
        continue
      sol = len(path)
      if sol < 1: continue
      if want > 3 and sol < 2: continue

      # If frozen: prefer thaw-required. Reject only if clearly solvable with permanent ice.
      if any(tv > 0 for tv in thaw):
        path_dead, st_dead = bfs_solve(flasks, caps, locked, lock_color, thaw, mixer,
                                 max_states=min(40000, max_states), max_depth=min(40, max_depth),
                                 permanent_freeze=True)
        if path_dead is not None:
          continue  # thaw optional — reject

      slack = slack_for(want, sol)
      move_limit = sol + slack
      par = sol + max(1, slack // 2)

      level = {
        "id": want + 1,
        "colors": nc,
        "par": par,
        "moveLimit": move_limit,
        "solutionLen": sol,
        "states": states,
        "validated": "bfs",
        "flasks": flasks,
        "caps": caps,
        "tags": tags,
      }
      if any(locked):
        level["locked"] = locked
        level["lockColor"] = lock_color
      if any(mixer):
        level["mixer"] = mixer
      if any(t > 0 for t in thaw):
        level["frozen"] = [t > 0 for t in thaw]
        level["thawAfter"] = thaw
      if any(c != 4 for c in caps):
        level["tags"] = list(set(level.get("tags", []) + ["varcap"]))
      if want in TIMER_LEVELS:
        level["timeLimit"] = int(45 + sol * 12 + slack * 3)
        level["tags"] = list(set(level.get("tags", []) + ["timer"]))
      if not is_mix and want >= 12:
        level["hidden"] = add_hidden(flasks, rng, 0.28 if want >= 20 else 0.18)

      best = level
      break

    if best is None:
      nc, nf, empty, moves = 3, 5, 2, 10
      caps = [4]*nf
      flasks = scramble(nc, nf, empty, 9100+want, moves, caps)
      locked = [False]*nf; lock_color=[None]*nf; mixer=[False]*nf; thaw=[0]*nf
      path, states = bfs_solve(flasks, caps, locked, lock_color, thaw, mixer, max_states=200000, max_depth=60)
      if path is None:
        raise SystemExit(f"FAILED level {want+1}")
      sol = len(path)
      slack = slack_for(want, sol)
      best = {
        "id": want+1, "colors": nc, "par": sol+max(1,slack//2),
        "moveLimit": sol+slack, "solutionLen": sol, "states": states,
        "validated": "bfs", "flasks": flasks, "caps": caps, "tags": ["fallback"]
      }
      print(f"WARN L{want+1} used fallback", flush=True)

    levels.append(best)
    stats.append({
      "id": best["id"], "sol": best["solutionLen"], "limit": best["moveLimit"],
      "par": best["par"], "states": best["states"], "validated": best["validated"],
      "tags": best.get("tags", []), "time": best.get("timeLimit"),
      "thaw": best.get("thawAfter"), "frozen": "frozen" in best.get("tags", [])
    })
    print(f"L{best['id']:03d} sol={best['solutionLen']:2d} lim={best['moveLimit']:2d} st={best['states']:6d} {best.get('tags',[])} thaw={best.get('thawAfter')}", flush=True)

  out = {
    "capacity": 4,
    "colors": COLORS,
    "mix": {"yellow+blue":"green","red+yellow":"orange","red+blue":"purple"},
    "mechanics": {
      "moveLimit": 1,
      "lockedKey": START_LOCK+1,
      "frozenThaw": START_FROZEN+1,
      "varCap": START_VARCAP+1,
      "timer": sorted(x+1 for x in TIMER_LEVELS),
      "mixing": START_MIX+1
    },
    "levels": levels
  }
  Path("/workspace/farm-3d/www/assets/paint_levels.json").write_text(
    json.dumps(out, ensure_ascii=False, separators=(",", ":")))
  Path("/workspace/farm-3d/scripts/paint_level_stats_v411.json").write_text(
    json.dumps({
      "count": len(levels),
      "all_bfs": all(s["validated"]=="bfs" for s in stats),
      "bfs": sum(1 for s in stats if s["validated"]=="bfs"),
      "approx": 0,
      "with_frozen": sum(1 for s in stats if s.get("frozen")),
      "with_timer": sum(1 for s in stats if s.get("time")),
      "limits_ok": all(s["limit"] >= s["sol"] for s in stats),
      "levels": stats,
      "elapsed_s": round(time.time()-t0, 1)
    }, ensure_ascii=False, indent=2))
  print("TOTAL", len(levels), "all_bfs", all(s['validated']=='bfs' for s in stats),
        "limits_ok", all(s['limit']>=s['sol'] for s in stats),
        "frozen", sum(1 for s in stats if s.get('frozen')),
        "elapsed", round(time.time()-t0,1))

if __name__ == "__main__":
  main()
