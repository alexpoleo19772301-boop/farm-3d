#!/usr/bin/env python3
"""Regenerate all levels: every non-collector flask cap=4; one tall collector when tagged.
Each level gets a BFS witness replayed with safe-cork engine rules."""
from __future__ import annotations
import json, random, collections, time, copy
from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location('rv', 'scripts/revalidate_engine_v414.py')
rv = importlib.util.module_from_spec(spec); spec.loader.exec_module(rv)

COLORS = ["red","orange","yellow","green","teal","blue","purple","pink","brown","lime","indigo","coral"]
COLLECTOR_IDS = set(range(12, 100, 10))  # 12..92

def slack(idx, sol):
  if idx < 10: return max(8, int(sol*0.9)+4)
  if idx < 25: return max(6, int(sol*0.55)+3)
  if idx < 50: return max(4, int(sol*0.40)+2)
  if idx < 75: return max(3, int(sol*0.30)+2)
  return max(2, int(sol*0.22)+1)

def scramble(flasks, caps, moves, rng):
  n = len(flasks)
  for _ in range(moves):
    cands = []
    for i,f in enumerate(flasks):
      if not f: continue
      c, run = f[-1], 0
      for x in reversed(f):
        if x != c: break
        run += 1
      for j in range(n):
        if i==j or len(flasks[j]) >= caps[j]: continue
        space = caps[j]-len(flasks[j])
        if not flasks[j] or flasks[j][-1]==c:
          amt = min(run, space)
          if amt>0: cands.append((i,j,amt))
    if not cands: break
    i,j,amt = cands[rng.randrange(min(12, len(cands)))]
    amt = rng.randint(1, amt)
    for __ in range(amt):
      flasks[j].append(flasks[i].pop())
  return flasks

def add_hidden(flasks, rng, dens=0.25):
  hidden=[]
  for f in flasks:
    h=[]
    for i,c in enumerate(f):
      # keep top visible
      h.append(False if i==len(f)-1 else (rng.random()<dens))
    hidden.append(h)
  return hidden

def make_classic(lid, rng, n_colors, n_empty, moves, want_hidden=False, want_freeze=False, want_lock=False, want_timer=False):
  cols = COLORS[:n_colors]
  flasks = [[c]*4 for c in cols] + [[] for _ in range(n_empty)]
  caps = [4]*len(flasks)
  flasks = scramble(flasks, caps, moves, rng)
  tags=[]
  hidden = add_hidden(flasks, rng, 0.28) if want_hidden else [[False]*len(f) for f in flasks]
  if want_hidden: tags.append('hidden')
  n=len(flasks)
  locked=[False]*n; lockColor=[None]*n
  thaw=[0]*n; frozen=[False]*n
  if want_freeze:
    # freeze a non-empty flask that is NOT the only source of a unique needed pattern — pick one with mixed or mono
    cands=[i for i,f in enumerate(flasks) if f]
    if cands:
      fi=cands[rng.randrange(len(cands))]
      frozen[fi]=True
      thaw[fi]=1 if lid<50 else 2
      tags.append('frozen')
  if want_lock:
    # lock an empty or near-empty flask requiring a color that has exactly 4 units total
    from collections import Counter
    tot=Counter(c for f in flasks for c in f)
    key=None
    for c,cnt in tot.items():
      if cnt==4: key=c; break
    if key is None and tot:
      key=max(tot, key=tot.get)
    empties=[i for i,f in enumerate(flasks) if not f]
    # prefer empty; else a flask that doesn't hold much of key
    if empties and key:
      li=empties[0]
      locked[li]=True; lockColor[li]=key
      tags.append('locked')
    elif key:
      # add an empty flask to lock
      flasks.append([]); caps.append(4); hidden.append([])
      locked.append(True); lockColor.append(key); thaw.append(0); frozen.append(False)
      tags.append('locked')
  if want_timer: tags.append('timer')
  L={
    'id':lid,'flasks':flasks,'caps':caps,'hidden':hidden,
    'locked':locked,'lockColor':lockColor,'thawAfter':thaw,'frozen':frozen,
    'mixer':[False]*len(flasks),'collector':[False]*len(flasks),
    'tags':tags,'par':12,'moveLimit':20
  }
  return L

