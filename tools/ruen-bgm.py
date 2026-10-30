"""뤼엔 전용 BGM 생성기: 잔잔하고 쓸쓸한 곡을 numpy로 직접 합성한다 (외부 음원 없음, 선율·화성은 직접 만들었다).
   실행: python3 tools/ruen-bgm.py → assets/bgm/ruen_boss.mp3 (ffmpeg 필요)
   A 단조 · 54BPM · 16마디(약 71초)를 되풀이: 피아노 아르페지오 + 현 패드 + 파도 소리, 9마디부터 선율이 얹힌다."""
import numpy as np, subprocess, wave, os
SR=44100; BPM=54; BEAT=60/BPM; BARS=16; L=int(BARS*4*BEAT*SR); TAIL=int(4*SR)
rng=np.random.default_rng(7)
buf=np.zeros((L+TAIL,2))
mid=lambda m:440*2**((m-69)/12)
def add(sig,t0,pan=0.0):
    i=int(t0*SR); n=min(len(sig),len(buf)-i)
    if n<=0:return
    buf[i:i+n,0]+=sig[:n]*(1-pan)*0.5*2*0.5+sig[:n]*0; buf[i:i+n,1]+=sig[:n]*(1+pan)*0.5
def env(n,a,r,dec=None):
    t=np.arange(n)/SR; e=np.minimum(1,t/max(a,1e-3)); 
    if dec: e=e*np.exp(-t/dec)
    tail=np.minimum(1,(n/SR-t)/max(r,1e-3)); return e*np.clip(tail,0,1)
def piano(m,dur,vel=0.3):
    n=int((dur+1.8)*SR); t=np.arange(n)/SR; f=mid(m)
    s=sum(a*np.sin(2*np.pi*f*k*t*(1+0.0004*k*k)) for k,a in [(1,1),(2,0.42),(3,0.2),(4,0.1),(5,0.05)])
    return s*env(n,0.004,0.6,dec=1.5)*vel
def pad(ms,dur,vel=0.07):
    n=int((dur+1.2)*SR); t=np.arange(n)/SR; s=0
    for m in ms:
        f=mid(m)
        for dt in (-0.003,0,0.003):
            s=s+np.sin(2*np.pi*f*(1+dt)*t)+0.3*np.sin(2*np.pi*2*f*(1+dt)*t)
    return s/ (len(ms)*3)*env(n,1.0,1.0)*vel*4
def lead(m,dur,vel=0.2):
    n=int((dur+0.8)*SR); t=np.arange(n)/SR; f=mid(m); vib=1+0.004*np.sin(2*np.pi*5*t)*np.minimum(1,t/0.8)
    s=np.sin(2*np.pi*f*vib*t)+0.25*np.sin(4*np.pi*f*vib*t)+0.08*np.sin(6*np.pi*f*t)
    return s*env(n,0.06,0.5)*vel
def bass(m,dur,vel=0.22):
    n=int((dur+0.5)*SR); t=np.arange(n)/SR; f=mid(m)
    return (np.sin(2*np.pi*f*t)+0.2*np.sin(4*np.pi*f*t))*env(n,0.03,0.4,dec=2.2)*vel
CH=[('Am',45,[57,60,64,67]),('F',41,[53,57,60,65]),('C',48,[55,60,64,67]),('G',43,[55,59,62,67]),('Am',45,[57,60,64,67]),('F',41,[53,57,60,65]),('Dm',38,[50,57,62,65]),('E',40,[52,56,59,64])]
PAT=[0,1,2,3,2,1,2,1]
for bar in range(BARS):
    name,root,tones=CH[bar%8]; t0=bar*4*BEAT
    add(pad([root+12]+tones,4*BEAT),t0,0)
    add(bass(root,4*BEAT),t0,0)
    for k,ix in enumerate(PAT):
        m=tones[ix]+(12 if ix<2 else 0)
        add(piano(m,BEAT/2,0.25*(0.85 if k%2 else 1.0)),t0+k*BEAT/2,(-0.35 if k%2 else 0.35))
MEL={2:[(0,4,76)],6:[(0,4,69)],
 8:[(0,2,76),(2,1,74),(3,1,72)],9:[(0,2,72),(2,2,69)],10:[(0,1.5,76),(1.5,.5,79),(2,2,76)],11:[(0,2,74),(2,2,71)],
 12:[(0,1,72),(1,1,76),(2,2,81)],13:[(0,1,79),(1,1,77),(2,2,76)],14:[(0,2,74),(2,1,77),(3,1,76)],15:[(0,3,76)]}
for bar,notes in MEL.items():
    for b0,d,m in notes: add(lead(m,d*BEAT),bar*4*BEAT+b0*BEAT,0.1)
# 파도 소리: 저역 통과한 잡음이 아주 느리게 밀려왔다 빠진다
n=len(buf); noise=rng.standard_normal(n); F=np.fft.rfft(noise); fr=np.fft.rfftfreq(n,1/SR)
F*=1/(1+(fr/700)**4); sea=np.fft.irfft(F,n); sea/=np.abs(sea).max()
t=np.arange(n)/SR; lfo=0.55+0.45*np.sin(2*np.pi*(1/13.5)*t-1.2); sea*=lfo**2*0.16
buf[:,0]+=sea; buf[:,1]+=np.roll(sea,2000)
# 잔향
ir_n=int(2.2*SR); ir=rng.standard_normal(ir_n)*np.exp(-np.arange(ir_n)/SR/0.7); ir[:int(0.02*SR)]*=0.2
out=np.zeros_like(buf)
for c in range(2):
    N=len(buf[:,c])+len(ir)-1; nfft=1<<(N-1).bit_length()
    wet=np.fft.irfft(np.fft.rfft(buf[:,c],nfft)*np.fft.rfft(ir,nfft),nfft)[:len(buf)]
    out[:,c]=buf[:,c]*0.8+wet*0.045
# 꼬리를 처음에 겹쳐 이음매 없이 되풀이
loop=out[:L].copy(); loop[:TAIL]+=out[L:L+TAIL]
loop/=np.abs(loop).max()/0.72
pcm=(loop*32767).astype('<i2')
os.makedirs('assets/bgm',exist_ok=True)
with wave.open('/tmp/ruen_boss.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/ruen_boss.wav','-b:a','112k','assets/bgm/ruen_boss.mp3'],check=True)
print('ok',round(L/SR,1),'초',os.path.getsize('assets/bgm/ruen_boss.mp3')//1024,'KB')
