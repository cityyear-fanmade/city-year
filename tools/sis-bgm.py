"""시지프 전용 음악 가공: 수노(Suno)로 만든 곡 7개를 게임에서 반복 재생하기 좋게 다듬어 assets/bgm/sis_<이름>.mp3 로 내보낸다.
   실행: python3 tools/sis-bgm.py <원본 폴더>   (원본은 mp4/mp3 어느 형식이든 ffmpeg가 읽을 수 있으면 된다. 저장소에는 원본을 두지 않는다)
   처리: ① 끝의 페이드아웃(무음 꼬리)을 자른다 ② 끝 4초와 처음 4초를 겹쳐 이어서 반복할 때 끊기지 않게 한다
         ③ 음량을 기존 곡에 맞춘다(보스 -14 LUFS, 나머지 -15.5 LUFS, 최대 -1.5 dBTP) ④ 112kbps 스테레오 mp3
   원본 파일 이름(부분 일치) → 장면 이름: 아래 MAP. 장면 배정은 이 표에서만 바꾼다."""
import subprocess, sys, os, glob, re, wave
import numpy as np
MAP=[('the_empty_ballroom','day'),('after_hours_fitting','tailor'),('weight_of_the_concrete','hunt'),('the_velvet_aisle','velvet'),
     ('the_unmarked_corridor','corridor'),('weight_of_the_iron_sky','boss'),('the_weight_of_the_downpour','rain')]
LUFS={'boss':-14.0}
XF=4.0
src=sys.argv[1] if len(sys.argv)>1 else '.'
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','bgm')
tmp='/tmp/sis-bgm-work';os.makedirs(tmp,exist_ok=True)
def run(*a,**k):return subprocess.run(a,check=True,capture_output=True,text=True,**k)
def rms_db(a,sr):
    n=len(a)//sr;return np.array([20*np.log10(np.sqrt((a[i*sr:(i+1)*sr]**2).mean())+1e-9) for i in range(n)])
for key,name in MAP:
    fs=[f for f in glob.glob(os.path.join(src,'*')) if key in os.path.basename(f) and f.endswith(('.mp4','.mp3','.wav','.m4a'))]
    if not fs: print('없음',key);continue
    f=fs[0];wav=os.path.join(tmp,name+'.wav')
    run('ffmpeg','-v','error','-y','-i',f,'-vn','-ac','2','-ar','44100',wav)
    w=wave.open(wav);a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32).reshape(-1,2).mean(axis=1)/32768;sr=w.getframerate()
    r=rms_db(a,sr);ref=np.median(r[len(r)//4:]);keep=len(r)
    while keep>10 and r[keep-1]<ref-14:keep-=1      # 끝의 페이드아웃·무음 꼬리를 자른다
    end=float(keep)
    # 이음새: [XF, end-XF] 본문 + (끝 XF초 → 처음 XF초) 겹침. 반복하면 본문 시작(XF초 지점)으로 자연스럽게 이어진다
    flt=(f"[0:a]atrim=start={XF}:end={end-XF},asetpts=PTS-STARTPTS[b];"
         f"[0:a]atrim=start={end-XF}:end={end},asetpts=PTS-STARTPTS[t];"
         f"[0:a]atrim=start=0:end={XF},asetpts=PTS-STARTPTS[h];"
         f"[t][h]acrossfade=d={XF}:c1=tri:c2=tri[x];[b][x]concat=n=2:v=0:a=1[o]")
    loop=os.path.join(tmp,name+'_loop.wav');run('ffmpeg','-v','error','-y','-i',wav,'-filter_complex',flt,'-map','[o]',loop)
    tgt=LUFS.get(name,-15.5)
    p=run('ffmpeg','-hide_banner','-i',loop,'-af',f'loudnorm=I={tgt}:TP=-1.5:LRA=11:print_format=json','-f','null','-')
    import json;j=json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}',p.stderr,re.S).group(0))
    af=(f"loudnorm=I={tgt}:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    dst=os.path.join(out,f'sis_{name}.mp3');run('ffmpeg','-v','error','-y','-i',loop,'-af',af,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','112k',dst)
    print(f"{name:8} ← {os.path.basename(f)[:40]}  본문 {end-2*XF:.0f}초+이음 {XF:.0f}초 · 목표 {tgt} LUFS · {os.path.getsize(dst)/1e6:.1f}MB")
