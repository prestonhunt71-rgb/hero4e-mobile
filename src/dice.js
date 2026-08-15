import { combatValue, rollHeroDice } from "./rules.js";

const ATTACK_PROFILES_4E=Object.freeze({
  aid:{},dispel:{},drain:{},egoAttack:{mental:true,damageMode:"mental"},energyBlast:{damageMode:"normal"},entangle:{},flash:{},
  handToHandAttack:{damageMode:"normal"},handToHandKillingAttack:{damageMode:"killing"},mentalIllusions:{mental:true},mindControl:{mental:true},mindScan:{mental:true},
  rangedKillingAttack:{damageMode:"killing"},suppress:{},telekinesis:{},transfer:{},transform:{},
});
export function attackPowerProfile4e(key){const profile=ATTACK_PROFILES_4E[key];return profile?{attack:true,mental:Boolean(profile.mental),damageMode:profile.damageMode||null}:{attack:false,mental:false,damageMode:null};}
export function rollAttackPower4e(entry,characteristics,random=Math.random){
  const profile=attackPowerProfile4e(entry?.mechanics?.key);if(!profile.attack)throw new Error("This Power is not an attack");
  const result=rollHeroDice({count:3},random),cv=combatValue(characteristics?.[profile.mental?"EGO":"DEX"]),defense=cv+11-result.total;
  return {...result,cv,defense,combatValueLabel:profile.mental?"ECV":"OCV",defenseLabel:profile.mental?"ECV":"DCV"};
}
export function powerDamageDice4e(entry){
  const profile=attackPowerProfile4e(entry?.mechanics?.key);if(!profile.damageMode)return null;
  const purchased=Math.max(0,Number(entry?.mechanics?.levels||0)),count=Math.floor(purchased);
  return {count,half:purchased-count>=.5,mode:profile.damageMode};
}