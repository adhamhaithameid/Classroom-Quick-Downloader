"""Original CQD launch score: deterministic synthesis, no sampled recordings."""
import wave, json
from pathlib import Path
import numpy as np
out=Path(__file__).resolve().parents[1]/'composition/assets'
sr=48000; duration=23; n=sr*duration
music=np.zeros(n); fx=np.zeros(n); rng=np.random.default_rng(210926)
beat=60/110
def add(dst, signal, start, gain=1):
    i=round(start*sr); m=min(len(signal),len(dst)-i)
    if i>=0 and m>0: dst[i:i+m]+=signal[:m]*gain
def note(freq, length, decay=3):
    t=np.arange(round(length*sr))/sr
    return (np.sin(2*np.pi*freq*t)+.22*np.sin(4*np.pi*freq*t)+.06*np.sin(6*np.pi*freq*t))*np.minimum(t/.008,1)*np.exp(-decay*t)
chords=[[146.832,220,293.665,369.994],[130.813,196,261.626,329.628],[110,164.814,220,293.665],[97.999,146.832,196,246.942]]
for b in range(42):
    s=b*beat; chord=chords[(b//8)%4]
    t=np.arange(int(.3*sr))/sr
    kick=np.sin(2*np.pi*(48*t+4*(1-np.exp(-t*30))))*np.exp(-t*18)
    add(music,kick,s,.075)
    add(music,note(chord[0]/2,.42,8),s,.13)
    add(music,note(chord[(b%4)],.55,6),s+beat/2,.055)
    if b%2:
        t=np.arange(int(.085*sr))/sr
        noise=rng.normal(0,1,len(t)); noise=np.convolve(noise,np.ones(6)/6,'same')
        add(music,noise*np.exp(-t*65),s,.024)
    if b%8==0:
        t=np.arange(int(4*beat*sr))/sr
        env=np.minimum(t/.09,1)*np.exp(-t*1.1)
        pad=sum(np.sin(2*np.pi*f*t) for f in chord)/4*env
        add(music,pad,s,.105)
for s in [1.1,2.15,6.0]:
    t=np.arange(int(.055*sr))/sr
    click=(np.sin(2*np.pi*760*t)+rng.normal(0,.16,len(t)))*np.exp(-t*105)
    add(fx,click,s,.15 if s==6 else .055)
for s,f in [(8.74,587.33),(9.29,739.99),(9.83,880),(17.5,587.33)]:
    add(fx,note(f,.65,7),s,.09)
fade=np.minimum(np.arange(n)/sr/.22,1)*np.minimum((duration-np.arange(n)/sr)/1.5,1)
music*=fade; mixed=music+fx
def save(name,signal):
    stereo=np.column_stack([signal,signal*.98])
    with wave.open(str(out/name),'w') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())
save('music.wav',music); save('soundtrack.wav',mixed)
(out/'music-cues.json').write_text(json.dumps({'tempo':110,'duration':duration,'beats':[round(i*beat,4) for i in range(43)],'strongCues':[6,8.74,13.1,17.5]}))
print('Original score and synchronized SFX generated; peak',float(abs(mixed).max()))
