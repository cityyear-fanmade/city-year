#!/usr/bin/env python3
"""몸 시트(머리 자리에 마젠타 원, 같은 줄에 복장 여러 벌) + 머리 시트(회색 머리카락·청록 눈, 표정 4종 × 머리 모양 행)를
합성해 머리 모양·머리색·눈색을 바꾼 전신 그림과 전투 초상(표정 4종)을 만든다.
시험 단계의 도구: 얼굴 비율(0.42)·턱 위치(-0.04)는 시험 결과(엄지 카포·언더보스·대부 + 단발·숏컷)에 맞춘 값이다.
사용 예 (파이썬에서):
    import importlib.util; spec=importlib.util.spec_from_file_location('cc','tools/char-compose.py'); C=...
    rgba,circles,masks=C.load_bodies('body.webp'); heads=C.load_heads('heads.webp',[(0,512),(512,1024)])
    img=C.build(None,circles[0],masks[0],rgba,heads[0][0],'#c43d3d','#e8b023')   # 몸 0번 + 머리 모양 0의 '대기' 표정"""
import sys,numpy as np
from PIL import Image
from scipy import ndimage as ndi
import colorsys
def key(a):
    r,g,b=[a[:,:,i].astype(int) for i in range(3)];return (g-np.maximum(r,b))>60
def hexrgb(h):
    h=h.lstrip('#');return tuple(int(h[i:i+2],16) for i in (0,2,4))
def keyed_rgba(a):
    r,g,b=[a[:,:,i].astype(np.float32) for i in range(3)]
    alpha=1-np.clip(((g-np.maximum(r,b))-40)/110,0,1)
    g2=np.where(alpha>0,np.minimum(g,np.maximum(r,b)+8),g)
    return np.dstack([r,g2,b,alpha*255]).clip(0,255).astype(np.uint8)
def comps(a,y0=0,y1=None,min_area=6000,n=None):
    y1=y1 or a.shape[0];sub=a[y0:y1];fg=~key(sub);m=ndi.binary_opening(fg,iterations=3)
    lab,k=ndi.label(m);sz=ndi.sum(m,lab,range(1,k+1));objs=ndi.find_objects(lab)
    cs=sorted([(objs[i][1].start,i+1) for i,s in enumerate(sz) if s>min_area]);rgba=keyed_rgba(sub);out=[]
    for _,l in cs:
        bx=objs[l-1];keep=(lab[bx]==l)|ndi.binary_dilation(lab[bx]==l,iterations=4)
        c=rgba[bx].copy();c[:,:,3]=np.where(keep,c[:,:,3],0);out.append((c,(bx[1].start,bx[0].start+y0)))
    return out
def tint(rgba,hair,eye):
    a=rgba.astype(np.float32);r,g,b,al=a[:,:,0],a[:,:,1],a[:,:,2],a[:,:,3]
    L=0.299*r+0.587*g+0.114*b;sat=np.max(a[:,:,:3],2)-np.min(a[:,:,:3],2);out=a.copy()
    cy=(b>150)&(g>150)&(r<150)&(b-r>60)&(al>128)
    hm=(sat<22)&(L<222)&(al>0)&~cy
    hc=np.array(hexrgb(hair),np.float32);f=np.clip(L/150.0,0,1)[...,None];base=hc*f
    hi=np.clip((L-150)/105.0,0,1)[...,None]*0.55;tinted=base+(255-base)*hi*(L[...,None]>150)
    for c in range(3):out[:,:,c]=np.where(hm,tinted[:,:,c],out[:,:,c])
    th,ts,tv=colorsys.rgb_to_hsv(*[x/255 for x in hexrgb(eye)])
    ys,xs=np.where(cy)
    for y,x in zip(ys,xs):
        h_,s_,v_=colorsys.rgb_to_hsv(r[y,x]/255,g[y,x]/255,b[y,x]/255)
        rr,gg,bb=colorsys.hsv_to_rgb(th,min(1,s_*(0.55+0.45*ts)) if ts>0.05 else 0,min(1,v_*(0.7+0.3*tv)))
        out[y,x,0],out[y,x,1],out[y,x,2]=rr*255,gg*255,bb*255
    return out.clip(0,255).astype(np.uint8)
def skin_box(rgba):
    a=rgba.astype(int);r,g,b,al=a[:,:,0],a[:,:,1],a[:,:,2],a[:,:,3]
    sk=(r>190)&(g>140)&(b>120)&(r-b>14)&(r-g>4)&(al>128);lab,n=ndi.label(sk)
    if n==0:return None
    sz=ndi.sum(sk,lab,range(1,n+1));k=int(np.argmax(sz))+1;ys,xs=np.where(lab==k)
    return xs.min(),xs.max(),ys.min(),ys.max(),xs.mean(),ys.mean()
# 몸 시트
def load_bodies(path):
    a=np.array(Image.open(path).convert('RGB'));rgba=keyed_rgba(a)
    r,g,b=[a[:,:,i].astype(int) for i in range(3)];mag=(r>200)&(b>200)&(g<90)
    magd=ndi.binary_dilation(mag,iterations=2);rgba[magd,3]=0
    lab,n=ndi.label(mag);sz=ndi.sum(mag,lab,range(1,n+1));circles=[]
    for i,s in enumerate(sz):
        if s>3000:
            ys,xs=np.where(lab==i+1);circles.append((xs.mean(),ys.mean(),(xs.max()-xs.min()+ys.max()-ys.min()+2)/2))
    circles.sort()
    fg=~key(a);m=ndi.binary_opening(fg,iterations=3);lb,k=ndi.label(m);sz2=ndi.sum(m,lb,range(1,k+1));objs=ndi.find_objects(lb)
    cs=sorted([(objs[i][1].start,i+1) for i,s in enumerate(sz2) if s>6000])
    masks=[ndi.binary_dilation(lb==l,iterations=6) for _,l in cs]
    return rgba,circles,masks
def load_heads(path,rows):
    a=np.array(Image.open(path).convert('RGB'));return [[c for c,_ in comps(a,y0,y1)] for y0,y1 in rows]
def build(body,circle,mask,rgba_all,head,hair,eye,rot=0,face_ratio=0.42,chin_off=-0.04,pad=300,top=300,dx=0.08):
    cx,cy,d=circle;H=head
    hc=tint(H,hair,eye);sb=skin_box(hc)
    s=(d*face_ratio)/(sb[1]-sb[0]+1)
    hc=np.pad(hc,((pad,pad),(pad,pad),(0,0)));sbp=(sb[0]+pad,sb[1]+pad,sb[2]+pad,sb[3]+pad)
    pivot=((sbp[0]+sbp[1])/2.0,sbp[3]);Hh=Image.fromarray(hc,'RGBA').rotate(rot,resample=Image.BICUBIC,center=pivot)
    Hh=Hh.resize((max(1,round(Hh.width*s)),max(1,round(Hh.height*s))),Image.LANCZOS)
    px,py=pivot[0]*s,pivot[1]*s;tx=cx+dx*d;ty=cy+d/2+chin_off*d
    bm=rgba_all.copy();bm[~mask]=0
    sheet=Image.new('RGBA',(bm.shape[1],bm.shape[0]+top),(0,0,0,0));sheet.paste(Image.fromarray(bm,'RGBA'),(0,top))
    layer=Image.new('RGBA',sheet.size,(0,0,0,0));layer.paste(Hh,(round(tx-px),round(ty+top-py)),Hh)
    out=Image.alpha_composite(sheet,layer);return out
