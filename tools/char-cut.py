#!/usr/bin/env python3
"""GPT가 그린 포즈 시트(순초록 배경, 가로 한 줄 4포즈)를 잘라 투명 PNG 4장으로 만든다.
사용: python3 -I tools/char-cut.py <시트.png|webp> <이름접두사 예: ch_thumb_soldato> [출력폴더=assets/character]
- 초록 키 + 가장자리 초록 번짐 제거
- 연결 덩어리로 4포즈를 왼쪽부터 나눈다 (칸이 맞닿아도 된다)
- 네 포즈에 같은 배율을 쓰고, 발이 닿는 선과 가로 중심을 맞춰 512×512 캔버스에 놓는다"""
import sys,os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
POSES=['idle','atk','hit','down']
def main(src,prefix,out='assets/character',size=512,pad=16):
    im=Image.open(src).convert('RGB');a=np.array(im).astype(np.float32)
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    gr=g-np.maximum(r,b)                               # 초록 정도
    alpha=1-np.clip((gr-40)/110,0,1)                   # 순초록 → 0, 캐릭터 → 1
    # 가장자리 초록 번짐 제거: 초록이 다른 채널보다 큰 만큼 깎는다
    spill=np.maximum(0,g-np.maximum(r,b))
    g2=np.where(alpha>0,np.minimum(g,np.maximum(r,b)+8),g)
    rgb=np.stack([r,g2,b],-1)
    mask=alpha>0.5
    mask=ndi.binary_opening(mask,iterations=2)
    lab,n=ndi.label(mask);sz=ndi.sum(mask,lab,range(1,n+1))
    objs=ndi.find_objects(lab)
    comps=sorted([(objs[i][1].start,i+1) for i,s in enumerate(sz) if s>4000])
    if len(comps)!=4: sys.exit(f'포즈 덩어리가 4개가 아니다({len(comps)}개): 서로 붙었거나 조각이 많다')
    rgba=np.dstack([rgb,alpha*255]).clip(0,255).astype(np.uint8)
    # 같은 배율: 네 포즈 중 가장 큰 것이 캔버스에 들어가게
    boxes=[objs[l-1] for _,l in comps]
    H=[bx[0].stop-bx[0].start for bx in boxes];W=[bx[1].stop-bx[1].start for bx in boxes]
    s=min((size-2*pad)/max(H),(size-2*pad)/max(W))
    os.makedirs(out,exist_ok=True);res=[]
    for pose,(x0,l),bx in zip(POSES,comps,boxes):
        ys,xs=bx;m=(lab[bx]==l)|ndi.binary_dilation(lab[bx]==l,iterations=3)   # 외곽선 번짐을 조금 포함
        crop=rgba[bx].copy();crop[:,:,3]=np.where(m,crop[:,:,3],0)
        t=Image.fromarray(crop,'RGBA');t=t.resize((max(1,round(t.width*s)),max(1,round(t.height*s))),Image.LANCZOS)
        can=Image.new('RGBA',(size,size),(0,0,0,0))
        can.paste(t,((size-t.width)//2,size-pad-t.height),t)   # 발 선(바닥)·가로 중심
        f=os.path.join(out,f'{prefix}_{pose}.png');can.save(f);res.append(f)
    print('만든 파일:',*res,sep='\n  ');print('배율',round(s,3))
if __name__=='__main__':
    if len(sys.argv)<3:sys.exit(__doc__)
    main(sys.argv[1],sys.argv[2],*(sys.argv[3:4] or ['assets/character']))
