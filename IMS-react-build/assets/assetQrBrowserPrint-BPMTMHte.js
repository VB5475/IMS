const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-qrcode-OQ492SX-.js","assets/rolldown-runtime-CMxvf4Kt.js"])))=>i.map(i=>d[i]);
import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{r as t}from"./vendor-jspdf-RVBzdqvX.js";import{a as n,i as r,n as i,r as a,t as o}from"./assetQrStickerConstants-B9OHU8iL.js";import{r as s,t as c}from"./assetQrUtils-BGRJzdVy.js";var l=null;function u(){return l||=t(()=>import(`./vendor-qrcode-OQ492SX-.js`).then(t=>e(t.t(),1)),__vite__mapDeps([0,1])),l}async function d(e,t=280){return(await u()).default.toDataURL(e,{errorCorrectionLevel:`M`,margin:1,width:t})}async function f(e){let t=(e||[]).map(e=>s(e)).filter(({itemcode:e,srno:t})=>e&&t);if(t.length===0)throw Error(`Selected rows must have both Item Code and Asset Sr No.`);return Promise.all(t.map(async e=>{let t=await d(c(e.itemcode,e.itemname,e.srno),600);return{...e,dataUrl:t}}))}function p(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function m(e,t,n){let r=`
    <div class="sticker-card__fields">
      ${[[`Tag`,e.tag||e.itemcode],[`Model`,e.model||e.itemname],[`Sr. No.`,e.serial||e.srno]].map(([e,t])=>`
        <div class="sticker-card__row">
          <span class="sticker-card__label">${p(e)}:</span>
          <span class="sticker-card__value">${p(t)}</span>
        </div>`).join(``)}
    </div>`;return n?`
  <div class="sticker-card sticker-card--compact">
    <div class="sticker-card__qr">
      <img src="${e.dataUrl}" alt="QR" />
    </div>
    ${r}
  </div>`:`
  <div class="sticker-card">
    ${t?`<div class="sticker-card__header"><img class="sticker-card__logo" src="${t}" alt="Logo" /></div>`:``}
    <div class="sticker-card__qr">
      <img src="${e.dataUrl}" alt="QR" />
    </div>
    <hr class="sticker-card__divider" />
    ${r}
  </div>`}function h(e,t){let n=[];for(let r=0;r<e.length;r+=t)n.push(e.slice(r,r+t));return n}function g(e,t,n,r=1){let o=t.widthIn??i.widthIn,s=t.heightIn??i.heightIn,c=!!t.compact,l=a,u=.09,d=.08,f=.05,p=o-f*2,g=s-f*2,_=Math.max(1,Math.floor(p/l)),v=Math.max(1,Math.floor(g/l)),y=_*v,b=Math.max(1,Math.min(r,y)),x=+((p-u*(_-1))/_).toFixed(4),S=+((g-u*(v-1))/v).toFixed(4),C=c?+Math.max(.4,S-d*2).toFixed(4):+Math.max(.8,Math.min(x-d*2,S-.7-.3)).toFixed(4);return`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title></title>
<style>
  @page {
    size: ${o}in ${s}in;
    margin: 0in; /* Fixed: Changed from 5in to 0in so it doesn't clip the stickers */
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @media print {
    html, body, img, .sticker-card {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img {
      filter: none !important;
      -webkit-filter: none !important;
    }
  }
  .print-page {
    width: ${o}in;
    height: ${s}in;
    padding: ${f}in;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    align-items: center;
    gap: ${u}in;
  }
  .print-page + .print-page {
    page-break-before: always;
    break-before: page;
  }
  .sticker-card {
    width: ${x}in;
    height: ${S}in;
    border: 1px solid #000;
    border-radius: 0.06in;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: ${d}in;
    gap: 0.04in;
    background: #fff;
    overflow: hidden;
  }
  .sticker-card__header {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
  .sticker-card__logo {
    width: 0.26in;
    height: 0.26in;
    object-fit: contain;
  }
  .sticker-card__qr {
    width: ${C}in; /* scaled to fill the card while leaving room for the info rows */
    height: ${C}in;
    flex-shrink: 0;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  .sticker-card__qr img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .sticker-card__divider {
    width: 85%;
    border: none;
    border-top: 0.75px solid #999;
    margin: 0 auto;
  }
  .sticker-card__fields {
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    font-size: 10px;
    line-height: 1.2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .sticker-card--compact {
    flex-direction: row;
    justify-content: flex-start;
    gap: 0.08in;
  }
  .sticker-card--compact .sticker-card__qr {
    margin: 0;
  }
  .sticker-card--compact .sticker-card__fields {
    width: auto;
    max-width: none;
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .sticker-card--compact .sticker-card__value {
    overflow: visible;
    white-space: normal;
    word-break: break-word;
  }
  .sticker-card__row {
    display: flex;
    gap: 3px;
    margin-bottom: 1px;
  }
  .sticker-card__label {
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sticker-card__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
</head>
<body>
${h(e,b).map(e=>`<div class="print-page">${e.map(e=>m(e,n,c)).join(``)}</div>`).join(``)}
</body>
</html>`}async function _(){try{let e=new URL(r,window.location.origin).href,t=await fetch(e,{cache:`force-cache`});if(!t.ok)return e;let n=await t.blob();return await new Promise((e,t)=>{let r=new FileReader;r.onload=()=>e(r.result),r.onerror=t,r.readAsDataURL(n)})}catch{return new URL(r,window.location.origin).href}}async function v(e,t=o,r=1){let i=n[t]??n.ta220,[a,s]=await Promise.all([f(e),_()]),c=g(a,i,s,r),l=document.createElement(`iframe`);l.setAttribute(`aria-hidden`,`true`),l.style.cssText=`position:fixed;right:0;bottom:0;width:0;height:0;border:0;`,document.body.appendChild(l);let u=l.contentDocument||l.contentWindow?.document;if(!u)throw l.remove(),Error(`Could not open print frame.`);u.open(),u.write(c),u.close(),await new Promise(e=>{setTimeout(e,400)});try{l.contentWindow?.focus(),l.contentWindow?.print()}finally{setTimeout(()=>l.remove(),1e3)}return a.length}export{g as buildPrintDocument,_ as loadLogoDataUrl,d as n,v as printAssetStickersBrowser,f as t};