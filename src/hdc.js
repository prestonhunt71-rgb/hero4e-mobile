import { analyzeHdcPower } from "./powers.js";
import { analyzeHdcSkill } from "./skills.js";
import { analyzeHdcDisadvantage } from "./disadvantages.js";
import { analyzeHdcEquipment } from "./equipment.js";
import { analyzeHdcPerk, analyzeHdcTalent } from "./abilities.js";
import { analyzeHdcMartialManeuver } from "./martialarts.js";
import {
  figured,
  movementBases,
  movementKeys,
  normalizeCharacter,
  primaryDefinitions,
  primaryKeys,
  figuredKeys,
} from "./rules.js";
const attribute = (node, name, fallback = "") =>
  node?.getAttribute(name) ?? fallback;
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
  for (const key of primaryKeys)
    characteristics[key] =
      primaryDefinitions[key][0] +
      Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const bases = figured(characteristics);
  for (const key of figuredKeys)
    characteristics[key] =
      bases[key] +
      Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const movement = movementBases(characteristics);
  for (const key of movementKeys)
    characteristics[key] =
      movement[key] +
      Number(attribute(block.getElementsByTagName(key)[0], "LEVELS", 0));
  const sectionNames = [
    "SKILLS",
    "PERKS",
    "TALENTS",
    "MARTIALARTS",
    "POWERS",
    "DISADVANTAGES",
    "EQUIPMENT",
  ];
  const sections = Object.fromEntries(
    sectionNames.map((sectionName) => {
      const section = root.getElementsByTagName(sectionName)[0];
      const entries = section
        ? Array.from(section.childNodes)
            .filter((node) => node.nodeType === 1)
            .map((node) => {
              const rawXml = new XMLSerializer().serializeToString(node),
                mechanics =
                  sectionName === "POWERS"
                    ? analyzeHdcPower(rawXml)
                    : sectionName === "SKILLS"
                      ? analyzeHdcSkill(rawXml, characteristics)
                      : sectionName === "DISADVANTAGES"
                        ? analyzeHdcDisadvantage(rawXml)
                        : sectionName === "EQUIPMENT"
                          ? analyzeHdcEquipment(rawXml)
                          : sectionName === "TALENTS"
                            ? analyzeHdcTalent(rawXml, characteristics)
                            : sectionName === "PERKS"
                              ? analyzeHdcPerk(rawXml)
                              : sectionName === "MARTIALARTS"
                                ? analyzeHdcMartialManeuver(rawXml)
                                : null;
              return {
                id: attribute(node, "ID") || crypto.randomUUID(),
                tag: node.tagName,
                xmlId: attribute(node, "XMLID"),
                name:
                  attribute(node, "NAME") ||
                  attribute(node, "INPUT") ||
                  attribute(node, "DISPLAY") ||
                  attribute(node, "ALIAS") ||
                  attribute(node, "XMLID") ||
                  node.tagName,
                alias: attribute(node, "ALIAS"),
                option:
                  attribute(node, "OPTION_ALIAS") || attribute(node, "OPTION"),
                levels: Number(attribute(node, "LEVELS", 0)),
                baseCost: Number(attribute(node, "BASECOST", 0)),
                notes:
                  node.getElementsByTagName("NOTES")[0]?.textContent?.trim() ||
                  "",
                rawXml,
                mechanics,
              };
            })
        : [];
      return [sectionName.toLowerCase(), entries];
    }),
  );
  return normalizeCharacter({
    name: attribute(info, "CHARACTER_NAME", "Imported Hero"),
    playerName: attribute(info, "PLAYER_NAME"),
    profile: {
      alternateIdentities: attribute(info, "ALTERNATE_IDENTITIES"),
      campaignName: attribute(info, "CAMPAIGN_NAME"),
      background:
        info?.getElementsByTagName("BACKGROUND")[0]?.textContent || "",
      personality:
        info?.getElementsByTagName("PERSONALITY")[0]?.textContent || "",
      quote: info?.getElementsByTagName("QUOTE")[0]?.textContent || "",
      tactics: info?.getElementsByTagName("TACTICS")[0]?.textContent || "",
      appearance:
        info?.getElementsByTagName("APPEARANCE")[0]?.textContent || "",
      notes: info?.getElementsByTagName("NOTES1")[0]?.textContent || "",
    },
    points: {
      base: Number(attribute(basic, "BASE_POINTS", 0)),
      disadvantages: Number(attribute(basic, "DISAD_POINTS", 0)),
      experience: Number(attribute(basic, "EXPERIENCE", 0)),
    },
    characteristics,
    sections,
    source: {
      type: "hdc",
      formatVersion: attribute(root, "version"),
      template: attribute(root, "TEMPLATE"),
      importedAt: new Date().toISOString(),
    },
    preservedHdc: xmlText,
    hdcDirty: false,
    warnings: [
      "Imported from Hero Designer. Unchanged exports preserve the original file exactly; edited exports retain the original HDC structure.",
    ],
  });
}

