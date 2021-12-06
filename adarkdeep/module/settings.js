export const registerSettings = function () {

  game.settings.register("adarkdeep", "initiative", {
    name: game.i18n.localize("ADARKDEEP.Setting.Initiative"),
    hint: game.i18n.localize("ADARKDEEP.Setting.InitiativeHint"),
    default: "group",
    scope: "world",
    type: String,
    config: true,
    choices: {
      individual: "ADARKDEEP.Setting.InitiativeIndividual",
      group: "ADARKDEEP.Setting.InitiativeGroup",
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("adarkdeep", "rerollInitiative", {
    name: game.i18n.localize("ADARKDEEP.Setting.RerollInitiative"),
    hint: game.i18n.localize("ADARKDEEP.Setting.RerollInitiativeHint"),
    default: "reset",
    scope: "world",
    type: String,
    config: true,
    choices: {
      keep: "ADARKDEEP.Setting.InitiativeKeep",
      reset: "ADARKDEEP.Setting.InitiativeReset",
      reroll: "ADARKDEEP.Setting.InitiativeReroll",
    }
  });

  game.settings.register("adarkdeep", "ascendingAC", {
    name: game.i18n.localize("ADARKDEEP.Setting.AscendingAC"),
    hint: game.i18n.localize("ADARKDEEP.Setting.AscendingACHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    onChange: _ => window.location.reload()
  });

  game.settings.register("adarkdeep", "morale", {
    name: game.i18n.localize("ADARKDEEP.Setting.Morale"),
    hint: game.i18n.localize("ADARKDEEP.Setting.MoraleHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register("adarkdeep", "encumbranceOption", {
    name: game.i18n.localize("ADARKDEEP.Setting.Encumbrance"),
    hint: game.i18n.localize("ADARKDEEP.Setting.EncumbranceHint"),
    default: "detailed",
    scope: "world",
    type: String,
    config: true,
    choices: {
      disabled: "ADARKDEEP.Setting.EncumbranceDisabled",
      basic: "ADARKDEEP.Setting.EncumbranceBasic",
      detailed: "ADARKDEEP.Setting.EncumbranceDetailed",
      complete: "ADARKDEEP.Setting.EncumbranceComplete",
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("adarkdeep", "significantTreasure", {
    name: game.i18n.localize("ADARKDEEP.Setting.SignificantTreasure"),
    hint: game.i18n.localize("ADARKDEEP.Setting.SignificantTreasureHint"),
    default: 800,
    scope: "world",
    type: Number,
    config: true,
    onChange: _ => window.location.reload()
  });

  game.settings.register("adarkdeep", "languages", {
    name: game.i18n.localize("ADARKDEEP.Setting.Languages"),
    hint: game.i18n.localize("ADARKDEEP.Setting.LanguagesHint"),
    default: "",
    scope: "world",
    type: String,
    config: true,
    onChange: _ => window.location.reload()
  });
};
