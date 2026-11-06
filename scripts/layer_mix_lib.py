#!/usr/bin/env python3
"""Layer-recipe mixer engine (v4.3.0). Mixers keep product layers; pending = first ingredient."""
from __future__ import annotations
import collections, copy, itertools, random
from typing import List, Optional, Tuple

MIX = {
  frozenset(("yellow", "blue")): "green",
  frozenset(("red", "yellow")): "orange",
  frozenset(("red", "blue")): "purple",
}
ING = {
  "green": ("yellow", "blue"),
  "orange": ("red", "yellow"),
  "purple": ("red", "blue"),
}
PRODUCTS = ["green", "orange", "purple"]
CAP = 4

def ingredients_for(product: str):
  return ING[product]

def mix_result(a, b):
  return MIX.get(frozenset((a, b)))

def top_color(layers, hidden=None):
  if not layers: return None
  if hidden and hidden[-1]: return None
  return layers[-1]

def top_run(layers, hidden=None):
  c = top_color(layers, hidden)
  if not c: return None, 0
  n = 0
  for i in range(len(layers)-1, -1, -1):
    if layers[i] != c or (hidden and hidden[i]): break
    n += 1
  return c, n

def needed_ingredients(recipes, layers_done, pendings):
  """Count remaining ingredient units still required (pending counts as already placed)."""
  need = collections.Counter()
  for mi, recipe in enumerate(recipes):
    if not recipe: continue
    done = len(layers_done[mi])
    pend = pendings[mi]
    for li in range(done, len(recipe)):
      a, b = ING[recipe[li]]
      if li == done and pend:
        other = b if pend == a else a
        if pend not in (a, b):
          # corrupt pending — require full pair again
          need[a] += 1; need[b] += 1
        else:
          need[other] += 1
      else:
        need[a] += 1; need[b] += 1
  return need

def can_safely_cork(fi, layers, hidden, caps, corked, is_mixer, is_coll, recipes, pendings, frozen=None):
  if is_mixer[fi] or is_coll[fi] or corked[fi]: return False
  if frozen and frozen[fi]: return False
  f = layers[fi]
  if not f or len(f) != caps[fi]: return False
  if hidden and any(hidden[fi]): return False
  if len(set(f)) != 1: return False
  color = f[0]
  # reserve recipe ingredients
  need = needed_ingredients(recipes, [layers[i] if is_mixer[i] else [] for i in range(len(layers))], pendings)
  # available of color including this flask
  total = sum(1 for ff in layers for c in ff if c == color)
  total += sum(1 for p in pendings if p == color)
  rem_need = need[color]
  # after corking, rem units = total - caps[fi] must still cover rem_need
  if total - caps[fi] < rem_need:
    return False
  rem = total - caps[fi]
  if rem == 0: return True
  if rem < 0: return False
  avail = [caps[a] for a in range(len(layers))
           if a != fi and not corked[a] and not is_mixer[a] and not is_coll[a]]
  # partition check
  if rem == 0: return True
  dp = [False]*(rem+1); dp[0]=True
  for c in avail:
    for s in range(rem, c-1, -1):
      if dp[s-c]: dp[s]=True
  return dp[rem]

def can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, locked=None, thaw=None, filters=None):
  if i == j: return 0
  if locked and (locked[i] or locked[j]): return 0
  if thaw and (thaw[i] > 0 or thaw[j] > 0): return 0
  if corked[i] or corked[j]: return 0
  if is_mixer[i]: return 0  # never pour out of recipe mixer
  if not layers[i]: return 0
  color, run = top_run(layers[i], hidden[i] if hidden else None)
  if not run: return 0

  if is_mixer[j] and recipes[j]:
    recipe = recipes[j]
    done = len(layers[j])
    if done >= len(recipe): return 0
    want = recipe[done]
    a, b = ING[want]
    pend = pendings[j]
    if pend is None:
      if color not in (a, b): return 0
      return 1
    # second ingredient
    if color == pend: return 0
    if mix_result(pend, color) != want: return 0
    return 1

  # ordinary
  if filters and filters[j] and color != filters[j]:
    return 0
  space = caps[j] - len(layers[j])
  if space <= 0: return 0
  if hidden and layers[j] and hidden[j] and hidden[j][-1]: return 0
  if not layers[j]: return min(run, space)
  if layers[j][-1] != color: return 0
  return min(run, space)

def apply_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, amt, locked=None, lock_color=None, thaw=None):
  nl = [list(x) for x in layers]
  nh = [list(x) for x in (hidden or [[] for _ in layers])]
  for k in range(len(nl)):
    while len(nh[k]) < len(nl[k]): nh[k].append(False)
  ck = list(corked)
  pend = list(pendings)
  lk = list(locked) if locked is not None else [False]*len(nl)
  th = list(thaw) if thaw is not None else [0]*len(nl)

  if is_mixer[j] and recipes[j]:
    # always 1 unit
    poured = nl[i].pop()
    if nh[i]: nh[i].pop()
    want = recipes[j][len(nl[j])]
    if pend[j] is None:
      pend[j] = poured
    else:
      prod = mix_result(pend[j], poured)
      assert prod == want, (pend[j], poured, want, prod)
      nl[j].append(prod)
      nh[j].append(False)
      pend[j] = None
  else:
    for _ in range(amt):
      nl[j].append(nl[i].pop())
      if nh[i]: nh[i].pop()
      nh[j].append(False)

  if nl[i] and nh[i] and nh[i][-1]:
    nh[i][-1] = False

  # auto-cork
  for fi in range(len(nl)):
    if ck[fi]: continue
    if can_safely_cork(fi, nl, nh, caps, ck, is_mixer, [False]*len(nl), recipes, pend, [th[x]>0 for x in range(len(th))]):
      ck[fi] = True
      color = nl[fi][0]
      if lock_color:
        for k, lc in enumerate(lock_color):
          if lk[k] and lc == color: lk[k] = False
      for k in range(len(th)):
        if th[k] > 0: th[k] -= 1
  return nl, nh, ck, pend, lk, th

