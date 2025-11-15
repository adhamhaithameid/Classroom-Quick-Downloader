var content=(function(){"use strict";function J(e){return e}const R=/^https:\/\/classroom\.google\.com\//,_=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
  <path d="M5 20h14v-2H5v2z"/>
  <path d="M11 4v8.17L8.41 9.59 7 11l5 5 5-5-1.41-1.41L13 12.17V4h-2z"/>
</svg>
`.trim(),D=`data:image/svg+xml;utf8,${encodeURIComponent(_)}`,v="cqd-style",q="data-cqd-injected",P=2e3,M=250,S=16,E=600,z=1500,$=1400,h='a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]',U=[".KlRXdf",".z3vRcc",".VfPpkd-aPP78e","[data-drive-id]","[data-id][data-item-id]"].join(", "),F=[/https:\/\/drive\.google\.com\/file\/d\//,/https:\/\/drive\.google\.com\/open\?/,/https:\/\/drive\.google\.com\/uc\?/,/https:\/\/classroom\.google\.com\/drive\//];let c=null,m=null;function y(){return typeof location>"u"||location.hostname!=="classroom.google.com"?!1:R.test(location.href)}function O(){if(typeof document>"u"||document.getElementById(v))return;const e=document.createElement("style");e.id=v,e.textContent=`
    /* SINGLE ATTACHMENT BUTTONS (circle -> pill on hover) */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
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
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width 220ms cubic-bezier(0.2, 0, 0, 1),
        padding-inline 220ms cubic-bezier(0.2, 0, 0, 1),
        border-radius 220ms cubic-bezier(0.2, 0, 0, 1),
        box-shadow 220ms cubic-bezier(0.2, 0, 0, 1),
        transform 220ms cubic-bezier(0.2, 0, 0, 1),
        background-color 220ms cubic-bezier(0.2, 0, 0, 1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }

    .cqd-download-btn:hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.30);
      justify-content: flex-start;
      transform: translateY(calc(-50% - 1px)) scale(1.04);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity 200ms cubic-bezier(0.2, 0, 0, 1),
        max-width 200ms cubic-bezier(0.2, 0, 0, 1),
        margin-left 200ms cubic-bezier(0.2, 0, 0, 1);
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

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${D}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width 200ms cubic-bezier(0.2, 0, 0, 1),
        height 200ms cubic-bezier(0.2, 0, 0, 1),
        border-width 200ms cubic-bezier(0.2, 0, 0, 1);
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

    /* PILL STATES (loading / success / error) */
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
      cursor: default;
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-success .cqd-label,
    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-loading:hover,
    .cqd-download-btn.cqd-success:hover,
    .cqd-download-btn.cqd-error:hover {
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    /* Material-like circular spinner: arc on a circle, rotating.
       The diameter is controlled by SPINNER_SIZE_PX. */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${S}px;
      height: ${S}px;
      border-style: solid;
      border-width: 3px;
      border-color: rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      border-right-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.9s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Success / error icons using emoji, no background image */
    .cqd-icon-check,
    .cqd-icon-cross {
      background-image: none;
      width: 18px;
      height: 18px;
      box-shadow: none;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-icon-cross {
      font-size: 15px;
    }
  `.trim(),(document.head||document.documentElement).appendChild(e)}function p(){c!==null&&window.clearTimeout(c),c=window.setTimeout(()=>{c=null,V()},M)}function C(){if(!(typeof document>"u")){if(!document.body){window.addEventListener("DOMContentLoaded",()=>{C()},{once:!0});return}m||(m=new MutationObserver(e=>{e.some(n=>n.type==="childList"&&(n.addedNodes.length>0||n.removedNodes.length>0))&&p()}),m.observe(document.body,{childList:!0,subtree:!0}),window.setInterval(()=>{p()},P),p())}}function V(){y()&&(typeof document>"u"||B())}function B(){const e=Array.from(document.querySelectorAll(h));for(const n of e){const o=g(n);if(!o)continue;const r=n.closest(U)||n.parentElement||n;r&&(I(r)||A(r,o))}const t=Array.from(document.querySelectorAll("[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"));for(const n of t){if(I(n))continue;const o=j(n);o&&A(n,o)}}function I(e){return!!e.querySelector(`[${q}="true"]`)}function g(e){const t=e.href;return t&&F.some(o=>o.test(t))?t:null}function j(e){const t=e.querySelector(h)||e.closest(h);if(t){const o=g(t);if(o)return o}const n=e.getAttribute("data-drive-id")||e.getAttribute("data-id");if(n){const o=document.querySelector(`a[data-drive-id="${n}"]`)||document.querySelector(`a[data-id="${n}"]`)||document.querySelector(`a[href*="${n}"]`);if(o){const r=g(o);if(r)return r}return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(n)}`}return null}function T(e,t=0){if(t>3)return e;try{const n=new URL(e,location.href),o=n.hostname,r=n.pathname;if(o==="drive.google.com"){if(r.startsWith("/auth_warmup")){const s=n.searchParams.get("continue");if(s)return T(s,t+1);const N=n.searchParams.get("id");return N?`https://drive.google.com/uc?export=download&id=${encodeURIComponent(N)}`:e}const i=r.match(/^\/file\/d\/([^/]+)/);if(i){const s=i[1];return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(s)}`}if(r==="/open"){const s=n.searchParams.get("id");if(s)return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(s)}`}if(r==="/uc")return n.searchParams.set("export","download"),n.toString()}if(o==="classroom.google.com"&&r.startsWith("/drive")){const i=n.searchParams.get("id")||n.searchParams.get("resourceId")||n.searchParams.get("fileId");if(i)return`https://drive.google.com/uc?export=download&id=${encodeURIComponent(i)}`}return e}catch{return e}}function A(e,t){if(!t)return;window.getComputedStyle(e).position==="static"&&(e.style.position="relative");const o=Y(t),r=o.querySelector(".cqd-download-icon");r&&r.classList.add("cqd-icon-medium"),e.appendChild(o)}function W(e){return e.classList.contains("cqd-loading")?"loading":e.classList.contains("cqd-success")?"success":e.classList.contains("cqd-error")?"error":"idle"}function d(e,t){const n=e.querySelector(".cqd-download-icon"),o=e.querySelector(".cqd-label");if(!(!n||!o))switch(e.classList.remove("cqd-loading","cqd-success","cqd-error"),n.classList.remove("cqd-spinner","cqd-icon-check","cqd-icon-cross"),n.textContent="",e.disabled=!1,e.style.backgroundColor="#1a73e8",o.textContent="Download",t){case"idle":break;case"loading":e.classList.add("cqd-loading"),e.disabled=!0,o.textContent="Downloading…",n.classList.add("cqd-spinner");break;case"success":e.classList.add("cqd-success"),e.style.backgroundColor="#188038",o.textContent="Downloaded",n.classList.add("cqd-icon-check"),n.textContent="✅";break;case"error":e.classList.add("cqd-error"),e.style.backgroundColor="#d93025",o.textContent="Error",n.classList.add("cqd-icon-cross"),n.textContent="❌";break}}function Y(e){const t=document.createElement("button");t.type="button",t.className="cqd-download-btn",t.setAttribute(q,"true"),t.setAttribute("aria-label","Quick download attachment"),t.setAttribute("title","Quick download");const n=document.createElement("span");n.className="cqd-icon-wrapper";const o=document.createElement("span");o.className="cqd-download-icon",n.appendChild(o);const r=document.createElement("span");return r.className="cqd-label",r.textContent="Download",t.appendChild(n),t.appendChild(r),t.addEventListener("click",async i=>{i.preventDefault(),i.stopPropagation(),await L(t,e)}),t.addEventListener("auxclick",async i=>{i.button===1&&(i.preventDefault(),i.stopPropagation(),await L(t,e))}),t}async function L(e,t){if(!t||W(e)==="loading")return;d(e,"loading");const n=Date.now(),o=await G(t),r=Date.now()-n;r<E&&await w(E-r),o?(d(e,"success"),await w(z)):(d(e,"error"),await w($)),d(e,"idle")}function G(e){if(!e||!/^https?:\/\//i.test(e))return Promise.resolve(!1);const t=T(e);return typeof navigator<"u"&&!navigator.onLine||/https:\/\/drive\.google\.com\/auth_warmup/.test(t)?Promise.resolve(!1):typeof chrome<"u"&&!!chrome.runtime&&typeof chrome.runtime.sendMessage=="function"?new Promise(o=>{let r=!1;try{chrome.runtime.sendMessage({type:"CQD_DOWNLOAD",url:t},i=>{const s=chrome.runtime.lastError;if(s){console.warn("[CQD] sendMessage error:",s.message),a(t),r||(r=!0,o(!0));return}if(!i||i.ok===!1){i?.error&&console.warn("[CQD] background download error:",i.error),a(t),r||(r=!0,o(!0));return}r||(r=!0,o(!0))}),window.setTimeout(()=>{r||(a(t),r=!0,o(!0))},4e3)}catch(i){console.warn("[CQD] sendMessage threw:",i),a(t),r||o(!0)}}):(a(t),Promise.resolve(!0))}function a(e){if(typeof document>"u")return;const t=document.createElement("a");t.href=e,t.target="_blank",t.rel="noopener noreferrer",t.style.display="none",document.body.appendChild(t),t.click(),window.setTimeout(()=>{t.remove()},0)}function w(e){return new Promise(t=>window.setTimeout(t,e))}function Q(){y()&&(O(),C())}const H={matches:["https://classroom.google.com/*"],runAt:"document_idle",main(){Q()}},k=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function l(e,...t){}const K={debug:(...e)=>l(console.debug,...e),log:(...e)=>l(console.log,...e),warn:(...e)=>l(console.warn,...e),error:(...e)=>l(console.error,...e)};class b extends Event{constructor(t,n){super(b.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=n}static EVENT_NAME=x("wxt:locationchange")}function x(e){return`${k?.runtime?.id}:content:${e}`}function X(e){let t,n;return{run(){t==null&&(n=new URL(location.href),t=e.setInterval(()=>{let o=new URL(location.href);o.href!==n.href&&(window.dispatchEvent(new b(o,n)),n=o)},1e3))}}}class u{constructor(t,n){this.contentScriptName=t,this.options=n,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=x("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=X(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(t){return this.abortController.abort(t)}get isInvalid(){return k.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(t){return this.signal.addEventListener("abort",t),()=>this.signal.removeEventListener("abort",t)}block(){return new Promise(()=>{})}setInterval(t,n){const o=setInterval(()=>{this.isValid&&t()},n);return this.onInvalidated(()=>clearInterval(o)),o}setTimeout(t,n){const o=setTimeout(()=>{this.isValid&&t()},n);return this.onInvalidated(()=>clearTimeout(o)),o}requestAnimationFrame(t){const n=requestAnimationFrame((...o)=>{this.isValid&&t(...o)});return this.onInvalidated(()=>cancelAnimationFrame(n)),n}requestIdleCallback(t,n){const o=requestIdleCallback((...r)=>{this.signal.aborted||t(...r)},n);return this.onInvalidated(()=>cancelIdleCallback(o)),o}addEventListener(t,n,o,r){n==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),t.addEventListener?.(n.startsWith("wxt:")?x(n):n,o,{...r,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),K.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:u.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(t){const n=t.data?.type===u.SCRIPT_STARTED_MESSAGE_TYPE,o=t.data?.contentScriptName===this.contentScriptName,r=!this.receivedMessageIds.has(t.data?.messageId);return n&&o&&r}listenForNewerScripts(t){let n=!0;const o=r=>{if(this.verifyScriptStartedEvent(r)){this.receivedMessageIds.add(r.data.messageId);const i=n;if(n=!1,i&&t?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",o),this.onInvalidated(()=>removeEventListener("message",o))}}function te(){}function f(e,...t){}const Z={debug:(...e)=>f(console.debug,...e),log:(...e)=>f(console.log,...e),warn:(...e)=>f(console.warn,...e),error:(...e)=>f(console.error,...e)};return(async()=>{try{const{main:e,...t}=H,n=new u("content",t);return await e(n)}catch(e){throw Z.error('The content script "content" crashed on startup!',e),e}})()})();
content;