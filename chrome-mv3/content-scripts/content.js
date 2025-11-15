var content=(function(){"use strict";function z(n){return n}const q=/^https:\/\/classroom\.google\.com\//,T=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
  <path d="M5 20h14v-2H5v2z"/>
  <path d="M11 4v8.17L8.41 9.59 7 11l5 5 5-5-1.41-1.41L13 12.17V4h-2z"/>
</svg>
`.trim(),A=`data:image/svg+xml;utf8,${encodeURIComponent(T)}`,w="cqd-style",v="data-cqd-injected",N=2e3,R=250,l='a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]',L=[".KlRXdf",".z3vRcc",".VfPpkd-aPP78e","[data-drive-id]","[data-id][data-item-id]"].join(", "),_=[/https:\/\/drive\.google\.com\/file\/d\//,/https:\/\/drive\.google\.com\/open\?/,/https:\/\/drive\.google\.com\/uc\?/,/https:\/\/classroom\.google\.com\/drive\//];let s=null,u=null;function b(){return typeof location>"u"||location.hostname!=="classroom.google.com"?!1:q.test(location.href)}function k(){if(typeof document>"u"||document.getElementById(w))return;const n=document.createElement("style");n.id=w,n.textContent=`
    .cqd-download-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);
      border-radius: 9999px;
      border: none;
      padding: 0;
      background-color: #1a73e8;
      color: #ffffff;
      /* Realistic default elevation: soft, slightly offset shadow */
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transition:
        width 180ms ease,
        border-radius 180ms ease,
        box-shadow 180ms ease,
        background-color 180ms ease,
        transform 120ms ease;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }

    /* Card pill state on hover: higher, softer shadow like lifting up */
    .cqd-download-btn:hover {
      width: 120px; /* pill */
      padding-inline: 12px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.28);
      justify-content: flex-start;
      transform: translateY(-1px);
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    /* Active: pressed state, shadow tighter and closer to button */
    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(0);
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity 160ms ease,
        max-width 160ms ease,
        margin-left 160ms ease;
    }

    .cqd-download-btn:hover .cqd-label {
      opacity: 1;
      max-width: 100px;
      margin-left: 6px;
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* Icon drawn via background-image so layout can't corrupt it */
    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${A}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
      flex-shrink: 0;
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    /* Viewer pill: always pill-like, label visible even without hover */
    .cqd-viewer-btn {
      width: auto;
      min-width: 120px;
      padding-inline: 12px;
      justify-content: flex-start;
    }

    .cqd-viewer-btn .cqd-label {
      opacity: 1;
      max-width: 120px;
      margin-left: 6px;
    }

    .cqd-viewer-btn:hover {
      width: auto;
      padding-inline: 12px;
    }
  `.trim(),(document.head||document.documentElement).appendChild(n)}function p(){s!==null&&window.clearTimeout(s),s=window.setTimeout(()=>{s=null,U()},R)}function x(){if(!(typeof document>"u")){if(!document.body){window.addEventListener("DOMContentLoaded",()=>{x()},{once:!0});return}u||(u=new MutationObserver(n=>{n.some(e=>e.type==="childList"&&(e.addedNodes.length>0||e.removedNodes.length>0))&&p()}),u.observe(document.body,{childList:!0,subtree:!0}),window.setInterval(()=>{p()},N),p())}}function U(){if(!b()||typeof document>"u")return;const n=Array.from(document.querySelectorAll(l));for(const e of n){const o=m(e);if(!o)continue;const i=e.closest(L)||e.parentElement||e;i&&(h(i)||S(i,o))}const t=Array.from(document.querySelectorAll("[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"));for(const e of t){if(h(e))continue;const o=M(e);o&&S(e,o)}P()}function h(n){return!!n.querySelector(`[${v}="true"]`)}function m(n){const t=n.href;return t&&_.some(o=>o.test(t))?t:null}function M(n){const t=n.querySelector(l)||n.closest(l);if(t){const o=m(t);if(o)return o}const e=n.getAttribute("data-drive-id")||n.getAttribute("data-id");if(e){const o=document.querySelector(`a[data-drive-id="${e}"]`)||document.querySelector(`a[data-id="${e}"]`)||document.querySelector(`a[href*="${e}"]`);if(o){const i=m(o);if(i)return i}return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(e)}`}return null}function E(n){try{const t=new URL(n,location.href);if(t.hostname==="drive.google.com"){const e=t.pathname.match(/^\/file\/d\/([^/]+)/);if(e){const o=e[1];return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(o)}`}if(t.pathname==="/open"){const o=t.searchParams.get("id");if(o)return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(o)}`}if(t.pathname==="/uc")return t.searchParams.set("export","download"),t.toString()}if(t.hostname==="classroom.google.com"&&t.pathname.startsWith("/drive")){const e=t.searchParams.get("id")||t.searchParams.get("resourceId")||t.searchParams.get("fileId");if(e)return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(e)}`}return n}catch{return n}}function S(n,t){if(!t)return;window.getComputedStyle(n).position==="static"&&(n.style.position="relative");const o=y(t),i=o.querySelector(".cqd-download-icon");i&&i.classList.add("cqd-icon-medium"),n.appendChild(o)}function P(){const n=Array.from(document.querySelectorAll('iframe[src*="https://drive.google.com/file/"], iframe[src*="https://drive.google.com/uc"], iframe[src*="https://docs.google.com"]'));for(const t of n){const e=t.closest(".pco8Kc, .qq2eQd, .I9rrLb")||t.parentElement;if(!e||h(e))continue;const o=t.src;if(!o)continue;const i=E(o);D(e,i)}}function D(n,t){if(!t)return;window.getComputedStyle(n).position==="static"&&(n.style.position="relative");const o=y(t);o.classList.add("cqd-viewer-btn");const i=o.querySelector(".cqd-download-icon");i&&(i.classList.remove("cqd-icon-small","cqd-icon-large"),i.classList.add("cqd-icon-medium")),n.appendChild(o)}function y(n){const t=document.createElement("button");t.type="button",t.className="cqd-download-btn",t.setAttribute(v,"true"),t.setAttribute("aria-label","Quick download attachment"),t.setAttribute("title","Quick download");const e=document.createElement("span");e.className="cqd-icon-wrapper";const o=document.createElement("span");o.className="cqd-download-icon",e.appendChild(o);const i=document.createElement("span");return i.className="cqd-label",i.textContent="Download",t.appendChild(e),t.appendChild(i),t.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),I(n)}),t.addEventListener("auxclick",r=>{r.preventDefault(),r.stopPropagation(),r.button===1&&I(n)}),t}function I(n){if(!n||!/^https?:\/\//i.test(n))return;const t=E(n),e=document.createElement("a");e.href=t,e.target="_blank",e.rel="noopener noreferrer",e.style.display="none",document.body.appendChild(e),e.click(),window.setTimeout(()=>{e.remove()},0)}function $(){b()&&(k(),x())}const F={matches:["https://classroom.google.com/*"],runAt:"document_idle",main(){$()}},C=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function a(n,...t){}const V={debug:(...n)=>a(console.debug,...n),log:(...n)=>a(console.log,...n),warn:(...n)=>a(console.warn,...n),error:(...n)=>a(console.error,...n)};class f extends Event{constructor(t,e){super(f.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=e}static EVENT_NAME=g("wxt:locationchange")}function g(n){return`${C?.runtime?.id}:content:${n}`}function O(n){let t,e;return{run(){t==null&&(e=new URL(location.href),t=n.setInterval(()=>{let o=new URL(location.href);o.href!==e.href&&(window.dispatchEvent(new f(o,e)),e=o)},1e3))}}}class c{constructor(t,e){this.contentScriptName=t,this.options=e,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=g("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=O(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(t){return this.abortController.abort(t)}get isInvalid(){return C.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(t){return this.signal.addEventListener("abort",t),()=>this.signal.removeEventListener("abort",t)}block(){return new Promise(()=>{})}setInterval(t,e){const o=setInterval(()=>{this.isValid&&t()},e);return this.onInvalidated(()=>clearInterval(o)),o}setTimeout(t,e){const o=setTimeout(()=>{this.isValid&&t()},e);return this.onInvalidated(()=>clearTimeout(o)),o}requestAnimationFrame(t){const e=requestAnimationFrame((...o)=>{this.isValid&&t(...o)});return this.onInvalidated(()=>cancelAnimationFrame(e)),e}requestIdleCallback(t,e){const o=requestIdleCallback((...i)=>{this.signal.aborted||t(...i)},e);return this.onInvalidated(()=>cancelIdleCallback(o)),o}addEventListener(t,e,o,i){e==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),t.addEventListener?.(e.startsWith("wxt:")?g(e):e,o,{...i,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),V.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:c.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(t){const e=t.data?.type===c.SCRIPT_STARTED_MESSAGE_TYPE,o=t.data?.contentScriptName===this.contentScriptName,i=!this.receivedMessageIds.has(t.data?.messageId);return e&&o&&i}listenForNewerScripts(t){let e=!0;const o=i=>{if(this.verifyScriptStartedEvent(i)){this.receivedMessageIds.add(i.data.messageId);const r=e;if(e=!1,r&&t?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",o),this.onInvalidated(()=>removeEventListener("message",o))}}function W(){}function d(n,...t){}const j={debug:(...n)=>d(console.debug,...n),log:(...n)=>d(console.log,...n),warn:(...n)=>d(console.warn,...n),error:(...n)=>d(console.error,...n)};return(async()=>{try{const{main:n,...t}=F,e=new c("content",t);return await n(e)}catch(n){throw j.error('The content script "content" crashed on startup!',n),n}})()})();
content;