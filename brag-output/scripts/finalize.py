"""Extract the selected poster, bake frame zero, verify encoded delivery."""
import hashlib, json, subprocess
from pathlib import Path
r=Path(__file__).resolve().parents[1]
def run(args):
    return subprocess.run(args,check=True,capture_output=True).stdout
def probe(p):
    return json.loads(run(['ffprobe','-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,duration','-show_entries','format=duration,size','-of','json',str(p)]))
def audio_hash(p):
    return hashlib.sha256(run(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-c','copy','-f','adts','pipe:1'])).hexdigest()
video=r/'brag.mp4'; poster=r/'brag.jpg'; baked=r/'brag.poster.mp4'
before=probe(video); old_audio=audio_hash(video)
run(['ffmpeg','-v','error','-y','-ss','10.8','-i',str(video),'-frames:v','1','-q:v','2',str(poster)])
run(['ffmpeg','-v','error','-y','-i',str(video),'-i',str(poster),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(baked)])
after=probe(baked)
v=next(x for x in after['streams'] if x['codec_type']=='video')
assert (v['width'],v['height'],v['r_frame_rate'],v['nb_frames'])==(1920,1080,'30/1','690'),v
assert float(after['format']['duration'])==23
assert audio_hash(baked)==old_audio,'Audio packets changed'
baked.replace(video)
run(['ffmpeg','-v','error','-y','-i',str(video),'-frames:v','1',str(r/'validation/first-frame.png')])
run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',"select='eq(n,30)+eq(n,150)+eq(n,190)+eq(n,324)+eq(n,459)+eq(n,689)',scale=640:360,tile=3x2",'-frames:v','1',str(r/'validation/render-contact-sheet.jpg')])
run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'])
record={'before':before,'after':after,'audioPacketsPreserved':True,'fullDecodePassed':True,'posterSourceSeconds':10.8,'posterBakedIntoFrame':0,'audioSHA256':old_audio}
(r/'validation/delivery.json').write_text(json.dumps(record,indent=2))
print(json.dumps({'duration':23,'dimensions':'1920x1080','fps':30,'frames':690,'audio':'AAC, preserved','decode':'passed','sizeBytes':video.stat().st_size},indent=2))
