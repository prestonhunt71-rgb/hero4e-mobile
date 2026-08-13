export function analyzeHdcMartialManeuver(rawXml){
  if(!rawXml)return null;
  const node=new DOMParser().parseFromString(rawXml,"application/xml").documentElement;
  const phase=node.getAttribute("PHASE")||"1/2";
  return {kind:"martialManeuver",category:node.getAttribute("CATEGORY")||"Hand-To-Hand",ocv:node.getAttribute("OCV")||"--",dcv:node.getAttribute("DCV")||"--",damageClasses:Number(node.getAttribute("DC")||0),phase,action:phase==="1/2"?"Half Phase":phase==="1"?"Full Phase":phase,effect:node.getAttribute("EFFECT")||node.getAttribute("DISPLAY")||"",addStrength:String(node.getAttribute("ADDSTR")||"").toLowerCase()==="yes",useWeapon:String(node.getAttribute("USEWEAPON")||"").toLowerCase()==="yes",weaponEffect:node.getAttribute("WEAPONEFFECT")||"",characterPoints:Number(node.getAttribute("BASECOST")||0),pricingBasis:"Fourth Edition maneuver specifications"};
}
export function martialManeuverSummary4e(entry){const m=entry.mechanics;if(!m)return "";return [`OCV ${m.ocv}`,`DCV ${m.dcv}`,m.action,m.effect,`${m.characterPoints} Character Points`].filter(Boolean).join(" · ");}
export function martialManeuverEffect4e(entry,strength=0){const m=entry.mechanics||{},normalDice=Math.max(0,Math.floor(Number(strength)/5)+Number(m.damageClasses||0));return String(m.effect||"").replace(/\[NORMALDC\]/g,`${normalDice}d6`).replace(/\[WEAPONDC\]/g,`Weapon +${Number(m.damageClasses||0)} DC`);}
