const KEY="hero4e-mobile.characters.v1";
export function loadCharacters(){ try{return JSON.parse(localStorage.getItem(KEY)||"[]");}catch{return [];} }
export function saveCharacter(character){ const all=loadCharacters(); const index=all.findIndex((item)=>item.id===character.id); if(index>=0) all[index]=character; else all.unshift(character); localStorage.setItem(KEY,JSON.stringify(all)); return all; }
export function getCharacter(id){ return loadCharacters().find((item)=>item.id===id); }
export function deleteCharacter(id){const all=loadCharacters().filter(item=>item.id!==id);localStorage.setItem(KEY,JSON.stringify(all));return all;}
export function replaceCharacters(characters){if(!Array.isArray(characters))throw new TypeError("Roster must be an array.");localStorage.setItem(KEY,JSON.stringify(characters));return characters;}
