import { normalizeCharacter } from "./rules.js";
const KEY="hero4e-mobile.characters.v2",LEGACY_KEYS=["hero4e-mobile.characters.v1"];
const parse=value=>{try{const data=JSON.parse(value||"[]");return Array.isArray(data)?data:[];}catch{return [];}};
function readRoster(){const current=localStorage.getItem(KEY);if(current!==null)return parse(current);for(const legacy of LEGACY_KEYS){const value=localStorage.getItem(legacy);if(value!==null){const migrated=parse(value).map(normalizeCharacter);localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}}return [];}
export function loadCharacters(){return readRoster().map(character=>character?.schema==="hero4e-character"&&character?.schemaVersion===1?character:normalizeCharacter(character));}
export function saveCharacter(character){const normalized=normalizeCharacter(character),all=loadCharacters(),index=all.findIndex(item=>item.id===normalized.id);if(index>=0)all[index]=normalized;else all.unshift(normalized);localStorage.setItem(KEY,JSON.stringify(all));return all;}
export function getCharacter(id){return loadCharacters().find(item=>item.id===id);}
export function deleteCharacter(id){const all=loadCharacters().filter(item=>item.id!==id);localStorage.setItem(KEY,JSON.stringify(all));return all;}
export function replaceCharacters(characters){if(!Array.isArray(characters))throw new TypeError("Roster must be an array.");const normalized=characters.map(normalizeCharacter);localStorage.setItem(KEY,JSON.stringify(normalized));return normalized;}
export const rosterStorageVersion=2;