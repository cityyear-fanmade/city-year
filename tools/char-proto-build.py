#!/usr/bin/env python3
"""외형 시험판(proto/char-test.html) 생성기: 몸 시트·머리 시트를 잘라 data URI로 넣고, 머리색·눈색 합성은 브라우저(JS)에서 한다.
사용: python3 tools/char-proto-build.py   → proto/char-test.html"""
import importlib.util,base64,io,json,numpy as np
from PIL import Image
from scipy import ndimage as ndi
spec=importlib.util.spec_from_file_location('cc','tools/char-compose.py');C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
def b64(im,q=88):
    b=io.BytesIO();im.save(b,'WEBP',quality=q,method=6);return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
BODY_H=560
bodies=[]
for sheet,aff,ranks in [('assets/character/_src_body_thumb_capo_under_don.webp','thumb',['카포','언더보스','대부'])]:   # 검지(전령·수행자·대행자) 시트는 파일이 오면 ('assets/character/_src_body_index_3.webp','index',['전령','수행자','대행자'])를 여기에 더한다
    rgba,circ,masks=C.load_bodies(sheet)
    for i,(c,m) in enumerate(zip(circ,masks)):
        bm=rgba.copy();bm[~m]=0
        ys,xs=np.where(bm[:,:,3]>10);y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        crop=bm[y0:y1,x0:x1];s=BODY_H/crop.shape[0]
        im=Image.fromarray(crop,'RGBA').resize((round(crop.shape[1]*s),BODY_H),Image.LANCZOS)
        cx,cy,d=(c[0]-x0)*s,(c[1]-y0)*s,c[2]*s
        bodies.append(dict(aff=aff,rank=ranks[i],img=b64(im),w=im.width,h=im.height,cx=cx,cy=cy,d=d))