def is_won(layers, corked, is_mixer, recipes, pendings):
  for i, recipe in enumerate(recipes):
    if not recipe: continue
    if pendings[i] is not None: return False
    if layers[i] != list(recipe): return False
  for i, f in enumerate(layers):
    if is_mixer[i]: continue
    if corked[i] or not f: continue
    # must be complete mono full
    if len(f) != 4 or len(set(f)) != 1: return False
    if not corked[i]: return False
  return True

def state_key(layers, corked, pendings, hidden=None, locked=None, thaw=None):
  return (tuple(tuple(f) for f in layers), tuple(corked), tuple(pendings),
          tuple(tuple(h) for h in (hidden or [])),
          tuple(locked or []), tuple(thaw or []))

def bfs_solve(L, max_states=250000, max_depth=80):
  layers = [list(f) for f in L['flasks']]
  n = len(layers)
  caps = list(L.get('caps') or [CAP]*n)
  while len(caps)<n: caps.append(CAP)
  hidden = [list(h) for h in (L.get('hidden') or [[] for _ in range(n)])]
  while len(hidden)<n: hidden.append([])
  for i,f in enumerate(layers):
    while len(hidden[i])<len(f): hidden[i].append(False)
    hidden[i]=hidden[i][:len(f)]
  corked = [False]*n
  is_mixer = list(L.get('mixer') or [False]*n)
  while len(is_mixer)<n: is_mixer.append(False)
  recipes = list(L.get('mixRecipe') or [None]*n)
  while len(recipes)<n: recipes.append(None)
  recipes = [list(r) if r else None for r in recipes]
  pendings = [None]*n
  locked = list(L.get('locked') or [False]*n)
  lock_color = list(L.get('lockColor') or [None]*n)
  thaw = list(L.get('thawAfter') or L.get('thaw') or [0]*n)
  filters = list(L.get('filterColor') or [None]*n)
  while len(locked)<n: locked.append(False)
  while len(lock_color)<n: lock_color.append(None)
  while len(thaw)<n: thaw.append(0)
  while len(filters)<n: filters.append(None)

  # pre-cork safe
  for fi in range(n):
    if can_safely_cork(fi, layers, hidden, caps, corked, is_mixer, [False]*n, recipes, pendings, [thaw[x]>0 for x in range(n)]):
      corked[fi]=True

  start = state_key(layers, corked, pendings, hidden, locked, thaw)
  if is_won(layers, corked, is_mixer, recipes, pendings):
    return [], 0, True

  q = collections.deque([(layers, hidden, corked, pendings, locked, thaw, [])])
  seen = {start}
  states = 0
  while q:
    layers, hidden, corked, pendings, locked, thaw, path = q.popleft()
    if len(path) > max_depth: continue
    states += 1
    if states > max_states: return None, states, False
    for i in range(n):
      for j in range(n):
        amt = can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, locked, thaw, filters)
        if amt <= 0: continue
        nl, nh, ck, pend, lk, th = apply_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, amt, locked, lock_color, thaw)
        key = state_key(nl, ck, pend, nh, lk, th)
        if key in seen: continue
        seen.add(key)
        npath = path + [(i,j,amt)]
        if is_won(nl, ck, is_mixer, recipes, pend):
          return npath, states, True
        q.append((nl, nh, ck, pend, lk, th, npath))
  return None, states, False

def replay(L, path):
  layers = [list(f) for f in L['flasks']]
  n = len(layers)
  caps = list(L.get('caps') or [CAP]*n)
  while len(caps)<n: caps.append(CAP)
  hidden = [list(h) for h in (L.get('hidden') or [[] for _ in range(n)])]
  while len(hidden)<n: hidden.append([])
  for i,f in enumerate(layers):
    while len(hidden[i])<len(f): hidden[i].append(False)
    hidden[i]=hidden[i][:len(f)]
  corked=[False]*n
  is_mixer=list(L.get('mixer') or [False]*n)
  while len(is_mixer)<n: is_mixer.append(False)
  recipes=[list(r) if r else None for r in (L.get('mixRecipe') or [None]*n)]
  while len(recipes)<n: recipes.append(None)
  pendings=[None]*n
  locked=list(L.get('locked') or [False]*n)
  lock_color=list(L.get('lockColor') or [None]*n)
  thaw=list(L.get('thawAfter') or [0]*n)
  filters=list(L.get('filterColor') or [None]*n)
  while len(locked)<n: locked.append(False)
  while len(thaw)<n: thaw.append(0)
  while len(filters)<n: filters.append(None)
  for fi in range(n):
    if can_safely_cork(fi, layers, hidden, caps, corked, is_mixer, [False]*n, recipes, pendings, [thaw[x]>0 for x in range(n)]):
      corked[fi]=True
  for step in path:
    i,j = step[0], step[1]
    amt = can_pour(layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, locked, thaw, filters)
    if amt <= 0: return False, f'blocked {i}->{j}'
    use = step[2] if len(step)>2 else amt
    if use > amt: return False, f'amt {use}>{amt}'
    layers, hidden, corked, pendings, locked, thaw = apply_pour(
      layers, hidden, caps, corked, is_mixer, recipes, pendings, i, j, use, locked, lock_color, thaw)
  if not is_won(layers, corked, is_mixer, recipes, pendings):
    return False, 'not won'
  return True, 'ok'
