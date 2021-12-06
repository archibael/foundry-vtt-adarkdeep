// Import Modules
import { OseItemSheet } from "./module/item/item-sheet.js";
import { OseActorSheetCharacter } from "./module/actor/character-sheet.js";
import { OseActorSheetMonster } from "./module/actor/monster-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { OseActor } from "./module/actor/entity.js";
import { OseItem } from "./module/item/entity.js";
import { ADARKDEEP } from "./module/config.js";
import { registerSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import * as chat from "./module/chat.js";
import * as treasure from "./module/treasure.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import { OseCombat } from "./module/combat.js";
import * as renderList from "./module/renderList.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d10 + @initiative.value",
    decimals: 2,
  };

  CONFIG.ADARKDEEP = ADARKDEEP;

  game.adarkdeep = {
    rollItemMacro: macros.rollItemMacro,
  };

  // Custom Handlebars helpers
  registerHelpers();

  // Register custom system settings
  registerSettings();

  CONFIG.Actor.documentClass = OseActor;
  CONFIG.Item.documentClass = OseItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("adarkdeep", OseActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
    label: "ADARKDEEP.SheetClassCharacter"
  });
  Actors.registerSheet("adarkdeep", OseActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
    label: "ADARKDEEP.SheetClassMonster"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("adarkdeep", OseItemSheet, {
    makeDefault: true,
    label: "ADARKDEEP.SheetClassItem"
  });

  await preloadHandlebarsTemplates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = ["saves_short", "saves_long", "scores", "scores_short", "armor", "colors", "tags"];
  for (let o of toLocalize) {
    CONFIG.ADARKDEEP[o] = Object.entries(CONFIG.ADARKDEEP[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }

  // Custom languages
  const languages = game.settings.get("adarkdeep", "languages");
  if (languages != "") {
    const langArray = languages.split(',');
    langArray.forEach((l, i) => langArray[i] = l.trim())
    CONFIG.ADARKDEEP.languages = langArray;
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) =>
    macros.createOseMacro(data, slot)
  );
});

// License and KOFI infos
Hooks.on("renderSidebarTab", async (object, html) => {
  if (object instanceof ActorDirectory) {
    party.addControl(object, html);
  }
  if (object instanceof Settings) {
    let gamesystem = html.find("#game-details");
    // SRD Link
    let adarkdeep = gamesystem.find('h4').last();
    adarkdeep.append(` <sub><a href="https://oldschoolessentials.necroticgnome.com/srd/index.php">SRD<a></sub>`);

    // License text
    const template = "systems/adarkdeep/templates/chat/license.html";
    const rendered = await renderTemplate(template);
    gamesystem.find(".system").append(rendered);

    // User guide
    let docs = html.find("button[data-action='docs']");
    const styling = "border:none;margin-right:2px;vertical-align:middle;margin-bottom:5px";
    $(`<button data-action="userguide"><img src='systems/adarkdeep/assets/dragon.png' width='16' height='16' style='${styling}'/>Old School Guide</button>`).insertAfter(docs);
    html.find('button[data-action="userguide"]').click(ev => {
      new FrameViewer('https://mesfoliesludiques.gitlab.io/foundryvtt-ose', { resizable: true }).render(true);
    });
  }
});

Hooks.on("preCreateCombatant", (combat, data, options, id) => {
  let init = game.settings.get("adarkdeep", "initiative");
  if (init == "group") {
    OseCombat.addCombatant(combat, data, options, id);
  }
});

Hooks.on("updateCombatant", OseCombat.updateCombatant);
Hooks.on("renderCombatTracker", OseCombat.format);
Hooks.on("preUpdateCombat", OseCombat.preUpdateCombat);
Hooks.on("getCombatTrackerEntryContext", OseCombat.addContextEntry);

Hooks.on("renderChatLog", (app, html, data) => OseItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessage", chat.addChatMessageButtons);
Hooks.on("renderRollTableConfig", treasure.augmentTable);
Hooks.on("updateActor", party.update);

Hooks.on("renderCompendium", renderList.RenderCompendium);
Hooks.on("renderSidebarDirectory", renderList.RenderDirectory);