heads=[]
SRC='assets/character/_src_head_bob_short.webp'
a=np.array(Image.open(SRC).convert('RGB'));H=a.shape[0]
rows=C.load_heads(SRC,[(0,H//2),(H//2,H)])
EXP=['idle','atk','hit','down']
for si,(name,row) in enumerate(zip(['bob','short'],rows)):
    for ei,h in enumerate(row):
        sb=C.skin_box(h);s=240/h.shape[0]
        im=Image.fromarray(h,'RGBA').resize((round(h.shape[1]*s),240),Image.LANCZOS)
        heads.append(dict(shape=name,exp=EXP[ei],img=b64(im,92),w=im.width,h=im.height,
          sk=[sb[0]*s,sb[1]*s,sb[2]*s,sb[3]*s]))


# --- 전투용 도트 몸 시트 (머리 자리 마젠타 원 18칸: 대기4·공격4·회피3·피격3·쓰러짐4) ---
frames=[]
try:
    a=np.array(Image.open('assets/character/_src_dot_body_capo.png').convert('RGB'));rg=C.keyed_rgba(a)
    r_,g_,b_=[a[:,:,i].astype(int) for i in range(3)];mag=(r_>200)&(b_>200)&(g_<90)
    lab,n=ndi.label(mag);sz=ndi.sum(mag,lab,range(1,n+1));cs=[]
    for i,sv in enumerate(sz):
        if sv>800:
            ys,xs=np.where(lab==i+1);cs.append((xs.mean(),ys.mean(),(xs.max()-xs.min()+ys.max()-ys.min()+2)/2))
    cs.sort(key=lambda c:(round(c[1]/220),c[0]))
    fg=~C.key(a);fgd=ndi.binary_dilation(fg,iterations=7);lb,k=ndi.label(fgd)
    rgba=rg.copy();rgba[ndi.binary_dilation(mag,iterations=1),3]=0
    names=['idle']*4+['atk']*4+['dodge']*3+['hit']*3+['down']*4
    for (cx,cy,d),nm in zip(cs,names):
        l=lb[int(cy),int(cx)];m=(lb==l)&fg|(lb==l)&mag
        ys,xs=np.where(lb==l);y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        # 마젠타 원 위쪽 끝이 잘리지 않게 원 영역도 포함
        y0=min(y0,int(cy-d/2));x0=min(x0,int(cx-d/2));x1=max(x1,int(cx+d/2))
        crop=rgba.copy();crop[~((lb==l)|mag)]=0;crop=crop[y0:y1,x0:x1]
        ys2,xs2=np.where(crop[:,:,3]>10);fy=ys2.max()+1;crop=crop[:fy]   # 발바닥(가장 아래 칸)에서 자른다
        frames.append(dict(pose=nm,img=b64(Image.fromarray(crop,'RGBA'),95),w=crop.shape[1],h=crop.shape[0],cx=cx-x0,cy=cy-y0,d=d,foot=int(fy)))
except Exception as e:
    print('도트 시트 건너뜀',e)


# --- 전투용 도트 머리 시트 (단발·숏컷 × 대기·공격·회피·피격·쓰러짐) ---
pheads=[]
try:
    HS='assets/character/_src_dot_head_bob_short.png';ah=np.array(Image.open(HS).convert('RGB'));HH=ah.shape[0]
    prow=C.load_heads(HS,[(0,HH//2),(HH//2,HH)])
    for nm,row in zip(['bob','short'],prow):
        for pose,hd in zip(['idle','atk','dodge','hit','down'],row):
            ys,xs=np.where(hd[:,:,3]>10);hd=hd[ys.min():ys.max()+1,xs.min():xs.max()+1]
            im=Image.fromarray(hd,'RGBA');sc=200/max(im.size)
            if sc<1:im=im.resize((round(im.width*sc),round(im.height*sc)),Image.NEAREST)
            pheads.append(dict(shape=nm,pose=pose,img=b64(im,95),w=im.width,h=im.height))
except Exception as e:
    print('도트 머리 건너뜀',e)


# --- 던파식 도트 시트(머리까지 한 몸): 대기3·공격5·회피3·피격3·쓰러짐4 ---
dnf=[]
try:
    a=np.array(Image.open('assets/character/_src_dnf_sprite_capo.png').convert('RGB'));rg=C.keyed_rgba(a);fgm=~C.key(a)
    lb,k=ndi.label(ndi.binary_dilation(fgm,iterations=6));objs=ndi.find_objects(lb);items=[]
    for i,o in enumerate(objs):
        if ((lb[o]==i+1)&fgm[o]).sum()>3000:items.append(((o[0].start+o[0].stop)/2,(o[1].start+o[1].stop)/2,i+1,o))
    bands=[140,430,700,985,1290]
    items.sort(key=lambda t:(min(range(5),key=lambda j:abs(bands[j]-t[0])),t[1]))
    names=['idle']*3+['atk']*5+['dodge']*3+['hit']*3+['down']*4
    for (cy,cx,l,o),nm in zip(items,names):
        crop=rg[o].copy();crop[~(ndi.binary_dilation(lb[o]==l,iterations=2))]=0
        ys,xs=np.where(crop[:,:,3]>10);crop=crop[ys.min():ys.max()+1,xs.min():xs.max()+1]
        dnf.append(dict(pose=nm,img=b64(Image.fromarray(crop,'RGBA'),93),w=crop.shape[1],h=crop.shape[0]))
except Exception as e:
    print('던파식 시트 건너뜀',e)


# --- B2(4.5등신) 몸 시트(대기4·공격6·회피3·피격3·쓰러짐4) + 머리 시트(단발·숏컷 × 대기4·공격5·회피3·피격3·쓰러짐4) ---
def clean_fg(a,xmin):
    r,g,b=[a[:,:,i].astype(int) for i in range(3)];key=(g-np.maximum(r,b))>60
    dark=(a.astype(int).sum(2)<160)&~key;rows=np.where(dark[:,xmin:].mean(1)>0.45)[0];sep=np.zeros(key.shape,bool)
    for y in rows:sep[max(0,y-2):y+3,:]=True
    fg=~(key|sep);fg[:,:xmin]=False;return fg,key|sep
def split_comps(a,xmin,minh=40,minw=30,minar=600):
    fg,bad=clean_fg(a,xmin);lb,n=ndi.label(ndi.binary_dilation(fg,iterations=3));out=[]
    for i,o in enumerate(ndi.find_objects(lb)):
        h=o[0].stop-o[0].start;w=o[1].stop-o[1].start
        if h>minh and w>minw and ((lb[o]==i+1)&fg[o]).sum()>minar:out.append(((o[0].start+o[0].stop)/2,(o[1].start+o[1].stop)/2,lb,i+1,o))
    return out,fg
frames2=[];pheads2=[]
try:
    ab=np.array(Image.open('assets/character/_src_b2_body.png').convert('RGB'));rgb=C.keyed_rgba(ab)
    r_,g_,b_=[ab[:,:,i].astype(int) for i in range(3)];mag=(r_>200)&(b_>200)&(g_<90)
    items,fg=split_comps(ab,150,60,30,1500)
    bandsb=[100,290,470,640,820];items.sort(key=lambda t:(min(range(5),key=lambda j:abs(bandsb[j]-t[0])),t[1]))
    names=['idle']*4+['atk']*6+['dodge']*3+['hit']*3+['down']*4
    for (cy,cx,lb,l,o),nm in zip(items,names):
        m=ndi.binary_dilation(lb[o]==l,iterations=2);crop=rgb[o].copy();crop[~m]=0
        mm=mag[o]&m;ys,xs=np.where(mm);ccx,ccy=xs.mean(),ys.mean();d=(xs.max()-xs.min()+ys.max()-ys.min()+2)/2
        crop[ndi.binary_dilation(mm,iterations=1)]=(0,0,0,0)
        ys2,xs2=np.where(crop[:,:,3]>10);y0,y1,x0,x1=min(ys2.min(),int(ccy-d/2)),ys2.max()+1,min(xs2.min(),int(ccx-d/2)),max(xs2.max()+1,int(ccx+d/2))
        crop=crop[y0:y1,x0:x1]
        frames2.append(dict(pose=nm,img=b64(Image.fromarray(crop,'RGBA'),94),w=crop.shape[1],h=crop.shape[0],cx=ccx-x0,cy=ccy-y0,d=d))
    ah=np.array(Image.open('assets/character/_src_b2_head.png').convert('RGB'));rgh=C.keyed_rgba(ah)
    items,fg=split_comps(ah,420,40,30,600);bandsh=[45,135,225,315,405,500,590,680,770,860]
    items.sort(key=lambda t:(min(range(10),key=lambda j:abs(bandsh[j]-t[0])),t[1]))
    cnt=[4,5,3,3,4];poses=['idle','atk','dodge','hit','down'];k=0
    for si,shape in enumerate(['bob','short']):
        for pi,pn in enumerate(poses):
            for j in range(cnt[pi]):
                cy,cx,lb,l,o=items[k];k+=1
                m=ndi.binary_dilation(lb[o]==l,iterations=2);crop=rgh[o].copy();crop[~m]=0
                ys2,xs2=np.where(crop[:,:,3]>10);crop=crop[ys2.min():ys2.max()+1,xs2.min():xs2.max()+1]
                pheads2.append(dict(shape=shape,pose=pn,j=j,img=b64(Image.fromarray(crop,'RGBA'),94),w=crop.shape[1],h=crop.shape[0]))
except Exception as e:
    import traceback;traceback.print_exc();print('B2 시트 건너뜀',e)

tpl=open('proto/char-test.tpl.html',encoding='utf8').read()
open('proto/char-test.html','w',encoding='utf8').write(tpl.replace('/*__DATA__*/null',json.dumps(dict(bodies=bodies,heads=heads,frames=frames,pheads=pheads,dnf=dnf,frames2=frames2,pheads2=pheads2))))
print('bodies',len(bodies),'heads',len(heads),'size',len(tpl)+len(json.dumps(dict(bodies=bodies,heads=heads,frames=frames,pheads=pheads,dnf=dnf,frames2=frames2,pheads2=pheads2))))
