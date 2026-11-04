#!/usr/bin/env python3
"""Chroma-key magenta/green, trim, optional downscale, export webp+png."""
import sys, os
from pathlib import Path
from PIL import Image
import numpy as np

def key_and_trim(src, dst_webp, dst_png=None, max_side=256, bg_mode='auto'):
    im=Image.open(src).convert('RGBA')
    arr=np.array(im)
    r,g,b,a=arr[:,:,0],arr[:,:,1],arr[:,:,2],arr[:,:,3]
    # detect dominant corner color
    corners=np.stack([arr[0,0,:3],arr[0,-1,:3],arr[-1,0,:3],arr[-1,-1,:3]]).astype(float)
    bg=corners.mean(axis=0)
    # magenta-ish or green screen or near-white/solid
    dist=np.sqrt(((arr[:,:,:3].astype(float)-bg)**2).sum(axis=2))
    # also strong magenta
    mag=((r>180)&(b>180)&(g<120))
    # strong green screen
    gre=((g>180)&(r<120)&(b<120))
    # near bg
    near=dist<48
    mask=mag|gre|near
    # keep soft edge
    arr[:,:,3]=np.where(mask,0,a)
    # if almost all transparent, loosen
    if (arr[:,:,3]>0).sum()<100:
        near=dist<70
        arr[:,:,3]=np.where(mag|gre|near,0,255)
    out=Image.fromarray(arr,'RGBA')
    bbox=out.getbbox()
    if bbox: out=out.crop(bbox)
    # pad 2px
    w,h=out.size
    pad=Image.new('RGBA',(w+4,h+4),(0,0,0,0)); pad.paste(out,(2,2))
    out=pad
    # downscale
    w,h=out.size
    m=max(w,h)
    if m>max_side:
        s=max_side/m
        out=out.resize((max(1,int(w*s)), max(1,int(h*s))), Image.Resampling.LANCZOS)
    out.save(dst_webp,'WEBP',quality=82,method=4)
    if dst_png: out.save(dst_png,'PNG')
    return out.size

if __name__=='__main__':
    src,dst=sys.argv[1],sys.argv[2]
    ms=int(sys.argv[3]) if len(sys.argv)>3 else 256
    print(key_and_trim(src,dst,max_side=ms))
