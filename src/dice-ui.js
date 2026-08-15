import { rollHeroDice } from "./rules.js";
import { rollAttackPower4e, powerDamageDice4e } from "./dice.js";

const escapeHtml=value=>{const node=document.createElement("span");node.textContent=String(value??"");return node.innerHTML;};
export function createDiceTray4e({getCharacter,root=document}={}){
  const $=selector=>root.querySelector(selector),$$=selector=>[...root.querySelectorAll(selector)];
  let count=3,bodyModifier=0,multiplierModifier=0;
  const dialog=$("#dice-dialog"),open=()=>{if(!dialog.open)dialog.showModal();};
  const mode=()=>$("[data-dice-mode]:checked")?.dataset.diceMode||"check";
  const update=()=>{const selected=mode(),skill=selected==="check",killing=selected==="killing",diceCount=skill?3:count,half=!skill&&$("#dice-half").checked,suffix=half?" + ½d6":"";$("#dice-count-minus").disabled=skill;$("#dice-count-plus").disabled=skill;$("#dice-half").disabled=skill;$$('#killing-adjustments button').forEach(button=>button.disabled=!killing);$("#dice-count-display").textContent=`${diceCount}d6`;$("#roll-dice-tray").textContent=skill?"Roll Skill Check":`Roll ${diceCount}d6${suffix}`;$("#body-mod-display").textContent=bodyModifier>0?`+${bodyModifier}`:String(bodyModifier);$("#multiplier-mod-display").textContent=multiplierModifier>0?`+${multiplierModifier}`:String(multiplierModifier);};
  const diceText=result=>[...result.dice.map(String),...(result.halfDie==null?[]:[`${result.halfDie} (½d6)`])].join(" + ");
  const display=(result,{label=""}={})=>{const dice=diceText(result),prefix=label?`<span>${escapeHtml(label)}</span>`:"",values=result.mode==="check"?`${result.total}`:result.mode==="mental"?`${result.stun} STUN`:`${result.stun} STUN · ${result.body} BODY`,description=result.mode==="check"?dice:result.mode==="mental"?`${dice} · Mental / NND Damage`:result.mode==="normal"?`${dice} · Normal Damage`:`${dice} · STUN Multiplier ×${result.multiplier}`;$("#roll-result").innerHTML=`${prefix}<strong>${values}</strong><span>${description}</span>`;};
  const roll=()=>{const selected=mode();display(rollHeroDice({count:selected==="check"?3:count,half:selected!=="check"&&$("#dice-half").checked,mode:selected,bodyModifier,multiplierModifier}));};
  const rollAgainstTarget=(target,label)=>{const result=rollHeroDice({count:3});display(result,{label:`${label} ${target}− · ${result.total<=target?"SUCCESS":"FAILED"} by ${Math.abs(target-result.total)}`});open();};
  const rollPowerAttack=entry=>{const result=rollAttackPower4e(entry,getCharacter().characteristics);display(result,{label:`${entry.name||entry.mechanics.label} Attack Roll · ${result.combatValueLabel} ${result.cv} · hits ${result.defenseLabel} ${result.defense} or less`});open();};
  const rollPowerDamage=entry=>{const profile=powerDamageDice4e(entry);if(!profile)return;count=profile.count;$("#dice-half").checked=profile.half;$$('[data-dice-mode]').forEach(box=>box.checked=box.dataset.diceMode===profile.mode);bodyModifier=0;multiplierModifier=0;update();roll();open();};
  const bind=()=>{
    $("#dice-count-minus").addEventListener("click",()=>{count=Math.max(0,count-1);update();});$("#dice-count-plus").addEventListener("click",()=>{count=Math.min(99,count+1);update();});$("#dice-half").addEventListener("change",update);
    $$('[data-dice-mode]').forEach(box=>box.addEventListener("change",()=>{if(!box.checked)box.checked=true;$$('[data-dice-mode]').forEach(other=>{if(other!==box)other.checked=false;});update();}));
    $("#body-mod-minus").addEventListener("click",()=>{bodyModifier--;update();});$("#body-mod-plus").addEventListener("click",()=>{bodyModifier++;update();});$("#multiplier-mod-minus").addEventListener("click",()=>{multiplierModifier--;update();});$("#multiplier-mod-plus").addEventListener("click",()=>{multiplierModifier++;update();});
    $("#roll-dice-tray").addEventListener("click",roll);$("#dice-overlay-button").addEventListener("click",()=>{$$('[data-dice-mode]').forEach(box=>box.checked=box.dataset.diceMode==="check");update();open();});$("#close-dice").addEventListener("click",()=>dialog.close());
    $("#detail-roll-card").addEventListener("click",event=>{const target=Number(event.currentTarget.dataset.target);if(Number.isFinite(target)&&target)rollAgainstTarget(target,event.currentTarget.dataset.label);});update();
  };
  return Object.freeze({bind,open,rollAgainstTarget,rollPowerAttack,rollPowerDamage});
}