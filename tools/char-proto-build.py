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

tpl=open('proto/char-test.tpl.html',encoding='utf8').read()
open('proto/char-test.html','w',encoding='utf8').write(tpl.replace('/*__DATA__*/null',json.dumps(dict(bodies=bodies,heads=heads,frames=frames,pheads=pheads))))
print('bodies',len(bodies),'heads',len(heads),'size',len(tpl)+len(json.dumps(dict(bodies=bodies,heads=heads,frames=frames,pheads=pheads))))
