#!/usr/bin/env python3
"""Exact BFS matching v4.1.4 engine (safe-cork). Replay solutions. Never replace levels."""
from __future__ import annotations
import json, collections, time, sys
from pathlib import Path

MIX = {
  frozenset(("yellow","blue")): "green",
  frozenset(("red","yellow")): "orange",
  frozenset(("red","blue")): "purple",
}

def top_run(layers, hidden):
  if not layers: return None, 0
  if hidden and hidden[-1]: return None, 0
  c = layers[-1]; n = 0
  for i in range(len(layers)-1, -1, -1):
    if layers[i] != c or (hidden and hidden[i]): break
    n += 1
  return c, n

def flask_complete(layers, hidden, cap, frozen, mixer=False, collector=False):
  if frozen or mixer or collector: return False
  if not layers or len(layers) != cap: return False
  if hidden and any(hidden): return False
  return len(set(layers)) == 1

def can_partition(need, caps_avail):
  if need == 0: return True
  if need < 0: return False
  dp = [False]*(need+1); dp[0]=True
  for c in caps_avail:
    for s in range(need, c-1, -1):
      if dp[s-c]: dp[s]=True
  return dp[need]

def can_safely_cork(fi, layers, hidden, caps, corked, mixer, collector, frozen, coll_color=None):
  if frozen[fi] or mixer[fi] or collector[fi] or corked[fi]: return False
  if not flask_complete(layers[fi], hidden[fi], caps[fi], False): return False
  color = layers[fi][0]
  if coll_color and color == coll_color: return False
  k = caps[fi]
  total = sum(1 for f in layers for c in f if c == color)
  rem = total - k
  if rem == 0: return True
  if rem < 0: return False
  avail = [caps[a] for a in range(len(layers))
           if a != fi and not corked[a] and not mixer[a] and not collector[a]]
  return can_partition(rem, avail)

def can_pour(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, i, j):
  if i == j: return 0
  if locked[i] or locked[j]: return 0
  if thaw[i] > 0 or thaw[j] > 0: return 0
  if corked[i] or corked[j]: return 0
  if collector[i]: return 0
  if not layers[i]: return 0
  color, run = top_run(layers[i], hidden[i])
  if not run: return 0
  if collector[j]:
    if color != coll_color: return 0
    space = caps[j] - len(layers[j])
    return min(run, space) if space > 0 else 0
  if mixer[j]:
    if not layers[j]: return min(run, 1)
    if len(layers[j]) >= 2: return 0
    a = layers[j][-1]
    if a == color: return 0
    return 1 if frozenset((a, color)) in MIX else 0
  space = caps[j] - len(layers[j])
  if space <= 0: return 0
  if hidden[j] and layers[j] and hidden[j][-1]: return 0
  if not layers[j]: return min(run, space)
  if layers[j][-1] != color: return 0
  return min(run, space)

def apply_pour(layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, i, j, amt, coll_color=None):
  nl = [list(x) for x in layers]
  nh = [list(x) for x in hidden]
  lk = list(locked); th = list(thaw); ck = list(corked)
  if mixer[j] and nl[j] and frozenset((nl[j][-1], nl[i][-1])) in MIX:
    poured = nl[i].pop(); nh[i].pop()
    existing = nl[j].pop(); nh[j].pop()
    nl[j].append(MIX[frozenset((existing, poured))]); nh[j].append(False)
  else:
    for _ in range(amt):
      nl[j].append(nl[i].pop())
      if nh[i]: nh[i].pop()
      nh[j].append(False)
  if nl[i] and nh[i] and nh[i][-1]:
    nh[i][-1] = False
  for fi in range(len(nl)):
    if ck[fi]: continue
    if can_safely_cork(fi, nl, nh, caps, ck, mixer, collector, [th[x]>0 for x in range(len(th))], coll_color):
      ck[fi] = True
      color = nl[fi][0]
      for k, lc in enumerate(lock_color):
        if lk[k] and lc == color: lk[k] = False
      for k in range(len(th)):
        if th[k] > 0: th[k] -= 1
  return nl, nh, lk, th, ck

