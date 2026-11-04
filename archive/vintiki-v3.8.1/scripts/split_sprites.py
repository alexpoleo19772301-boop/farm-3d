#!/usr/bin/env python3
"""Chroma-key magenta, split into connected components, export webp."""
from pathlib import Path
from PIL import Image
import numpy as np
from collections import deque

OUT=Path('/workspace/farm-game/www/assets')
OUT.mkdir(parents=True, exist_ok=True)

def chroma(arr, thr=55):
    corners=np.stack([arr[2,2,:3],arr[2,-3,:3],arr[-3,2,:3],arr[-3,-3,:3]]).astype(np.float32)
    bg=corners.mean(axis=0)
    rgb=arr[:,:,:3].astype(np.float32)
    dist=np.sqrt(((rgb-bg)**2).sum(axis=2))
    r,g,b=arr[:,:,0],arr[:,:,1],arr[:,:,2]
    mag=(r>170)&(b>150)&(g<140)
    # also very saturated magenta
    mag2=(r>200)&(b>180)&(g<160)&(r.astype(int)+b.astype(int)-2*g.astype(int)>120)
    near=dist<thr
    alpha=np.where(mag|mag2|near,0,255).astype(np.uint8)
    out=arr.copy(); out[:,:,3]=alpha
    return out, bg

def components(alpha, min_area=800):
    h,w=alpha.shape
    vis=np.zeros_like(alpha,dtype=bool)
    comps=[]
    for y in range(h):
        for x in range(w):
            if alpha[y,x]==0 or vis[y,x]: continue
            q=deque([(y,x)]); vis[y,x]=True
            cells=[];
            minx=miny=10**9; maxx=maxy=-1
            while q:
                cy,cx=q.popleft(); cells.append((cy,cx))
                if cx<minx:minx=cx
                if cy<miny:miny=cy
                if cx>maxx:maxx=cx
                if cy>maxy:maxy=cy
                for ny,nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if 0<=ny<h and 0<=nx<w and not vis[ny,nx] and alpha[ny,nx]>0:
                        vis[ny,nx]=True; q.append((ny,nx))
            if len(cells)>=min_area:
                comps.append((miny,minx,maxy,maxx,cells))
    # sort top-to-bottom, left-to-right
    comps.sort(key=lambda c:(c[0]//80, c[1]))
    return comps

def export_named(src, names, max_side=280, min_area=1200, thr=55):
    im=Image.open(src).convert('RGBA')
    arr=np.array(im)
    keyed,_=chroma(arr, thr=thr)
    comps=components(keyed[:,:,3], min_area=min_area)
    print(src.name, 'comps', len(comps), 'want', len(names))
    # if too many small, raise min_area
    results=[]
    for i,name in enumerate(names):
        if i>=len(comps):
            print(' missing', name); continue
        miny,minx,maxy,maxx,cells=comps[i]
        # extract bbox with padding
        pad=4
        y0=max(0,miny-pad); x0=max(0,minx-pad)
        y1=min(keyed.shape[0],maxy+pad+1); x1=min(keyed.shape[1],maxx+pad+1)
        crop=keyed[y0:y1,x0:x1].copy()
        # zero outside this component roughly via bbox is ok
        out=Image.fromarray(crop,'RGBA')
        bb=out.getbbox()
        if bb: out=out.crop(bb)
        w,h=out.size
        m=max(w,h)
        if m>max_side:
            s=max_side/m
            out=out.resize((max(1,int(w*s)),max(1,int(h*s))), Image.Resampling.LANCZOS)
        path=OUT/f'{name}.webp'
        out.save(path,'WEBP',quality=80,method=4)
        results.append((name, out.size, path.stat().st_size))
        print(' ', name, out.size, path.stat().st_size)
    return results

RAW=Path('/workspace/farm-game/www/assets/raw')

# island whole
im=Image.open(RAW/'island.jpg').convert('RGBA')
arr=np.array(im); keyed,_=chroma(arr, thr=48)
out=Image.fromarray(keyed,'RGBA'); bb=out.getbbox();
if bb: out=out.crop(bb)
out=out.resize((512, int(512*out.size[1]/out.size[0])), Image.Resampling.LANCZOS)
out.save(OUT/'island.webp','WEBP',quality=82,method=4)
print('island', out.size, (OUT/'island.webp').stat().st_size)

export_named(RAW/'buildings.jpg', ['hut','barn','well','stall'], max_side=220, min_area=2500)
export_named(RAW/'animals.jpg', ['chicken','cow','sheep','chicken_walk'], max_side=160, min_area=2000)
export_named(RAW/'props.jpg', ['scarecrow','heart','tree','bush','rocks','pest','coin','fence'], max_side=200, min_area=900, thr=60)

# crops - may have many components
export_named(RAW/'crops.jpg', [
  'soil_dry','soil_tilled','soil_wet',
  'wheat_1','wheat_2','wheat_3','carrot_1','sun_1',
  'carrot_3','sun_3'
], max_side=180, min_area=900, thr=50)

# list all
total=sum(p.stat().st_size for p in OUT.glob('*.webp'))
print('TOTAL webp bytes', total)
for p in sorted(OUT.glob('*.webp')):
  print(p.name, p.stat().st_size)
