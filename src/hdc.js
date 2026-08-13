import { figured, normalizeCharacter, primaryDefinitions, primaryKeys, figuredKeys } from "./rules.js";
const attribute = (node, name, fallback="") => node?.getAttribute(name) ?? fallback;
export function importHdc(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = xml.querySelector("parsererror");
  if (parseError) throw new Error("This file is not valid HDC XML.");
  const root = xml.querySelector("CHARACTER");
  if (!root) throw new Error("No Hero Designer CHARACTER record was found.");
  const info = root.getElementsByTagName("CHARACTER_INFO")[0];
  const block = root.getElementsByTagName("CHARACTERISTICS")[0];
  if (!block) throw new Error("The HDC file has no CHARACTERISTICS block.");
  const characteristics = {};
  for (const key of primaryKeys) characteristics[key] = primaryDefinitions[key][0] + Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const bases = figured(characteristics);
  for (const key of figuredKeys) characteristics[key] = bases[key] + Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const sectionNames=["SKILLS","PERKS","TALENTS","MARTIALARTS","POWERS","DISADVANTAGES","EQUIPMENT"];
  const sections=Object.fromEntries(sectionNames.map((sectionName)=>{ const section=root.getElementsByTagName(sectionName)[0]; const entries=section?Array.from(section.childNodes).filter((node)=>node.nodeType===1).map((node)=>({ id:attribute(node,"ID")||crypto.randomUUID(), tag:node.tagName, xmlId:attribute(node,"XMLID"), name:attribute(node,"NAME")||attribute(node,"INPUT")||attribute(node,"DISPLAY")||attribute(node,"ALIAS")||attribute(node,"XMLID")||node.tagName, alias:attribute(node,"ALIAS"), option:attribute(node,"OPTION_ALIAS")||attribute(node,"OPTION"), levels:Number(attribute(node,"LEVELS",0)), baseCost:Number(attribute(node,"BASECOST",0)), notes:node.getElementsByTagName("NOTES")[0]?.textContent?.trim()||"", rawXml:new XMLSerializer().serializeToString(node) })):[]; return [sectionName.toLowerCase(),entries]; }));
  return normalizeCharacter({ name:attribute(info,"CHARACTER_NAME","Imported Hero"), playerName:attribute(info,"PLAYER_NAME"), characteristics, sections, source:{type:"hdc",formatVersion:attribute(root,"version"),template:attribute(root,"TEMPLATE"),importedAt:new Date().toISOString()}, preservedHdc:xmlText, warnings:["The original HDC XML is preserved. This milestone imports identity and characteristics; abilities and full lossless export are next."] });
}
