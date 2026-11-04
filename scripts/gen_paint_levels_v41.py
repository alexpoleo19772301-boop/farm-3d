#!/usr/bin/env python3
"""Generate ~100 paint-sort levels with move limits, locks, caps, timers, mixing.
Every level validated by exact BFS (no approx)."""
from __future__ import annotations
import json, random, collections, time
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
  """Moves above optimum; generous early, tight later. moveLimit = sol + slack."""
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

def flask_complete(f, cap):
  return len(f) == 0 or (len(f) == cap and len(set(f)) == 1)

def is_won(flasks, caps, locked):
  for i, f in enumerate(flasks):
    if locked[i]: return False
    if not flask_complete(f, caps[i]): return False
  return True

def can_pour(flasks, caps, locked, mixer, i, j):
  if i == j: return 0
  if locked[i] or locked[j]: return 0
  src, dst = flasks[i], flasks[j]
  if not src: return 0
  cap_j = caps[j]
  color, run = top_run(src)
  if not run: return 0

  # Mixing flask: special rules
  if mixer[j]:
    if not dst:
      return min(run, 1)  # take one segment into empty mixer
    if len(dst) >= 2: return 0
    # one color already in mixer — try recipe
    a = dst[-1]
    if a == color: return 0  # same color doesn't mix
    if frozenset((a, color)) in MIX:
      return 1  # pour one unit to trigger mix
    return 0

  if mixer[i]:
    # pouring OUT of mixer — treat as normal color flask
    pass

  if len(dst) >= cap_j: return 0
  if not dst: return min(run, cap_j - len(dst))
  if dst[-1] != color: return 0
  return min(run, cap_j - len(dst))

def apply_pour(flasks, caps, locked, lock_color, mixer, i, j, amt):
  nf = [list(f) for f in flasks]
  nl = list(locked)
  # mixing destination
  if mixer[j] and nf[j] and frozenset((nf[j][-1], nf[i][-1])) in MIX:
    # pop one from src, replace mixer contents with result
    nf[i].pop()
    a = nf[j].pop()
    # a was already out; result
    # We need the color being poured:
    # actually amt==1 and we popped from src above... wait we need color before pop
    # redo carefully
    nf = [list(f) for f in flasks]
    poured = nf[i].pop()
    existing = nf[j].pop()
    result = MIX[frozenset((existing, poured))]
    nf[j].append(result)
  else:
    for _ in range(amt):
      nf[j].append(nf[i].pop())

  # complete → cork conceptually (remove from play by marking complete via full mono)
  # unlock locks of matching color
  for fi, f in enumerate(nf):
    if flask_complete(f, caps[fi]) and len(f) == caps[fi]:
      c = f[0]
      for k, lc in enumerate(lock_color):
        if nl[k] and lc == c:
          nl[k] = False
  return nf, nl

def normalize(flasks, locked):
  return (tuple(tuple(f) for f in flasks), tuple(locked))

def bfs_solve(flasks, caps, locked, lock_color, mixer, max_states=250000, max_depth=80):
  start = normalize(flasks, locked)
  if is_won(flasks, caps, locked):
    return [], 0
  q = collections.deque([(flasks, locked, [])])
  seen = {start}
  while q:
    fl, lk, path = q.popleft()
    if len(path) > max_depth:
      continue
    if is_won(fl, caps, lk):
      return path, len(seen)
    n = len(fl)
    for i in range(n):
      for j in range(n):
        if i == j: continue
        amt = can_pour(fl, caps, lk, mixer, i, j)
        if amt <= 0: continue
        nf, nl = apply_pour(fl, caps, lk, lock_color, mixer, i, j, amt)
        ns = normalize(nf, nl)
        if ns in seen: continue
        seen.add(ns)
        if len(seen) > max_states:
          return None, len(seen)
        q.append((nf, nl, path + [(i, j)]))
  return None, len(seen)

