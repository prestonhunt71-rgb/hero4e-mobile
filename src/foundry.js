export const FOUNDRY_SYSTEM_ID="hero4e-foundryvtt-main";
const types={skills:"skill",perks:"perk",talents:"talent",martialarts:"martialart",powers:"power",disadvantages:"disadvantage",equipment:"equipment"};
const primaryBases={STR:10,DEX:10,CON:10,BODY:10,INT:10,EGO:10,PRE:10,COM:10};
const figuredKeys=["PD","ED","SPD","REC","END","STUN"];
const round=value=>Math.floor(Number(value)+.5);
function legacy(key,value,index,base){return {XMLID:key,ID:9000000000000+index,BASECOST:0,LEVELS:Number(value)-Number(base),ALIAS:key,POSITION:index+1,MULTIPLIER:1,NAME:"",AFFECTS_PRIMARY:true,AFFECTS_TOTAL:true,xmlTag:key};}
export function characterToFoundryActor(character,{exportedAt=new Date().toISOString()}={}){
 if(character?.schema!=="hero4e-character"||character?.rulesEdition!=="4e")throw new TypeError("A Fourth Edition mobile character is required.");
 const values=character.characteristics||{},str=Number(values.STR??10),dex=Number(values.DEX??10),con=Number(values.CON??10),body=Number(values.BODY??10),ego=Number(values.EGO??10);
 const bases={...primaryBases,PD:round(str/5),ED:round(con/5),SPD:Math.floor(1+dex/10),REC:round(str/5)+round(con/5),END:2*con,STUN:body+round(str/2)+round(con/2)};
 const system={rulesEdition:"4e",is5e:true,_type:"pc",CHARACTER:{version:"mobile-1",xmlTag:"CHARACTER",CHARACTER_INFO:{CHARACTER_NAME:character.name,PLAYER_NAME:character.playerName||""}},characteristics:{}};
 const keys=[...Object.keys(primaryBases),...figuredKeys];keys.forEach((key,index)=>{const value=Number(values[key]??bases[key]);system[key]=legacy(key,value,index,bases[key]);system.characteristics[key.toLowerCase()]={value,max:value};});
 const combat={OCV:round(dex/3),DCV:round(dex/3),OMCV:round(ego/3),DMCV:round(ego/3)};Object.entries(combat).forEach(([key,value],offset)=>{system[key]=legacy(key,value,keys.length+offset,value);system.characteristics[key.toLowerCase()]={value,max:value};});
 const items=[];let position=0;for(const [section,type]of Object.entries(types))for(const entry of character.sections?.[section]||[])items.push({name:entry.name||entry.alias||("Unnamed "+type),type,system:{XMLID:entry.xmlId||"HERO4E_MOBILE_ENTRY",ID:9001000000000+position,BASECOST:Number(entry.baseCost||0),LEVELS:Number(entry.levels||0),ALIAS:entry.alias||entry.name||"",NAME:entry.name||"",OPTION_ALIAS:entry.option||"",COMMENTS:entry.notes||"",POSITION:position++,MULTIPLIER:1,xmlTag:entry.tag||type.toUpperCase(),_type:type},effects:[],flags:{[FOUNDRY_SYSTEM_ID]:{mobile:{sourceId:String(entry.id||""),section,imported:true}}}});
 return {name:character.name,type:"pc",img:"icons/svg/mystery-man.svg",system,items,effects:[],folder:null,flags:{[FOUNDRY_SYSTEM_ID]:{mobileImport:{format:"hero4e-mobile-character",version:1,sourceCharacterId:character.id||null,exportedAt}}},prototypeToken:{name:character.name,displayName:20,actorLink:true,texture:{src:"icons/svg/mystery-man.svg"}},_stats:{systemId:FOUNDRY_SYSTEM_ID,systemVersion:"0.1.0",coreVersion:"13.348",createdTime:Date.now(),modifiedTime:Date.now(),lastModifiedBy:null}};
}
export function exportFoundryActorJson(character){return JSON.stringify(characterToFoundryActor(character),null,2);}
