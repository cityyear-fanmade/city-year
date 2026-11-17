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
def load(p):
    a=np.array(Image.open(p).convert('RGB')).astype(int)
    r,g,b=a[...,0],a[...,1],a[...,2]
    green=(g>150)&(r<120)&(b<120)
    return a,green
def bbox(green):
    ys,xs=np.where(~green);return xs.min(),ys.min(),xs.max()+1,ys.max()+1
def main(src,dst):
    os.makedirs(dst,exist_ok=True)
    ma,mg=load(os.path.join(src,'sis_w_mannequin.png'))
    x0,y0,x1,y1=bbox(mg)
    pad=int((y1-y0)*0.02);x0-=pad;y0-=pad;x1+=pad;y1+=pad
    # 마네킹 비율(412:734)에 맞춰 폭을 맞춘다
    cw=(y1-y0)*W/H;cx=(x0+x1)/2;x0=int(cx-cw/2);x1=int(cx+cw/2)
    box=(x0,y0,x1,y1)
    ms=(ma.max(2)-ma.min(2))/np.maximum(ma.max(2),1);bge=(ms>0.18)&~mg&(ma[...,0]>ma[...,2]+30);bmax=int(np.where(bge)[0].max())  # 베이지(마네킹 몸)가 끝나는 줄
    names=[f[6:-4] for f in os.listdir(src) if f.startswith('sis_w_') and f.endswith('.png') and f!='sis_w_mannequin.png']
    for n in names:
        im=Image.open(os.path.join(src,f'sis_w_{n}.png')).convert('RGB')
        a=np.array(im).astype(int);r,g,b=a[...,0],a[...,1],a[...,2]
        green=(g>150)&(r<120)&(b<120)
        mx,mn=a.max(2),a.min(2);sat=(mx-mn)/np.maximum(mx,1)
        gray=(~green)&(sat<0.18)&(mx>70)           # 옷(무채색, 외곽선 제외)
        beige=(sat>=0.18)&(r>b+30)&~green
        near=np.array(Image.fromarray((beige*255).astype('uint8'),'L').filter(__import__('PIL.ImageFilter',fromlist=['x']).MaxFilter(9)))>127
        gray&=~near                                  # 마네킹 몸 가장자리의 번진 픽셀 제외
        h,w=gray.shape
        # 옷 = 무채색 영역 중 봉·받침대 위쪽. 마네킹 몸(베이지)이 끝나는 줄 근처까지만 보고, 그 아래는 폭이 넓은 줄(옷 밑단)만 옷으로 본다
        ys=np.arange(h)[:,None]
        rowgray=gray.sum(1)
        wide=(rowgray>0.2*(x1-x0))[:,None]
        mask=gray&((ys<=bmax)|((ys<=bmax+0.10*(y1-y0))&wide))
        mask[: y0]=False
        m8=Image.fromarray((mask*255).astype('uint8'),'L').filter(__import__('PIL.ImageFilter',fromlist=['x']).MaxFilter(5));mask=np.array(m8)>127
        rgba=np.dstack([a.astype('uint8'),np.where(green,0,255).astype('uint8')])
        out=Image.fromarray(rgba,'RGBA').crop(box).resize((W,H),Image.LANCZOS);out.save(os.path.join(dst,f'sis_w_{n}.png'),optimize=True)
        mk=Image.fromarray((mask*255).astype('uint8'),'L').crop(box).resize((W,H),Image.LANCZOS)
        Image.merge('LA',(Image.new('L',(W,H),255),mk)).save(os.path.join(dst,f'sis_wm_{n}.png'),optimize=True)
        print(n,'옷 영역',int(mask.sum()),'픽셀')
if __name__=='__main__':
    if len(sys.argv)<2:sys.exit(__doc__)
    main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(__file__),'..','assets','sis'))
