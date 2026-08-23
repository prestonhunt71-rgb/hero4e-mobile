import {
  characteristicCost,
  totalCharacteristicCost,
  combatValue,
  figured,
  movementBases,
  movementKeys,
  normalizeCharacter,
  primaryKeys,
  figuredKeys,
} from "./rules.js";
import { attackPowerProfile4e } from "./dice.js";
import { createDiceTray4e } from "./dice-ui.js";
import { emailIssue4e, installDiagnostics4e, issueReport4e, logDiagnostic4e } from "./diagnostics.js";
import { importHdc, exportHdc as buildHdc } from "./hdc.js";
import {
  deleteCharacter,
  getCharacter,
  loadCharacters,
  replaceCharacters,
  saveCharacter,
} from "./store.js";
import { exportCharacterJson, importCharacterJson } from "./interchange.js";
import { exportFoundryActorJson } from "./foundry.js";
import {
  POWER_ADVANTAGES_4E,
  POWER_CATALOG_4E,
  POWER_LIMITATIONS_4E,
  buildPower4e,
  calculatePowerCost4e,
  resolvePowerModifier4e,
  powerSummary,
} from "./powers.js";
import {
  EQUIPMENT_TYPES_4E,
  buildEquipment4e,
  equipmentSummary,
} from "./equipment.js";
import {
  DISADVANTAGES_4E,
  buildDisadvantage4e,
  calculateDisadvantage4e,
  disadvantageOptions4e,
  disadvantageSummary,
} from "./disadvantages.js";
import {
  TALENTS_4E,
  PERKS_4E,
  abilitySummary,
  buildAbility4e,
  calculatePerk4e,
  calculateTalent4e,
} from "./abilities.js";
import {
  SKILLS_4E,
  buildSkill4e,
  calculateSkill4e,
  skillSummary,
} from "./skills.js";
import { preparePortrait } from "./images.js";
import { printCharacter, saveCharacterPdf } from "./print.js";
import {
  MARTIAL_MANEUVERS_4E,
  buildMartialManeuver4e,
  martialManeuverEffect4e,
  martialManeuverSummary4e,
} from "./martialarts.js";
import { entryDefinition4e, entryReference4e, entryRoll4e } from "./descriptions.js";
import {
  SKILL_ENHANCERS_4E,
  buildFramework4e,
  buildSkillEnhancer4e,
  frameworkCost4e,
  frameworkSummary4e,
  skillEnhancerDiscount4e,
} from "./frameworks.js";
import {
  ACTION_TIMING_4E,
  addPhaseAction,
  advanceSegment,
  applyDamage4e,
  clearPhaseActions,
  hasPhase,
  recoverResources,
  speedPhases,
  hitLocation4e,
  knockback4e,
  presenceAttack4e,
} from "./combat.js";
let current = null;
let currentSheetPage = "characteristics";
let currentWorkspace = "character";
let editMode = false, isDraft = false, editSnapshot = null;
let selectedEntry = null;
installDiagnostics4e();
const $ = (selector) => document.querySelector(selector);
function show(view) {
  document
    .querySelectorAll(".view")
    .forEach((node) => node.classList.toggle("active", node.id === view));
  document
    .querySelectorAll("[data-nav]")
    .forEach((node) =>
      node.classList.toggle("active", node.dataset.nav === view),
    );
  updatePlayAvailability();
  if(view === "library-view") setAppNav("character");
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
}
const workspacePageOrder = {
  character:["characteristics","skills","talents","perks","martialarts","powers","disadvantages","background","art","math"],
  play:["actions","characteristics","skills","talents","perks","martialarts","powers","disadvantages"],
};
const sheetPageLabels = {actions:"Actions",characteristics:"Characteristics",skills:"Skills",talents:"Talents",perks:"Perks",martialarts:"Martial Arts",powers:"Powers",disadvantages:"Disadvantages",background:"Background",art:"Character Art",math:"Balance Sheet"};
const addableSheetPages = {skills:"skills",talents:"talents",perks:"perks",martialarts:"martialarts",powers:"powers",disadvantages:"disadvantages"};
function setupSheetPages() {
  const groups = {
    actions: [$(".character-actions-panel")], play: [$(".play-speed-panel"), $(".combat-panel")],
    characteristics: [$("#movement")?.closest(".panel"), $(".characteristics-rolls-panel"), $(".characteristics-panel")],
    skills: [$("#skills-panel")], talents: [$("#talents-panel")], perks: [$("#perks-panel")], martialarts: [$("#martial-panel")], powers: [$("#powers-panel")], disadvantages: [$("#disadvantages-panel")],
    background: [$("#profile-panel")], art: [$("#art-page-panel")], math: [$("#math-panel")],
  };
  for (const [page, nodes] of Object.entries(groups)) for (const node of nodes.filter(Boolean)) { node.classList.add("sheet-section-page"); node.dataset.sheetPage = page; }
}
function setSheetMenu(open){$("#sheet-jump")?.classList.toggle("menu-open",open);$("#sheet-page-menu").classList.toggle("open",open);$("#sheet-menu-button").setAttribute("aria-expanded",String(open));}
function showSheetPage(page) {
  const order=workspacePageOrder[currentWorkspace]||workspacePageOrder.character;
  if(page!=="manage"&&!order.includes(page))page=order[0];
  if(page==="manage"&&currentWorkspace!=="character")page=order[0];
  const pageChanged=currentSheetPage!==page;
  currentSheetPage = page;
  document.body.dataset.sheetPage=page;
  if(currentWorkspace==="character"&&page!=="manage")lastCharacterPage=page;
  document.body.dataset.workspace=currentWorkspace;
  setAppNav(currentWorkspace);
  document.querySelectorAll("[data-sheet-page]").forEach(node => node.classList.toggle("sheet-page-active", node.dataset.sheetPage === (page==="actions"?"play":page)));
  document.querySelectorAll("#sheet-page-menu [data-page]").forEach(button => {
    const permitted=button.dataset.workspace.split(" ").includes(currentWorkspace);
    const section=addableSheetPages[button.dataset.page],empty=section&&!(current?.sections?.[section]||[]).length;
    button.hidden=!permitted||(currentWorkspace==="character"&&!editMode&&empty);
    button.classList.toggle("active", permitted&&button.dataset.page===page);
  });
  $("#sheet-page-title").textContent=sheetPageLabels[page];setSheetMenu(false);
  if(pageChanged)requestAnimationFrame(()=>$("#sheet-view")?.scrollTo({top:0,behavior:"auto"}));
  updateSheetAddButton();
  const sheetView=$("#sheet-view"); if(sheetView) sheetView.scrollTop=0;
  renderWorkspaceState();
}
function setAppNav(mode){document.querySelectorAll("[data-app-mode]").forEach(button=>button.classList.toggle("active",button.dataset.appMode===mode));}
let lastCharacterPage="characteristics";
function renderWorkspaceState(){
  document.body.dataset.workspace=currentWorkspace;
  const character=currentWorkspace==="character",play=currentWorkspace==="play";
  $("#header-options").hidden=!character;
  $("#header-point-summary").hidden=!character;
  $("#header-cancel-edit").hidden=!(character&&editMode);
  $("#header-conditions").hidden=!play;
  $(".floating-dice").hidden=!play;
  document.querySelectorAll(".header-cv-stack [data-combat-roll]").forEach(button=>button.disabled=!play);
  document.querySelectorAll(".header-cv-stack [data-combat-roll]").forEach(button=>button.classList.toggle("static-value",!play));
  $("#sheet-menu-button").setAttribute("aria-label",`Open ${currentWorkspace} page menu`);
  if(current)refreshResources();
  $("#edit-entry-detail").hidden=!(character&&editMode);
  updateSheetAddButton();
  updatePlayAvailability();
}
function updateSheetAddButton(){
  const button=$("#sheet-add-button"),section=addableSheetPages[currentSheetPage];
  if(!button)return;
  button.hidden=!(editMode&&currentWorkspace==="character"&&section);
  button.dataset.addEntry=section||"";
  button.setAttribute("aria-label",section?`Add ${sheetPageLabels[currentSheetPage]} item`:"Add item");
}
function openAppMode(mode){
  if(mode==="character"){
    currentWorkspace="character";if(current){show("sheet-view");showSheetPage(lastCharacterPage);renderSheet();}else{show("library-view");setAppNav("character");document.body.dataset.workspace="character";}
  }else if(mode==="play"){
    if(!updatePlayAvailability())return toast($("[data-app-mode='play']").title);
    if(!current)return toast("Choose a character first");
    if(editMode)return toast("Save the character before entering Play");
    currentWorkspace="play";show("sheet-view");showSheetPage("actions");renderSheet();
  }else if(mode==="more"){
    if(editMode)return toast("Save the character before leaving Character");
    currentWorkspace="more";show("more-view");setAppNav("more");document.body.dataset.workspace="more";
    for(const id of ["export-json","export-foundry","export-hdc","save-pdf","print-character","delete-character"])$("#"+id).disabled=!current;
  }else toast("Campaign management is coming next");
}
function setupSheetGestures(){let startX=0,startY=0;const view=$("#sheet-view");view.addEventListener("touchstart",event=>{if(event.touches.length===1){startX=event.touches[0].clientX;startY=event.touches[0].clientY;}},{passive:true});view.addEventListener("touchend",event=>{if(!startX||!event.changedTouches.length)return;const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;startX=0;if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.25||event.target.closest("input,textarea,select,button,dialog"))return;const order=workspacePageOrder[currentWorkspace]||[];const index=order.indexOf(currentSheetPage);if(index<0)return;const next=dx<0?Math.min(order.length-1,index+1):Math.max(0,index-1);if(next!==index)showSheetPage(order[next]);},{passive:true});}
function setupIdentityOptions(){
  const identity=$("#identity-form"),identityDialog=$("#identity-dialog"),profile=$("#profile-form"),profileDialog=$("#profile-dialog");
  $("#art-edit-controls").append(identity.querySelector(".portrait-editor"));
  const nameLabel=$("#identity-name").closest("label"),playerLabel=$("#identity-player").closest("label");
  profile.prepend(nameLabel,playerLabel);
  profile.classList.add("background-edit-form");$("#profile-panel").append(profile);
  $("#math-panel").append(profile.querySelector(".point-edit"));
  identityDialog?.remove();profileDialog?.remove();
  profile.querySelector(".dialog-actions")?.remove();
  $("#math-panel .dialog-actions")?.remove();
  $(".identity-heading").append($("#edit-mode-banner"));
}
function setupPowerModifierDialog(){
  const editor=$("#power-advantage-key").closest(".modifier-builder"),dialog=document.createElement("dialog");
  dialog.id="power-modifier-dialog";dialog.className="entry-dialog";dialog.setAttribute("aria-label","Power modifier");
  dialog.innerHTML='<form method="dialog"><h3 id="modifier-editor-title">Add Modifier</h3><div id="modifier-editor-fields"></div><div class="dialog-actions"><button id="cancel-power-modifier" type="button" class="quiet">Cancel</button><button id="apply-power-modifier" type="button" class="primary">Apply</button></div></form>';
  document.body.append(dialog);$("#modifier-editor-fields").append(editor);
}
function setEditMode(value){
  editMode=Boolean(value); document.body.classList.toggle("edit-mode",editMode);
  $("#edit-mode-banner").hidden=!editMode;
  $("#header-options b").textContent=editMode?"Save":"Edit";
  $("#header-options").setAttribute("aria-label",editMode?"Save character":"Edit character");
  $("#add-xp").hidden=!editMode;
  $("#dice-overlay-button").disabled=editMode; $(".combat-panel").inert=editMode;

  document.querySelectorAll("#identity-form input, #identity-form textarea, #identity-form button, #profile-form input, #profile-form textarea, #art-edit-controls input, #art-edit-controls button, .point-edit input, .point-edit button").forEach(node=>node.disabled=!editMode);
  document.querySelectorAll("[data-current]").forEach(node=>node.disabled=editMode);
  document.querySelectorAll("[data-sheet-roll], .entry-roll").forEach(node=>node.disabled=editMode);
  $("#profile-button").hidden=true; $("#edit-entry-detail").hidden=!(editMode&&currentWorkspace==="character");renderWorkspaceState();
}
function characterBalance(character){
  const points=character?.points||{},sections=character?.sections||{};
  const earnedDisadvantages=(sections.disadvantages||[]).reduce((sum,entry)=>sum+(Number(entry.mechanics?.cost)||0),0);
  const allowance=Number(points.disadvantages||0),creditedDisadvantages=Math.min(earnedDisadvantages,allowance||earnedDisadvantages);
  const available=Number(points.base||0)+creditedDisadvantages+Number(points.experience||0);
  const enhancers=(sections.talents||[]).filter(entry=>entry.mechanics?.isSkillEnhancer);
  const powers=(sections.powers||[]).reduce((sum,entry)=>sum+(Number(entry.mechanics?.realCost)||0),0);
  const skills=(sections.skills||[]).reduce((sum,entry)=>sum+Math.max(0,(Number(entry.mechanics?.cost)||0)-skillEnhancerDiscount4e(entry,enhancers)),0);
  const abilities=[...(sections.talents||[]),...(sections.perks||[])].reduce((sum,entry)=>sum+(Number(entry.mechanics?.cost)||0),0);
  const martial=(sections.martialarts||[]).reduce((sum,entry)=>sum+(Number(entry.mechanics?.characterPoints??entry.baseCost)||0),0);
  const characteristics=totalCharacteristicCost(character.characteristics),spent=characteristics+powers+skills+abilities+martial;
  return {earnedDisadvantages,creditedDisadvantages,available,characteristics,powers,skills,abilities,martial,spent,remaining:available-spent};
}
function characterIsComplete(character){
  const c=character?.characteristics||{};
  return ["STR","DEX","CON","BODY","INT","EGO","PRE","COM","PD","ED","SPD","REC","END","STUN","RUNNING","SWIMMING","LEAPING"].every(key=>Number.isFinite(Number(c[key])))
    && Number(c.SPD)>0&&Number(c.BODY)>0&&Number(c.STUN)>0&&Number(c.END)>0;
}
function updatePlayAvailability(){
  const button=$("[data-app-mode='play']"),balance=current?characterBalance(current):null;
  const complete=characterIsComplete(current),eligible=Boolean(current&&!isDraft&&!editMode&&complete&&balance?.available>0&&balance.remaining>=0);
  button.disabled=!eligible;
  button.setAttribute("aria-disabled",String(!eligible));
  button.title=eligible?"Open Play":!current?"Choose a character first":editMode||isDraft?"Save and lock the character first":!complete?"Complete the character before entering Play":balance?.available<=0?"Set the character's point allowance":"The character is overspent";
  return eligible;
}
function beginEdit(){ if(!current||editMode||currentWorkspace!=="character")return; editSnapshot=structuredClone(current); setEditMode(true); renderSheet(); showSheetPage(currentSheetPage); }
function cancelEdit(){if(!editMode)return;current=isDraft?null:normalizeCharacter(editSnapshot);isDraft=false;editSnapshot=null;setEditMode(false);if(!current){renderLibrary();show("library-view");return;}renderSheet();showSheetPage(currentSheetPage);toast("Changes discarded");}
function saveAndLockCharacter(){
  if(!current||!editMode)return;
  current.name=$("#identity-name").value.trim()||current.name;
  current.playerName=$("#identity-player").value.trim();
  current.updatedAt=new Date().toISOString();
  saveCharacter(current);isDraft=false;editSnapshot=null;setEditMode(false);
  currentWorkspace="character";currentSheetPage="characteristics";renderSheet();showSheetPage("characteristics");renderLibrary();toast("Character saved and locked");
}
function characterPointTotal(character){ const p=character.points||{},earned=(character.sections?.disadvantages||[]).reduce((sum,item)=>sum+(Number(item.mechanics?.cost)||0),0); return Number(p.base||0)+Math.min(earned,Number(p.disadvantages||0)||earned)+Number(p.experience||0); }
function renderLibrary() {
  const query = $("#character-search")?.value.trim().toLowerCase() || "",
    stored = loadCharacters(),
    all = stored.filter(
      (c) =>
        !query ||
        [
          c.name,
          c.playerName,
          c.profile?.alternateIdentities,
          c.profile?.campaignName,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        ),
    );
  $("#character-list").innerHTML = all.length
    ? all
        .map(
          (c) =>
            `<button class="character-card" data-id="${c.id}"><span class="avatar" ${c.portrait?.dataUrl ? 'data-view-art="true" title="View full-size character art" aria-label="View full-size character art"' : ""}>${c.portrait?.dataUrl ? `<img src="${c.portrait.dataUrl}" alt="" />` : escapeHtml((c.name||"H").slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.profile?.alternateIdentities||"No secret identity")}</small><small>${escapeHtml(c.profile?.campaignName||"No campaign")} · ${characterPointTotal(c)} points</small></span><span class="chevron">›</span></button>`,
        )
        .join("")
    : `<div class="empty"><strong>${stored.length ? "No matching heroes" : "No characters yet"}</strong><p>${stored.length ? "Try a different name or identity." : "Your roster is stored locally on this device."}</p></div>`;
  document
    .querySelectorAll("[data-id]")
    .forEach((node) =>
      node.addEventListener("click", (event) => event.target.closest("[data-view-art]") ? openArt(loadCharacters().find(c => c.id === node.dataset.id)) : openCharacter(node.dataset.id)),
    );
}
function inputStat(key, value) {
  if (!editMode) return currentWorkspace==="play"&&primaryKeys.includes(key) ? `<button type="button" class="stat read rollable-stat base-stat-roll" data-base-stat="${key}"><span>${key}</span><strong>${value}</strong></button>` : `<div class="stat read"><span>${key}</span><strong>${value}</strong></div>`;
  return `<button type="button" class="stat characteristic-edit" data-edit-stat="${key}"><span>${key}</span><strong>${value}</strong></button>`;
}
function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}
function markHdcDirty() {
  if (current?.preservedHdc) current.hdcDirty = true;
}
function sectionLabels() {
  return {
    skills: "Skills",
    perks: "Perks",
    talents: "Talents",
    martialarts: "Martial Arts",
    powers: "Powers",
    disadvantages: "Disadvantages",
    equipment: "Equipment",
  };
}
function syncFrameworkCosts(character = current) {
  const builderPoints=Number(character?.points?.base||0)+Number(character?.points?.disadvantages||0)+Number(character?.points?.experience||0);
  for(const entry of character?.sections?.perks||[]){const key=entry.mechanics?.key;if(key==="follower"||key==="vehicleOrBase"){entry.mechanics=calculatePerk4e(key,entry.levels,{...(entry.mechanics.options||{}),builderPoints});entry.baseCost=entry.mechanics.cost;}}
  const powers = character?.sections?.powers || [];
  for (const framework of powers.filter((entry) => entry.mechanics?.isFramework)) {
    const result = frameworkCost4e(framework, powers);
    framework.mechanics.realCost = framework.mechanics.kind === "vpp" ? result.total : result.reserve;
    const slots = powers.filter((power) => power.mechanics?.frameworkId === framework.id);
    slots.forEach((slot, index) => {
      slot.mechanics.realCost = Number(result.slots[index] || 0);
      slot.mechanics.frameworkName = framework.name;
    });
  }
}
function entryMechanicsSummary(section, entry) {
  if (entry.mechanics?.isFramework) return frameworkSummary4e(entry, current.sections?.powers || []);
  if (entry.mechanics?.isSkillEnhancer) return `Skill Enhancer · ${entry.mechanics.cost} points · -1 to affected skill costs`;
  if (section === "powers") return powerSummary(entry);
  if (section === "skills") return skillSummary(entry);
  if (section === "talents" || section === "perks") return abilitySummary(entry);
  if (section === "disadvantages") return disadvantageSummary(entry);
  if (section === "equipment") return equipmentSummary(entry);
  if (section === "martialarts") return martialManeuverSummary4e(entry);
  return "";
}
function entryPointCost(section, entry) {
  if (entry.mechanics?.isFramework) {
    const result = frameworkCost4e(entry, current.sections?.powers || []);
    return result.total;
  }
  if (section === "powers") return Number(entry.mechanics?.realCost ?? entry.baseCost ?? 0);
  if (section === "skills") {
    const enhancers=(current.sections?.talents||[]).filter(item=>item.mechanics?.isSkillEnhancer);
    return Math.max(0,Number(entry.mechanics?.cost??entry.baseCost??0)-skillEnhancerDiscount4e(entry,enhancers));
  }
  if (section === "equipment") return entry.mechanics?.characterCost == null ? "Campaign" : Number(entry.mechanics.characterCost);
  if (section === "martialarts") return Number(entry.mechanics?.characterPoints ?? entry.baseCost ?? 0);
  return Number(entry.mechanics?.cost ?? entry.baseCost ?? 0);
}
function renderEntries() {
  syncFrameworkCosts();
  const labels = sectionLabels();
  const groups = Object.entries(current.sections || {}).filter(
    ([, entries]) => entries.length,
  );
  const total = groups.reduce((sum, [, entries]) => sum + entries.length, 0);
  $("#ability-count").textContent = total
    ? `${total} ${current.preservedHdc ? "imported " : ""}items`
    : "No Skills, Perks, Talents, Martial Arts, Powers, Disadvantages, or Equipment yet";
  const groupMarkup = selected => { const visible=groups.filter(([key])=>selected.includes(key)); return visible.map(([key, entries]) =>
    `<section class="entry-group">${visible.length>1?`<h4>${labels[key] || key} <span>${entries.length}</span></h4>`:""}<div class="entry-list">${entries.map((entry) => `<button class="entry" data-entry-section="${key}" data-entry-id="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.name || entry.alias || "Unnamed " + (labels[key] || "item"))}</strong><small>${escapeHtml([entry.alias !== entry.name ? entry.alias : "", entry.option, entry.mechanics ? entryMechanicsSummary(key, entry) : ""].filter(Boolean).join(" · "))}</small></button>`).join("")}</div></section>`).join(""); };
  $("#skills-sections").innerHTML=groupMarkup(["skills"]);
  $("#martial-sections").innerHTML=groupMarkup(["martialarts"]);
  $("#talents-sections").innerHTML=groupMarkup(["talents"]);
  $("#perks-sections").innerHTML=groupMarkup(["perks"]);
  $("#powers-sections").innerHTML=groupMarkup(["powers","framework","equipment"]);
  $("#disadvantages-sections").innerHTML=groupMarkup(["disadvantages"]);
  document.querySelectorAll("[data-entry-id]").forEach((node) => {
    node.addEventListener("click", () => openEntryDetails(node.dataset.entrySection, node.dataset.entryId));
    const section=node.dataset.entrySection,entry=findEntry(section,node.dataset.entryId),target=entry?.mechanics?.roll,actions=[];
    if(Number.isFinite(target))actions.push({label:`Roll ${target}−`,aria:`Roll ${entry.name||entry.alias||"ability"}, target ${target} or less`,run:()=>rollAgainstTarget(target,entry.name||entry.alias||"Ability")});
    const recoveryTarget=entry?.mechanics?.recoveryRoll;
    if(Number.isFinite(recoveryTarget))actions.push({label:`Recovery ${recoveryTarget}−`,aria:`Roll ${entry.name||entry.alias||"ability"} recovery, target ${recoveryTarget} or less`,run:()=>rollAgainstTarget(recoveryTarget,`${entry.name||entry.alias||"Ability"} Recovery`)});
    const powerProfile=section==="powers"?attackPowerProfile4e(entry?.mechanics?.key):{attack:false};
    if(powerProfile.attack){
      actions.push({label:"Attack Roll",aria:`Roll ${entry.name||"Power"} attack`,run:()=>rollPowerAttack(entry)});
      if(powerProfile.damageMode)actions.push({label:"Damage",aria:`Roll ${entry.name||"Power"} damage`,run:()=>rollPowerDamage(entry)});
    }
    if(actions.length && !editMode && currentWorkspace==="play"){
      const host=document.createElement("div");host.className="entry-actions";
      for(const action of actions){const button=document.createElement("button");button.type="button";button.className="entry-roll";button.textContent=action.label;button.setAttribute("aria-label",action.aria);button.addEventListener("click",action.run);host.append(button);}
      node.insertAdjacentElement("afterend",host);
    }
  });
  $("#export-hdc").hidden = false;
  updateSheetAddButton();
}
function renderProfile() {
  syncFrameworkCosts();
  const p = current.profile || {};
  const profileKeys=["alternateIdentities","campaignName","background","personality","quote","tactics","campaignUse","appearance"];
  for(const key of profileKeys){const field=$("#profile-"+key);if(field&&document.activeElement!==field)field.value=p[key]||"";}
  if(document.activeElement!==$("#identity-name"))$("#identity-name").value=current.name||"";
  if(document.activeElement!==$("#identity-player"))$("#identity-player").value=current.playerName||"";
  const rows = [
    ["Alternate Identity", p.alternateIdentities],
    ["Campaign", p.campaignName],
    ["Background/History", p.background],
    ["Personality/Motivation", p.personality],
    ["Quote", p.quote],
    ["Powers/Tactics", p.tactics],
    ["Campaign Use", p.campaignUse],
    ["Appearance", p.appearance],
  ].filter(([, value]) => value);
  $("#profile-summary").innerHTML = rows.length
    ? rows
        .map(
          ([label, value]) =>
            `<div><strong>${label}</strong><p>${escapeHtml(value)}</p></div>`,
        )
        .join("")
    : `<p class="muted">No profile details yet.</p>`;
  const points=current.points||{},math=characterBalance(current),{earnedDisadvantages,available,skills:knownSkills,abilities:knownAbilities,martial:knownMartial,powers:knownPowers,spent:knownSpent,remaining:balance}=math;
  for(const [id,key] of [["points-base","base"],["points-disadvantages","disadvantages"]]){const field=$("#"+id);if(field&&document.activeElement!==field)field.value=Number(points[key]||0);}
  $("#point-summary").textContent = available + " Character Points available";
  $("#profile-button").hidden = true;
  $("#point-grid").innerHTML = [
    ["Base Points", points.base],
    ["Disadvantages", earnedDisadvantages],
    ["XP", points.experience],
    ["Available", available],
    ["Character Points spent", knownSpent],
    ["Character Points remaining", balance],
  ]
    .map(
      ([label, value]) =>
        `<div><span>${label}</span><strong>${Number(value || 0)}</strong></div>`,
    )
    .join("");
  $("#math-summary").innerHTML=[["Characteristics & Movement",totalCharacteristicCost(current.characteristics)],["Skills",knownSkills],["Talents & Perks",knownAbilities],["Martial Arts",knownMartial],["Powers",knownPowers],["Total Spent",knownSpent],["Available",available],["Remaining",balance]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("#header-xp").textContent=Number(points.experience||0);
  $("#header-spent").textContent=Math.max(0,knownSpent-(Number(points.base||0)+Number(math.creditedDisadvantages||0)));

}
function characterDefenses() {
  let rPD = 0,
    rED = 0;
  for (const item of current.sections?.equipment || []) {
    if (item.mechanics?.kind === "armor") {
      rPD += Number(item.mechanics.pd || 0);
      rED += Number(item.mechanics.ed || 0);
    }
  }
  for (const power of current.sections?.powers || []) {
    if (power.mechanics?.key !== "armor") continue;
    const match = String(power.mechanics.effect || "").match(
      /(\d+) PD \/ (\d+) ED/i,
    );
    if (match) {
      rPD += Number(match[1]);
      rED += Number(match[2]);
    }
  }
  return {
    physical: {
      total: Number(current.characteristics.PD || 0) + rPD,
      resistant: rPD,
    },
    energy: {
      total: Number(current.characteristics.ED || 0) + rED,
      resistant: rED,
    },
  };
}
function renderDefenseValues() {
  const defenses = characterDefenses(), powers = current.sections?.powers || [];
  const amount = key => powers.filter(power => power.mechanics?.key === key).reduce((sum, power) => sum + Number(power.mechanics?.levels || 0), 0);
  const rows = [
    ["Physical Defense", defenses.physical.total, defenses.physical.resistant],
    ["Energy Defense", defenses.energy.total, defenses.energy.resistant],
  ];
  const mental = amount("mentalDefense"), flash = amount("flashDefense"), power = amount("powerDefense");
  if (mental) rows.push(["Mental Defense", mental, null]);
  if (flash) rows.push(["Flash Defense", flash, null]);
  if (power) rows.push(["Power Defense", power, null]);
  for (const entry of powers.filter(item => item.mechanics?.key === "damageReduction")) {
    const resistant = entry.mechanics?.options?.resistant ? " · Resistant" : "";
    rows.push(["Damage Reduction", `${entry.mechanics.levels}%${resistant}`, null]);
  }
  $("#defense-values").innerHTML = rows.map(([label,total,resistant]) => `<div class="defense-card"><span>${label}</span><strong>${total}</strong>${resistant == null ? "" : `<small>${resistant} Resistant</small>`}</div>`).join("");
}
function renderDamageDefenses() {
  const kind = $("#damage-defense-kind").value || "physical",
    defenses = characterDefenses()[kind];
  $("#damage-defense").value = defenses.total;
  $("#damage-resistant").value = defenses.resistant;
  const status = current.combat.statuses || {};
  $("#damage-status").textContent =
    [
      status.stunned ? "STUNNED" : "",
      status.unconscious ? "UNCONSCIOUS" : "",
      status.dead ? "DEAD" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Ready";
}
function renderCombat() {
  const { segment, turn } = current.combat,
    spd = current.characteristics.SPD,
    phases = speedPhases(spd),
    phase = current.combat.phase || clearPhaseActions();
  current.combat.phase = phase;
  renderDamageDefenses();
  $("#combat-status").textContent =
    `Turn ${turn} · Segment ${segment} · ${hasPhase(spd, segment) ? "Your Phase" : "No Phase"}`;
  const speedMarkup = Array.from({ length: 12 }, (_, i) => i + 1).map((value) => `<button data-segment="${value}" class="${value === segment ? "current " : ""}${phases.includes(value) ? "phase" : ""}" aria-label="Segment ${value}${phases.includes(value) ? ", Phase" : ""}"><span>${value}</span>${phases.includes(value) ? "<small>Phase</small>" : ""}</button>`).join("");
  $("#speed-chart").innerHTML = speedMarkup; $("#play-speed-chart").innerHTML = speedMarkup; $("#play-combat-status").textContent = `SPD ${spd} · Phases ${phases.join(", ")}`; $("#header-phases strong").textContent=phases.join(", ");
  const labels = phase.log.map((id) => ACTION_TIMING_4E[id]?.label || id),lastAction=ACTION_TIMING_4E[phase.log.at(-1)],maneuverDetails=lastAction?.effect?[`OCV ${lastAction.ocv}`,`DCV ${lastAction.dcv}`,lastAction.effect].join(" · "):"";
  $("#phase-status").textContent = (phase.held
    ? "Held Action saved"
    : phase.ended
      ? `Phase complete${labels.length ? ` · ${labels.join(" + ")}` : ""}`
      : `${1 - Number(phase.used || 0)} Phase remaining${labels.length ? ` · ${labels.join(" + ")}` : ""}`)+(maneuverDetails?` · ${maneuverDetails}`:"");
  $("#phase-meter-fill").style.width =
    `${Math.min(100, Number(phase.used || 0) * 100)}%`;
  $("#damage-defense-kind").addEventListener("change", renderDamageDefenses);
  $("#apply-damage").addEventListener("click", () => {
    const result = applyDamage4e(
      current.current,
      {
        type: $("#damage-type").value,
        stun: Number($("#damage-stun").value || 0),
        body: Number($("#damage-body").value || 0),
      },
      {
        defense: Number($("#damage-defense").value || 0),
        resistantDefense: Number($("#damage-resistant").value || 0),
      },
      current.characteristics.CON,
    );
    current.current = result.current;
    current.combat.statuses = result.statuses;
    saveCharacter(current);
    refreshResources();
    renderCombat();
    toast(
      "Took " + result.taken.stun + " STUN and " + result.taken.body + " BODY",
    );
  });
  document
    .querySelectorAll("[data-action]")
    .forEach(
      (node) => (node.disabled = phase.ended || !hasPhase(spd, segment)),
    );
  document.querySelectorAll("[data-segment]").forEach((node) =>
    node.addEventListener("click", () => {
      current.combat.segment = Number(node.dataset.segment);
      current.combat.phase = clearPhaseActions();
      saveCharacter(current);
      renderCombat();
    }),
  );
}
function refreshResources() {
  document.querySelectorAll("[data-current]").forEach((node) => { node.value = current.current[node.dataset.current]; });
  if(!current)return;
  const host=$("#header-resources"),keys=["STUN","BODY","END"];
  if(currentWorkspace==="play"){
    host.innerHTML=keys.map(key=>`<label><b>${key}</b><input inputmode="text" enterkeyhint="done" data-current="${key}" value="${current.current[key]}"><small>/${current.characteristics[key]}</small></label>`).join("");
    host.querySelectorAll("[data-current]").forEach(node=>{node.addEventListener("focus",()=>node.select());node.addEventListener("keydown",event=>{if(event.key==="Enter")node.blur();});node.addEventListener("change",()=>applyResourceEntry(node));});
  }else{
    host.innerHTML=keys.map(key=>`<div class="header-resource-maximum"><b>${key}</b><strong>${current.characteristics[key]}</strong><small>Maximum</small></div>`).join("");
  }
}
function renderPortraits() {
  const markup = current.portrait?.dataUrl
    ? `<img src="${current.portrait.dataUrl}" alt="${escapeHtml(current.name)} portrait" />`
    : `<span>${escapeHtml(current.name.slice(0, 1).toUpperCase())}</span>`;
  $("#sheet-portrait").innerHTML = markup;
  $("#page-art-image").hidden=!current.portrait?.dataUrl; $("#page-art-empty").hidden=Boolean(current.portrait?.dataUrl);
  if(current.portrait?.dataUrl){$("#page-art-image").src=current.portrait.dataUrl;$("#page-art-image").alt=`${current.name||"Character"} full-size art`;}
  $("#remove-portrait").hidden = !current.portrait;
}
let artZoom = 1;
function updateArtZoom(){ $("#art-image").style.transform = `scale(${artZoom})`; $("#art-zoom-reset").textContent = `${Math.round(artZoom*100)}%`; }
function openArt(character=current){ if(!character?.portrait?.dataUrl) return toast("Add character art first"); artZoom=1; $("#art-title").textContent=`${character.name||"Character"} art`; $("#art-image").src=character.portrait.dataUrl; $("#art-image").alt=`${character.name||"Character"} full-size art`; updateArtZoom(); $("#art-dialog").showModal(); }
function renderSheet() {
  if (!current) return;
  $("#character-name").textContent = current.name;
  renderPortraits();
  $("#player-name").textContent = current.playerName ? `Played By: ${current.playerName}` : "";
  $("#identity-name").value=current.name; $("#identity-player").value=current.playerName||"";
  $("#characteristics").innerHTML = [...primaryKeys, ...figuredKeys]
    .map((key) => inputStat(key, current.characteristics[key]))
    .join("");
  $("#movement").innerHTML = movementKeys
    .map((key) => inputStat(key, current.characteristics[key]))
    .join("");
  $("#resources").innerHTML = ["BODY", "STUN", "END"]
    .map(
      (key) =>
        `<label><span>${key}</span><input inputmode="text" enterkeyhint="done" data-current="${key}" value="${current.current[key]}" ${editMode ? "disabled" : ""} /><small>/ ${current.characteristics[key]}</small></label>`,
    )
    .join("");
  refreshResources();
  renderDerived();
  renderEntries();
  renderProfile();
  renderCombat();
  showSheetPage(currentSheetPage);

  document.querySelectorAll("[data-edit-stat]").forEach(node=>node.addEventListener("click",()=>openCharacteristicEditor(node.dataset.editStat)));
  document.querySelectorAll("#resources [data-current]").forEach((node) => { node.addEventListener("focus",()=>node.select()); node.addEventListener("keydown",event=>{if(event.key==="Enter")node.blur();}); node.addEventListener("change",()=>applyResourceEntry(node)); });
  document.querySelectorAll("[data-base-stat]").forEach(node=>node.addEventListener("click",()=>rollAgainstTarget(characteristicRollTarget(current.characteristics[node.dataset.baseStat]),node.dataset.baseStat)));
  setEditMode(editMode);
}
function characteristicRollTarget(value){ return 9 + Math.floor(Number(value || 0) / 5 + 0.5); }
function applyResourceEntry(node){
  const text=String(node.value).trim(),key=node.dataset.current,previous=Number(current.current[key]||0);
  if(currentWorkspace!=="play"||editMode)return;
  if(!/^[+-]?\d+$/.test(text)){node.value=previous;return toast("Enter a whole number, +number, or -number");}
  current.current[key]=/^[+-]/.test(text)?previous+Number(text):Number(text);
  saveCharacter(current);logDiagnostic4e(`${key} changed from ${previous} to ${current.current[key]}`);refreshResources();renderCombat();
}
function renderDerived() {
  const c = current.characteristics;
  $("#characteristic-cost").textContent =
    `${totalCharacteristicCost(c)} characteristic & movement points`;
  const statCards = (rows,rolls=false) => rows.map(([k, v]) => rolls ? `<button type="button" class="stat read rollable-stat" data-sheet-roll="${String(v).replace("-","")}" data-roll-label="${k}"><span>${k}</span><strong>${v}</strong></button>` : `<div class="stat read"><span>${k}</span><strong>${v}</strong></div>`).join("");
  const headerDefenses=characterDefenses(), mentalDefense=(current.sections?.powers||[]).filter(power=>power.mechanics?.key==="mentalDefense").reduce((sum,power)=>sum+Number(power.mechanics?.levels||0),0);
  $("#header-spd").textContent=Number(c.SPD||0); $("#header-dex").textContent=Number(c.DEX||0); $("#header-move").textContent=Number(c.RUNNING||6);
  const headerCombat=[["#header-ocv",combatValue(c.DEX)],["#header-dcv",combatValue(c.DEX)],["#header-ecv",combatValue(c.EGO)]]; for(const [selector,value] of headerCombat){const output=$(selector);output.textContent=value;output.closest("[data-combat-roll]").dataset.combatRoll=value;}
  $("#header-pd strong").textContent=`${headerDefenses.physical.total} / ${headerDefenses.physical.resistant}`; $("#header-ed strong").textContent=`${headerDefenses.energy.total} / ${headerDefenses.energy.resistant}`; $("#header-ego-defense strong").textContent=mentalDefense;
  $("#combat-values").innerHTML = [["OCV",combatValue(c.DEX),"DCV"],["DCV",combatValue(c.DEX),"OCV"],["ECV",combatValue(c.EGO),"ECV"]].map(([label,value,defense])=>`<button type="button" class="stat read rollable-stat" data-combat-roll="${value}" data-roll-label="${label}" data-defense-label="${defense}"><span>${label}</span><strong>${value}</strong></button>`).join("");
  const roll = value => `${characteristicRollTarget(value)}-`;
  $("#characteristic-rolls").innerHTML = statCards([
    ["STR", roll(c.STR)], ["DEX", roll(c.DEX)], ["INT", roll(c.INT)],
    ["EGO", roll(c.EGO)], ["PRE", roll(c.PRE)], ["PER", roll(c.INT)],
  ],true);
  renderDefenseValues();
  if(currentWorkspace==="play")document.querySelectorAll("[data-sheet-roll]").forEach(node=>node.addEventListener("click",()=>rollAgainstTarget(Number(node.dataset.sheetRoll),node.dataset.rollLabel)));
  if(currentWorkspace==="play")document.querySelectorAll("[data-combat-roll]").forEach(node=>node.addEventListener("click",()=>queueCombatValue(Number(node.dataset.combatRoll),node.dataset.rollLabel,node.dataset.defenseLabel)));
}
function updateStat(event) { applyCharacteristicValue(event.target.dataset.stat, event.target.value); }
function applyCharacteristicValue(key,value) {
  markHdcDirty();
  const previous = Number(current.characteristics[key]);
  const oldBases = figured(current.characteristics);
  const oldMovement = movementBases(current.characteristics);
  current.characteristics[key] = Number(value);
  if (primaryKeys.includes(key)) {
    const newBases = figured(current.characteristics);
    for (const figuredKey of figuredKeys) {
      current.characteristics[figuredKey] +=
        newBases[figuredKey] - oldBases[figuredKey];
      const input = document.querySelector(`[data-stat="${figuredKey}"]`);
      if (input) input.value = current.characteristics[figuredKey];
    }
    const newMovement = movementBases(current.characteristics);
    current.characteristics.LEAPING +=
      newMovement.LEAPING - oldMovement.LEAPING;
    const leap = document.querySelector(`[data-stat="LEAPING"]`);
    if (leap) leap.value = current.characteristics.LEAPING;
  }
  if (!Number.isFinite(current.characteristics[key]))
    current.characteristics[key] = previous;
  renderDerived();
}
let characteristicEditKey="";
function openCharacteristicEditor(key){
  if(!editMode||currentWorkspace!=="character")return;
  characteristicEditKey=key;const starting=Number(current.characteristics[key]||0);
  $("#characteristic-dialog-title").textContent=`Edit ${key}`;$("#characteristic-starting-value").textContent=starting;$("#characteristic-value").value=starting;
  $("#characteristic-dialog").showModal();requestAnimationFrame(()=>$("#characteristic-value").select());
}
function stepCharacteristic(delta){const field=$("#characteristic-value");field.value=String(Number(field.value||0)+delta);field.select();}
function openCharacter(id) { currentWorkspace="character";currentSheetPage="characteristics"; current=normalizeCharacter(getCharacter(id)); isDraft=false; editSnapshot=null; setEditMode(false); renderSheet(); show("sheet-view");showSheetPage("characteristics");requestAnimationFrame(()=>$("#sheet-view")?.scrollTo({top:0,behavior:"auto"})); }
function createCharacter() { currentWorkspace="character";currentSheetPage="background"; current=normalizeCharacter({name:"New Hero"}); isDraft=true; editSnapshot=null; setEditMode(true); renderSheet(); show("sheet-view"); showSheetPage("background"); toast("New character is not saved yet"); }
function backupRoster() {
  const data = {
    format: "hero4e-mobile-roster",
    version: 1,
    exportedAt: new Date().toISOString(),
    characters: loadCharacters(),
  };
  downloadFile(
    JSON.stringify(data, null, 2),
    `hero4e-roster-${new Date().toISOString().slice(0, 10)}.hero4e-roster`,
    "application/json",
  );
  toast("Roster backup downloaded");
}
function downloadFile(text, filename, type) {
  const file = new File([text], filename, { type });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return file;
}
async function exportJson() {
  const filename = `${current.name.replace(/[\/:*?"<>|]/g, "-")}.hero4e`;
  const text = exportCharacterJson(current);
  const file = new File([text], filename, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `${current.name} HERO4E`, files: [file] });
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
  }
  downloadFile(text, filename, "application/json");
  toast("HERO4E character downloaded");
}
async function exportFoundry() {
  const filename = `fvtt-Actor-${current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hero"}.json`;
  const text=exportFoundryActorJson(current),file=new File([text],filename,{type:"application/json"});
  try { if(navigator.canShare?.({files:[file]})){await navigator.share({title:`${current.name} Foundry Actor`,files:[file]});toast("Foundry Actor shared");return;} }
  catch(error){if(error.name==="AbortError")return;console.warn(error);}
  downloadFile(text,filename,"application/json");toast("Foundry Actor downloaded");
}
async function exportHdc() {
  let prototypeHdc = "";
  if (!current?.preservedHdc) {
    try { prototypeHdc = await fetch("./assets/hero-designer-v3-prototypes.hdc").then(response => { if (!response.ok) throw new Error("Prototype library unavailable"); return response.text(); }); }
    catch (error) { toast(error.message); return; }
  }
  let hdcText; try { hdcText = buildHdc(current, prototypeHdc); } catch (error) { toast(error.message); return; }
  const filename = `${current.name.replace(/[\/:*?"<>|]/g, "-")}.hdc`;
  const file = new File([hdcText], filename, { type: "application/xml" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `${current.name} HDC`, files: [file] });
      toast("HDC shared");
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    console.warn(error);
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("HDC downloaded");
}
function findEntry(section, id) {
  return (current.sections?.[section] || []).find((item) => String(item.id) === String(id));
}
function openEntryDetails(section, id) {
  const entry = findEntry(section, id);
  if (!entry) return;
  selectedEntry = {section, id};
  $("#detail-category").textContent = sectionLabels()[section] || section;
  $("#detail-name").textContent = entry.name || entry.alias || "Unnamed entry";
  $("#detail-points").textContent = String(entryPointCost(section, entry));
  const detailRoll=entryRoll4e(entry),detailTarget=entry.mechanics?.roll;
  $("#detail-roll").textContent = detailRoll;
  $("#detail-roll-card").querySelector("span").textContent=entry.mechanics?.rollLabel||"Roll";
  $("#detail-roll-card").disabled=currentWorkspace!=="play"||!Number.isFinite(detailTarget);
  $("#detail-roll-card").dataset.target=Number.isFinite(detailTarget)?String(detailTarget):"";
  $("#detail-roll-card").dataset.label=entry.name||entry.alias||"Ability";
  $("#detail-definition").textContent = entryDefinition4e(section, entry);
  $("#detail-reference").textContent = entryReference4e(section, entry);
  $("#detail-mechanics").textContent = entryMechanicsSummary(section, entry) || "No additional mechanics recorded.";
  renderMartialSpecifications(section, entry);
  $("#detail-notes").textContent = entry.notes || "No character-specific notes.";
  $("#detail-notes-wrap").hidden = !entry.notes;
  $("#entry-detail-dialog").showModal();
}
function renderMartialSpecifications(section,entry){
  const box=$("#detail-martial-specs"),m=entry.mechanics;
  box.hidden=section!=="martialarts"||!m;
  if(box.hidden){box.innerHTML="";return;}
  const facts=[["Action",m.action],["OCV",m.ocv],["DCV",m.dcv],["Damage Class Bonus",m.damageClasses||"—"],["Damage / Effect",martialManeuverEffect4e(entry,current.characteristics.STR)],["Add STR",m.addStrength?"Yes":"No"],["Use Weapon",m.useWeapon?"Yes":"No"],["Category",m.category]];
  if(m.weaponEffect)facts.push(["Weapon Effect",m.weaponEffect]);
  box.innerHTML=facts.map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}
function openEntryEditor(section, id) {
  const entry = findEntry(section, id);
  if(currentWorkspace!=="character"||!editMode)return;
  if (!entry) return;
  $("#entry-dialog").dataset.mode = "edit";
  $("#delete-entry").hidden = false;
  $("#entry-category-heading").textContent = sectionLabels()[section] || section;
  $("#entry-form-heading").textContent = `Edit ${entry.name || entry.alias || sectionLabels()[section] || "Character Ability"}`;
  $("#entry-section").value = section;
  $("#entry-id").value = id;
  $("#entry-name").value = entry.name || "";
  $("#entry-levels").value = entryPointCost(section, entry);
  $("#entry-levels").readOnly = true;
  $("#entry-cost-display").textContent = String(entryPointCost(section, entry));
  $("#entry-roll-display").textContent = entryRoll4e(entry);
  $("#entry-definition").textContent = entryDefinition4e(section, entry);
  $("#entry-reference").textContent = entryReference4e(section, entry);
  $("#entry-notes").value = entry.notes || "";
  $("#entry-new-section").value = entry.mechanics?.isFramework ? "framework" : section;
  prepareExistingEntryBuilder(section, entry);
  $("#entry-dialog").showModal();
}
$("#close-entry-detail").addEventListener("click", () => $("#entry-detail-dialog").close());
$("#edit-entry-detail").addEventListener("click", () => {
  if (!selectedEntry) return;
  $("#entry-detail-dialog").close();
  openEntryEditor(selectedEntry.section, selectedEntry.id);
});
$("#entry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  let section = $("#entry-section").value;
  let entry = (current.sections?.[section] || []).find(
    (item) => String(item.id) === String($("#entry-id").value),
  );
  if ($("#entry-dialog").dataset.mode === "new") {
    section = $("#entry-new-section").value;
    current.sections[section] ??= [];
    entry =
      section === "equipment"
        ? buildEquipment4e({
            kind: $("#equipment-kind").value,
            name: $("#entry-name").value,
            effect: $("#equipment-effect").value,
            quantity: $("#equipment-quantity").value,
            weight: $("#equipment-weight").value,
            carried: $("#equipment-carried").checked,
            ocv: $("#equipment-ocv").value,
            range: $("#equipment-range").value,
            pd: $("#equipment-pd").value,
            ed: $("#equipment-ed").value,
            notes: $("#entry-notes").value,
          })
        : section === "disadvantages"
          ? buildDisadvantage4e({
              key: $("#disadvantage-key").value,
              name: $("#entry-name").value,
              levels: $("#disadvantage-levels").value,
              selections: [
                ...document.querySelectorAll("[data-disadvantage-option]"),
              ].map((node) => node.value),
              notes: $("#entry-notes").value,
            })
          : section === "talents" || section === "perks"
            ? buildAbility4e({
                section,
                key: $("#simple-ability-key").value,
                name: $("#entry-name").value,
                characteristics: current.characteristics,
                levels: $("#simple-ability-levels").value,
                options: collectTalentOptions(),
                notes: $("#entry-notes").value,
              })
            : section === "skills"
              ? buildSkill4e({
                  key: $("#skill-key").value,
                  name: $("#entry-name").value,
                  characteristics: current.characteristics,
                  improvements: $("#skill-improvements").value,
                  familiarity: $("#skill-familiarity").checked,
                  characteristicBased: $("#skill-characteristic").checked,
                  ...collectSkillOptions(),
                  notes: $("#entry-notes").value,
                })
              : section === "martialarts"
                ? buildMartialManeuver4e({
                    key: $("#martial-key").value,
                    name: $("#entry-name").value,
                    category: $("#martial-category").value,
                    useWeapon: $("#martial-use-weapon").checked,
                    notes: $("#entry-notes").value,
                  })
                : section === "powers"
                  ? buildPower4e({
                    key: $("#power-key").value,
                    name: $("#entry-name").value,
                    levels: $("#power-levels").value,
                    advantages: $("#power-advantages").value,
                    limitations: $("#power-limitations").value,
                    advantageKey: $("#power-advantage-key").value,
                    limitationKey: $("#power-limitation-key").value,
                    advantageName: $("#power-advantage-name").value,
                    limitationName: $("#power-limitation-name").value,
                    modifiers: additionalPowerModifiers,
                    options: collectPowerOptions(),
                    notes: $("#entry-notes").value,
                  })
                : {
                    id: crypto.randomUUID(),
                    tag: "CANONICAL",
                    name: "",
                    alias: "",
                    option: "",
                    levels: 0,
                    baseCost: 0,
                    notes: "",
                    rawXml: "",
                  };
    const repeatableSkills=new Set(["knowledge","skillLevels","combatSkillLevels","rangeSkillLevels","languages","professionalSkill","science","weaponFamiliarity","transportFamiliarity"]),key=entry.mechanics?.key||entry.xmlId;
    const duplicate=(section==="skills"&&!repeatableSkills.has(key)||section==="martialarts")&&current.sections[section].some(item=>(item.mechanics?.key||item.xmlId)===key);
    if(duplicate){toast(`${entry.alias||entry.name} is already on the character — edit the existing entry instead`);return;}
    current.sections[section].push(entry);
  }
  if (!entry) return;
  entry.name = $("#entry-name").value.trim() || entry.name;
  if ($("#entry-dialog").dataset.mode !== "new") updateExistingEntryFromForm(section, entry);
  entry.notes = $("#entry-notes").value;
  markHdcDirty();
  $("#entry-dialog").close();
  renderEntries();
  renderProfile();
  toast(`${sectionLabels()[section] || "Character ability"} updated — save the character`);
});
function updateExistingEntryFromForm(section, entry) {
  if (section === "skills" && SKILLS_4E[$("#skill-key").value]) {
    entry.mechanics = calculateSkill4e($("#skill-key").value, current.characteristics, {improvements:Number($("#skill-improvements").value||0),familiarity:$("#skill-familiarity").checked,characteristicBased:$("#skill-characteristic").checked,...collectSkillOptions()});
    entry.xmlId = $("#skill-key").value; entry.levels = entry.mechanics.improvements; entry.baseCost = entry.mechanics.cost;
  } else if (section === "martialarts" && MARTIAL_MANEUVERS_4E[$("#martial-key").value]) {
    const rebuilt=buildMartialManeuver4e({key:$("#martial-key").value,name:entry.name,category:$("#martial-category").value,useWeapon:$("#martial-use-weapon").checked,notes:entry.notes});
    entry.xmlId=rebuilt.xmlId;entry.alias=rebuilt.alias;entry.levels=0;entry.mechanics=rebuilt.mechanics;entry.baseCost=rebuilt.baseCost;
  } else if (section === "powers" && entry.mechanics?.isFramework) {
    const rebuilt=buildFramework4e({kind:$("#special-kind").value,name:entry.name,points:Number($("#framework-points").value),advantages:Number($("#framework-advantages").value),limitations:Number($("#framework-limitations").value),notes:entry.notes});
    entry.xmlId=rebuilt.xmlId;entry.alias=rebuilt.alias;entry.levels=rebuilt.levels;entry.baseCost=rebuilt.baseCost;entry.mechanics=rebuilt.mechanics;
  } else if (section === "powers" && !entry.mechanics?.isFramework && POWER_CATALOG_4E[$("#power-key").value]) {
    const powerModifiers=allPowerModifiers(), advantageTotal=powerModifiers.filter(item=>item.value>0).reduce((sum,item)=>sum+Math.abs(item.value),0), limitationTotal=powerModifiers.filter(item=>item.value<0).reduce((sum,item)=>sum+Math.abs(item.value),0), frameworkId=$("#power-framework").value||undefined,framework=(current.sections?.powers||[]).find(item=>item.id===frameworkId),preserved={frameworkId,frameworkName:framework?.name,slotKind:framework?.mechanics?.kind==="multipower"?$("#power-slot-kind").value:frameworkId?"framework":undefined};
    entry.levels=Number($("#power-levels").value||1); entry.xmlId=$("#power-key").value;
    entry.mechanics={...calculatePowerCost4e(entry.xmlId,entry.levels,{advantages:advantageTotal,limitations:limitationTotal,options:collectPowerOptions()}),effect:entry.levels+" "+POWER_CATALOG_4E[entry.xmlId].unit,modifiers:powerModifiers,status:"converted",pricingBasis:"Fourth Edition",...Object.fromEntries(Object.entries(preserved).filter(([,value])=>value))};
    entry.baseCost=entry.mechanics.baseCost;
  } else if ((section === "talents" || section === "perks") && !entry.mechanics?.isSkillEnhancer) {
    const key=$("#simple-ability-key").value,levels=Number($("#simple-ability-levels").value||0),mechanics=section==="talents"?calculateTalent4e(key,current.characteristics,levels,collectTalentOptions()):calculatePerk4e(key,levels,collectTalentOptions());
    entry.xmlId=key;entry.levels=levels;entry.mechanics=mechanics;entry.baseCost=mechanics.cost;
  } else if (section === "disadvantages" && DISADVANTAGES_4E[$("#disadvantage-key").value]) {
    const key=$("#disadvantage-key").value,selections=[...document.querySelectorAll("[data-disadvantage-option]")].map(node=>node.value),mechanics=calculateDisadvantage4e(key,{levels:Number($("#disadvantage-levels").value||1),selections});
    entry.xmlId=key;entry.levels=mechanics.levels;entry.mechanics=mechanics;entry.baseCost=mechanics.cost;entry.option=mechanics.detail;
  } else if (section === "equipment") {
    const rebuilt=buildEquipment4e({kind:$("#equipment-kind").value,name:entry.name,effect:$("#equipment-effect").value,quantity:$("#equipment-quantity").value,weight:$("#equipment-weight").value,carried:$("#equipment-carried").checked,ocv:$("#equipment-ocv").value,range:$("#equipment-range").value,pd:$("#equipment-pd").value,ed:$("#equipment-ed").value,notes:entry.notes});
    entry.xmlId=rebuilt.xmlId;entry.levels=rebuilt.levels;entry.mechanics=rebuilt.mechanics;entry.baseCost=rebuilt.baseCost;
  }
  syncFrameworkCosts();
}
$("#delete-entry").addEventListener("click", () => {
  const section = $("#entry-section").value;
  const deletedId = $("#entry-id").value;
  const entry=findEntry(section,deletedId);
  if(!entry||!confirm(`Delete ${entry.name||entry.alias||"this entry"}? Its points will be removed from the character total.`))return;
  current.sections[section] = (current.sections?.[section] || []).filter(
    (e) => String(e.id) !== String(deletedId),
  );
  for (const power of current.sections?.powers || []) {
    if (String(power.mechanics?.frameworkId) === String(deletedId)) {
      delete power.mechanics.frameworkId;
      delete power.mechanics.frameworkName;
      delete power.mechanics.slotKind;
      Object.assign(power.mechanics, calculatePowerCost4e(power.mechanics.key, power.levels, {advantages:power.mechanics.advantages, limitations:power.mechanics.limitations}));
    }
  }
  markHdcDirty();
  $("#entry-dialog").close();
  renderEntries();
  renderProfile();
  toast("Entry removed and character points recalculated");
});
function updateEquipmentBuilder() {
  const visible = $("#entry-new-section").value === "equipment";
  $("#equipment-builder").hidden = !visible;
  if (!visible) return;
  const kind = $("#equipment-kind").value;
  $("#equipment-weapon-fields").hidden = kind !== "weapon";
  $("#equipment-armor-fields").hidden = kind !== "armor";
  const e = buildEquipment4e({
    kind,
    name: $("#entry-name").value,
    effect: $("#equipment-effect").value,
    quantity: $("#equipment-quantity").value,
    weight: $("#equipment-weight").value,
    carried: $("#equipment-carried").checked,
    ocv: $("#equipment-ocv").value,
    range: $("#equipment-range").value,
    pd: $("#equipment-pd").value,
    ed: $("#equipment-ed").value,
  });
  $("#equipment-preview").textContent = equipmentSummary(e);
  updateEntryFacts("equipment", e);
}
function updateDisadvantageBuilder(rebuild = false) {
  const visible = $("#entry-new-section").value === "disadvantages";
  $("#disadvantage-builder").hidden = !visible;
  if (!visible) return;
  const key = $("#disadvantage-key").value,
    definition = DISADVANTAGES_4E[key],
    groups = disadvantageOptions4e(key);
  $("#disadvantage-levels-wrap").hidden = !definition.perLevel;
  if (
    rebuild ||
    document.querySelectorAll("[data-disadvantage-option]").length !==
      groups.length
  )
    $("#disadvantage-options").innerHTML = groups
      .map(
        (group, index) =>
          "<label>" +
          group.label +
          '<select data-disadvantage-option="' +
          index +
          '">' +
          group.choices
            .map(
              (choice) =>
                '<option value="' +
                choice.key +
                '">' +
                choice.label +
                " (" +
                (choice.value >= 0 ? "+" : "") +
                choice.value +
                ")</option>",
            )
            .join("") +
          "</select></label>",
      )
      .join("");
  const selections = [
      ...document.querySelectorAll("[data-disadvantage-option]"),
    ].map((node) => node.value),
    d = calculateDisadvantage4e(key, {
      levels: Number($("#disadvantage-levels").value || 1),
      selections,
    });
  $("#disadvantage-preview").textContent = "";
  $("#disadvantage-preview").hidden = true;
  updateEntryFacts("disadvantages", {mechanics:d, xmlId:key});
}
function collectTalentOptions(){return {...Object.fromEntries([...document.querySelectorAll("[data-talent-option]")].map(node=>[node.dataset.talentOption,node.value])),builderPoints:Number(current?.points?.base||0)+Number(current?.points?.disadvantages||0)+Number(current?.points?.experience||0)};}
function renderTalentOptions(saved=null){const key=$("#simple-ability-key").value,host=$("#simple-ability-options");const templates={dangerSense:`<div class="power-numbers"><label>Warning<select data-talent-option="warning"><option value="combat">Prevents surprise in combat</option><option value="outOfCombat">Out of combat, perceivable attacks (+5)</option><option value="anyAttack">Any attack (+10)</option></select></label><label>Sensing area<select data-talent-option="area"><option value="self">Self</option><option value="vicinity">Immediate vicinity (+5)</option><option value="general">General area (+10)</option><option value="any">Any area (+15)</option></select></label></div>`,findWeakness:`<label>Attack scope<select data-talent-option="scope"><option value="single">One attack</option><option value="group">Group of related attacks (+10)</option><option value="all">All attacks (+20)</option></select></label>`,contact8:`<label>Exceptional usefulness<select data-talent-option="usefulness"><option value="0">Ordinary Contact</option><option value="1">Useful (+1)</option><option value="2">Very useful (+2)</option><option value="3">Exceptionally useful (+3)</option></select></label>`,contact11:`<label>Exceptional usefulness<select data-talent-option="usefulness"><option value="0">Ordinary Contact</option><option value="1">Useful (+1)</option><option value="2">Very useful (+2)</option><option value="3">Exceptionally useful (+3)</option></select></label>`,follower:`<div class="power-numbers"><label>Total Points after Disadvantages<input type="number" min="0" step="1" data-talent-option="totalPoints"></label><label>Follower quantity<select data-talent-option="quantityDoublings"><option value="0">One Follower</option><option value="1">Two Followers (+5)</option><option value="2">Four Followers (+10)</option><option value="3">Eight Followers (+15)</option></select></label></div>`,vehicleOrBase:`<label>Total Points after Disadvantages<input type="number" min="0" step="1" data-talent-option="totalPoints"></label>`};host.innerHTML=templates[key]||"";host.hidden=!host.innerHTML;for(const node of host.querySelectorAll("[data-talent-option]")){if(saved?.options?.[node.dataset.talentOption]!==undefined)node.value=saved.options[node.dataset.talentOption];node.addEventListener("input",updateSimpleAbilityBuilder);}}
function updateSimpleAbilityBuilder() {
  const section=$("#entry-new-section").value,visible=section==="talents"||section==="perks";
  $("#simple-ability-builder").hidden=!visible;if(!visible)return;
  const catalog=section==="talents"?TALENTS_4E:PERKS_4E,select=$("#simple-ability-key"),prior=select.value;
  select.innerHTML=Object.entries(catalog).map(([key,a])=>'<option value="'+key+'">'+a.label+"</option>").join("");if(catalog[prior])select.value=prior;
  $("#simple-ability-kind").textContent=section==="talents"?"Talent":"Perk";$("#simple-ability-levels-label").textContent=({follower:"Base Points",vehicleOrBase:"Base Points",fringeBenefit:"Character Points",contact8:"Roll improvements (+1)",contact11:"Roll improvements (+1)"}[select.value]||"Levels / improvements");
  if($("#simple-ability-options").dataset.key!==select.value){$("#simple-ability-options").dataset.key=select.value;renderTalentOptions();}
  try{const a=section==="talents"?calculateTalent4e(select.value,current.characteristics,Number($("#simple-ability-levels").value||0),collectTalentOptions()):calculatePerk4e(select.value,Number($("#simple-ability-levels").value||0),collectTalentOptions());$("#simple-ability-preview").textContent=[a.detail,a.cost+" points"].filter(Boolean).join(" · ");updateEntryFacts(section,{mechanics:a,xmlId:select.value});}catch(error){$("#simple-ability-preview").textContent=error.message;}
}function collectSkillOptions() {
  const value = id => document.getElementById(id)?.value;
  return {scope:value("skill-scope"),quantity:Number(value("skill-quantity")||1),fluency:Number(value("skill-fluency")||1),nativeTongue:Boolean(document.getElementById("skill-native")?.checked),literacy:Boolean(document.getElementById("skill-literacy")?.checked),similarity:Number(value("skill-similarity")||0)};
}
function renderSkillSpecialOptions(saved=null) {
  const key=$("#skill-key").value,definition=SKILLS_4E[key],host=$("#skill-special-options");
  host.hidden=!definition?.special;$("#skill-standard-options").hidden=Boolean(definition?.special);
  if(!definition?.special){host.innerHTML="";return;}
  if(definition.language){host.innerHTML=`<div class="power-numbers"><label>Fluency<select id="skill-fluency"><option value="1">Basic conversation (1)</option><option value="2">Fluent conversation (2)</option><option value="3">Completely fluent with accent (3)</option><option value="4">Idiomatic, native accent (4)</option><option value="5">Imitate dialects (5)</option></select></label><label>Language similarity<select id="skill-similarity"><option value="0">Standard cost</option><option value="-1">Related language (−1)</option><option value="1">Unrelated language (+1)</option></select></label><label class="check"><input id="skill-literacy" type="checkbox"> Literacy (+1 when not standard)</label><label class="check"><input id="skill-native" type="checkbox"> Native language (free)</label></div>`;}else{host.innerHTML=`<div class="power-numbers"><label>Application<select id="skill-scope">${Object.entries(definition.scopes).map(([id,item])=>`<option value="${id}">${item.label} (${item.cost})</option>`).join("")}</select></label><label>Levels / selections<input id="skill-quantity" type="number" min="1" step="1" value="1"></label></div>`;}
  if(saved){for(const [id,value] of Object.entries({"skill-scope":saved.scope,"skill-quantity":saved.improvements,"skill-fluency":saved.fluency,"skill-similarity":saved.similarity})){const node=document.getElementById(id);if(node&&value!==undefined)node.value=value;}const native=document.getElementById("skill-native"),literacy=document.getElementById("skill-literacy");if(native)native.checked=Boolean(saved.nativeTongue);if(literacy)literacy.checked=Boolean(saved.literacy);}
  host.querySelectorAll("input,select").forEach(node=>node.addEventListener("input",updateSkillBuilder));
}
function updateSkillBuilder() {
  const visible = $("#entry-new-section").value === "skills";
  $("#skill-builder").hidden = !visible;
  if (!visible) return;
  const definition = SKILLS_4E[$("#skill-key").value],background=Boolean(definition?.background);
  $("#skill-characteristic-wrap").hidden = !background;
  if($("#skill-special-options").dataset.key!==$("#skill-key").value){$("#skill-special-options").dataset.key=$("#skill-key").value;renderSkillSpecialOptions();}
  try {
    const s=calculateSkill4e($("#skill-key").value,current.characteristics,{improvements:Number($("#skill-improvements").value||0),familiarity:$("#skill-familiarity").checked,characteristicBased:$("#skill-characteristic").checked,...collectSkillOptions()});
    $("#skill-preview").textContent=[s.detail||s.characteristic||"General",Number.isFinite(s.roll)?s.roll+"-":"No roll",s.cost+" points"].join(" · ");
    updateEntryFacts("skills",{mechanics:s,xmlId:$("#skill-key").value});
  } catch(error){$("#skill-preview").textContent=error.message;}
}let additionalPowerModifiers = [],modifierEditIndex=-1,modifierEditKind="advantage";
function allPowerModifiers() { return [...additionalPowerModifiers]; }
function legacyRenderPowerModifierList() {
  const host=$("#power-modifier-list");
  host.innerHTML=additionalPowerModifiers.map((modifier,index)=>`<span class="modifier-chip">${escapeHtml(modifier.name)} (${modifier.value>0?"+":"âˆ’"}${Math.abs(modifier.value)}) <button type="button" data-remove-power-modifier="${index}" aria-label="Remove ${escapeHtml(modifier.name)}">Ã—</button></span>`).join(" ");
  host.hidden=!additionalPowerModifiers.length;
}
function collectPowerOptions() {
  return Object.fromEntries([...document.querySelectorAll("[data-power-option]")].map((node) => [node.dataset.powerOption, node.type === "checkbox" ? node.checked : node.type === "number" ? Number(node.value || 0) : node.value]));
}
function openPowerModifierEditor(kind,index=-1){
  modifierEditKind=kind;modifierEditIndex=index;
  const advantage=kind==="advantage",existing=index>=0?additionalPowerModifiers[index]:null;
  $("#modifier-editor-title").textContent=`${index<0?"Add":"Edit"} ${advantage?"Advantage":"Limitation"}`;
  $("#power-advantage-key").closest("label").hidden=!advantage;$("#power-limitation-key").closest("label").hidden=advantage;
  $("#power-advantage-custom").hidden=!advantage;$("#power-limitation-custom").hidden=advantage;
  const select=$(advantage?"#power-advantage-key":"#power-limitation-key"),key=existing?.id||existing?.key||"none";
  select.value=[...select.options].some(option=>option.value===key)?key:"custom";
  if(existing&&select.value==="custom"){$(advantage?"#power-advantage-name":"#power-limitation-name").value=existing.name;$(advantage?"#power-advantages":"#power-limitations").value=Math.abs(existing.value);}
  $("#power-modifier-dialog").showModal();
}
function renderPowerModifierList(){
  const host=$("#power-modifier-list");
  host.innerHTML=additionalPowerModifiers.map((modifier,index)=>`<div class="modifier-row"><span>${escapeHtml(modifier.name)}</span><strong>${modifier.value>0?"+":"−"}${Math.abs(modifier.value)}</strong><button type="button" data-edit-power-modifier="${index}">Edit</button><button type="button" data-remove-power-modifier="${index}" aria-label="Remove ${escapeHtml(modifier.name)}">Remove</button></div>`).join("");host.hidden=!additionalPowerModifiers.length;
}
function renderPowerOptions(saved = null) {
  const key = $("#power-key").value, host = $("#power-specific-options");
  if (host.dataset.key === key && saved === null) return;
  host.dataset.key = key;
  const checkbox = (id,label) => '<label class="check"><input type="checkbox" data-power-option="'+id+'" /> '+label+'</label>';
  const templates = {
    damageReduction: checkbox("resistant","Resistant Damage Reduction"),
    endReserve: '<label>Reserve REC<input type="number" min="0" step="1" value="0" data-power-option="rec" /></label>',
    extraDimensionalMovement: '<label>Destinations<select data-power-option="scope"><option value="single">One dimension</option><option value="related">Related group (+10)</option><option value="any">Any dimension (+20)</option></select></label>'+checkbox("timeTravel","Travel through time (+20)")+'<label>Mass doublings<input type="number" min="0" step="1" value="0" data-power-option="massDoublings" /></label>',
    lifeSupport: checkbox("unusualBreathing","Breathe in one unusual environment (5)")+checkbox("selfContainedBreathing","Self-contained breathing (10)")+checkbox("noEating","Need not eat, excrete, or sleep (5)")+checkbox("vacuum","Safe in vacuum/high pressure (3)")+checkbox("radiation","Safe in high radiation (3)")+checkbox("heatCold","Safe in intense heat/cold (3)")+checkbox("disease","Immune to disease (3)")+checkbox("aging","Immune to aging (3)"),
    mindLink: checkbox("relatedGroup","Related group, one at a time (+5)")+checkbox("anyMind","Any one mind (+5)")+'<label>Number-of-minds doublings<input type="number" min="0" step="1" value="0" data-power-option="mindDoublings" /></label>'+checkbox("anyDistance","Any distance (+5)")+checkbox("anyDimension","Any dimension (+5)"),
    missileDeflection: '<label>Bonus to Deflection Roll<input type="number" min="0" step="1" value="0" data-power-option="rollBonus" /></label><label>Reflection<select data-power-option="reflection"><option value="none">No Reflection</option><option value="attacker">Back at attacker (+20)</option><option value="any">At any target (+30)</option></select></label>',
    transform: '<label>Transformation class<select data-power-option="severity"><option value="cosmetic">Cosmetic (5 points/d6)</option><option value="minor">Minor (10 points/d6)</option><option value="major" selected>Major (15 points/d6)</option></select></label>',
    enhancedSenses: '<label>Sense or modifier<select data-power-option="sense"><option value="activeSonar">Active Sonar (15)</option><option value="discriminatory">Discriminatory Sense (5)</option><option value="enhancedPerceptionAll">Enhanced Perception, all senses (3/+1)</option><option value="enhancedPerceptionOne">Enhanced Perception, one sense (2/+1)</option><option value="highRangeRadio">High Range Radio Hearing (10)</option><option value="infrared" selected>Infrared Vision (5)</option><option value="mentalAwareness">Mental Awareness (3)</option><option value="microscopic">Microscopic Vision (3/level)</option><option value="nRay">N-Ray Vision (20)</option><option value="radar">Radar Sense (15)</option><option value="radioHearing">Radio Hearing (3)</option><option value="radioTransmit">Radio Listen and Transmit (5)</option><option value="rangeOne">Range, one sense (5)</option><option value="rangeGroup">Range, Sense Group (10)</option><option value="spatialAwareness">Spatial Awareness (25)</option><option value="targeting">Targeting Sense (20)</option><option value="telescopic">Telescopic Sense (+2 per 3)</option><option value="trackingScent">Tracking Scent (10)</option><option value="ultrasonic">Ultrasonic Hearing (3)</option><option value="ultraviolet">Ultraviolet Vision (5)</option><option value="sensing360Group">360 Degree Sensing, one group (10)</option><option value="sensing360All">360 Degree Sensing, all senses (25)</option><option value="detect">Detect (3 base)</option></select></label><label class="check"><input type="checkbox" data-power-option="detectSense" /> Detect is a Sense (+2)</label><label>Detect PER bonus<input type="number" min="0" step="1" value="0" data-power-option="perBonus" /></label>',
    clairsentience: '<label>Additional individual senses<input type="number" min="0" step="1" value="0" data-power-option="additionalSenses" /></label><label>Additional Sense Groups<input type="number" min="0" step="1" value="0" data-power-option="additionalGroups" /></label>'+checkbox("future","See the future (+20)")+checkbox("past","See the past (+20)")+checkbox("otherDimensions","See into other dimensions (+20)")+'<label>Maximum-range doublings<input type="number" min="0" step="1" value="0" data-power-option="rangeDoublings" /></label>',
  };
  host.innerHTML = templates[key] || "";
  host.hidden = !host.innerHTML;
  if (saved) for (const node of host.querySelectorAll("[data-power-option]")) { const value=saved[node.dataset.powerOption]; if (value === undefined) continue; if (node.type === "checkbox") node.checked=Boolean(value); else node.value=String(value); }
}
function selectedModifier(kind) {
  const prefix = kind === "advantage" ? "advantage" : "limitation",
    key = $("#power-" + prefix + "-key").value,
    value = $(
      "#power-" + (kind === "advantage" ? "advantages" : "limitations"),
    ).value,
    name = $("#power-" + prefix + "-name").value;
  return resolvePowerModifier4e(kind, key, value, name);
}
function updatePowerBuilder() {
  const editingFramework = $("#entry-dialog").dataset.mode === "edit" && findEntry($("#entry-section").value, $("#entry-id").value)?.mechanics?.isFramework;
  const visible = $("#entry-new-section").value === "powers" && !editingFramework;
  $("#power-builder").hidden = !visible;
  if (!visible) return;
  renderPowerOptions();
  const powerDefinition=POWER_CATALOG_4E[$("#power-key").value];
  $("#power-level-label").textContent = `Effect amount (${powerDefinition?.unit || "levels"})`;
  $("#power-levels").min=String(powerDefinition?.minimumInput??1);
  const advantage=selectedModifier("advantage"), limitation=selectedModifier("limitation"), powerModifiers=allPowerModifiers();
  const advantageTotal=powerModifiers.filter(item=>item.value>0).reduce((sum,item)=>sum+Math.abs(item.value),0);
  const limitationTotal=powerModifiers.filter(item=>item.value<0).reduce((sum,item)=>sum+Math.abs(item.value),0);
  $("#power-advantage-custom").hidden = $("#power-advantage-key").value !== "custom";
  $("#power-limitation-custom").hidden = $("#power-limitation-key").value !== "custom";
  try {
    const p=calculatePowerCost4e($("#power-key").value,Number($("#power-levels").value||1),{advantages:advantageTotal,limitations:limitationTotal,options:collectPowerOptions()});
    const mods=powerModifiers.map(modifier=>modifier.name).join("; ");
    $("#power-preview").textContent=[mods,p.activeCost+" Active",p.realCost+" Real",p.end+" END"].filter(Boolean).join(" · ");
    updateEntryFacts("powers",{mechanics:{...p,modifiers:powerModifiers,status:"converted"},xmlId:$("#power-key").value});
  } catch (error) { $("#power-preview").textContent=error.message; }
}
function updateEntryFacts(section, entry) {
  const cost = entryPointCost(section, entry);
  const framework=Boolean(entry?.mechanics?.isFramework),roll=entryRoll4e(entry);
  $("#entry-levels").value = cost;
  $("#entry-levels").readOnly = true;
  $("#entry-points-label").hidden=false;
  $("#entry-cost-display").textContent = String(cost);
  $("#entry-roll-display").textContent = roll;
  $("#entry-roll-fact").hidden=framework||roll==="None";
  $("#entry-definition").textContent = entryDefinition4e(section, entry);
  $("#entry-reference").textContent = entryReference4e(section, entry);
}
function prepareExistingEntryBuilder(section, entry) {
  const m=entry.mechanics||{};
  for(const id of ["equipment-builder","disadvantage-builder","simple-ability-builder","skill-builder","power-builder","martial-builder","special-builder"]) $("#"+id).hidden=true;
  if(section==="powers"&&m.isFramework){
    $("#special-kind").innerHTML='<option value="multipower">Multipower</option><option value="elementalControl">Elemental Control</option><option value="vpp">Variable Power Pool</option>';$("#special-kind").value=m.kind;$("#framework-points").value=m.points||entry.levels||20;$("#framework-advantages").value=m.advantages||0;$("#framework-limitations").value=m.limitations||0;updateSpecialBuilder();
  }else if(section==="skills"&&SKILLS_4E[m.key]){
    $("#skill-key").value=m.key;$("#skill-improvements").value=m.improvements??entry.levels??0;$("#skill-familiarity").checked=Boolean(m.familiarity);$("#skill-characteristic").checked=Boolean(m.characteristicBased);$("#skill-special-options").dataset.key=m.key;renderSkillSpecialOptions(m);updateSkillBuilder();
  }else if(section==="martialarts"&&MARTIAL_MANEUVERS_4E[m.key]){
    $("#martial-key").value=m.key;$("#martial-category").value=m.category||"Hand-To-Hand";$("#martial-use-weapon").checked=Boolean(m.useWeapon);updateMartialBuilder();
  }else if(section==="powers"&&!m.isFramework&&POWER_CATALOG_4E[m.key]){
    $("#power-key").value=m.key;$("#power-levels").value=entry.levels??m.levels??POWER_CATALOG_4E[m.key].defaultLevels??1;renderPowerOptions(m.options||{});
    additionalPowerModifiers=[...(m.modifiers||[])];$("#power-advantage-key").value="none";$("#power-limitation-key").value="none";$("#power-advantages").value=0;$("#power-limitations").value=0;renderPowerModifierList();refreshFrameworkChoices();if(m.frameworkId)$("#power-framework").value=m.frameworkId;if(m.slotKind)$("#power-slot-kind").value=m.slotKind;updatePowerBuilder();
  }else if((section==="talents"||section==="perks")&&!m.isSkillEnhancer&&((section==="talents"?TALENTS_4E:PERKS_4E)[m.key])){
    updateSimpleAbilityBuilder();$("#simple-ability-key").value=m.key;$("#simple-ability-levels").value=m.levels??entry.levels??0;$("#simple-ability-options").dataset.key=m.key;renderTalentOptions(m);updateSimpleAbilityBuilder();
  }else if(section==="disadvantages"&&DISADVANTAGES_4E[m.key]){
    $("#disadvantage-key").value=m.key;$("#disadvantage-levels").value=m.levels||entry.levels||1;updateDisadvantageBuilder(true);const selections=normalizeDisadvantageSelections4e(m.key,m.selections);[...document.querySelectorAll("[data-disadvantage-option]")].forEach((node,index)=>{if(selections[index])node.value=selections[index]});updateDisadvantageBuilder();
  }else if(section==="equipment"&&m.kind){
    $("#equipment-kind").value=m.kind;$("#equipment-effect").value=m.effect||"";$("#equipment-quantity").value=m.quantity||1;$("#equipment-weight").value=m.weight||0;$("#equipment-carried").checked=Boolean(m.carried);$("#equipment-ocv").value=m.ocv||0;$("#equipment-range").value=m.range||"";$("#equipment-pd").value=m.pd||0;$("#equipment-ed").value=m.ed||0;updateEquipmentBuilder();
  }else updateEntryFacts(section,entry);
}
function fillModifierSelect(selector, catalog, sign) {
  const select = $(selector);
  for (const [key, m] of Object.entries(catalog)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = m.label + (m.value ? " (" + sign + m.value + ")" : "");
    select.append(option);
  }
}
$("#power-key").innerHTML = '<optgroup label="Power Frameworks"><option value="framework:elementalControl">Elemental Control</option><option value="framework:multipower">Multipower</option><option value="framework:vpp">Variable Power Pool</option></optgroup><optgroup label="Powers">' + Object.entries(POWER_CATALOG_4E)
  .map(([key, p]) => '<option value="' + key + '"'+(key==="absorption"?' selected':'')+'>' + p.label + "</option>")
  .join("") + '</optgroup>';
fillModifierSelect("#power-advantage-key", POWER_ADVANTAGES_4E, "+");
fillModifierSelect("#power-limitation-key", POWER_LIMITATIONS_4E, "-");
$("#equipment-kind").innerHTML = Object.entries(EQUIPMENT_TYPES_4E)
  .map(([key, e]) => '<option value="' + key + '">' + e.label + "</option>")
  .join("");
for (const id of [
  "equipment-kind",
  "equipment-effect",
  "equipment-quantity",
  "equipment-weight",
  "equipment-carried",
  "equipment-ocv",
  "equipment-range",
  "equipment-pd",
  "equipment-ed",
])
  $("#" + id).addEventListener("input", updateEquipmentBuilder);
$("#disadvantage-key").innerHTML = Object.entries(DISADVANTAGES_4E)
  .map(([key, d]) => '<option value="' + key + '">' + d.label + "</option>")
  .join("");
$("#add-power-advantage").addEventListener("click",()=>openPowerModifierEditor("advantage"));
$("#add-power-limitation").addEventListener("click",()=>openPowerModifierEditor("limitation"));
$("#power-modifier-list").addEventListener("click",event=>{const remove=event.target.closest("[data-remove-power-modifier]"),edit=event.target.closest("[data-edit-power-modifier]");if(remove){additionalPowerModifiers.splice(Number(remove.dataset.removePowerModifier),1);renderPowerModifierList();updatePowerBuilder();}else if(edit){const index=Number(edit.dataset.editPowerModifier),modifier=additionalPowerModifiers[index];openPowerModifierEditor(modifier?.value>=0?"advantage":"limitation",index);}});
$("#power-specific-options").addEventListener("input", updatePowerBuilder);
$("#power-key").addEventListener("change", () => {
  const value=$("#power-key").value;
  if(value.startsWith("framework:")){
    $("#entry-new-section").value="framework";$("#special-kind").value=value.split(":")[1];updateSpecialBuilder();updatePowerBuilder();return;
  }
  $("#entry-new-section").value="powers";updateSpecialBuilder();const definition=POWER_CATALOG_4E[value];$("#power-levels").value=definition?.defaultLevels??1;updatePowerBuilder();
});
$("#disadvantage-key").addEventListener("change", () =>
  updateDisadvantageBuilder(true),
);
$("#disadvantage-levels").addEventListener("input", () =>
  updateDisadvantageBuilder(),
);
$("#disadvantage-options").addEventListener("input", () =>
  updateDisadvantageBuilder(),
);
$("#skill-key").innerHTML = '<optgroup label="Skill Enhancers">'+Object.entries(SKILL_ENHANCERS_4E).map(([key,item])=>`<option value="enhancer:${key}">${item.label}</option>`).join("")+'</optgroup><optgroup label="Skills">'+Object.entries(SKILLS_4E)
  .map(([key, s]) => '<option value="' + key + '"'+(key==="acrobatics"?' selected':'')+'>' + s.label + "</option>")
  .join("")+'</optgroup>';
$("#skill-key").addEventListener("change",()=>{
  const value=$("#skill-key").value;
  if(value.startsWith("enhancer:")){$("#entry-new-section").value="enhancer";$("#special-kind").value=value.split(":")[1];updateSpecialBuilder();updateSkillBuilder();return;}
  $("#entry-new-section").value="skills";updateSpecialBuilder();updateSkillBuilder();
});
$("#entry-new-section").addEventListener("change", () => {
  const section=$("#entry-new-section").value;
  $("#entry-category-heading").textContent=sectionLabels()[section]||section;
  if($("#entry-dialog").dataset.mode==="new")$("#entry-form-heading").textContent=`Add ${sectionLabels()[section]||"Character Ability"}`;
  updatePowerBuilder();
  updateSkillBuilder();
  updateSimpleAbilityBuilder();
  updateDisadvantageBuilder(true);
  updateEquipmentBuilder();
  updateMartialBuilder();
});
for (const id of ["simple-ability-key", "simple-ability-levels"])
  $("#" + id).addEventListener("input", updateSimpleAbilityBuilder);
for (const id of [
  "skill-key",
  "skill-improvements",
  "skill-familiarity",
  "skill-characteristic",
])
  $("#" + id).addEventListener("input", updateSkillBuilder);
for (const id of [
  "power-key",
  "power-levels",
  "power-advantage-key",
  "power-limitation-key",
  "power-advantages",
  "power-limitations",
  "power-advantage-name",
  "power-limitation-name",
])
  $("#" + id).addEventListener("input", updatePowerBuilder);


// Fourth Edition core Martial Maneuvers are selected, not improvised.
$("#entry-new-section").insertAdjacentHTML("afterend", `<div id="martial-builder" hidden>
  <label>Martial Maneuver<select id="martial-key"></select></label>
  <label>Martial Arts category<input id="martial-category" value="Hand-To-Hand" /></label>
  <label class="check"><input id="martial-use-weapon" type="checkbox" /> Use with weapon</label>
  <div id="martial-preview" class="power-preview"></div>
</div>`);
$("#martial-key").innerHTML=Object.entries(MARTIAL_MANEUVERS_4E).map(([key,m])=>`<option value="${key}">${m.label} (${m.cost} points)</option>`).join("");
function updateMartialBuilder(){
  const visible=$("#entry-new-section").value==="martialarts";
  $("#martial-builder").hidden=!visible;
  if(!visible)return;
  try{
    const maneuver=buildMartialManeuver4e({key:$("#martial-key").value,category:$("#martial-category").value,useWeapon:$("#martial-use-weapon").checked});
    $("#martial-preview").textContent=martialManeuverSummary4e(maneuver);
    updateEntryFacts("martialarts",maneuver);
  }catch(error){$("#martial-preview").textContent=error.message;}
}
for(const id of ["martial-key","martial-category","martial-use-weapon"]) $("#"+id).addEventListener("input",updateMartialBuilder);
// Fourth Edition frameworks and Skill Enhancers are first-class creation modes.
$("#entry-name").required = false;
$("#identity-name").required = false;
$("#entry-new-section").insertAdjacentHTML(
  "beforeend",
  '<option value="framework">Power Framework</option><option value="enhancer">Skill Enhancer</option>',
);
$("#entry-new-section").insertAdjacentHTML(
  "afterend",
  `<div id="special-builder" hidden>
    <label id="special-kind-wrap">Fourth Edition type<select id="special-kind"></select></label>
    <div id="framework-fields" class="power-numbers">
      <label><span id="framework-points-label">Framework points</span><input id="framework-points" type="number" min="1" step="1" value="20" /></label>
      <label>Control Advantages<input id="framework-advantages" type="number" min="0" step="0.25" value="0" /></label>
      <label>Framework Limitations<input id="framework-limitations" type="number" min="0" step="0.25" value="0" /></label>
    </div>
    <div id="special-preview" class="power-preview"></div>
  </div>`,
);
$("#power-builder").insertAdjacentHTML(
  "beforeend",
  `<div id="framework-slot-fields"><label>Power Framework<select id="power-framework"><option value="">Standalone Power</option></select></label><label>Multipower slot type<select id="power-slot-kind"><option value="variable">Variable slot (1/5)</option><option value="fixed">Fixed slot (1/10)</option></select></label></div>`,
);

function refreshFrameworkChoices() {
  const frameworks = (current?.sections?.powers || []).filter((entry) => entry.mechanics?.isFramework);
  $("#framework-slot-fields").hidden=!frameworks.length;
  const prior = $("#power-framework").value;
  $("#power-framework").innerHTML = '<option value="">Standalone Power</option>' + frameworks.map((framework) => `<option value="${escapeHtml(framework.id)}">${escapeHtml(framework.name)}</option>`).join("");
  if (frameworks.some((framework) => framework.id === prior)) $("#power-framework").value = prior;
  const selected = frameworks.find((framework) => framework.id === $("#power-framework").value);
  $("#power-slot-kind").closest("label").hidden = selected?.mechanics?.kind !== "multipower";
}
function updateSpecialBuilder() {
  const section = $("#entry-new-section").value;
  const special = section === "framework" || section === "enhancer";
  $("#special-builder").hidden = !special;
  if (!special) return;
  const catalog = section === "framework"
    ? {multipower:"Multipower",elementalControl:"Elemental Control",vpp:"Variable Power Pool"}
    : Object.fromEntries(Object.entries(SKILL_ENHANCERS_4E).map(([key,value]) => [key,value.label]));
  const prior = $("#special-kind").value;
  $("#special-kind").innerHTML = Object.entries(catalog).map(([key,label]) => `<option value="${key}">${label}</option>`).join("");
  if (catalog[prior]) $("#special-kind").value = prior;
  $("#framework-fields").hidden = section !== "framework";
  if (section === "enhancer") {
    $("#special-preview").textContent = "3 points · reduces the cost of each affected Skill by 1 point";
    return;
  }
  try {
    const preview = buildFramework4e({kind:$("#special-kind").value, points:Number($("#framework-points").value), advantages:Number($("#framework-advantages").value), limitations:Number($("#framework-limitations").value)});
    const pointLabels={multipower:"Multipower Reserve",elementalControl:"Elemental Control Base (Active Points)",vpp:"Variable Power Pool"};
    $("#framework-points-label").textContent=pointLabels[$("#special-kind").value]||"Framework points";
    $("#special-preview").textContent = frameworkSummary4e(preview, []);
    updateEntryFacts("powers",preview);
  } catch (error) { $("#special-preview").textContent = error.message; }
}
$("#entry-new-section").addEventListener("change", updateSpecialBuilder);
for (const id of ["special-kind","framework-points","framework-advantages","framework-limitations"]) $("#"+id).addEventListener("input", updateSpecialBuilder);
$("#power-framework").addEventListener("change", refreshFrameworkChoices);

$("#entry-form").addEventListener("submit", (event) => {
  if ($("#entry-dialog").dataset.mode !== "new") return;
  const special = $("#entry-new-section").value;
  if (special !== "framework" && special !== "enhancer") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const entry = special === "framework"
      ? buildFramework4e({kind:$("#special-kind").value,name:$("#entry-name").value.trim(),points:Number($("#framework-points").value),advantages:Number($("#framework-advantages").value),limitations:Number($("#framework-limitations").value),notes:$("#entry-notes").value})
      : buildSkillEnhancer4e({key:$("#special-kind").value,name:$("#entry-name").value.trim(),notes:$("#entry-notes").value});
    const section = special === "framework" ? "powers" : "talents";
    current.sections[section] ??= [];
    if(special==="enhancer"&&current.sections[section].some(item=>item.mechanics?.isSkillEnhancer&&item.mechanics?.key===entry.mechanics?.key)){toast(`${entry.alias} is already on the character — edit the existing entry instead`);return;}
    current.sections[section].push(entry);
    markHdcDirty(); syncFrameworkCosts(); $("#entry-dialog").close(); renderEntries(); renderProfile();
    toast(`${entry.alias} added — save the character`);
  } catch (error) { toast(error.message); }
}, {capture:true});