def is_won(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, coll_need):
  if any(collector):
    for i, f in enumerate(layers):
      if collector[i]:
        return len(f) >= coll_need and all(c == coll_color for c in f)
    return False
  for i, f in enumerate(layers):
    if locked[i] or thaw[i] > 0: return False
    if corked[i] or not f: continue
    if mixer[i] or collector[i]:
      if f: return False
      continue
    if not flask_complete(f, hidden[i], caps[i], False):
      return False
  for i, f in enumerate(layers):
    if not f or corked[i] or mixer[i] or collector[i]: continue
    if not can_safely_cork(i, layers, hidden, caps, corked, mixer, collector, [thaw[x]>0 for x in range(len(thaw))], coll_color if any(collector) else None):
      return False
  return True

def norm(layers, hidden, locked, thaw, corked):
  return (tuple(tuple(f) for f in layers), tuple(tuple(h) for h in hidden),
          tuple(locked), tuple(thaw), tuple(corked))

def init_state(L):
  layers = [list(f) for f in L['flasks']]
  n = len(layers)
  caps = list(L.get('caps') or [4]*n)
  while len(caps) < n: caps.append(4)
  hidden = [list(h) for h in (L.get('hidden') or [[] for _ in range(n)])]
  while len(hidden) < n: hidden.append([])
  for i,f in enumerate(layers):
    while len(hidden[i]) < len(f): hidden[i].append(False)
    hidden[i] = hidden[i][:len(f)]
  locked = list(L.get('locked') or [False]*n)
  lock_color = list(L.get('lockColor') or [None]*n)
  thaw = list(L.get('thawAfter') or [0]*n)
  mixer = list(L.get('mixer') or [False]*n)
  collector = list(L.get('collector') or [False]*n)
  while len(locked)<n: locked.append(False)
  while len(lock_color)<n: lock_color.append(None)
  while len(thaw)<n: thaw.append(0)
  while len(mixer)<n: mixer.append(False)
  while len(collector)<n: collector.append(False)
  coll_color = L.get('collectorColor')
  coll_need = L.get('collectorNeed') or 0
  for i,c in enumerate(collector):
    if c and coll_need: caps[i] = coll_need
  corked = [False]*n
  for i in range(n):
    if thaw[i]>0 or mixer[i] or collector[i]: continue
    if can_safely_cork(i, layers, hidden, caps, corked, mixer, collector, [thaw[x]>0 for x in range(n)], coll_color if any(collector) else None):
      corked[i] = True
      color = layers[i][0]
      for k,lc in enumerate(lock_color):
        if locked[k] and lc == color: locked[k] = False
  return layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, coll_color, coll_need

def bfs_solve(L, max_states=500000, max_depth=100):
  layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, coll_color, coll_need = init_state(L)
  n = len(layers)
  start = norm(layers, hidden, locked, thaw, corked)
  if is_won(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, coll_need):
    return [], 0, True
  q = collections.deque([(layers, hidden, locked, thaw, corked, [])])
  seen = {start}
  while q:
    layers, hidden, locked, thaw, corked, path = q.popleft()
    if len(path) > max_depth: continue
    if is_won(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, coll_need):
      return path, len(seen), True
    for i in range(n):
      for j in range(n):
        amt = can_pour(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, i, j)
        if amt <= 0: continue
        nl, nh, lk, th, ck = apply_pour(layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, i, j, amt, coll_color)
        key = norm(nl, nh, lk, th, ck)
        if key in seen: continue
        seen.add(key)
        if len(seen) > max_states:
          return None, len(seen), False
        q.append((nl, nh, lk, th, ck, path+[(i,j,amt)]))
  return None, len(seen), False

