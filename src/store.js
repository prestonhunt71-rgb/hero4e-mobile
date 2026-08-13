const KEY="hero4e-mobile.characters.v1";
export function loadCharacters(){ try{return JSON.parse(localStorage.getItem(KEY)||"[]");}catch{return [];} }
export function saveCharacter(character){ const all=loadCharacters(); const index=all.findIndex((item)=>item.id===character.id); if(index>=0) all[index]=character; else all.unshift(character); localStorage.setItem(KEY,JSON.stringify(all)); return all; }
export function getCharacter(id){ return loadCharacters().find((item)=>item.id===id); }