$("#entry-form").addEventListener("submit", () => {
  if ($("#entry-dialog").dataset.mode !== "new" || $("#entry-new-section").value !== "powers") return;
  const frameworkId = $("#power-framework").value;
  if (!frameworkId) return;
  const power = current.sections?.powers?.at(-1);
  const framework = current.sections?.powers?.find((entry) => entry.id === frameworkId);
  if (!power || power.mechanics?.isFramework || !framework) return;
  power.mechanics.frameworkId = frameworkId;
  power.mechanics.frameworkName = framework.name;
  power.mechanics.slotKind = $("#power-slot-kind").value;
  syncFrameworkCosts(); renderEntries(); renderProfile();
});

function openNewEntry(defaultSection="skills") {
  $("#entry-dialog").dataset.mode = "new";
  if(currentWorkspace!=="character"||!editMode)return;
  $("#entry-category-heading").textContent = sheetPageLabels[currentSheetPage]||sectionLabels()[defaultSection]||defaultSection;
  $("#entry-form-heading").textContent = `Add ${sheetPageLabels[currentSheetPage]?.replace(/s$/,"")||"Entry"}`;
  $("#delete-entry").hidden = true;
  $("#entry-section").value = "";
  $("#entry-id").value = "";
  $("#entry-name").value = "";
  $("#entry-levels").value = 0;
  $("#entry-levels").readOnly = true;
  $("#entry-notes").value = "";
  additionalPowerModifiers=[];
  renderPowerModifierList();
  $("#power-advantage-key").value = "none";
  $("#power-limitation-key").value = "none";
  $("#power-advantages").value = 0;
  $("#power-limitations").value = 0;
  $("#power-advantage-name").value = "";
  $("#power-limitation-name").value = "";
  $("#skill-improvements").value = 0;
  $("#skill-familiarity").checked = false;
  $("#skill-characteristic").checked = false;
  $("#simple-ability-levels").value = 0;
  $("#equipment-kind").value = "weapon";
  $("#equipment-effect").value = "";
  $("#equipment-quantity").value = 1;
  $("#equipment-weight").value = 0;
  $("#equipment-carried").checked = true;
  $("#equipment-ocv").value = 0;
  $("#equipment-range").value = "";
  $("#equipment-pd").value = 0;
  $("#equipment-ed").value = 0;
  $("#framework-points").value = 20;
  $("#framework-advantages").value = 0;
  $("#framework-limitations").value = 0;
  $("#entry-new-section").value=defaultSection;
  refreshFrameworkChoices();
  updateSpecialBuilder();
  updatePowerBuilder();
  updateSkillBuilder();
  updateSimpleAbilityBuilder();
  updateDisadvantageBuilder(true);
  updateEquipmentBuilder();
  updateMartialBuilder();
  autofillEntryName();
  $("#entry-dialog").showModal();
}
function autofillEntryName(){
  if($("#entry-dialog").dataset.mode!=="new")return;
  const section=$("#entry-new-section").value;
  const select=section==="skills"?$("#skill-key"):section==="talents"||section==="perks"?$("#simple-ability-key"):section==="martialarts"?$("#martial-key"):section==="powers"?$("#power-key"):section==="disadvantages"?$("#disadvantage-key"):section==="framework"||section==="enhancer"?$("#special-kind"):null;
  const text=select?.selectedOptions?.[0]?.textContent?.replace(/\s*\([^)]*points?\)\s*$/i,"").trim();
  if(text)$("#entry-name").value=text;
}
$("#sheet-add-button").addEventListener("click",()=>{const section=addableSheetPages[currentSheetPage];if(section&&editMode&&currentWorkspace==="character")openNewEntry(section);});
$("#cancel-entry").addEventListener("click", () => $("#entry-dialog").close());
$("#entry-form").addEventListener("change",event=>{if(event.target.matches("#skill-key,#simple-ability-key,#martial-key,#power-key,#disadvantage-key,#special-kind"))requestAnimationFrame(autofillEntryName);});
$("#export-json").addEventListener("click", exportJson);
$("#export-foundry").addEventListener("click", exportFoundry);
$("#roll-hit-location").addEventListener("click",()=>{const dice=Array.from({length:3},()=>1+Math.floor(Math.random()*6)),total=dice.reduce((a,b)=>a+b,0),location=hitLocation4e(total);$("#hit-location-result").textContent=`${dice.join(" + ")} = ${total}: ${location.name} · STUNx ${location.stunX} · Normal STUN x${location.nStun} · BODY x${location.bodyX} · Placed Shot ${location.toHit} OCV`;});
$("#roll-knockback").addEventListener("click",()=>{const count=Number($("#knockback-dice").value),dice=Array.from({length:count},()=>1+Math.floor(Math.random()*6)),result=knockback4e($("#knockback-body").value,{dice,resistance:$("#knockback-resistance").value,impact:$("#knockback-impact").value});$("#knockback-result").textContent=`${result.body} BODY − ${dice.join(" + ")} = ${result.result}${result.impactDice?` · ${result.impactDice}d6 possible impact damage`:""} · ${result.reference}`;});
$("#roll-presence").addEventListener("click",()=>{const dice=Math.max(0,Math.floor(Number(current.characteristics.PRE||0)/5)+Number($("#presence-modifier").value||0)),values=Array.from({length:dice},()=>1+Math.floor(Math.random()*6)),result=presenceAttack4e(current.characteristics.PRE,{roll:values.reduce((a,b)=>a+b,0),modifierDice:$("#presence-modifier").value,targetPre:$("#presence-target-pre").value,targetEgo:$("#presence-target-ego").value});$("#presence-result").textContent=`${dice}d6 = ${result.total} vs. ${result.defense}: ${result.effect} · ${result.reference}`;});$("#export-hdc").addEventListener("click", exportHdc);
$("#save-pdf").addEventListener("click",()=>{try{saveCharacterPdf(current);toast("Letter-size PDF downloaded");}catch(error){toast(error.message);}});
$("#print-character").addEventListener("click",()=>{try{printCharacter(current);}catch(error){toast(error.message);}});
$("#report-issue").addEventListener("click",()=>$("#issue-dialog").showModal());
$("#cancel-issue").addEventListener("click",()=>$("#issue-dialog").close());
$("#issue-form").addEventListener("submit",async event=>{event.preventDefault();const report=await issueReport4e({summary:$("#issue-summary").value.trim(),steps:$("#issue-steps").value.trim(),character:current,page:currentSheetPage,editMode});logDiagnostic4e("Issue report prepared");emailIssue4e(report);});
$("#sheet-portrait").addEventListener("click",()=>openArt(current));
$("#close-art").addEventListener("click",()=>$("#art-dialog").close());
$("#art-zoom-in").addEventListener("click",()=>{artZoom=Math.min(4,artZoom+.25);updateArtZoom();});
$("#art-zoom-out").addEventListener("click",()=>{artZoom=Math.max(.5,artZoom-.25);updateArtZoom();});
$("#art-zoom-reset").addEventListener("click",()=>{artZoom=1;updateArtZoom();});
$("#profile-button").addEventListener("click",()=>showSheetPage("background"));
$("#profile-form").addEventListener("input",event=>{
  if(!editMode||currentWorkspace!=="character")return;
  const field=event.target;
  if(field.id==="identity-name")current.name=field.value;
  else if(field.id==="identity-player")current.playerName=field.value;
  else if(field.id.startsWith("profile-"))current.profile[field.id.slice(8)]=field.value;
  else if(field.id==="points-base")current.points.base=Number(field.value||0);
  else if(field.id==="points-disadvantages")current.points.disadvantages=Number(field.value||0);
  markHdcDirty();
});
$(".point-edit").addEventListener("input",event=>{if(!editMode)return;const map={"points-base":"base","points-disadvantages":"disadvantages"},key=map[event.target.id];if(!key)return;current.points[key]=Number(event.target.value||0);markHdcDirty();renderProfile();});
$("#portrait-input").addEventListener("change", async (event) => {
  const file = event.target.files[0],
    status = $("#portrait-status");
  if (!file) return;
  try {
    status.textContent = "Preparing " + file.name + "…";
    toast("Preparing character art...");
    current.portrait = await preparePortrait(file);
    renderPortraits();
    status.textContent =
      "Portrait saved (" + Math.round(current.portrait.bytes / 1024) + " KB).";
    toast("Portrait ready — Save Character to finish");
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
    toast(error.message);
  } finally {
    event.target.value = "";
  }
});
$("#remove-portrait").addEventListener("click", () => {
  current.portrait = null;
  renderPortraits();
  toast("Portrait removed — save the character");
});
$("#identity-button").addEventListener("click",()=>{if(editMode&&currentWorkspace==="character")showSheetPage("background");});
$("#identity-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = $("#identity-name").value.trim() || current.name,
    nextPlayer = $("#identity-player").value.trim();
  if (nextName !== current.name || nextPlayer !== current.playerName)
    markHdcDirty();
  current.name = nextName;
  current.playerName = nextPlayer;
  renderSheet();
  toast("Identity updated — Save Character to finish");
});