def replay(L, path):
  layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, coll_color, coll_need = init_state(L)
  for step, (i,j,amt) in enumerate(path):
    a = can_pour(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, i, j)
    if a <= 0: return False, f'step{step} illegal {(i,j,amt)} got {a}'
    use = min(a, amt)
    layers, hidden, locked, thaw, corked = apply_pour(layers, hidden, caps, locked, lock_color, thaw, corked, mixer, collector, i, j, use, coll_color)[:5]
  if not is_won(layers, hidden, caps, locked, thaw, corked, mixer, collector, coll_color, coll_need):
    return False, 'not won after replay'
  return True, 'ok'

def slack_for(idx, sol):
  if idx < 10: return max(8, int(sol*0.9)+4)
  if idx < 25: return max(6, int(sol*0.55)+3)
  if idx < 50: return max(4, int(sol*0.40)+2)
  if idx < 75: return max(3, int(sol*0.30)+2)
  return max(2, int(sol*0.22)+1)

def main():
  t0=time.time()
  pack=json.loads(Path('www/assets/paint_levels.json').read_text())
  results=[]; fail_ids=[]; timeout_ids=[]
  only = set(int(x) for x in sys.argv[1:]) if len(sys.argv)>1 else None
  for idx,L in enumerate(pack['levels']):
    if only is not None and L['id'] not in only: continue
    print(f"... L{L['id']:03d} tags={L.get('tags')}", flush=True)
    # escalate budgets for hard late levels
    budget = 400000
    depth = 80
    if L['id'] >= 40: budget = 800000; depth = 100
    if L['id'] >= 70: budget = 1200000; depth = 120
    if 'collector' in (L.get('tags') or []): budget = max(budget, 600000)
    path, states, ok = bfs_solve(L, max_states=budget, max_depth=depth)
    if not ok or path is None:
      print(f"TIMEOUT/FAIL L{L['id']} states={states}", flush=True)
      timeout_ids.append(L['id'])
      results.append({'id':L['id'],'ok':False,'sol':None,'lim':L.get('moveLimit'),'states':states,'tags':L.get('tags')})
      continue
    ok2, msg = replay(L, path)
    if not ok2:
      print(f"REPLAY FAIL L{L['id']} {msg}", flush=True)
      fail_ids.append(L['id'])
      results.append({'id':L['id'],'ok':False,'sol':len(path),'replay_fail':msg,'tags':L.get('tags')})
      continue
    sol=len(path)
    lim = L.get('moveLimit') or 0
    if lim < sol:
      L['moveLimit']=sol+slack_for(idx,sol)
      L['par']=sol+max(1,(L['moveLimit']-sol)//2)
      print(f"  bump lim {lim} -> {L['moveLimit']}", flush=True)
    L['solutionLen']=sol; L['states']=states; L['validated']='bfs_engine_v414'
    results.append({'id':L['id'],'ok':True,'sol':sol,'lim':L['moveLimit'],'replay':True,'tags':L.get('tags'),'states':states})
    print(f"L{L['id']:03d} sol={sol:2d} lim={L['moveLimit']:2d} st={states:7d} {L.get('tags')}", flush=True)

  if only is None:
    Path('www/assets/paint_levels.json').write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')))
  summary={'count':len(results),'ok':sum(1 for r in results if r['ok']),'fail':len(fail_ids),'timeout':timeout_ids,
           'approx':0,'method':'bfs_engine_faithful+replay_safe_cork','all_replay_ok':len(fail_ids)==0,
           'limits_ok':all((r.get('lim') or 0)>=(r.get('sol') or 0) for r in results if r.get('ok')),
           'elapsed_s':round(time.time()-t0,1),'levels':results}
  Path('scripts/paint_revalidate_v414.json').write_text(json.dumps(summary,indent=2))
  print('TOTAL', summary['ok'], '/', summary['count'], 'timeout', timeout_ids, 'fail', fail_ids, 'elapsed', summary['elapsed_s'], flush=True)
  if fail_ids or (only is None and timeout_ids):
    sys.exit(1)

if __name__ == '__main__':
  main()