def scramble(n_colors, n_flasks, empty, seed, n_moves, caps):
  rng = random.Random(seed)
  cols = COLORS[:n_colors]
  # build solved: each color fills one flask to its cap (use first n_colors flasks)
  flasks = []
  for i, c in enumerate(cols):
    cap = caps[i] if i < len(caps) else 4
    flasks.append([c] * cap)
  while len(flasks) < n_flasks:
    flasks.append([])
  # ensure empties
  while sum(1 for f in flasks if not f) < empty:
    flasks.append([])
  # trim to n_flasks
  flasks = flasks[:n_flasks]
  # pad caps
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
  """Small mixing puzzle: provide ingredients + mixer + empties; goal sort including mixed color."""
  rng = random.Random(seed)
  # Recipe pick
  recipes = [
    (("yellow","blue"), "green"),
    (("red","yellow"), "orange"),
    (("red","blue"), "purple"),
  ]
  (a, b), result = recipes[idx % 3]
  # Provide 2 of a, 2 of b in separate flasks (cap 4), one mixer, empties, and maybe one extra color
  flasks = [
    [a, a],
    [b, b],
    [],  # mixer will be marked
    [],
  ]
  caps = [4, 4, 2, 4]  # mixer cap 2
  mixer = [False, False, True, False]
  locked = [False]*4
  lock_color = [None]*4
  # Need enough of a and b to make 4 greens? For simplicity: make 2 of result needed in a cap-2 or cap-4 flask
  # Actually for win: all non-empty flasks full mono. So if we mix twice we get 2 result segments — put in one flask of cap 2.
  # Simpler early mixing: mix once into result, then place result into its flask with more result segments already present.
  # Even simpler tutorial: 1 mix creates green; also have 3 greens elsewhere → fill a cap-4 green flask.
  flasks = [
    [a],
    [b],
    [result, result, result],  # need one more result from mix
    [],  # mixer
    [],
  ]
  caps = [4, 4, 4, 2, 4]
  mixer = [False, False, False, True, False]
  locked = [False]*5
  lock_color = [None]*5
  return flasks, caps, locked, lock_color, mixer, [a,b,result]

def add_hidden(flasks, rng, chance):
  hidden = []
  for f in flasks:
    h = [(li < len(f)-1 and rng.random() < chance) for li in range(len(f))]
    hidden.append(h)
  return hidden

def params(idx):
  # returns n_colors, n_flasks, empty, scramble_moves
  if idx < 8: return 3, 5, 2, 8 + idx
  if idx < 15: return 4, 6, 2, 14 + idx
  if idx < 25: return 5, 7, 2, 18 + idx
  if idx < 40: return 6, 8, 2, 22 + idx
  if idx < 55: return 7, 9, 2, 26 + idx
  if idx < 70: return 8, 10, 2, 30 + idx
  if idx < 85: return 9, 11, 2, 34 + idx
  return 10, 12, 2, 38 + idx

