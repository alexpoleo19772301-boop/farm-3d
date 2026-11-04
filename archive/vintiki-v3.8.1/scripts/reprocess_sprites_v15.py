#!/usr/bin/env python3
"""Aggressive chroma + despill + alpha erode + rembg refine for Farm sprites."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageMorph
import numpy as np
from collections import deque

RAW=Path('/workspace/farm-game/art-raw/raw')
OUT=Path('/workspace/farm-game/www/assets')
OUT.mkdir(parents=True, exist_ok=True)

def magentaish(r,g,b):
    # high R+B, low G relative — classic chroma fringe
    return (r.astype(np.int16)+b.astype(np.int16) - 2*g.astype(np.int16) > 60) & (g < 160) & (r > 100) & (b > 80)

def despill_and_erode(rgba, erode=2):
    arr=np.array(rgba)
    r,g,b,a=arr[:,:,0].astype(np.float32),arr[:,:,1].astype(np.float32),arr[:,:,2].astype(np.float32),arr[:,:,3].astype(np.float32)
    # hard kill near-transparent magenta
    mag=magentaish(arr[:,:,0],arr[:,:,1],arr[:,:,2])
    # also near pure magenta corners style
    a=np.where(mag & (a<250), 0, a)
    # despill: pull magenta toward green neighbor estimate
    spill = (r+b - 2*g > 40) & (a>0)
    # replace R/B toward G for spill pixels
    r2=r.copy(); b2=b.copy()
    r2[spill]=np.minimum(r[spill], g[spill]*1.05+20)
    b2[spill]=np.minimum(b[spill], g[spill]*1.05+20)
    # for strong spill reduce alpha
    strong=(r+b-2*g>90)&(a>0)
    a=np.where(strong, a*0.15, a)
    a=np.where(mag, 0, a)
    # erode alpha a few px
    am=(a>40).astype(np.uint8)*255
    imA=Image.fromarray(am, 'L')
    for _ in range(erode):
        imA=imA.filter(ImageFilter.MinFilter(3))
    # slight blur then threshold for soft edge without fringe
    soft=imA.filter(ImageFilter.GaussianBlur(0.6))
    a_new=np.array(soft).astype(np.float32)
    a_new=np.where(a_new<30, 0, a_new)
    # multiply with existing
    a=np.minimum(a, a_new)
    out=np.stack([r2.clip(0,255), g.clip(0,255), b2.clip(0,255), a.clip(0,255)], axis=2).astype(np.uint8)
    return Image.fromarray(out,'RGBA')

def chroma_key(im, thr=42):
    arr=np.array(im.convert('RGBA'))
    # sample corners + border median
    h,w=arr.shape[:2]
    border=np.concatenate([
        arr[0,:,:3].reshape(-1,3), arr[-1,:,:3].reshape(-1,3),
        arr[:,0,:3].reshape(-1,3), arr[:,-1,:3].reshape(-1,3)
    ], axis=0).astype(np.float32)
    bg=np.median(border, axis=0)
    rgb=arr[:,:,:3].astype(np.float32)
    dist=np.sqrt(((rgb-bg)**2).sum(2))
    r,g,b=arr[:,:,0],arr[:,:,1],arr[:,:,2]
    mag=magentaish(r,g,b) | ((r>180)&(b>160)&(g<150))
    near=dist<thr
    # also very close to bg chroma
    a=np.where(mag|near, 0, 255).astype(np.uint8)
    arr[:,:,3]=a
    return Image.fromarray(arr,'RGBA'), bg

def components(alpha, min_area=800):
    h,w=alpha.shape
    vis=np.zeros((h,w),dtype=bool)
    comps=[]
    for y in range(h):
        xs=np.where((alpha[y]>0)&(~vis[y]))[0]
        for x in xs:
            if vis[y,x]: continue
            q=deque([(y,x)]); vis[y,x]=True
            cells=[]; minx=miny=10**9; maxx=maxy=-1
            while q:
                cy,cx=q.popleft(); cells.append((cy,cx))
                minx=min(minx,cx); maxx=max(maxx,cx); miny=min(miny,cy); maxy=max(maxy,cy)
                for ny,nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if 0<=ny<h and 0<=nx<w and not vis[ny,nx] and alpha[ny,nx]>0:
                        vis[ny,nx]=True; q.append((ny,nx))
            if len(cells)>=min_area:
                comps.append((miny,minx,maxy,maxx))
    comps.sort(key=lambda c:(c[0]//90, c[1]))
    return comps

def try_rembg(im):
    try:
        from rembg import remove
        return remove(im.convert('RGBA'))
    except Exception as e:
        print('rembg fail', e)
        return None

def export_sheet(src, names, max_side=280, min_area=1200, thr=40, erode=2, use_rembg=False):
    im=Image.open(src)
    if use_rembg:
        rb=try_rembg(im)
        if rb is not None:
            keyed=rb
        else:
            keyed,_=chroma_key(im, thr=thr)
    else:
        keyed,_=chroma_key(im, thr=thr)
    keyed=despill_and_erode(keyed, erode=erode)
    arr=np.array(keyed)
    comps=components(arr[:,:,3], min_area=min_area)
    print(src.name, 'comps', len(comps), 'names', len(names))
    for i,name in enumerate(names):
        if i>=len(comps):
            print(' missing', name); continue
        miny,minx,maxy,maxx=comps[i]
        pad=6
        y0=max(0,miny-pad); x0=max(0,minx-pad)
        y1=min(arr.shape[0],maxy+pad+1); x1=min(arr.shape[1],maxx+pad+1)
        crop=Image.fromarray(arr[y0:y1,x0:x1],'RGBA')
        crop=despill_and_erode(crop, erode=1)
        bb=crop.getbbox()
        if bb: crop=crop.crop(bb)
        w,h=crop.size
        m=max(w,h)
        if m>max_side:
            s=max_side/m
            crop=crop.resize((max(1,int(w*s)),max(1,int(h*s))), Image.Resampling.LANCZOS)
            crop=despill_and_erode(crop, erode=1)
        path=OUT/f'{name}.webp'
        crop.save(path,'WEBP',quality=82,method=4)
        # also count magenta leftover pixels
        a=np.array(crop)
        mag=magentaish(a[:,:,0],a[:,:,1],a[:,:,2])&(a[:,:,3]>20)
        print(f'  {name} {crop.size} mag_left={int(mag.sum())} bytes={path.stat().st_size}')

# field background — no key, just compress
field=Image.open(RAW/'field_wide.jpg').convert('RGB')
field=field.resize((768,1024), Image.Resampling.LANCZOS)
field.save(OUT/'field.webp','WEBP',quality=78,method=4)
print('field', field.size, (OUT/'field.webp').stat().st_size)

# island with rembg if possible (keep floating look as border decor)
island=Image.open(RAW/'island.jpg')
rb=try_rembg(island)
if rb is None:
    keyed,_=chroma_key(island, thr=45)
else:
    keyed=rb
keyed=despill_and_erode(keyed, erode=2)
bb=keyed.getbbox()
if bb: keyed=keyed.crop(bb)
keyed=keyed.resize((560, int(560*keyed.size[1]/keyed.size[0])), Image.Resampling.LANCZOS)
keyed=despill_and_erode(keyed, erode=1)
keyed.save(OUT/'island.webp','WEBP',quality=82,method=4)
print('island mag', int((magentaish(*[np.array(keyed)[:,:,i] for i in range(3)]) & (np.array(keyed)[:,:,3]>20)).sum()))

export_sheet(RAW/'buildings.jpg', ['hut','barn','well','stall'], max_side=240, min_area=2500, thr=38, erode=2, use_rembg=True)
export_sheet(RAW/'animals.jpg', ['chicken','cow','sheep','chicken_walk'], max_side=180, min_area=1800, thr=38, erode=3, use_rembg=True)
export_sheet(RAW/'props.jpg', ['scarecrow','heart','tree','bush','rocks','pest','coin','fence'], max_side=210, min_area=800, thr=40, erode=2, use_rembg=True)
export_sheet(RAW/'crops.jpg', [
  'soil_dry','soil_tilled','soil_wet',
  'wheat_1','wheat_2','wheat_3','carrot_1','sun_1',
  'carrot_3','sun_3'
], max_side=190, min_area=800, thr=38, erode=2, use_rembg=False)

total=sum(p.stat().st_size for p in OUT.glob('*.webp'))
print('TOTAL', total)
