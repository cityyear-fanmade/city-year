#!/usr/bin/env python3
"""시지프 재단대: GPT가 그린 '마네킹이 옷을 입은 모습'(초록 배경, 마네킹=베이지, 옷=무채색 회색)을
게임용 두 장으로 가른다.  사용: python3 tools/sis-worn.py <원본폴더> [<출력폴더 기본 assets/sis>]
원본 이름: sis_w_mannequin.png, sis_w_daily.png, sis_w_suit.png, sis_w_coat.png, sis_w_gala.png, sis_w_cloak.png, sis_w_shroud.png
출력: sis_w_<이름>.png (배경 투명, 같은 틀로 잘라 412x734) + sis_wm_<이름>.png (옷 색칠 영역 마스크: 알파 255=옷)"""
import sys, os
from collections import deque
from PIL import Image
import numpy as np
W,H=412,734
BASE_W,BASE_Y=190,700   # 받침대 폭(픽셀), 받침대 바닥 높이
def load(p):
    a=np.array(Image.open(p).convert('RGB')).astype(int)
    r,g,b=a[...,0],a[...,1],a[...,2]
    green=(g>150)&(r<120)&(b<120)
    return a,green
def bbox(green):
    ys,xs=np.where(~green);return xs.min(),ys.min(),xs.max()+1,ys.max()+1
def fit(x0,y0,x1,y1):
    """경계상자를 412:734 틀에 넣는다(위아래 약간 여백, 가운데 정렬)."""
    ch=(y1-y0)*1.04;cw=ch*W/H
    if x1-x0>cw*0.98:cw=(x1-x0)*1.04;ch=cw*H/W
    cx=(x0+x1)/2;cy=(y0+y1)/2
    return int(cx-cw/2),int(cy-ch/2),int(cx+cw/2),int(cy+ch/2)
def main(src,dst):
    os.makedirs(dst,exist_ok=True)
    names=[f[6:-4] for f in sorted(os.listdir(src)) if f.startswith('sis_w_') and f.endswith('.png') and f!='sis_w_mannequin.png']
    for n in names:
        im=Image.open(os.path.join(src,f'sis_w_{n}.png')).convert('RGB')
        a=np.array(im).astype(int);r,g,b=a[...,0],a[...,1],a[...,2]
        green=(g>150)&(r<120)&(b<120)
        mx,mn=a.max(2),a.min(2);sat=(mx-mn)/np.maximum(mx,1)
        beige=(sat>=0.18)&(r>b+30)&~green
        if beige.sum()<500:print(n,'마네킹(베이지)이 안 보여 건너뜀');continue
        h,w=green.shape
        x0,y0,x1,y1=bbox(green)
        # 마네킹 크기를 일정하게: 받침대(진한 회색) 폭을 기준으로 배율을 정하고, 받침대 바닥·가운데를 같은 자리에 둔다
        dark=(~green)&(sat<0.18)&(mx<=108)&(mx>30)
        low=dark[int(y0+(y1-y0)*0.78):y1+1]
        rw=low.sum(1);bw=int(rw.max());ys_=np.where(rw>bw*0.5)[0]
        by=int(y0+(y1-y0)*0.78)+int(ys_.max());bxs=np.where(low[ys_.max()-2:ys_.max()+1].any(0))[0]
        bxs=np.where(low[int(ys_.min()):int(ys_.max())+1].any(0))[0];bcx=(bxs.min()+bxs.max())/2;bw=bxs.max()-bxs.min()
        k=BASE_W/bw   # 원본 1픽셀 = 결과 k픽셀
        cw,ch=W/k,H/k;box=(int(bcx-cw/2),int(by-(BASE_Y)/k),int(bcx+cw/2),int(by-(BASE_Y)/k+ch))
        bmax=int(np.where(beige)[0].max())
        gray=(~green)&(sat<0.18)&(mx>108)   # 옷의 밝은 회색(진한 회색 봉·받침대·외곽선·검은 띠는 제외)
        near=np.array(Image.fromarray((beige*255).astype('uint8'),'L').filter(__import__('PIL.ImageFilter',fromlist=['x']).MaxFilter(9)))>127
        gray&=~near
        ys=np.arange(h)[:,None]
        mask=gray.copy()
        rs=mask.sum(1)>3;run=0;cut=None;seen_g=False        # 옷 밑단 아래 빈 줄이 이어지면 그 아래(받침대 하이라이트)는 버린다
        for yy in range(h):
            if rs[yy]:seen_g=True;run=0
            elif seen_g:
                run+=1
                if run>=8:cut=yy;break
        if cut:mask[cut:]=False
        m8=Image.fromarray((mask*255).astype('uint8'),'L').filter(__import__('PIL.ImageFilter',fromlist=['x']).MaxFilter(5));mask=np.array(m8)>127
        rgba=np.dstack([a.astype('uint8'),np.where(green,0,255).astype('uint8')])
        Image.fromarray(rgba,'RGBA').crop(box).resize((W,H),Image.LANCZOS).save(os.path.join(dst,f'sis_w_{n}.png'),optimize=True)
        mk=Image.fromarray((mask*255).astype('uint8'),'L').crop(box).resize((W,H),Image.LANCZOS)
        Image.merge('LA',(Image.new('L',(W,H),255),mk)).save(os.path.join(dst,f'sis_wm_{n}.png'),optimize=True)
        print(n,'옷 영역',int(mask.sum()),'픽셀')
if __name__=='__main__':
    if len(sys.argv)<2:sys.exit(__doc__)
    main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(__file__),'..','assets','sis'))
