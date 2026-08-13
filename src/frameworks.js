const rounded=value=>Math.round(Number(value)||0);

export const SKILL_ENHANCERS_4E=Object.freeze({
  jackOfAllTrades:{label:"Jack of All Trades",affects:["professionalSkill"]},
  linguist:{label:"Linguist",affects:["languages"]},
  scholar:{label:"Scholar",affects:["knowledge"]},
  scientist:{label:"Scientist",affects:["science"]},
  traveler:{label:"Traveler",affects:["areaKnowledge"]},
  wellConnected:{label:"Well-Connected",affects:["contact","favor"]},
});

export function buildSkillEnhancer4e({key,name="",notes=""}){
  const definition=SKILL_ENHANCERS_4E[key];
  if(!definition)throw new Error("Unknown Fourth Edition Skill Enhancer: "+key);
  return {id:crypto.randomUUID(),tag:"CANONICAL",xmlId:key,name:name||definition.label,alias:definition.label,option:"",levels:0,baseCost:3,notes,mechanics:{key,label:definition.label,cost:3,discount:1,affects:definition.affects,isSkillEnhancer:true,pricingBasis:"Fourth Edition"},rawXml:""};
}

export function skillEnhancerDiscount4e(skill,enhancers=[]){
  const key=skill?.mechanics?.key||skill?.xmlId;
  return enhancers.some(enhancer=>enhancer.mechanics?.affects?.includes(key))?1:0;
}

export function buildFramework4e({kind,name="",points=20,advantages=0,limitations=0,notes=""}){
  points=Number(points);advantages=Math.max(0,Number(advantages)||0);limitations=Math.max(0,Number(limitations)||0);
  if(kind==="multipower"&&points<20)throw new Error("Fourth Edition Multipower reserve must be at least 20 points.");
  if(!["multipower","elementalControl","vpp"].includes(kind)||!Number.isFinite(points)||points<=0)throw new Error("Choose a valid framework and positive reserve.");
  const labels={multipower:"Multipower",elementalControl:"Elemental Control",vpp:"Variable Power Pool"};
  return {id:crypto.randomUUID(),tag:"CANONICAL",xmlId:kind,name:name||labels[kind],alias:labels[kind],option:"",levels:points,baseCost:points,notes,mechanics:{kind,label:labels[kind],points,advantages,limitations,isFramework:true,activeCost:points,realCost:points,end:0,unit:"reserve",pricingBasis:"Fourth Edition"},rawXml:""};
}

export function frameworkCost4e(framework,powers=[]){
  const m=framework.mechanics||{},points=Number(m.points||framework.levels||0),slots=powers.filter(power=>power.mechanics?.frameworkId===framework.id);
  if(m.kind==="vpp"){
    const controlActive=rounded(points/2*(1+Number(m.advantages||0))),controlReal=rounded(controlActive/(1+Number(m.limitations||0)));
    return {reserve:points,slots:[],total:points+controlReal,detail:`${points} Pool + ${controlReal} Control`};
  }
  const reserve=rounded(points/(1+Number(m.limitations||0)));
  const costs=slots.map(slot=>{
    const active=Number(slot.mechanics?.activeCost||0),slotLimitations=Number(slot.mechanics?.limitations||0);
    if(m.kind==="multipower")return rounded(rounded(active/(slot.mechanics?.slotKind==="fixed"?10:5))/(1+slotLimitations));
    if(active<points*2)return null;
    return rounded((active-points)/(1+Number(m.limitations||0)+slotLimitations));
  });
  const valid=costs.filter(Number.isFinite);
  return {reserve,slots:costs,total:reserve+valid.reduce((sum,cost)=>sum+cost,0),detail:`${points}-point ${m.kind==="multipower"?"reserve":"base"} + ${valid.reduce((sum,cost)=>sum+cost,0)} slot points`,invalid:costs.some(cost=>cost===null)};
}

export function frameworkSummary4e(framework,powers=[]){const cost=frameworkCost4e(framework,powers);return [cost.detail,cost.total+" points",cost.invalid?"slot below minimum":""].filter(Boolean).join(" · ");}