const NATIVE_HDC_IDS={
  skills:{acrobatics:"ACROBATICS",acting:"ACTING",combatDriving:"COMBAT_DRIVING",demolitions:"DEMOLITIONS",disguise:"DISGUISE",electronics:"ELECTRONICS",seduction:"SEDUCTION",stealth:"STEALTH",streetwise:"STREETWISE",deduction:"DEDUCTION",paramedic:"PARAMEDICS",criminology:"CRIMINOLOGY",shadowing:"SHADOWING",tactics:"TACTICS",knowledge:"KNOWLEDGE_SKILL",professionalSkill:"PROFESSIONAL_SKILL",conversation:"CONVERSATION",highSociety:"HIGH_SOCIETY",persuasion:"PERSUASION"},
  talents:{ambidexterity:"AMBIDEXTERITY",dangerSense:"DANGER_SENSE",resistance:"RESISTANCE",eideticMemory:"EIDETIC_MEMORY"},
  powers:{energyBlast:"ENERGYBLAST",handToHandAttack:"HANDTOHANDATTACK",armor:"ARMOR",clinging:"CLINGING",invisibility:"INVISIBILITY",flash:"FLASH"},
  disadvantages:{dependentNpc:"DEPENDENTNPC",distinctiveFeatures:"DISTINCTIVEFEATURES",hunted:"HUNTED",psychologicalLimitation:"PSYCHOLOGICALLIMITATION",reputation:"REPUTATION",rivalry:"RIVALRY",unluck:"UNLUCK",vulnerability:"VULNERABILITY"},
};
const HDC_SECTION_TAGS={skills:"SKILLS",perks:"PERKS",talents:"TALENTS",martialarts:"MARTIALARTS",powers:"POWERS",disadvantages:"DISADVANTAGES",equipment:"EQUIPMENT"};
function nativePrototype(section,entry,prototypes){
  const nodes=prototypes[section]||[],m=entry.mechanics||{};
  if(section==="martialarts")return nodes.find(node=>(node.getAttribute("ALIAS")||node.getAttribute("DISPLAY"))===(m.label||entry.alias));
  if(section==="powers"&&m.isFramework)return nodes.find(node=>(node.getAttribute("ALIAS")||"").toLowerCase()===({multipower:"multipower",elementalControl:"elemental control"}[m.kind]||""));
  const xmlId=NATIVE_HDC_IDS[section]?.[m.key||entry.xmlId];
  return nodes.find(node=>node.getAttribute("XMLID")===xmlId);
}
function setTextChild(xml,parent,tag,value){let node=parent?.getElementsByTagName(tag)[0];if(!node&&parent){node=xml.createElement(tag);parent.appendChild(node);}if(node)node.textContent=value||"";}
function exportNativeHdc(character,templateHdc){
  if(!templateHdc)throw new Error("Native HDC export needs the bundled Hero Designer prototype library.");
  const xml=new DOMParser().parseFromString(templateHdc,"application/xml");if(xml.querySelector("parsererror"))throw new Error("The bundled Hero Designer prototype library is invalid.");
  const root=xml.querySelector("CHARACTER"),prototypes={};
  for(const [section,tag] of Object.entries(HDC_SECTION_TAGS)){const block=root.getElementsByTagName(tag)[0];prototypes[section]=block?[...block.children].map(node=>node.cloneNode(true)):[];if(block)while(block.firstChild)block.removeChild(block.firstChild);}
  root.querySelector("IMAGE")?.remove();
  const unsupported=[];for(const [section,entries] of Object.entries(character.sections||{}))for(const entry of entries){if(section==="powers"&&(entry.mechanics?.modifiers||[]).length){unsupported.push(`${entry.name}: Power modifiers need a verified Hero Designer prototype`);continue;}if(!nativePrototype(section,entry,prototypes))unsupported.push(`${entry.name||entry.alias}: no verified ${section} HDC prototype`);}
  if(unsupported.length)throw new Error("Native HDC export cannot safely represent: "+unsupported.join("; "));
  root.setAttribute("version","3.0");root.setAttribute("TEMPLATE","builtIn.Superheroic.hdt");
  const info=root.getElementsByTagName("CHARACTER_INFO")[0],basic=root.getElementsByTagName("BASIC_CONFIGURATION")[0];setAttribute(info,"CHARACTER_NAME",character.name||"");setAttribute(info,"PLAYER_NAME",character.playerName||"");setAttribute(info,"ALTERNATE_IDENTITIES",character.profile?.alternateIdentities||"");setAttribute(info,"CAMPAIGN_NAME",character.profile?.campaignName||"");for(const [key,tag] of Object.entries({background:"BACKGROUND",personality:"PERSONALITY",quote:"QUOTE",tactics:"TACTICS",appearance:"APPEARANCE",notes:"NOTES1"}))setTextChild(xml,info,tag,character.profile?.[key]);setAttribute(basic,"BASE_POINTS",character.points?.base||0);setAttribute(basic,"DISAD_POINTS",character.points?.disadvantages||0);setAttribute(basic,"EXPERIENCE",character.points?.experience||0);
  const block=root.getElementsByTagName("CHARACTERISTICS")[0],bases=figured(character.characteristics),moves=movementBases(character.characteristics);for(const key of primaryKeys)setAttribute(block.getElementsByTagName(key)[0],"LEVELS",Number(character.characteristics[key])-primaryDefinitions[key][0]);for(const key of figuredKeys)setAttribute(block.getElementsByTagName(key)[0],"LEVELS",Number(character.characteristics[key])-bases[key]);for(const key of movementKeys)setAttribute(block.getElementsByTagName(key)[0],"LEVELS",Number(character.characteristics[key])-moves[key]);
  let sequence=0;const exportedIds=new Map();for(const [section,entries] of Object.entries(character.sections||{})){const target=root.getElementsByTagName(HDC_SECTION_TAGS[section])[0];if(!target)continue;for(const entry of entries){const node=nativePrototype(section,entry,prototypes).cloneNode(true),id=String(1700000000000+sequence++);exportedIds.set(entry.id,id);setAttribute(node,"ID",id);setAttribute(node,"POSITION",target.children.length);setAttribute(node,"LEVELS",entry.levels||0);setAttribute(node,"BASECOST",entry.baseCost||entry.mechanics?.cost||entry.mechanics?.characterPoints||entry.mechanics?.realCost||0);if(entry.name&&entry.name!==entry.alias)setAttribute(node,"NAME",entry.name);node.querySelectorAll("MODIFIER").forEach(mod=>mod.remove());let notes=node.getElementsByTagName("NOTES")[0];if(!notes){notes=xml.createElement("NOTES");node.appendChild(notes);}notes.textContent=entry.notes||"";target.appendChild(node);}}
  for(const entry of character.sections?.powers||[]){if(!entry.mechanics?.frameworkId)continue;const id=exportedIds.get(entry.id),parent=exportedIds.get(entry.mechanics.frameworkId),node=[...root.getElementsByTagName("POWERS")[0].children].find(item=>item.getAttribute("ID")===id);if(node&&parent){setAttribute(node,"PARENTID",parent);if(entry.mechanics.slotKind==="fixed")setAttribute(node,"ULTRA_SLOT","Yes");}}
  return new XMLSerializer().serializeToString(xml);
}
function setAttribute(node, name, value) {
  if (node) node.setAttribute(name, String(value));
}
export function exportHdc(character, templateHdc = "") {
  if (!character?.preservedHdc) return exportNativeHdc(character, templateHdc);
  if (!character.hdcDirty) return character.preservedHdc;
  const xml = new DOMParser().parseFromString(
    character.preservedHdc,
    "application/xml",
  );
  if (xml.querySelector("parsererror"))
    throw new Error("The preserved HDC source is invalid.");
  const root = xml.querySelector("CHARACTER");
  const info = root?.getElementsByTagName("CHARACTER_INFO")[0];
  setAttribute(info, "CHARACTER_NAME", character.name);
  setAttribute(info, "PLAYER_NAME", character.playerName || "");
  setAttribute(
    info,
    "ALTERNATE_IDENTITIES",
    character.profile?.alternateIdentities || "",
  );
  setAttribute(info, "CAMPAIGN_NAME", character.profile?.campaignName || "");
  const profileTags = {
    background: "BACKGROUND",
    personality: "PERSONALITY",
    quote: "QUOTE",
    tactics: "TACTICS",
    appearance: "APPEARANCE",
    notes: "NOTES1",
  };
  for (const [key, tag] of Object.entries(profileTags)) {
    let node = info?.getElementsByTagName(tag)[0];
    if (!node && info) {
      node = xml.createElement(tag);
      info.appendChild(node);
    }
    if (node) node.textContent = character.profile?.[key] || "";
  }
  const basic = root?.getElementsByTagName("BASIC_CONFIGURATION")[0];
  setAttribute(basic, "BASE_POINTS", Number(character.points?.base || 0));
  setAttribute(
    basic,
    "DISAD_POINTS",
    Number(character.points?.disadvantages || 0),
  );
  setAttribute(basic, "EXPERIENCE", Number(character.points?.experience || 0));
  const block = root?.getElementsByTagName("CHARACTERISTICS")[0];
  const bases = figured(character.characteristics);
  for (const key of primaryKeys)
    setAttribute(
      block?.getElementsByTagName(key)[0],
      "LEVELS",
      Number(character.characteristics[key]) - primaryDefinitions[key][0],
    );
  for (const key of figuredKeys)
    setAttribute(
      block?.getElementsByTagName(key)[0],
      "LEVELS",
      Number(character.characteristics[key]) - bases[key],
    );
  const movement = movementBases(character.characteristics);
  for (const key of movementKeys)
    setAttribute(
      block?.getElementsByTagName(key)[0],
      "LEVELS",
      Number(character.characteristics[key]) - movement[key],
    );
  const sectionTags = {
    skills: "SKILLS",
    perks: "PERKS",
    talents: "TALENTS",
    martialarts: "MARTIALARTS",
    powers: "POWERS",
    disadvantages: "DISADVANTAGES",
    equipment: "EQUIPMENT",
  };
  for (const [key, tag] of Object.entries(sectionTags)) {
    const section = root?.getElementsByTagName(tag)[0];
    if (!section) continue;
    const entries = character.sections?.[key] || [];
    const byId = new Map(entries.map((entry) => [String(entry.id), entry]));
    for (const node of Array.from(section.childNodes).filter(
      (node) => node.nodeType === 1,
    )) {
      if (!byId.has(attribute(node, "ID"))) node.remove();
    }
    for (const entry of entries) {
      const node = Array.from(section.childNodes).find(
        (candidate) =>
          candidate.nodeType === 1 &&
          attribute(candidate, "ID") === String(entry.id),
      );
      if (node) section.appendChild(node);
    }
  }
  for (const entries of Object.values(character.sections || {}))
    for (const entry of entries) {
      const node = Array.from(
        root?.getElementsByTagName(entry.tag || "*") || [],
      ).find((candidate) => attribute(candidate, "ID") === String(entry.id));
      if (!node) continue;
      const originalName = attribute(node, "NAME");
      if (originalName || (!attribute(node, "ALIAS") && entry.name))
        setAttribute(node, "NAME", entry.name || "");
      else setAttribute(node, "ALIAS", entry.name || "");
      setAttribute(node, "LEVELS", Number(entry.levels || 0));
      let notes = node.getElementsByTagName("NOTES")[0];
      if (!notes) {
        notes = xml.createElement("NOTES");
        node.appendChild(notes);
      }
      notes.textContent = entry.notes || "";
    }
  return new XMLSerializer().serializeToString(xml);
}
