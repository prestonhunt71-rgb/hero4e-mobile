import { analyzeHdcPower } from "./powers.js";
import { figured, movementBases, movementKeys, normalizeCharacter, primaryDefinitions, primaryKeys, figuredKeys } from "./rules.js";
const attribute = (node, name, fallback="") => node?.getAttribute(name) ?? fallback;
export function importHdc(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = xml.querySelector("parsererror");
  if (parseError) throw new Error("This file is not valid HDC XML.");
  const root = xml.querySelector("CHARACTER");
  if (!root) throw new Error("No Hero Designer CHARACTER record was found.");
  const info = root.getElementsByTagName("CHARACTER_INFO")[0];
  const block = root.getElementsByTagName("CHARACTERISTICS")[0];
  const basic = root.getElementsByTagName("BASIC_CONFIGURATION")[0];
  if (!block) throw new Error("The HDC file has no CHARACTERISTICS block.");
  const characteristics = {};
  for (const key of primaryKeys) characteristics[key] = primaryDefinitions[key][0] + Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const bases = figured(characteristics);
  for (const key of figuredKeys) characteristics[key] = bases[key] + Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const movement=movementBases(characteristics);for(const key of movementKeys)characteristics[key]=movement[key]+Number(attribute(block.getElementsByTagName(key)[0],"LEVELS",0));
  const sectionNames=["SKILLS","PERKS","TALENTS","MARTIALARTS","POWERS","DISADVANTAGES","EQUIPMENT"];
  const sections=Object.fromEntries(sectionNames.map((sectionName)=>{ const section=root.getElementsByTagName(sectionName)[0]; const entries=section?Array.from(section.childNodes).filter((node)=>node.nodeType===1).map((node)=>({ id:attribute(node,"ID")||crypto.randomUUID(), tag:node.tagName, xmlId:attribute(node,"XMLID"), name:attribute(node,"NAME")||attribute(node,"INPUT")||attribute(node,"DISPLAY")||attribute(node,"ALIAS")||attribute(node,"XMLID")||node.tagName, alias:attribute(node,"ALIAS"), option:attribute(node,"OPTION_ALIAS")||attribute(node,"OPTION"), levels:Number(attribute(node,"LEVELS",0)), baseCost:Number(attribute(node,"BASECOST",0)), notes:node.getElementsByTagName("NOTES")[0]?.textContent?.trim()||"", rawXml:new XMLSerializer().serializeToString(node), mechanics:sectionName==="POWERS"?analyzeHdcPower(new XMLSerializer().serializeToString(node)):null })):[]; return [sectionName.toLowerCase(),entries]; }));
  return normalizeCharacter({ name:attribute(info,"CHARACTER_NAME","Imported Hero"), playerName:attribute(info,"PLAYER_NAME"), profile:{alternateIdentities:attribute(info,"ALTERNATE_IDENTITIES"),campaignName:attribute(info,"CAMPAIGN_NAME"),background:info?.getElementsByTagName("BACKGROUND")[0]?.textContent||"",personality:info?.getElementsByTagName("PERSONALITY")[0]?.textContent||"",quote:info?.getElementsByTagName("QUOTE")[0]?.textContent||"",tactics:info?.getElementsByTagName("TACTICS")[0]?.textContent||"",appearance:info?.getElementsByTagName("APPEARANCE")[0]?.textContent||"",notes:info?.getElementsByTagName("NOTES1")[0]?.textContent||""}, points:{base:Number(attribute(basic,"BASE_POINTS",0)),disadvantages:Number(attribute(basic,"DISAD_POINTS",0)),experience:Number(attribute(basic,"EXPERIENCE",0))}, characteristics, sections, source:{type:"hdc",formatVersion:attribute(root,"version"),template:attribute(root,"TEMPLATE"),importedAt:new Date().toISOString()}, preservedHdc:xmlText, hdcDirty:false, warnings:["Imported from Hero Designer. Unchanged exports preserve the original file exactly; edited exports retain the original HDC structure."] });
}


