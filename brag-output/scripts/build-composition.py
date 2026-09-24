from pathlib import Path
import json
out=Path(__file__).resolve().parents[1]/'composition'
audio=json.loads((out/'assets/audio-data.json').read_text())
(out/'assets/audio-data.js').write_text('window.CQD_AUDIO='+json.dumps(audio,separators=(',',':'))+';')
rows=''
for i,(name,kind) in enumerate([('Lecture notes.pdf','PDF'),('Practice sheet.pdf','PDF'),('Seminar slides.pptx','Microsoft PowerPoint')]):
    rows+=f'''<div class="file-row" id="file-{i}"><div class="file-icon">{ 'P' if i==2 else 'PDF'}</div><div class="file-copy"><div class="file-title">{name}</div><div class="file-type">{kind}</div></div>
    <div class="single-idle native-control" id="idle-{i}"><button class="cqd-download-btn" aria-label="Download {name}"><span class="cqd-icon-wrapper"><span class="cqd-download-icon"></span></span><span class="cqd-label">Download</span></button></div>
    <div class="single-done" id="done-{i}"><button class="cqd-download-btn cqd-success"><span class="cqd-icon-wrapper"><img src="assets/success.svg" width="24" height="24" alt=""></span><span class="cqd-label">Downloaded</span></button></div></div>'''
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1920,height=1080"><title>CQD — One last click</title>
<script src="assets/gsap.min.js"></script><script src="assets/audio-data.js"></script><link rel="stylesheet" href="assets/cqd-controls.css">
<style>
@font-face{font-family:'Plus Jakarta Sans';src:url('assets/PlusJakartaSans.ttf') format('truetype');font-weight:200 800;font-display:block}
*{box-sizing:border-box}body{margin:0;background:#fafcfb;color:#1a1a2e;font-family:'Plus Jakarta Sans',sans-serif}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#fafcfb}
.brand{position:absolute;top:60px;left:84px;display:flex;align-items:center;gap:18px;z-index:20}.brand img{width:62px;height:62px}.brand-name{font-weight:800;font-size:25px;letter-spacing:-.6px}.brand-sub{font-size:17px;color:#46564d;margin-top:5px;letter-spacing:1.8px}
.top-note{position:absolute;top:82px;right:90px;font-size:22px;color:#46564d}.top-line{position:absolute;left:84px;right:84px;top:158px;height:2px;background:#d7e4db}
.bottom{position:absolute;bottom:40px;left:84px;right:84px;display:flex;align-items:center;justify-content:space-between;z-index:30;font-size:20px;color:#46564d}.bottom-sign{font-size:18px;letter-spacing:2px;font-weight:700}.rule{position:absolute;left:84px;bottom:91px;width:1752px;height:4px;background:#1a8b55;transform-origin:left center}
.clip{position:absolute;inset:0}.copy{position:absolute;left:84px;top:270px;width:670px}.eyebrow{font-size:23px;font-weight:700;letter-spacing:3px;color:#137a47;margin-bottom:25px}.headline{font-size:86px;line-height:1.09;letter-spacing:-5px;font-weight:800;margin:0}.headline span{display:block}.sub{font-size:29px;line-height:1.5;margin-top:30px;color:#46564d}.accent{color:#137a47}
#demo-stage{position:absolute;left:820px;top:260px;width:1000px;height:660px;z-index:4}.stage-content{width:100%;height:100%}.ui-scale{transform:scale(1.46);transform-origin:top left;width:670px;height:432px}.post{position:relative;width:670px;height:408px;border:1.5px solid #d5ded8;border-radius:20px;background:#fff;box-shadow:0 24px 55px rgba(26,64,44,.10);padding:24px}.post-top{height:65px;display:flex;align-items:flex-start;position:relative}.course-icon{width:42px;height:42px;background:#e9f2ed;color:#137a47;border-radius:50%;display:grid;place-items:center;font-size:23px}.post-heading{margin-left:14px;font-size:17px;font-weight:700;padding-top:1px}.post-meta{font-size:12px;color:#4f5f56;font-weight:400;margin-top:6px}.dots{position:absolute;right:0;top:5px;color:#4f5f56;font-size:23px}.files{display:flex;flex-direction:column;gap:13px}.file-row{position:relative;display:flex;align-items:center;height:78px;border:1px solid #c8d1ca;border-radius:12px;padding:12px 14px;background:#fff}.file-icon{height:44px;width:36px;background:#f2e6e6;color:#932c2c;border-radius:4px;display:grid;place-items:center;font-size:10px;font-weight:800;border-top:5px solid #a74747}.file-copy{padding-left:14px}.file-title{font-size:17px;font-weight:500;line-height:1.5}.file-type{font-size:12px;color:#4f5f56;margin-top:3px}.single-idle,.single-done{position:absolute;inset:0;pointer-events:none}.single-idle{opacity:0}.single-done{opacity:0}.single-done .cqd-download-btn{right:9px}.cqd-download-btn{font-family:system-ui,sans-serif!important}.cqd-download-btn.cqd-success{background:#008522!important}.all-wrap{position:absolute;right:36px;top:0;opacity:0}.all-wrap button{position:relative!important;inset:auto!important;transform:none!important;font-family:system-ui,sans-serif!important;margin:0!important}.all-wrap .cqd-download-all-btn{height:38px!important}.all-progress,.all-done{position:absolute!important;right:36px;top:0;opacity:0}.all-done .cqd-download-all-btn{background:#008522!important}.all-progress .cqd-download-all-btn{background:#005dd7}.all-wrap img{width:18px;height:18px}.demo-caption{position:absolute;top:635px;left:6px;font-size:20px;color:#46564d}.context-label{position:absolute;left:0;top:-60px;font-size:23px;color:#46564d}.context-label b{color:#1a1a2e}.demo-marker{position:absolute;bottom:14px;left:24px;font-size:12px;color:#4f5f56}.opening{position:absolute;right:20px;bottom:13px;color:#46564d;font-size:12px;opacity:0}
#cursor{position:absolute;left:0;top:0;width:46px;height:59px;z-index:22;opacity:0;filter:drop-shadow(0 5px 4px rgba(0,0,0,.2))}.click-ring{position:absolute;left:1549px;top:288px;width:84px;height:84px;border:4px solid #005dd7;border-radius:50%;opacity:0;z-index:21}
#success-note{position:absolute;left:84px;top:692px;font-size:29px;color:#137a47;font-weight:700;opacity:0}.mini-check{display:inline-flex;align-items:center;justify-content:center;background:#137a47;color:white;width:35px;height:35px;border-radius:50%;margin-right:10px}
.trust-copy{position:absolute;left:84px;top:286px;width:790px}.trust-title{font-size:95px}.trust-panel{position:absolute;left:1010px;top:284px;width:770px;padding:48px;background:#edf5ef;border:2px solid #cbded1;border-radius:28px}.trust-panel img{width:135px;height:135px}.trust-line{font-size:31px;line-height:1.4;margin-top:30px;font-weight:650}.trust-line span{display:block}.trust-kicker{font-size:21px;color:#46564d;margin-top:18px}.trust-rule{width:100%;height:2px;background:#c0d5c7;margin-top:32px}
.end-copy{position:absolute;left:84px;top:243px;width:1130px}.end-title{font-size:118px;line-height:1.04;letter-spacing:-6px;margin:0;font-weight:800}.install-line{font-size:42px;line-height:1.3;margin-top:27px;font-weight:650}.cta{display:inline-flex;align-items:center;gap:24px;background:#137a47;color:#fff;font-size:29px;font-weight:700;border-radius:18px;padding:23px 31px;margin-top:33px}.cta-arrow{font-size:34px}.end-mark{position:absolute;right:170px;top:306px;width:330px;height:330px}.browsers{display:flex;align-items:center;gap:28px;margin-top:32px;font-size:24px;color:#46564d}.browser{display:flex;gap:12px;align-items:center}.browser img{width:36px;height:36px}.free{color:#137a47;font-weight:800}.end-url{position:absolute;left:84px;top:847px;font-size:24px;color:#46564d}.end-url b{font-weight:700;color:#1a1a2e}
.cqd-download-btn,.cqd-download-btn *,.cqd-download-all-btn,.cqd-download-all-btn *{transition:none!important;animation:none!important}.all-done .cqd-download-all-btn::after{background:#008522!important}.all-done .cqd-download-all-sub{opacity:1!important;max-width:100px!important;margin-left:4px!important}
</style></head><body><div id="root" data-composition-id="cqd-launch" data-width="1920" data-height="1080" data-duration="23">
<div class="brand"><img src="assets/logo.png" alt="CQD"><div><div class="brand-name">Classroom Quick Downloader</div><div class="brand-sub">A BROWSER EXTENSION FOR STUDENTS</div></div></div><div class="top-note">Less clicking. More studying.</div><div class="top-line"></div>
<section class="clip" id="hook" data-start="0" data-duration="3" data-track-index="1"><div class="copy" id="hook-copy"><div class="eyebrow">THE CLASSROOM DOWNLOAD ROUTINE</div><h1 class="headline"><span>Still opening</span><span>every file?</span></h1><p class="sub">Open. Download. Repeat.</p></div></section>
<section class="clip" id="reveal" data-start="3" data-duration="10.1" data-track-index="1"><div class="copy" id="reveal-copy"><div class="eyebrow">MEET CLASSROOM QUICK DOWNLOADER</div><h1 class="headline"><span>One click.</span><span class="accent">Every</span><span class="accent">attachment.</span></h1><p class="sub">From a Classroom post.</p></div><div id="success-note"><span class="mini-check">✓</span>Back to studying.</div></section>
<section class="clip" id="demo" data-start="0" data-duration="13.1" data-track-index="2"><div id="demo-stage"><div class="stage-content"><div class="context-label">Inside <b>Google Classroom</b></div><div class="ui-scale"><div class="post"><div class="post-top"><div class="course-icon">≡</div><div class="post-heading">Study materials<div class="post-meta">Classwork · 3 attachments</div></div><div class="dots">⋮</div>
<div class="all-wrap native-control" id="all-idle"><button class="cqd-download-all-btn cqd-in-header"><span class="cqd-icon-wrapper"><img src="assets/download.svg" alt=""></span><span class="cqd-download-all-main">Download all</span></button></div>
<div class="all-wrap all-progress" id="all-progress"><button class="cqd-download-all-btn cqd-in-header"><img src="assets/download.svg" alt=""><span class="cqd-download-all-main">Downloading…</span></button></div>
<div class="all-wrap all-done" id="all-done"><button class="cqd-download-all-btn cqd-in-header cqd-all-success"><img src="assets/success.svg" alt=""><span class="cqd-download-all-main">Downloaded</span><span class="cqd-download-all-sub">3 / 3</span></button></div>
</div><div class="files">__FILE_ROWS__</div><div class="demo-marker">Class materials</div><div class="opening" id="opening">Opening attachment…</div></div></div><div class="demo-caption">Illustrative demo · download time varies</div></div></div></section>
<div id="cursor" data-layout-ignore><svg viewBox="0 0 40 52" width="46" height="59"><path d="M4 3 L34 29 L22 31 L29 46 L21 50 L14 34 L4 44 Z" fill="#1a1a2e" stroke="#fafcfb" stroke-width="3" stroke-linejoin="round"/></svg></div><div class="click-ring" data-layout-ignore></div>
<section class="clip" id="trust" data-start="13.1" data-duration="4.4" data-track-index="1"><div class="trust-copy"><div class="eyebrow">PRIVATE. TRANSPARENT.</div><h2 class="headline trust-title"><span>Your files.</span><span>Your business.</span></h2></div><div class="trust-panel"><img src="assets/logo.png" alt="CQD"><div class="trust-line"><span>Anonymous</span><span>operational metrics.</span></div><div class="trust-rule"></div><div class="trust-line"><span>No file contents</span><span>in telemetry.</span></div></div></section>
<section class="clip" id="end" data-start="17.5" data-duration="5.5" data-track-index="1"><div class="end-copy"><div class="eyebrow">A TINY TOOL. A BETTER ROUTINE.</div><h2 class="end-title">ONE LAST CLICK.</h2><div class="install-line">Install Classroom Quick Downloader.</div><div class="cta">Get the extension <span class="cta-arrow">↗</span></div><div class="browsers"><span class="free">Free</span><span class="browser"><img src="assets/chrome.svg" alt="">Chrome</span><span class="browser"><img src="assets/firefox.svg" alt="">Firefox</span><span class="browser"><img src="assets/edge.svg" alt="">Edge</span></div></div><img class="end-mark" src="assets/logo.png" alt="CQD"><div class="end-url"><b>Install links in the post.</b> One less click between you and your files.</div></section>
<div class="rule" data-layout-ignore></div><div class="bottom"><span>Independent project. Not affiliated with Google or Google Classroom.</span><span class="bottom-sign">BUILT BY ADHAM</span></div>
<audio id="soundtrack" src="assets/soundtrack.wav" data-start="0" data-duration="23" data-track-index="10" data-volume="1"></audio>
</div><script>
const tl=gsap.timeline({paused:true});
tl.from('#hook-copy',{x:-28,opacity:0,duration:.42,ease:'power3.out'},0);
tl.from('.stage-content',{y:28,opacity:0,duration:.5,ease:'power2.out'},0);
tl.set('#cursor',{x:1210,y:740,opacity:1},.45);
tl.to('#cursor',{x:1140,y:455,duration:.45,ease:'power2.inOut'},.6);
tl.to('#file-0',{backgroundColor:'#edf2ee',duration:.1},1.08);
tl.to('#opening',{opacity:1,duration:.08},1.1);
tl.to('#cursor',{x:1130,y:592,duration:.5,ease:'power2.inOut'},1.55);
tl.to('#file-1',{backgroundColor:'#edf2ee',duration:.1},2.1);
tl.to('#opening',{opacity:0,duration:.15},2.7);
tl.to('#cursor',{opacity:0,duration:.15},2.75);
tl.from('#reveal-copy',{x:-30,opacity:0,duration:.45,ease:'power3.out'},3);
tl.to('.native-control',{opacity:1,duration:.35,stagger:.08,ease:'power2.out'},3.35);
tl.to('.file-row',{backgroundColor:'#fff',duration:.3},3.35);
tl.set('#cursor',{x:1740,y:755},4.1);
tl.to('#cursor',{opacity:1,duration:.15},4.15);
tl.to('#cursor',{x:1580,y:318,duration:1.15,ease:'power3.inOut'},4.25);
tl.to('#all-idle',{scale:1.035,duration:.2,ease:'power2.out',transformOrigin:'center'},5.42);
// beat-locked: action at 6.00s
tl.to('#cursor',{scale:.85,duration:.07},5.94);tl.to('#cursor',{scale:1,duration:.13},6.02);
tl.fromTo('.click-ring',{scale:.4,opacity:.7},{scale:1.35,opacity:0,duration:.45,ease:'power2.out',immediateRender:false},6);
tl.set('#all-idle',{opacity:0},6);tl.set('#all-progress',{opacity:1},6);
tl.to('#cursor',{x:1730,y:615,opacity:0,duration:.55,ease:'power2.inOut'},6.25);
// beat-grid: completion 1 8.74s, 2 9.29s, 3 9.83s; hold the full set.
[8.74,9.29,9.83].forEach((t,i)=>{tl.set('#idle-'+i,{opacity:0},t);tl.fromTo('#done-'+i,{opacity:0,x:8},{opacity:1,x:0,duration:.22,ease:'power2.out'},t);});
tl.set('#all-progress',{opacity:0},9.83);tl.fromTo('#all-done',{opacity:0,scale:.97},{opacity:1,scale:1,duration:.3,ease:'power2.out'},9.83);
tl.fromTo('#success-note',{opacity:0,y:15},{opacity:1,y:0,duration:.4,ease:'power3.out'},10.15);
// beat-locked: trust on 13.1s; closing on 17.5s.
tl.from('.trust-copy',{x:-30,opacity:0,duration:.4,ease:'power3.out'},13.1);
tl.from('.trust-panel',{x:40,opacity:0,duration:.4,ease:'power2.out'},13.1);
tl.from('.end-copy',{y:25,opacity:0,duration:.4,ease:'power3.out'},17.5);
tl.from('.end-mark',{scale:.9,opacity:0,rotation:-7,duration:.5,ease:'power2.out'},17.5);
tl.from('.end-url',{opacity:0,duration:.3},17.8);
// Per-frame precomputed music response on a structural rule, never on text.
const data=window.CQD_AUDIO;
data.frames.slice(0,690).forEach((f,i)=>tl.set('.rule',{opacity:.5+.25*(f.bands[0]||0)},i/30));
window.__timelines['cqd-launch']=tl;
</script></body></html>'''
(out/'index.html').write_text(html.replace('__FILE_ROWS__',rows))
(out/'index.motion.json').write_text(json.dumps({'duration':23,'assertions':[{'kind':'appearsBy','selector':'#hook-copy','bySec':.5},{'kind':'appearsBy','selector':'#all-idle','bySec':4.1},{'kind':'appearsBy','selector':'#all-done','bySec':10.3},{'kind':'appearsBy','selector':'.end-copy','bySec':18.1},{'kind':'staysInFrame','selector':'.end-mark'}]},indent=2))
print('Composition authored.')
