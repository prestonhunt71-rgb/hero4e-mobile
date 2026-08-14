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
  roll3d6,
  rollNormalDamage,
  rollKillingDamage,
} from "./rules.js";
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
let installPrompt = null;
let currentSheetPage = "stats";
let selectedEntry = null;
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
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
}
function setupSheetPages() {
  const profile = $("#profile-panel"), characteristics = $(".characteristics-panel"), combat = $(".combat-panel"), dice = $(".dice-controls")?.closest(".panel");
  const groups = {
    stats: [$("#resources"), characteristics, characteristics?.nextElementSibling, characteristics?.nextElementSibling?.nextElementSibling],
    abilities: [$("#abilities-panel")],
    combat: [combat],
    dice: [dice],
    profile: [profile, profile?.nextElementSibling],
  };
  for (const [page, nodes] of Object.entries(groups)) for (const node of nodes.filter(Boolean)) {
    node.classList.add("sheet-section-page");
    node.dataset.sheetPage = page;
  }
  const pageOrder = ["stats", "abilities", "combat", "dice", "profile"];
  document.querySelectorAll("[data-jump]").forEach((button, index) => button.dataset.page = pageOrder[index]);
}
function showSheetPage(page) {
  currentSheetPage = page;
  document.querySelectorAll("[data-sheet-page]").forEach(node => node.classList.toggle("sheet-page-active", node.dataset.sheetPage === page));
  document.querySelectorAll("[data-jump]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  window.scrollTo({top: 0, behavior: "auto"});
}
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
          (c, index) =>
            `<button class="character-card" data-id="${c.id}"><span class="avatar${c.portrait?.dataUrl ? " has-art" : ""}" ${c.portrait?.dataUrl ? 'data-view-art="true" title="View full-size character art" aria-label="View full-size character art"' : ""}>${c.portrait?.dataUrl ? `<img src="${c.portrait.dataUrl}" alt="" /><span class="art-badge" aria-hidden="true">ART</span>` : escapeHtml(c.name.slice(0, 1).toUpperCase())}</span><span><strong>${c.name}</strong><small>${c.source?.type === "hdc" ? "Hero Designer import" : "HERO4E original"} · SPD ${c.characteristics.SPD}${c.profile?.alternateIdentities ? ` · ${escapeHtml(c.profile.alternateIdentities)}` : ""}</small></span><span class="chevron">${String(index + 1).padStart(2, "0")} ›</span></button>`,
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
  return `<label class="stat"><span>${key}</span><input inputmode="numeric" data-stat="${key}" value="${value}" aria-label="${key}" /></label>`;
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
  $("#abilities-panel").hidden = !total && Boolean(current.preservedHdc);
  $("#ability-count").textContent = total
    ? `${total} ${current.preservedHdc ? "imported " : ""}items`
    : "No Skills, Perks, Talents, Martial Arts, Powers, Disadvantages, or Equipment yet";
  $("#ability-sections").innerHTML = groups
    .map(
      ([key, entries]) =>
        `<details ${key === "skills" || key === "powers" ? "open" : ""}><summary>${labels[key] || key} <span>${entries.length}</span></summary><div class="entry-list">${entries.map((entry) => `<button class="entry" data-entry-section="${key}" data-entry-id="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.name || entry.alias || "Unnamed " + (labels[key] || "item"))}</strong><small>${escapeHtml([entry.alias !== entry.name ? entry.alias : "", entry.option, entry.mechanics ? entryMechanicsSummary(key, entry) : ""].filter(Boolean).join(" · "))}</small></button>`).join("")}</div></details>`,
    )
    .join("");
  document
    .querySelectorAll("[data-entry-id]")
    .forEach((node) =>
      node.addEventListener("click", () =>
        openEntryDetails(node.dataset.entrySection, node.dataset.entryId),
      ),
    );
  $("#export-hdc").hidden = false;
  $("#add-entry").hidden = Boolean(current.preservedHdc);
}
function renderProfile() {
  syncFrameworkCosts();
  const p = current.profile || {};
  const rows = [
    ["Identity", p.alternateIdentities],
    ["Campaign", p.campaignName],
    ["Background", p.background],
    ["Personality", p.personality],
    ["Quote", p.quote],
    ["Tactics", p.tactics],
    ["Appearance", p.appearance],
    ["Notes", p.notes],
  ].filter(([, value]) => value);
  $("#profile-summary").innerHTML = rows.length
    ? rows
        .map(
          ([label, value]) =>
            `<div><strong>${label}</strong><p>${escapeHtml(value)}</p></div>`,
        )
        .join("")
    : `<p class="muted">No profile details yet.</p>`;
  const points = current.points || {},
    earnedDisadvantages = (current.sections?.disadvantages || []).reduce(
      (sum, entry) => sum + (Number(entry.mechanics?.cost) || 0),
      0,
    ),
    allowance = Number(points.disadvantages || 0),
    creditedDisadvantages = Math.min(
      earnedDisadvantages,
      allowance || earnedDisadvantages,
    ),
    available =
      Number(points.base || 0) +
      creditedDisadvantages +
      Number(points.experience || 0);
  $("#point-summary").textContent = available + " Character Points available";
  const knownPowers = (current.sections?.powers || []).reduce(
      (sum, entry) => sum + (Number(entry.mechanics?.realCost) || 0),
      0,
    ),
    enhancers = (current.sections?.talents || []).filter((entry) => entry.mechanics?.isSkillEnhancer),
    knownSkills = (current.sections?.skills || []).reduce(
      (sum, entry) => sum + Math.max(0, (Number(entry.mechanics?.cost) || 0) - skillEnhancerDiscount4e(entry, enhancers)),
      0,
    ),
    knownAbilities = [
      ...(current.sections?.talents || []),
      ...(current.sections?.perks || []),
    ].reduce((sum, entry) => sum + (Number(entry.mechanics?.cost) || 0), 0),
    knownMartial = (current.sections?.martialarts || []).reduce((sum, entry) => sum + (Number(entry.mechanics?.characterPoints ?? entry.baseCost) || 0), 0),
    knownSpent =
      totalCharacteristicCost(current.characteristics) +
      knownPowers +
      knownSkills +
      knownAbilities +
      knownMartial,
    balance = available - knownSpent;
  $("#point-grid").innerHTML = [
    ["Base Character Points", points.base],
    ["Maximum Disadvantage Points", points.disadvantages],
    ["Disadvantage Points", earnedDisadvantages],
    ["Experience", points.experience],
    ["Available", available],
    ["Character Points spent", knownSpent],
    ["Character Points remaining", balance],
  ]
    .map(
      ([label, value]) =>
        `<div><span>${label}</span><strong>${Number(value || 0)}</strong></div>`,
    )
    .join("");
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
  $("#speed-chart").innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
    .map(
      (value) =>
        `<button data-segment="${value}" class="${value === segment ? "current " : ""}${phases.includes(value) ? "phase" : ""}" aria-label="Segment ${value}${phases.includes(value) ? ", Phase" : ""}"><span>${value}</span>${phases.includes(value) ? "<small>Phase</small>" : ""}</button>`,
    )
    .join("");
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
  document.querySelectorAll("[data-current]").forEach((node) => {
    node.value = current.current[node.dataset.current];
  });
}
function renderPortraits() {
  const markup = current.portrait?.dataUrl
    ? `<img src="${current.portrait.dataUrl}" alt="${escapeHtml(current.name)} portrait" />`
    : `<span>${escapeHtml(current.name.slice(0, 1).toUpperCase())}</span>`;
  $("#sheet-portrait").innerHTML = markup;
  $("#portrait-preview").innerHTML = markup;
  $("#remove-portrait").hidden = !current.portrait;
}
let artZoom = 1;
function updateArtZoom(){ $("#art-image").style.transform = `scale(${artZoom})`; $("#art-zoom-reset").textContent = `${Math.round(artZoom*100)}%`; }
function openArt(character=current){ if(!character?.portrait?.dataUrl) return toast("Add character art first"); artZoom=1; $("#art-title").textContent=`${character.name||"Character"} art`; $("#art-image").src=character.portrait.dataUrl; $("#art-image").alt=`${character.name||"Character"} full-size art`; updateArtZoom(); $("#art-dialog").showModal(); }
function renderSheet() {
  if (!current) return;
  $("#character-name").textContent = current.name;
  renderPortraits();
  $("#player-name").textContent = current.playerName
    ? `Player: ${current.playerName}`
    : "Tap to edit identity";
  $("#characteristics").innerHTML = [...primaryKeys, ...figuredKeys]
    .map((key) => inputStat(key, current.characteristics[key]))
    .join("");
  $("#movement").innerHTML = movementKeys
    .map((key) => inputStat(key, current.characteristics[key]))
    .join("");
  $("#resources").innerHTML = ["BODY", "STUN", "END"]
    .map(
      (key) =>
        `<label><span>${key}</span><input inputmode="numeric" data-current="${key}" value="${current.current[key]}" /><small>/ ${current.characteristics[key]}</small></label>`,
    )
    .join("");
  renderDerived();
  renderEntries();
  renderProfile();
  renderCombat();
  showSheetPage(currentSheetPage);
  const notice = $("#import-notice");
  notice.hidden = !current.warnings.length;
  notice.textContent = current.warnings[0] || "";
  document
    .querySelectorAll("[data-stat]")
    .forEach((node) => node.addEventListener("change", updateStat));
  document.querySelectorAll("[data-current]").forEach((node) =>
    node.addEventListener("change", () => {
      current.current[node.dataset.current] = Number(node.value);
    }),
  );
}
function renderDerived() {
  const c = current.characteristics;
  $("#characteristic-cost").textContent =
    `${totalCharacteristicCost(c)} characteristic & movement points`;
  $("#combat-values").innerHTML = [
    ["OCV", combatValue(c.DEX)],
    ["DCV", combatValue(c.DEX)],
    ["ECV", combatValue(c.EGO)],
    ["DEX roll", `${9 + Math.floor(c.DEX / 5 + 0.5)}-`],
    ["EGO roll", `${9 + Math.floor(c.EGO / 5 + 0.5)}-`],
  ]
    .map(
      ([k, v]) =>
        `<div class="stat read"><span>${k}</span><strong>${v}</strong></div>`,
    )
    .join("");
}
function updateStat(event) {
  markHdcDirty();
  const key = event.target.dataset.stat;
  const previous = Number(current.characteristics[key]);
  const oldBases = figured(current.characteristics);
  const oldMovement = movementBases(current.characteristics);
  current.characteristics[key] = Number(event.target.value);
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
function openCharacter(id) {
  currentSheetPage = "stats";
  current = normalizeCharacter(getCharacter(id));
  saveCharacter(current);
  renderSheet();
  show("sheet-view");
}
function createCharacter() {
  currentSheetPage = "stats";
  current = normalizeCharacter({ name: "New Hero" });
  saveCharacter(current);
  renderLibrary();
  renderSheet();
  show("sheet-view");
}
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
  $("#detail-roll").textContent = entryRoll4e(entry);
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
  if (!entry) return;
  $("#entry-dialog").dataset.mode = "edit";
  $("#entry-section-label").hidden = true;
  $("#entry-organize").hidden = false;
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
function moveEntry(delta) {
  const section = $("#entry-section").value,
    entries = current.sections?.[section] || [],
    index = entries.findIndex(
      (e) => String(e.id) === String($("#entry-id").value),
    ),
    target = index + delta;
  if (index < 0 || target < 0 || target >= entries.length) return;
  [entries[index], entries[target]] = [entries[target], entries[index]];
  markHdcDirty();
  $("#entry-dialog").close();
  renderEntries();
  toast("Ability order updated");
}
$("#move-entry-up").addEventListener("click", () => moveEntry(-1));
$("#move-entry-down").addEventListener("click", () => moveEntry(1));
$("#delete-entry").addEventListener("click", () => {
  const section = $("#entry-section").value;
  const deletedId = $("#entry-id").value;
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
  toast("Ability removed — export creates updated HDC");
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
  $("#disadvantage-preview").textContent = [d.detail, d.cost + " points"]
    .filter(Boolean)
    .join(" · ");
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
}let additionalPowerModifiers = [];
function allPowerModifiers() { return [...additionalPowerModifiers, selectedModifier("advantage"), selectedModifier("limitation")].filter(Boolean); }
function renderPowerModifierList() {
  const host=$("#power-modifier-list");
  host.innerHTML=additionalPowerModifiers.map((modifier,index)=>`<span class="modifier-chip">${escapeHtml(modifier.name)} (${modifier.value>0?"+":"âˆ’"}${Math.abs(modifier.value)}) <button type="button" data-remove-power-modifier="${index}" aria-label="Remove ${escapeHtml(modifier.name)}">Ã—</button></span>`).join(" ");
  host.hidden=!additionalPowerModifiers.length;
}
function collectPowerOptions() {
  return Object.fromEntries([...document.querySelectorAll("[data-power-option]")].map((node) => [node.dataset.powerOption, node.type === "checkbox" ? node.checked : node.type === "number" ? Number(node.value || 0) : node.value]));
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
    $("#power-preview").textContent=[mods,p.activeCost+" Active",p.realCost+" Real",p.end+" END"].filter(Boolean).join(" Â· ");
    updateEntryFacts("powers",{mechanics:{...p,modifiers:powerModifiers,status:"converted"},xmlId:$("#power-key").value});
  } catch (error) { $("#power-preview").textContent=error.message; }
}
function updateEntryFacts(section, entry) {
  const cost = entryPointCost(section, entry);
  $("#entry-levels").value = cost;
  $("#entry-levels").readOnly = true;
  $("#entry-cost-display").textContent = String(cost);
  $("#entry-roll-display").textContent = entryRoll4e(entry);
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
$("#power-key").innerHTML = Object.entries(POWER_CATALOG_4E)
  .map(([key, p]) => '<option value="' + key + '">' + p.label + "</option>")
  .join("");
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
$("#add-power-advantage").addEventListener("click",()=>{const modifier=selectedModifier("advantage");if(!modifier)return;additionalPowerModifiers.push(modifier);$("#power-advantage-key").value="none";renderPowerModifierList();updatePowerBuilder();});
$("#add-power-limitation").addEventListener("click",()=>{const modifier=selectedModifier("limitation");if(!modifier)return;additionalPowerModifiers.push(modifier);$("#power-limitation-key").value="none";renderPowerModifierList();updatePowerBuilder();});
$("#power-modifier-list").addEventListener("click",event=>{const button=event.target.closest("[data-remove-power-modifier]");if(!button)return;additionalPowerModifiers.splice(Number(button.dataset.removePowerModifier),1);renderPowerModifierList();updatePowerBuilder();});
$("#power-specific-options").addEventListener("input", updatePowerBuilder);
$("#power-key").addEventListener("change", () => { const definition=POWER_CATALOG_4E[$("#power-key").value]; $("#power-levels").value=definition?.defaultLevels??1; updatePowerBuilder(); });
$("#disadvantage-key").addEventListener("change", () =>
  updateDisadvantageBuilder(true),
);
$("#disadvantage-levels").addEventListener("input", () =>
  updateDisadvantageBuilder(),
);
$("#disadvantage-options").addEventListener("input", () =>
  updateDisadvantageBuilder(),
);
$("#skill-key").innerHTML = Object.entries(SKILLS_4E)
  .map(([key, s]) => '<option value="' + key + '">' + s.label + "</option>")
  .join("");
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
$("#entry-section-label").insertAdjacentHTML("afterend", `<div id="martial-builder" hidden>
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
$("#entry-section-label").insertAdjacentHTML(
  "afterend",
  `<div id="special-builder" hidden>
    <label id="special-kind-wrap">Fourth Edition type<select id="special-kind"></select></label>
    <div id="framework-fields" class="power-numbers">
      <label>Reserve / base points<input id="framework-points" type="number" min="1" step="1" value="20" /></label>
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
    $("#special-preview").textContent = frameworkSummary4e(preview, []);
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

$("#add-entry").addEventListener("click", () => {
  $("#entry-dialog").dataset.mode = "new";
  $("#entry-section-label").hidden = false;
  $("#entry-category-heading").textContent = "Character creation";
  $("#entry-form-heading").textContent = "Add Character Ability";
  $("#entry-organize").hidden = true;
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
  refreshFrameworkChoices();
  updateSpecialBuilder();
  updatePowerBuilder();
  updateSkillBuilder();
  updateSimpleAbilityBuilder();
  updateDisadvantageBuilder(true);
  updateEquipmentBuilder();
  updateMartialBuilder();
  $("#entry-dialog").showModal();
});
$("#cancel-entry").addEventListener("click", () => $("#entry-dialog").close());
$("#export-json").addEventListener("click", exportJson);
$("#export-foundry").addEventListener("click", exportFoundry);
$("#roll-hit-location").addEventListener("click",()=>{const dice=Array.from({length:3},()=>1+Math.floor(Math.random()*6)),total=dice.reduce((a,b)=>a+b,0),location=hitLocation4e(total);$("#hit-location-result").textContent=`${dice.join(" + ")} = ${total}: ${location.name} · STUNx ${location.stunX} · Normal STUN x${location.nStun} · BODY x${location.bodyX} · Placed Shot ${location.toHit} OCV`;});
$("#roll-knockback").addEventListener("click",()=>{const count=Number($("#knockback-dice").value),dice=Array.from({length:count},()=>1+Math.floor(Math.random()*6)),result=knockback4e($("#knockback-body").value,{dice,resistance:$("#knockback-resistance").value,impact:$("#knockback-impact").value});$("#knockback-result").textContent=`${result.body} BODY − ${dice.join(" + ")} = ${result.result}${result.impactDice?` · ${result.impactDice}d6 possible impact damage`:""} · ${result.reference}`;});
$("#roll-presence").addEventListener("click",()=>{const dice=Math.max(0,Math.floor(Number(current.characteristics.PRE||0)/5)+Number($("#presence-modifier").value||0)),values=Array.from({length:dice},()=>1+Math.floor(Math.random()*6)),result=presenceAttack4e(current.characteristics.PRE,{roll:values.reduce((a,b)=>a+b,0),modifierDice:$("#presence-modifier").value,targetPre:$("#presence-target-pre").value,targetEgo:$("#presence-target-ego").value});$("#presence-result").textContent=`${dice}d6 = ${result.total} vs. ${result.defense}: ${result.effect} · ${result.reference}`;});$("#export-hdc").addEventListener("click", exportHdc);
$("#save-pdf").addEventListener("click",()=>{try{saveCharacterPdf(current);toast("Letter-size PDF downloaded");}catch(error){toast(error.message);}});
$("#print-character").addEventListener("click",()=>{try{printCharacter(current);}catch(error){toast(error.message);}});
$("#sheet-portrait").addEventListener("click",()=>openArt(current));
$("#close-art").addEventListener("click",()=>$("#art-dialog").close());
$("#art-zoom-in").addEventListener("click",()=>{artZoom=Math.min(4,artZoom+.25);updateArtZoom();});
$("#art-zoom-out").addEventListener("click",()=>{artZoom=Math.max(.5,artZoom-.25);updateArtZoom();});
$("#art-zoom-reset").addEventListener("click",()=>{artZoom=1;updateArtZoom();});
$("#profile-button").addEventListener("click", () => {
  for (const key of [
    "alternateIdentities",
    "campaignName",
    "background",
    "personality",
    "quote",
    "tactics",
    "appearance",
    "notes",
  ])
    $(`#profile-${key}`).value = current.profile?.[key] || "";
  $("#points-base").value = current.points?.base || 0;
  $("#points-disadvantages").value = current.points?.disadvantages || 0;
  $("#points-experience").value = current.points?.experience || 0;
  $("#profile-dialog").showModal();
});
$("#profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  for (const key of [
    "alternateIdentities",
    "campaignName",
    "background",
    "personality",
    "quote",
    "tactics",
    "appearance",
    "notes",
  ])
    current.profile[key] = $(`#profile-${key}`).value;
  current.points = {
    base: Number($("#points-base").value || 0),
    disadvantages: Number($("#points-disadvantages").value || 0),
    experience: Number($("#points-experience").value || 0),
  };
  markHdcDirty();
  $("#profile-dialog").close();
  renderProfile();
  toast("Profile updated — save the character");
});
$("#cancel-profile").addEventListener("click", () =>
  $("#profile-dialog").close(),
);
$("#portrait-input").addEventListener("change", async (event) => {
  const file = event.target.files[0],
    status = $("#portrait-status");
  if (!file) return;
  try {
    status.textContent = "Preparing " + file.name + "…";
    toast("Preparing character art...");
    current.portrait = await preparePortrait(file);
    saveCharacter(current);
    renderPortraits();
    status.textContent =
      "Portrait saved (" + Math.round(current.portrait.bytes / 1024) + " KB).";
    toast("Portrait saved on this device");
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
$("#identity-button").addEventListener("click", () => {
  $("#identity-name").value = current.name;
  $("#identity-player").value = current.playerName || "";
  $("#identity-dialog").showModal();
});
$("#identity-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = $("#identity-name").value.trim() || current.name,
    nextPlayer = $("#identity-player").value.trim();
  if (nextName !== current.name || nextPlayer !== current.playerName)
    markHdcDirty();
  current.name = nextName;
  current.playerName = nextPlayer;
  saveCharacter(current);
  $("#identity-dialog").close();
  renderSheet();
  renderLibrary();
  toast("Identity and portrait saved");
});
$("#cancel-identity").addEventListener("click", () =>
  $("#identity-dialog").close(),
);
$("#backup-roster").addEventListener("click", backupRoster);
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
      `Delete ${current.name} from this device? Export or back up first if needed.`,
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
$("#back-button").addEventListener("click", () => {
  renderLibrary();
  show("library-view");
});
$("#save-button").addEventListener("click", () => {
  current.updatedAt = new Date().toISOString();
  saveCharacter(current);
  toast("Character saved on this device");
  renderLibrary();
});
$("#json-input").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    current = importCharacterJson(await file.text());
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast(`${current.name} imported`);
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
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast(`${current.name} imported`);
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
    saveCharacter(current);
    renderLibrary();
    renderSheet();
    show("sheet-view");
    toast("The Iron Wolf imported successfully");
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
document.querySelectorAll("[data-roll]").forEach((button) =>
  button.addEventListener("click", () => {
    const type = button.dataset.roll;
    const result =
      type === "3d6"
        ? roll3d6()
        : type === "normal"
          ? rollNormalDamage()
          : rollKillingDamage();
    $("#roll-result").innerHTML =
      type === "3d6"
        ? `<strong>${result.total}</strong><span>${result.dice.join(" + ")}</span>`
        : `<strong>${result.stun} STUN &middot; ${result.body} BODY</strong><span>${result.dice.join(" + ")}${result.multiplier ? ` &middot; &times;${result.multiplier}` : ""}</span>`;
  }),
);
document.querySelectorAll("[data-nav]").forEach((button) =>
  button.addEventListener("click", () => {
    if (button.dataset.nav === "sheet-view" && !current) {
      toast("Choose or create a character first");
      return;
    }
    show(button.dataset.nav);
  }),
);
document.querySelectorAll("[data-jump]").forEach((button) =>
  button.addEventListener("click", () => {
    showSheetPage(button.dataset.page);
  }),
);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#install-button").hidden = false;
});
$("#install-button").addEventListener("click", async () => {
  await installPrompt?.prompt();
  installPrompt = null;
  $("#install-button").hidden = true;
});
$("#refresh-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Refreshing...";
  toast("Updating HERO4E Mobile...");
  try {
    const registrations =
      (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(
      registrations.map((registration) => registration.update()),
    );
    const cacheKeys = (await caches?.keys?.()) || [];
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith("hero4e-mobile-"))
        .map((key) => caches.delete(key)),
    );
    const url = new URL(location.href);
    url.searchParams.set("refresh", Date.now());
    location.replace(url);
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = "Refresh app";
    toast(`Refresh failed: ${error.message}`);
  }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
setupSheetPages();
renderLibrary();
