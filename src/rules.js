export const primaryDefinitions = Object.freeze({ STR:[10,1], DEX:[10,3], CON:[10,2], BODY:[10,2], INT:[10,1], EGO:[10,2], PRE:[10,1], COM:[10,0.5] });
export const primaryKeys = Object.freeze(Object.keys(primaryDefinitions));
export const figuredKeys = Object.freeze(["PD", "ED", "SPD", "REC", "END", "STUN"]);
export const movementKeys = Object.freeze(["RUNNING","SWIMMING","LEAPING"]);
export function movementBases(values={}){const str=Number(values.STR??10);return {RUNNING:6,SWIMMING:2,LEAPING:Math.floor(Math.max(0,str)/2.5)/2};}
export const roundFavor = (value) => Math.floor(Number(value) + 0.5);
export function figured(values) {
  const v = { ...Object.fromEntries(primaryKeys.map((key) => [key, primaryDefinitions[key][0]])), ...values };
  return { PD:roundFavor(v.STR/5), ED:roundFavor(v.CON/5), SPD:Math.floor(1+v.DEX/10), REC:roundFavor(v.STR/5)+roundFavor(v.CON/5), END:2*v.CON, STUN:v.BODY+roundFavor(v.STR/2)+roundFavor(v.CON/2) };
}
export function normalizeCharacter(character) {
  const primaries = Object.fromEntries(primaryKeys.map((key) => [key, Number(character.characteristics?.[key] ?? primaryDefinitions[key][0])]));
  const bases = figured(primaries);
  const movement=movementBases(primaries);
  const characteristics = { ...primaries, ...Object.fromEntries(figuredKeys.map((key) => [key, Number(character.characteristics?.[key] ?? bases[key])])), ...Object.fromEntries(movementKeys.map(key=>[key,Number(character.characteristics?.[key]??movement[key])])) };
  return { schema:"hero4e-character", schemaVersion:1, id:character.id || crypto.randomUUID(), name:character.name || "New Hero", playerName:character.playerName || "", rulesEdition:"4e", createdAt:character.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString(), source:character.source || {type:"native"}, profile:{...Object.fromEntries(["alternateIdentities","campaignName","background","personality","quote","tactics","appearance","notes"].map(key=>[key,""])),...(character.profile||{})}, points:{base:Number(character.points?.base??0),disadvantages:Number(character.points?.disadvantages??0),experience:Number(character.points?.experience??0)}, portrait:character.portrait?.dataUrl?{dataUrl:String(character.portrait.dataUrl),mimeType:String(character.portrait.mimeType||"image/jpeg"),width:Number(character.portrait.width||0),height:Number(character.portrait.height||0),bytes:Number(character.portrait.bytes||0),updatedAt:character.portrait.updatedAt||new Date().toISOString()}:null, characteristics, current:{ BODY:Number(character.current?.BODY ?? characteristics.BODY), STUN:Number(character.current?.STUN ?? characteristics.STUN), END:Number(character.current?.END ?? characteristics.END) }, combat:{segment:Math.min(12,Math.max(1,Number(character.combat?.segment||12))),turn:Math.max(1,Number(character.combat?.turn||1))}, preservedHdc:character.preservedHdc || null, hdcDirty:Boolean(character.hdcDirty), sections:character.sections || {}, warnings:character.warnings || [] };
}
export function totalCharacteristicCost(c){const bases=figured(c),movement=movementBases(c);const primary=characteristicCost(c);const figuredCost=(c.PD-bases.PD)+(c.ED-bases.ED)+(c.SPD-(1+c.DEX/10))*10+(c.REC-bases.REC)*2+(c.END-bases.END)*.5+(c.STUN-bases.STUN);const movementCost=(c.RUNNING-movement.RUNNING)*2+(c.SWIMMING-movement.SWIMMING);return primary+figuredCost+movementCost;}
export function characteristicCost(characteristics) { return primaryKeys.reduce((sum,key)=>sum+(characteristics[key]-primaryDefinitions[key][0])*primaryDefinitions[key][1],0); }
export const combatValue = (value) => roundFavor(Number(value)/3);
export function roll3d6(random=Math.random) { const dice=Array.from({length:3},()=>1+Math.floor(random()*6)); return {dice,total:dice.reduce((a,b)=>a+b,0)}; }
export function rollNormalDamage(count=6, random=Math.random) { const dice=Array.from({length:count},()=>1+Math.floor(random()*6)); return {dice,stun:dice.reduce((a,b)=>a+b,0),body:dice.reduce((sum,die)=>sum+(die===1?0:die===6?2:1),0)}; }
export function rollKillingDamage(count=2, random=Math.random) { const dice=Array.from({length:count},()=>1+Math.floor(random()*6)); const body=dice.reduce((a,b)=>a+b,0); const multiplier=Math.max(1,Math.floor(random()*6)); return {dice,body,multiplier,stun:body*multiplier}; }
