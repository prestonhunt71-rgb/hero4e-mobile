const safeName = value => String(value || "Hero").replace(/[<>:"/\\|?*]+/g, "-").trim() || "Hero";
const val = value => String(value ?? "");
const sections = ["skills","perks","talents","martialArts","powers","equipment","disadvantages"];
const rows = character => sections.flatMap(section => (character[section] || []).map(entry => ({section,...entry})));
const entryLine = entry => `${entry.name || entry.type || "Entry"}${Number.isFinite(Number(entry.cost)) ? ` (${entry.cost} points)` : ""}${entry.summary ? ` — ${entry.summary}` : ""}`;
export function saveCharacterPdf(character) {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) throw new Error("PDF engine is unavailable");
  const doc = new JsPDF({unit:"pt",format:"letter",orientation:"portrait"});
  const left=42,width=528,bottom=750; let y=48;
  const line=(value,size=10,bold=false,indent=0)=>{doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);const parts=doc.splitTextToSize(val(value),width-indent);if(y+parts.length*(size+3)>bottom){doc.addPage();y=48;}doc.text(parts,left+indent,y);y+=parts.length*(size+3)+4;};
  if(character.portrait?.dataUrl){try{doc.addImage(character.portrait.dataUrl,undefined,466,32,104,104,undefined,"FAST");}catch{}}
  line("HERO SYSTEM FOURTH EDITION",9,true);line(character.name||"Unnamed Hero",22,true);line(`Player: ${character.playerName||"—"}`);y+=8;line("CHARACTERISTICS",14,true);
  line(Object.entries(character.characteristics||{}).map(([key,value])=>`${key} ${value}`).join("   "));
  line(`BODY ${character.current?.BODY??character.characteristics?.BODY} / ${character.characteristics?.BODY}   STUN ${character.current?.STUN??character.characteristics?.STUN} / ${character.characteristics?.STUN}   END ${character.current?.END??character.characteristics?.END} / ${character.characteristics?.END}`,10,true);y+=8;
  for(const section of sections){const list=rows(character).filter(entry=>entry.section===section);if(!list.length)continue;line(section==="martialArts"?"MARTIAL ARTS":section.toUpperCase(),14,true);list.forEach(entry=>line(entryLine(entry),9,false,10));y+=4;}
  const p=character.profile||{};for(const [heading,value] of [["BACKGROUND",p.background],["PERSONALITY",p.personality],["TACTICS",p.tactics],["APPEARANCE",p.appearance],["NOTES",p.notes]])if(value){line(heading,14,true);line(value,9);}
  window.__hero4eLastPdf = doc.output("arraybuffer");
  doc.save(`${safeName(character.name)}-HERO4E.pdf`);
}
function printHtml(character){
 const esc=value=>val(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const content=sections.map(section=>{const list=rows(character).filter(entry=>entry.section===section);return list.length?`<section><h2>${section==="martialArts"?"Martial Arts":section}</h2>${list.map(entry=>`<p>${esc(entryLine(entry))}</p>`).join("")}</section>`:"";}).join("");
 const stats=Object.entries(character.characteristics||{}).map(([k,v])=>`<b>${esc(k)}</b> ${esc(v)}`).join(" &nbsp; ");
 return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(character.name)} — HERO4E</title><style>@page{size:letter;margin:.45in}*{box-sizing:border-box}body{font:10pt Arial;color:#111;margin:0}header{border-bottom:3px solid #111;padding-bottom:8px;min-height:110px}h1{font-size:22pt;margin:2px 0;text-transform:uppercase}h2{font-size:13pt;text-transform:uppercase;border-bottom:1px solid #111;margin:12px 0 5px}p{margin:3px 0;break-inside:avoid}.portrait{float:right;width:100px;height:100px;object-fit:cover;border:2px solid #111}.stats{line-height:1.7}.columns{column-count:2;column-gap:.3in}section{break-inside:avoid-column}</style></head><body><header>${character.portrait?.dataUrl?`<img class="portrait" src="${character.portrait.dataUrl}">`:""}<small>HERO SYSTEM FOURTH EDITION</small><h1>${esc(character.name||"Unnamed Hero")}</h1><div>Player: ${esc(character.playerName||"—")}</div><div class="stats">${stats}</div></header><main class="columns">${content}</main><script>addEventListener('load',()=>setTimeout(()=>print(),250))<\/script></body></html>`;
}
export function printCharacter(character){const popup=window.open("","_blank");if(!popup)throw new Error("Allow pop-ups to print this character");popup.document.open();popup.document.write(printHtml(character));popup.document.close();}