export const DISADVANTAGES_4E=Object.freeze({
normalCharacteristicMaxima:{label:"Normal Characteristic Maxima",fixed:20},
unluck:{label:"Unluck",perLevel:5,levelsLabel:"d6"},
psychologicalLimitation:{label:"Psychological Limitation",options:[{label:"Frequency",values:{uncommon:5,common:10,veryCommon:15}},{label:"Intensity",values:{moderate:0,strong:5,total:10}}]},
distinctiveFeatures:{label:"Distinctive Features",options:[{label:"Concealability",values:{easilyConcealable:5,concealable:10,notConcealable:15}},{label:"Reaction",values:{noticed:0,major:5,extreme:10}}]},
hunted:{label:"Hunted",options:[{label:"Capabilities",values:{lessPowerful:5,asPowerful:10,morePowerful:15}},{label:"Appearance",values:{"8orLess":0,"11orLess":5,"14orLess":10}},{label:"Motivation",values:{mildlyPunish:-5,harshlyPunish:0}}]},
dependentNpc:{label:"Dependent NPC",options:[{label:"Competence",values:{incompetent:10,normal:5,slightlyLessPowerful:0,asPowerful:-5}},{label:"Appearance",values:{"8orLess":5,"11orLess":10,"14orLess":15}},{label:"Usefulness",values:{ordinary:0,useful:-5}}]},
reputation:{label:"Reputation",options:[{label:"Recognized",values:{sometimes:5,frequently:10,almostAlways:15}}]},
rivalry:{label:"Rivalry",options:[{label:"Situation",values:{professional:5,romantic:5,both:10}}]},
vulnerability:{label:"Vulnerability",options:[{label:"Attack frequency",values:{uncommon:5,common:10,veryCommon:15}},{label:"Effect",values:{halfStun:1,halfBody:1,doubleStun:2,doubleBody:2},multiply:true}]}
});
const pretty=value=>String(value).replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()).replace(/(\d+)or/g,"$1 or ");
export function disadvantageOptions4e(key){const d=DISADVANTAGES_4E[key];if(!d)throw new Error("Unknown Fourth Edition disadvantage: "+key);return (d.options||[]).map(group=>({...group,choices:Object.keys(group.values).map(key=>({key,label:pretty(key),value:group.values[key]}))}));}
export function calculateDisadvantage4e(key,{levels=1,selections=[]}={}){const d=DISADVANTAGES_4E[key];if(!d)throw new Error("Unknown Fourth Edition disadvantage: "+key);let cost=d.fixed??(d.perLevel?d.perLevel*Math.max(1,Number(levels)||1):0),detail=[];for(let i=0;i<(d.options||[]).length;i++){const group=d.options[i],choice=selections[i]??Object.keys(group.values)[0],value=group.values[choice];if(!Number.isFinite(value))throw new Error("Choose "+group.label);cost=group.multiply?cost*value:cost+value;detail.push(pretty(choice));}return {key,label:d.label,levels:Number(levels)||0,selections,cost:Math.max(0,cost),detail:detail.join("; "),pricingBasis:"Fourth Edition"};}
export function buildDisadvantage4e({key,name,levels=1,selections=[],notes=""}){const mechanics=calculateDisadvantage4e(key,{levels,selections});return {id:crypto.randomUUID(),tag:"CANONICAL",xmlId:key,name:name||mechanics.label,alias:mechanics.label,option:mechanics.detail,levels:Number(levels),baseCost:mechanics.cost,notes,mechanics,rawXml:""};}
export function disadvantageSummary(entry){const d=entry.mechanics;if(!d?.pricingBasis)return "";return [d.detail,d.cost+" points"].filter(Boolean).join(" · ");}
