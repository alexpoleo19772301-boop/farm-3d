#!/usr/bin/env python3
import json, random, copy, time
from pathlib import Path
from collections import Counter
import importlib.util
SPEC=importlib.util.spec_from_file_location('rv','scripts/revalidate_engine_v414.py')
rv=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(rv)
import importlib.util as _ilu
_gs=_ilu.spec_from_file_location('g417','scripts/gen_hard_cap4_v417.py')
g=_ilu.module_from_spec(_gs); _gs.loader.exec_module(g)

COLORS=g.COLORS
COLLECTOR={12,22,32,42,52,62,72,82,92}
MIXER={40,47,54,61,68,75,89,96}
old=json.load(open('www/assets/paint_levels.json'))
CK=Path('scripts/paint_pack_checkpoint_v420.json')

def struct(L):
  skip={i for i,c in enumerate(L.get('collector') or []) if c}
  mixed=pre=empty=0; cols=set()
  for i,f in enumerate(L['flasks']):
    if i in skip: continue
    for c in f: cols.add(c)
    if not f: empty+=1
    elif len(set(f))>1: mixed+=1
    elif len(f)==4 and len(set(f))==1: pre+=1
  return mixed,pre,empty,len(cols)

def ensure(L):
  n=len(L['flasks'])
  L['caps']=(list(L.get('caps') or [])+[4]*n)[:n]
  for k,v in [('locked',False),('frozen',False),('mixer',False),('collector',False)]:
    L[k]=(list(L.get(k) or [])+[v]*n)[:n]
  L['thawAfter']=(list(L.get('thawAfter') or [])+[0]*n)[:n]
  L['lockColor']=(list(L.get('lockColor') or [])+[None]*n)[:n]
  L['filterColor']=(list(L.get('filterColor') or [])+[None]*n)[:n]
  if not L.get('hidden') or len(L['hidden'])!=n:
    L['hidden']=[[False]*len(f) for f in L['flasks']]
  return L

def add_hidden(L, dens=0.3):
  rng=random.Random(L['id']*11+7)
  for i,f in enumerate(L['flasks']):
    h=[False]*len(f)
    for k in range(max(0,len(f)-1)):
      if rng.random()<dens: h[k]=True
    L['hidden'][i]=h
  tags=list(L.get('tags') or [])
  if 'hidden' not in tags: tags.append('hidden')
  L['tags']=tags
  return L

def add_filter(L):
  cols=[c for f in L['flasks'] for c in f]
  if not cols: return L
  empties=[i for i,f in enumerate(L['flasks']) if not f and not L['collector'][i] and not L['mixer'][i] and not L['locked'][i]]
  if not empties: return L
  color=Counter(cols).most_common(1)[0][0]
  L['filterColor']=[None]*len(L['flasks']); L['filterColor'][empties[-1]]=color
  tags=list(L.get('tags') or [])
  if 'filter' not in tags: tags.append('filter')
  L['tags']=tags
  return L

def validate(L, budget=120000, depth=50):
  path,states,ok=rv.bfs_solve(L,max_states=budget,max_depth=depth)
  if not ok or not path: return None,states
  ok2,msg=rv.replay(L,path)
  if not ok2: return None,msg
  return path,states

def make_board(lid, nc, rng):
  flasks=[[c]*4 for c in COLORS[:nc]]+[[],[]]
  caps=[4]*len(flasks)
  flasks=g.reverse_mix(flasks,caps,14+nc*3,rng,min_empty=2,frag=0.3)
  for _ in range(2):
    m,p,e,_=g.count_struct(flasks,caps)
    if m>=3 and p==0 and e>=1: break
    flasks=g.reverse_mix(flasks,caps,6+nc,rng,min_empty=2,frag=0.4)
  n=len(flasks)
  return {'id':lid,'flasks':flasks,'caps':caps,'hidden':[[False]*len(f) for f in flasks],
    'locked':[False]*n,'lockColor':[None]*n,'thawAfter':[0]*n,'frozen':[False]*n,
    'mixer':[False]*n,'collector':[False]*n,'filterColor':[None]*n,
    'collectorColor':None,'collectorNeed':0,'tags':[],'par':14,'moveLimit':36}