function setAttribute(node, name, value) { if (node) node.setAttribute(name, String(value)); }
export function exportHdc(character) {
  if (!character?.preservedHdc) throw new Error("This character has no preserved HDC source.");
  if (!character.hdcDirty) return character.preservedHdc;
  const xml = new DOMParser().parseFromString(character.preservedHdc, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("The preserved HDC source is invalid.");
  const root = xml.querySelector("CHARACTER");
  const info = root?.getElementsByTagName("CHARACTER_INFO")[0];
  setAttribute(info, "CHARACTER_NAME", character.name);
  setAttribute(info, "PLAYER_NAME", character.playerName || "");
  setAttribute(info,"ALTERNATE_IDENTITIES",character.profile?.alternateIdentities||""); setAttribute(info,"CAMPAIGN_NAME",character.profile?.campaignName||"");
  const profileTags={background:"BACKGROUND",personality:"PERSONALITY",quote:"QUOTE",tactics:"TACTICS",appearance:"APPEARANCE",notes:"NOTES1"}; for(const [key,tag]of Object.entries(profileTags)){let node=info?.getElementsByTagName(tag)[0];if(!node&&info){node=xml.createElement(tag);info.appendChild(node);}if(node)node.textContent=character.profile?.[key]||"";}
  const basic=root?.getElementsByTagName("BASIC_CONFIGURATION")[0];setAttribute(basic,"BASE_POINTS",Number(character.points?.base||0));setAttribute(basic,"DISAD_POINTS",Number(character.points?.disadvantages||0));setAttribute(basic,"EXPERIENCE",Number(character.points?.experience||0));
  const block = root?.getElementsByTagName("CHARACTERISTICS")[0];
  const bases = figured(character.characteristics);
  for (const key of primaryKeys) setAttribute(block?.getElementsByTagName(key)[0], "LEVELS", Number(character.characteristics[key]) - primaryDefinitions[key][0]);
  for (const key of figuredKeys) setAttribute(block?.getElementsByTagName(key)[0], "LEVELS", Number(character.characteristics[key]) - bases[key]);
  const movement=movementBases(character.characteristics);for(const key of movementKeys)setAttribute(block?.getElementsByTagName(key)[0],"LEVELS",Number(character.characteristics[key])-movement[key]);
  const sectionTags={skills:"SKILLS",perks:"PERKS",talents:"TALENTS",martialarts:"MARTIALARTS",powers:"POWERS",disadvantages:"DISADVANTAGES",equipment:"EQUIPMENT"};
  for(const [key,tag] of Object.entries(sectionTags)){const section=root?.getElementsByTagName(tag)[0];if(!section)continue;const entries=character.sections?.[key]||[];const byId=new Map(entries.map(entry=>[String(entry.id),entry]));for(const node of Array.from(section.childNodes).filter(node=>node.nodeType===1)){if(!byId.has(attribute(node,"ID")))node.remove();}for(const entry of entries){const node=Array.from(section.childNodes).find(candidate=>candidate.nodeType===1&&attribute(candidate,"ID")===String(entry.id));if(node)section.appendChild(node);}}
  for (const entries of Object.values(character.sections || {})) for (const entry of entries) {
    const node = Array.from(root?.getElementsByTagName(entry.tag || "*") || []).find((candidate) => attribute(candidate, "ID") === String(entry.id));
    if (!node) continue;
    const originalName = attribute(node, "NAME");
    if (originalName || (!attribute(node, "ALIAS") && entry.name)) setAttribute(node, "NAME", entry.name || "");
    else setAttribute(node, "ALIAS", entry.name || "");
    setAttribute(node, "LEVELS", Number(entry.levels || 0));
    let notes = node.getElementsByTagName("NOTES")[0];
    if (!notes) { notes = xml.createElement("NOTES"); node.appendChild(notes); }
    notes.textContent = entry.notes || "";
  }
  return new XMLSerializer().serializeToString(xml);
}