def main():
  t0 = time.time()
  levels, stats = [], []
  N = 100
  # Mechanic start indices (0-based)
  START_LOCK = 14      # level 15
  START_VARCAP = 24    # level 25
  START_MIX = 39       # level 40
  TIMER_LEVELS = {19, 34, 49, 64, 79, 94}  # level 20,35,50,...

  for want in range(N):
    rng = random.Random(41000 + want * 97)
    is_mix = want >= START_MIX and (want - START_MIX) % 7 == 0
    best = None

    for attempt in range(40):
      seed = 41000 + want * 97 + attempt * 19

      if is_mix:
        flasks, caps, locked, lock_color, mixer, used_cols = make_mixing_level(want, seed)
        # light scramble of non-mixer flasks only via a few reverse pours among non-mixers
        for _ in range(3 + want % 4):
          idxs = [i for i in range(len(flasks)) if not mixer[i] and flasks[i]]
          if len(idxs) < 1: break
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
          # assign some caps 3/5/6
          for i in range(min(nc, nf - empty)):
            caps[i] = rng.choice([3, 4, 4, 5, 6] if want >= 50 else [3, 4, 4, 5])
          # empties stay 4
        flasks = scramble(nc, nf, empty, seed, moves, list(caps))
        if len(flasks) != len(caps):
          caps = (caps + [4]*len(flasks))[:len(flasks)]
        locked = [False]*len(flasks)
        lock_color = [None]*len(flasks)
        mixer = [False]*len(flasks)
        tags = []

        if want >= START_LOCK and attempt % 2 == 0:
          # pick a color that appears as a full potential complete, lock a non-empty flask
          color_counts = collections.Counter(c for f in flasks for c in f)
          # lock one flask; unlock by completing another color that has enough segments
          cands = [i for i,f in enumerate(flasks) if f and len(f) < caps[i]]
          if cands:
            li = rng.choice(cands)
            # lock color = a color with at least `cap` segments somewhere so it's completable
            viable = [c for c,n in color_counts.items() if n >= 3]
            if viable:
              locked[li] = True
              lock_color[li] = rng.choice(viable)
              tags.append("locked")

      if sum(1 for f in flasks if not f) < 1 and not any(mixer):
        continue
      if is_won(flasks, caps, locked):
        continue

      max_states = 80000 if want < 20 else (150000 if want < 50 else 250000)
      max_depth = 50 if want < 20 else (70 if want < 60 else 90)
      path, states = bfs_solve(flasks, caps, locked, lock_color, mixer,
                               max_states=max_states, max_depth=max_depth)
      if path is None:
        continue
      sol = len(path)
      if sol < 1: continue
      if want > 3 and sol < 2: continue
      slack = slack_for(want, sol)
      move_limit = sol + slack
      par = sol + max(1, slack // 2)  # 3★ threshold ~ mid slack

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
      if any(c != 4 for c in caps):
        level["tags"] = list(set(tags + ["varcap"]))
      if want in TIMER_LEVELS:
        # generous: ~12s per expected move + 45
        level["timeLimit"] = int(45 + sol * 12 + slack * 3)
        level["tags"] = list(set(level.get("tags", []) + ["timer"]))
      # hidden/frozen for mid levels (not on mixing)
      if not is_mix and want >= 12:
        level["hidden"] = add_hidden(flasks, rng, 0.28 if want >= 20 else 0.18)
      if not is_mix and want >= 22:
        cands = [i for i,f in enumerate(flasks) if 0 < len(f) < caps[i] and not locked[i]]
        if cands:
          fr = [False]*len(flasks)
          fr[rng.choice(cands)] = True
          level["frozen"] = fr

      best = level
      break

    if best is None:
      # fallback: simpler classic level
      nc, nf, empty, moves = 3, 5, 2, 10
      caps = [4]*nf
      flasks = scramble(nc, nf, empty, 9000+want, moves, caps)
      locked = [False]*nf; lock_color=[None]*nf; mixer=[False]*nf
      path, states = bfs_solve(flasks, caps, locked, lock_color, mixer, max_states=200000, max_depth=60)
      if path is None:
        raise SystemExit(f"FAILED level {want+1}")
      sol = len(path)
      slack = slack_for(want, sol)
      best = {
        "id": want+1, "colors": nc, "par": sol+max(1,slack//2),
        "moveLimit": sol+slack, "solutionLen": sol, "states": states,
        "validated": "bfs", "flasks": flasks, "caps": caps, "tags": ["fallback"]
      }
      print(f"WARN L{want+1} used fallback")

    levels.append(best)
    stats.append({
      "id": best["id"], "sol": best["solutionLen"], "limit": best["moveLimit"],
      "par": best["par"], "states": best["states"], "validated": best["validated"],
      "tags": best.get("tags", []), "time": best.get("timeLimit"),
      "caps": best.get("caps"), "locked": "locked" in best, "mixer": "mixer" in best
    })
    print(f"L{best['id']:03d} sol={best['solutionLen']:2d} lim={best['moveLimit']:2d} st={best['states']:6d} {best.get('tags',[])}")

  out = {
    "capacity": 4,
    "colors": COLORS,
    "mix": {"yellow+blue":"green","red+yellow":"orange","red+blue":"purple"},
    "mechanics": {
      "moveLimit": 1,
      "lockedKey": START_LOCK+1,
      "varCap": START_VARCAP+1,
      "timer": sorted(x+1 for x in TIMER_LEVELS),
      "mixing": START_MIX+1
    },
    "levels": levels
  }
  Path("/workspace/farm-3d/www/assets/paint_levels.json").write_text(
    json.dumps(out, ensure_ascii=False, separators=(",", ":")))
  Path("/workspace/farm-3d/scripts/paint_level_stats_v41.json").write_text(
    json.dumps({
      "count": len(levels),
      "all_bfs": all(s["validated"]=="bfs" for s in stats),
      "bfs": sum(1 for s in stats if s["validated"]=="bfs"),
      "approx": 0,
      "with_timer": sum(1 for s in stats if s.get("time")),
      "with_lock": sum(1 for s in stats if s.get("locked")),
      "with_mixer": sum(1 for s in stats if s.get("mixer")),
      "with_varcap": sum(1 for s in stats if s.get("caps") and any(c!=4 for c in s["caps"])),
      "limits_ok": all(s["limit"] >= s["sol"] for s in stats),
      "levels": stats,
      "elapsed_s": round(time.time()-t0, 1)
    }, ensure_ascii=False, indent=2))
  print("TOTAL", len(levels), "all_bfs", all(s['validated']=='bfs' for s in stats),
        "limits_ok", all(s['limit']>=s['sol'] for s in stats),
        "elapsed", round(time.time()-t0,1))

if __name__ == "__main__":
  main()