def main():
  pack=[]; sols={}; stats=[]; failed=[]
  start=1
  if CK.exists():
    data=json.loads(CK.read_text()); pack=data['levels']; sols=data.get('solutions',{}); stats=data.get('stats',[])
    start=max(L['id'] for L in pack)+1
    print('RESUME', start, flush=True)
  t0=time.time()
  for lid in range(start,101):
    L0=old['levels'][lid-1]
    L=None
    if lid < 56 and lid not in COLLECTOR and lid not in MIXER:
      L=ensure(copy.deepcopy(L0))
      if lid>=30: L=add_hidden(L,0.28)
      if lid>=40: L=add_filter(L)
      path,st=validate(L,100000,45)
      if not path and lid>=40:
        L['filterColor']=[None]*len(L['flasks']); L['tags']=[t for t in L['tags'] if t!='filter']
        path,st=validate(L,120000,50)
      if not path:
        L=ensure(copy.deepcopy(L0)); path,st=validate(L,80000,40)
      if path:
        L['solutionLen']=len(path); L['moveLimit']=len(path)+max(4,int(len(path)*0.4)); L['validated']=True
        L['hintPath']=[[a[0],a[1],a[2]] for a in path[:3]]
        sols[str(lid)]={'path':path,'len':len(path),'method':'BFS'}
      else:
        L=ensure(copy.deepcopy(L0)); L['solutionLen']=L0.get('solutionLen') or 8; L['validated']=False; L['solutionMethod']='kept'
        failed.append(lid)
    else:
      path=None
      for attempt in range(10):
        rng=random.Random(4200+lid*31+attempt)
        if lid in COLLECTOR:
          L,_=g.make_collector(lid,rng); L=ensure(L); L=add_hidden(L,0.2)
          path,st=validate(L,180000,50)
        elif lid in MIXER:
          L,_=g.make_mixer(lid,rng); L=ensure(L); L=add_hidden(L,0.15)
          path,st=validate(L,100000,40)
        else:
          nc=6 if lid<80 else 7
          L=make_board(lid,nc,rng); L=ensure(L); L=add_hidden(L,0.3)
          if lid>=40: L=add_filter(L)
          m,p,e,c=struct(L)
          if p>0 or m<3: continue
          path,st=validate(L,140000 if nc<=6 else 180000,48)
        if path and len(path)>=4:
          L['solutionLen']=len(path); L['moveLimit']=len(path)+max(5,int(len(path)*0.45)); L['validated']=True
          L['hintPath']=[[a[0],a[1],a[2]] for a in path[:3]]
          sols[str(lid)]={'path':path,'len':len(path),'method':'BFS'}
          break
        path=None
      if not path:
        L=make_board(lid,5,random.Random(lid)); L=ensure(L); L=add_hidden(L,0.2)
        path,st=validate(L,90000,40)
        if path:
          L['solutionLen']=len(path); L['moveLimit']=len(path)+8; L['validated']=True
          L['tags']=list(L.get('tags') or [])+['emergency']
          sols[str(lid)]={'path':path,'len':len(path),'method':'emergency'}
        else:
          L=ensure(copy.deepcopy(L0)); L['validated']=False; failed.append(lid)

    pack.append(L)
    m,p,e,c=struct(L)
    stats.append(dict(id=lid,colors=c,mixed=m,presolved=p,empty=e,sol=L.get('solutionLen'),lim=L.get('moveLimit'),tags=L.get('tags'),ok=L.get('validated')))
    print(f'L{lid} sol={L.get("solutionLen")} val={L.get("validated")} tags={L.get("tags")} col={c} mixed={m} pre={p}', flush=True)
    if lid % 5 == 0:
      CK.write_text(json.dumps({'levels':pack,'solutions':sols,'stats':stats}))

  pack.sort(key=lambda x: x['id'])
  payload={'version':'4.2.0','levels':pack,'generated':time.strftime('%Y-%m-%dT%H:%M:%S'),
           'note':'4.2.0 filters+hidden; harder late; red/brown; big icon'}
  Path('www/assets/paint_levels.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')))
  Path('scripts/paint_solutions_v420.json').write_text(json.dumps(sols))
  Path('scripts/paint_diff_after_v420.json').write_text(json.dumps({'stats':stats,'failed':failed}, indent=2))
  print('TOTAL', len(pack), 'sols', len(sols), 'failed', failed, 't', round(time.time()-t0,1), flush=True)

if __name__ == '__main__':
  main()