$("#backup-roster").addEventListener("click", backupRoster);
$("#more-backup").addEventListener("click",backupRoster);
$("#more-restore").addEventListener("click",()=>$("#roster-input").click());
$("#roster-input").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (
      data?.format !== "hero4e-mobile-roster" ||
      data?.version !== 1 ||
      !Array.isArray(data.characters)
    )
      throw new Error("This is not a supported HERO4E roster backup.");
    const characters = data.characters.map(normalizeCharacter);
    if (
      loadCharacters().length &&
      !confirm(
        `Replace the current roster with ${characters.length} backed-up characters?`,
      )
    )
      return;
    replaceCharacters(characters);
    current = null;
    renderLibrary();
    show("library-view");
    toast(`${characters.length} characters restored`);
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
});
$("#delete-character").addEventListener("click", () => {
  if (
    !current ||
    !confirm(
      `Are you sure you want to delete ${current.name} from this device? This cannot be undone. Export or back up first if needed.`,
    )
  )
    return;
  deleteCharacter(current.id);
  current = null;
  renderLibrary();
  show("library-view");
  toast("Character deleted");
});
$("#new-character").addEventListener("click", createCharacter);
$("#new-character-shortcut").addEventListener("click", createCharacter);
$("#character-search").addEventListener("input", renderLibrary);
$("#back-button").addEventListener("click",()=>{ if(editMode){current=isDraft?null:normalizeCharacter(editSnapshot);isDraft=false;editSnapshot=null;setEditMode(false);} renderLibrary();show("library-view"); });
$("#json-input").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    current = importCharacterJson(await file.text());
    isDraft=false;editSnapshot=null;setEditMode(false);currentWorkspace="character";currentSheetPage="characteristics";
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast(`${current.name} imported${current.portrait?.dataUrl?` · character art loaded (${Math.round(current.portrait.bytes/1024)} KB)`:""}`);
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
});
$("#hdc-input").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    current = importHdc(await file.text());
    isDraft=false;editSnapshot=null;setEditMode(false);currentWorkspace="character";currentSheetPage="characteristics";
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast(`${current.name} imported${current.portrait?.dataUrl?` · embedded HDC art loaded (${Math.round(current.portrait.bytes/1024)} KB)`:" · no embedded HDC art found"}`);
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
});
$("#sample-character").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Importing...";
  toast("Loading Iron Wolf HDC...");
  try {
    const response = await fetch("./samples/The%20Iron%20Wolf.hdc", {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Sample download failed (${response.status})`);
    current = importHdc(await response.text());
    isDraft=false;editSnapshot=null;setEditMode(false);currentWorkspace="character";currentSheetPage="characteristics";
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast(`The Iron Wolf imported successfully${current.portrait?.dataUrl?` · embedded art loaded (${Math.round(current.portrait.bytes/1024)} KB)`:" · no embedded art found"}`);
  } catch (error) {
    console.error(error);
    toast(`Import failed: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Import Iron Wolf sample";
  }
});
function moveCombat(delta) {
  const next = advanceSegment(current.combat, delta);
  current.combat = { ...next, phase: clearPhaseActions() };
  saveCharacter(current);
  renderCombat();
}
document.querySelectorAll("[data-action]").forEach((button) => {
  const action=ACTION_TIMING_4E[button.dataset.action];if(action?.effect)button.title=[`OCV ${action.ocv}`,`DCV ${action.dcv}`,action.effect,"BBB p. 153"].join(" · ");
  button.addEventListener("click", () => {
    const result = addPhaseAction(current.combat.phase, button.dataset.action);
    if (!result.legal) {
      toast(result.error);
      return;
    }
    current.combat.phase = result;
    saveCharacter(current);
    renderCombat();
  });
});
$("#clear-phase").addEventListener("click", () => {
  current.combat.phase = clearPhaseActions();
  saveCharacter(current);
  renderCombat();
});
$("#next-segment").addEventListener("click", () => moveCombat(1));
$("#previous-segment").addEventListener("click", () => moveCombat(-1));
$("#take-recovery").addEventListener("click", () => {
  const timing = addPhaseAction(current.combat.phase, "recovery");
  if (!timing.legal) {
    toast(timing.error);
    return;
  }
  current.combat.phase = timing;
  const result = recoverResources({
    stun: current.current.STUN,
    end: current.current.END,
    stunMax: current.characteristics.STUN,
    endMax: current.characteristics.END,
    rec: current.characteristics.REC,
  });
  current.current.STUN = result.STUN;
  current.current.END = result.END;
  saveCharacter(current);
  refreshResources();
  renderCombat();
  toast(`Recovery: +${result.stunGained} STUN, +${result.endGained} END`);
});
$("#reset-resources").addEventListener("click", () => {
  for (const key of ["BODY", "STUN", "END"])
    current.current[key] = current.characteristics[key];
  saveCharacter(current);
  refreshResources();
  toast("Resources reset");
});
const diceTray=createDiceTray4e({getCharacter:()=>current});
const {queueCombatValue,rollAgainstTarget,rollPowerAttack,rollPowerDamage}=diceTray;
diceTray.bind();document.querySelectorAll("[data-nav]").forEach((button) =>
  button.addEventListener("click", () => {
    if (button.dataset.nav === "sheet-view" && !current) {
      toast("Choose or create a character first");
      return;
    }
    show(button.dataset.nav);
  }),
);
$("#sheet-menu-button").addEventListener("click",()=>setSheetMenu(!$("#sheet-page-menu").classList.contains("open")));
$("#header-options").addEventListener("click",()=>{if(currentWorkspace!=="character")return;if(editMode)saveAndLockCharacter();else beginEdit();});
$("#header-cancel-edit").addEventListener("click",cancelEdit);
$("#add-xp").addEventListener("click",()=>{if(!current||!editMode)return;current.points.experience=Number(current.points.experience||0)+1;markHdcDirty();renderProfile();toast(`Earned XP increased to ${current.points.experience}`);});
$("#skill-level-minus").addEventListener("click",()=>{$("#skill-improvements").value=Math.max(0,Number($("#skill-improvements").value||0)-1);updateSkillBuilder();});
$("#skill-level-plus").addEventListener("click",()=>{$("#skill-improvements").value=Number($("#skill-improvements").value||0)+1;updateSkillBuilder();});
$("#skill-improvements").addEventListener("focus",event=>event.target.select());
$("#characteristic-minus").addEventListener("click",()=>stepCharacteristic(-1));
$("#characteristic-plus").addEventListener("click",()=>stepCharacteristic(1));
$("#characteristic-value").addEventListener("focus",event=>event.target.select());
$("#cancel-characteristic").addEventListener("click",()=>$("#characteristic-dialog").close());
$("#characteristic-form").addEventListener("submit",event=>{event.preventDefault();applyCharacteristicValue(characteristicEditKey,$("#characteristic-value").value);$("#characteristic-dialog").close();renderSheet();showSheetPage("characteristics");});
$("#header-conditions").addEventListener("click",()=>{if(currentWorkspace==="play"){showSheetPage("actions");requestAnimationFrame(()=>$(".combat-panel")?.scrollIntoView({block:"start"}));}});
document.querySelectorAll("#sheet-page-menu [data-page]").forEach((button) => button.addEventListener("click", () => {showSheetPage(button.dataset.page);requestAnimationFrame(()=>$("#sheet-view")?.scrollTo({top:0,behavior:"auto"}));}));
document.querySelectorAll("[data-app-mode]").forEach(button=>button.addEventListener("click",()=>openAppMode(button.dataset.appMode)));
document.querySelectorAll("[data-open-play]").forEach(button=>button.addEventListener("click",()=>openAppMode("play")));
if ("serviceWorker" in navigator) {
  let reloading=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload();}});
  navigator.serviceWorker.register("./sw.js").then(registration=>registration.update()).catch(console.error);
}
setupIdentityOptions();
setupPowerModifierDialog();
$("#cancel-power-modifier").addEventListener("click",()=>$("#power-modifier-dialog").close());
$("#apply-power-modifier").addEventListener("click",()=>{const modifier=selectedModifier(modifierEditKind);if(!modifier)return toast("Choose a modifier");if(modifierEditIndex>=0)additionalPowerModifiers[modifierEditIndex]=modifier;else additionalPowerModifiers.push(modifier);$("#power-advantage-key").value="none";$("#power-limitation-key").value="none";$("#power-advantages").value=0;$("#power-limitations").value=0;$("#power-modifier-dialog").close();renderPowerModifierList();updatePowerBuilder();});
setupSheetPages();
setupSheetGestures();
renderLibrary();