def make_mixer(lid, rng):
  # All cap4 including mixer vessel. Start with ingredients + empties; solution mixes then sorts.
  # Simpler: 2 colors that mix to third, plus completed groups — use small known pattern.
  # yellow+blue=green. Provide yellow×1, blue×1 in mixer path, green×3 already, plus red×4.
  # Easier: classic 3-color all cap4 + one mixer flask empty cap4 tagged mixer — player optional.
  # Functional mixing level: place yellow and blue as tops to pour into empty mixer.
  flasks=[[], ['yellow'], ['blue'], ['red']*4, ['green']*3, []]
  # pad green to need mix: green has 3, mix adds 1 green from y+b
  caps=[4]*6
  mixer=[False,False,False,False,False,False]
  # designate flask 0 as mixer
  mixer[0]=True
  hidden=[[False]*len(f) for f in flasks]
  L={'id':lid,'flasks':flasks,'caps':caps,'hidden':hidden,'mixer':mixer,
     'locked':[False]*6,'lockColor':[None]*6,'thawAfter':[0]*6,'frozen':[False]*6,
     'collector':[False]*6,'tags':['mixing'],'par':10,'moveLimit':18,
     'collectorColor':None,'collectorNeed':0}
  return L

def make_collector(lid, rng, need, color):
  # Side flasks all cap4; collector cap=need. Supply exactly `need` of color + other colors ×4.
  other = [c for c in COLORS if c!=color][:3]
  # need units of color split across side flasks + empties
  units = [color]*need
  for o in other:
    units += [o]*4
  rng.shuffle(units)
  # pack into side flasks of 4
  sides=[]
  for i in range(0, len(units), 4):
    chunk=units[i:i+4]
    if len(chunk)<4:
      # shouldn't happen if totals multiple of 4 — pad by using 4 others only
      pass
    sides.append(chunk)
  # ensure all chunks size 4
  sides=[s for s in sides if len(s)==4]
  # recount — rebuild properly
  bag=[color]*need
  for o in other: bag += [o]*4
  rng.shuffle(bag)
  sides=[]
  cur=[]
  for u in bag:
    cur.append(u)
    if len(cur)==4:
      sides.append(cur); cur=[]
  if cur: # leftover — shouldn't if need%4==0 and others*4
    # dump into partial then we'll fix need to multiple
    while len(cur)<4: cur.append(other[0])
    sides.append(cur)
  empties=2
  flasks=sides + [[] for _ in range(empties)] + [[]]  # last is collector
  n=len(flasks)
  caps=[4]*(n-1)+[need]
  collector=[False]*(n-1)+[True]
  hidden=[[False]*len(f) for f in flasks]
  # light scramble sides only (not into collector randomly too much)
  side_caps=caps[:-1]
  side_f=flasks[:-1]
  side_f=scramble(side_f, side_caps, 8+rng.randrange(6), rng)
  flasks=side_f+[[]]
  L={'id':lid,'flasks':flasks,'caps':caps,'hidden':hidden,
     'locked':[False]*n,'lockColor':[None]*n,'thawAfter':[0]*n,'frozen':[False]*n,
     'mixer':[False]*n,'collector':collector,'collectorColor':color,'collectorNeed':need,
     'tags':['collector'],'par':8,'moveLimit':16}
  return L

def validate(L, budget=250000, depth=80):
  path, states, ok = rv.bfs_solve(L, max_states=budget, max_depth=depth)
  if not ok or path is None:
    return None, states
  ok2, msg = rv.replay(L, path)
  if not ok2:
    return None, msg
  return path, states

