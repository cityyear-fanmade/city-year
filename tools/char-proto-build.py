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

tpl=open('proto/char-test.tpl.html',encoding='utf8').read()
open('proto/char-test.html','w',encoding='utf8').write(tpl.replace('/*__DATA__*/null',json.dumps(dict(bodies=bodies,heads=heads))))
print('bodies',len(bodies),'heads',len(heads),'size',len(tpl)+len(json.dumps(dict(bodies=bodies,heads=heads))))
