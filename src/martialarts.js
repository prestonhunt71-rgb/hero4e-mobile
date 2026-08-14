export const MARTIAL_MANEUVERS_4E = Object.freeze({
  martialStrike:{label:"Martial Strike",cost:4,ocv:"+0",dcv:"+2",damageClasses:2,effect:"[NORMALDC] Strike",addStrength:true},
  offensiveStrike:{label:"Offensive Strike",cost:5,ocv:"-2",dcv:"+1",damageClasses:4,effect:"[NORMALDC] Strike",addStrength:true},
  martialBlock:{label:"Martial Block",cost:4,ocv:"+2",dcv:"+2",damageClasses:0,effect:"Block, Abort",addStrength:false},
  martialThrow:{label:"Martial Throw",cost:3,ocv:"+0",dcv:"+1",damageClasses:0,effect:"STR damage + velocity/5; Target Falls",addStrength:true},
  martialDodge:{label:"Martial Dodge",cost:4,ocv:"--",dcv:"+5",damageClasses:0,effect:"Dodge, Affects All Attacks, Abort",addStrength:false},
  nerveStrike:{label:"Nerve Strike",cost:4,ocv:"-1",dcv:"+1",damageClasses:4,effect:"2d6 NND",addStrength:false},
  martialGrab:{label:"Martial Grab",cost:3,ocv:"-1",dcv:"-1",damageClasses:2,effect:"Grab Two Limbs; STR +3 for holding on",addStrength:true},
  defensiveStrike:{label:"Defensive Strike",cost:5,ocv:"+1",dcv:"+3",damageClasses:0,effect:"[NORMALDC] Strike",addStrength:true},
  martialEscape:{label:"Martial Escape",cost:4,ocv:"+0",dcv:"+0",damageClasses:3,effect:"STR +3 versus Grabs",addStrength:true},
  chokeHold:{label:"Choke Hold",cost:5,ocv:"-2",dcv:"+0",damageClasses:4,effect:"Grab One Limb; 2d6 NND",addStrength:false},
  sacrificeThrow:{label:"Sacrifice Throw",cost:3,ocv:"+2",dcv:"+1",damageClasses:0,effect:"Target Falls; attacker also falls",addStrength:false},
  martialDisarm:{label:"Martial Disarm",cost:4,ocv:"-1",dcv:"+1",damageClasses:2,effect:"Disarm; STR +2 for Disarm",addStrength:true},
  killingStrike:{label:"Killing Strike",cost:4,ocv:"-2",dcv:"+0",damageClasses:2,effect:"Killing damage",addStrength:true},
});

export function buildMartialManeuver4e({key,name="",category="Hand-To-Hand",useWeapon=false,notes=""}){
  const definition=MARTIAL_MANEUVERS_4E[key];
  if(!definition)throw new RangeError("Unknown Fourth Edition Martial Maneuver: "+key);
  return {id:crypto.randomUUID(),tag:"CANONICAL",xmlId:key,name:name||definition.label,alias:definition.label,option:"",levels:0,baseCost:definition.cost,notes,mechanics:{kind:"martialManeuver",key,category,phase:"1/2",action:"Half Phase",useWeapon:Boolean(useWeapon),weaponEffect:useWeapon?definition.effect:"",characterPoints:definition.cost,pricingBasis:"Fourth Edition core maneuver",...definition},rawXml:""};
}
export function analyzeHdcMartialManeuver(rawXml){
  if(!rawXml)return null;
  const node=new DOMParser().parseFromString(rawXml,"application/xml").documentElement;
  const phase=node.getAttribute("PHASE")||"1/2",label=node.getAttribute("ALIAS")||node.getAttribute("DISPLAY")||"",key=Object.keys(MARTIAL_MANEUVERS_4E).find(candidate=>MARTIAL_MANEUVERS_4E[candidate].label.toLowerCase()===label.toLowerCase()),definition=MARTIAL_MANEUVERS_4E[key];
  const status=definition?"converted":label.toLowerCase()==="basic strike"?"later-edition-only":"unsupported";
  return {kind:"martialManeuver",key,category:node.getAttribute("CATEGORY")||"Hand-To-Hand",ocv:node.getAttribute("OCV")||"--",dcv:node.getAttribute("DCV")||"--",damageClasses:Number(node.getAttribute("DC")||0),phase,action:phase==="1/2"?"Half Phase":phase==="1"?"Full Phase":phase,effect:node.getAttribute("EFFECT")||node.getAttribute("DISPLAY")||"",addStrength:String(node.getAttribute("ADDSTR")||"").toLowerCase()==="yes",useWeapon:String(node.getAttribute("USEWEAPON")||"").toLowerCase()==="yes",weaponEffect:node.getAttribute("WEAPONEFFECT")||"",characterPoints:definition?.cost??0,status,warning:status==="later-edition-only"?"Basic Strike is not a Fourth Edition core Martial Maneuver.":status==="unsupported"?"No matching Fourth Edition core Martial Maneuver.":"",pricingBasis:definition?"Fourth Edition core maneuver":"Unpriced until Fourth Edition conversion"};
}
export function martialManeuverSummary4e(entry){const m=entry.mechanics;if(!m)return "";const priced=m.status==="converted"||m.pricingBasis==="Fourth Edition core maneuver";return ["OCV "+m.ocv,"DCV "+m.dcv,m.action,m.effect,priced?m.characterPoints+" Character Points":m.warning||"Unpriced"].filter(Boolean).join(" · ");}
export function martialManeuverEffect4e(entry,strength=0){const m=entry.mechanics||{},normalDice=Math.max(0,Math.floor(Number(strength)/5)+Number(m.damageClasses||0));return String(m.effect||"").replace(/\[NORMALDC\]/g,`${normalDice}d6`).replace(/\[WEAPONDC\]/g,`Weapon +${Number(m.damageClasses||0)} DC`);}
