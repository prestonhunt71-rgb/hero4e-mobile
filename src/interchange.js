import { normalizeCharacter } from "./rules.js";

export const INTERCHANGE_FORMAT="hero4e-mobile-character";
export const INTERCHANGE_VERSION=1;
export function exportCharacterJson(character){
  const payload=structuredClone(character); delete payload.preservedHdc;
  return JSON.stringify({format:INTERCHANGE_FORMAT,version:INTERCHANGE_VERSION,exportedAt:new Date().toISOString(),character:payload},null,2);
}
export function importCharacterJson(text){
  let data; try{data=JSON.parse(text)}catch{throw new Error("This file is not valid JSON.")}
  if(data?.format!==INTERCHANGE_FORMAT||data?.version!==INTERCHANGE_VERSION||!data?.character)throw new Error("This is not a supported HERO4E character file.");
  const character=normalizeCharacter({...data.character,id:crypto.randomUUID(),preservedHdc:null,hdcDirty:false,source:{type:"hero4e-json",importedAt:new Date().toISOString()}});
  character.warnings=[]; return character;
}