def main():
  t0=time.time()
  old=json.loads(Path('www/assets/paint_levels.json').read_text())
  out=[]
  report=[]
  for idx in range(100):
    lid=idx+1
    rng=random.Random(416000+lid*17)
    path=None; L=None; tries=0
    is_coll = lid in COLLECTOR_IDS
    while path is None and tries < 60:
      tries+=1
      if is_coll:
        need = 6 if lid < 50 else 8
        color = COLORS[(lid//10) % len(COLORS)]
        L=make_collector(lid, rng, need, color)
        budget=400000; depth=70
      elif lid in (40,47,54,61,68,75,89,96):
        L=make_mixer(lid, rng)
        # scramble a bit more variants
        if tries>1:
          L=make_classic(lid, rng, 3, 2, 10+tries, want_hidden=False)
          # force mixer flask
          L['mixer']=[False]*len(L['flasks'])
          L['mixer'][0]=True
          if L['flasks'][0]:
            # ensure mixer empty
            L['flasks'].append(L['flasks'][0]); L['flasks'][0]=[]
            L['caps'].append(4); L['hidden'].append([])
            for k in ('locked','lockColor','thawAfter','frozen','mixer','collector'):
              if k=='mixer': L[k]=[False]*len(L['flasks']); L[k][0]=True
              elif k=='lockColor': L[k]=[None]*len(L['flasks'])
              elif k=='collector': L[k]=[False]*len(L['flasks'])
              else: L[k]=([False]*len(L['flasks'])) if k!='thawAfter' else [0]*len(L['flasks'])
          L['tags']=['mixing']
        budget=200000; depth=50
      else:
        # progression
        if lid<=8: nc,ne,mv=2,2,6+tries%4
        elif lid<=15: nc,ne,mv=3,2,8+tries%5
        elif lid<=24: nc,ne,mv=3,2,10+tries%6
        elif lid<=40: nc,ne,mv=4,2,12+tries%6
        elif lid<=60: nc,ne,mv=4,2,14+tries%7
        elif lid<=80: nc,ne,mv=5,2,14+tries%8
        else: nc,ne,mv=5,2,16+tries%8
        want_h = lid>=8
        want_f = lid>=20 and (lid%3!=0)
        want_l = lid>=25 and (lid%2==0)
        want_t = lid in (35,50,65,80,95)
        # boss multiples of 5 still normal levels (boss is after)
        L=make_classic(lid, rng, nc, ne, mv, want_hidden=want_h, want_freeze=want_f, want_lock=want_l, want_timer=want_t)
        budget=300000 if lid<50 else 500000
        depth=70 if lid<50 else 90
      # force all non-collector caps to 4
      for i in range(len(L['flasks'])):
        if L.get('collector') and i < len(L['collector']) and L['collector'][i]:
          L['caps'][i]=L.get('collectorNeed') or L['caps'][i]
        else:
          if i >= len(L['caps']): L['caps'].append(4)
          else: L['caps'][i]=4
          # trim overfill
          if len(L['flasks'][i])>4:
            L['flasks'][i]=L['flasks'][i][:4]
          if L.get('hidden') and i < len(L['hidden']):
            L['hidden'][i]=L['hidden'][i][:len(L['flasks'][i])]
      path, info = validate(L, budget=budget, depth=depth)
      if path is None and tries==30:
        # fallback pure classic 3c
        L=make_classic(lid, rng, 3, 2, 10+tries, False, False, False, False)
        for i in range(len(L['caps'])): L['caps'][i]=4
        path, info = validate(L, budget=200000, depth=50)
    if path is None:
      raise SystemExit(f'FAIL generate L{lid} last={info}')
    sol=len(path)
    L['solutionLen']=sol
    L['states']=info if isinstance(info,int) else 0
    L['validated']='bfs_witness_v416'
    L['moveLimit']=max(L.get('moveLimit') or 0, sol+slack(idx,sol))
    L['par']=sol+max(1,(L['moveLimit']-sol)//2)
    # strip varcap tag
    L['tags']=[t for t in (L.get('tags') or []) if t!='varcap']
    # property checks
    for i,f in enumerate(L['flasks']):
      is_c = L.get('collector') and i < len(L['collector']) and L['collector'][i]
      cap = L['caps'][i]
      if not is_c and cap!=4: raise SystemExit(f'cap bug {lid}')
      if len(f)>cap: raise SystemExit(f'overfill {lid}')
    out.append(L)
    report.append({'id':lid,'sol':sol,'lim':L['moveLimit'],'tags':L.get('tags'),'tries':tries})
    print(f"L{lid:03d} sol={sol:2d} lim={L['moveLimit']:2d} tags={L.get('tags')} tries={tries}", flush=True)

  pack={'version':'4.1.6','levels':out,'generated':'normalize_cap4_v416'}
  Path('www/assets/paint_levels.json').write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')))
  summary={'ok':len(report),'method':'bfs_witness_replay_cap4','elapsed_s':round(time.time()-t0,1),'levels':report}
  Path('scripts/paint_revalidate_v416.json').write_text(json.dumps(summary,indent=2))
  print('TOTAL', len(report), 'elapsed', summary['elapsed_s'], flush=True)

if __name__=='__main__':
  main()
