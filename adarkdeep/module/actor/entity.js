import { OseDice } from "../dice.js";
import { OseItem } from "../item/entity.js";

export class OseActor extends Actor {
  /**
   * Extends data from base Actor class
   */

  prepareData() {
    super.prepareData();
    const data = this.data.data;

    // Compute modifiers from actor scores
    this.computeModifiers();
    this._isSlow();
    this.computeAC();
    this.computeEncumbrance();
    this.computeTreasure();
	this.computeExperienceReward();

    // Determine Initiative
    if (game.settings.get("adarkdeep", "initiative") != "group") {
      data.initiative.value = data.initiative.mod;
      if (this.data.type == "character") {
        data.initiative.value += data.scores.dex.init;
      }
    } else {
      data.initiative.value = 0;
    }
    data.movement.encounter = Math.floor(data.movement.base * 3 / 10);
  }

  async modifyTokenAttribute(attribute, value, isDelta=false, isBar=true) {
    const current = foundry.utils.getProperty(this.data.data, attribute);

    // Determine the updates to make to the actor data
    let updates;
    if ( isBar ) {
      if (isDelta) value = Math.clamped(-10, Number(current.value) + value, current.max);
      updates = {[`data.${attribute}.value`]: value};
    } else {
      if ( isDelta ) value = Number(current) + value;
      updates = {[`data.${attribute}`]: value};
    }
  
    /**
     * A hook event that fires when a token's resource bar attribute has been modified.
     * @function modifyTokenAttribute
     * @memberof hookEvents
     * @param {object} data           An object describing the modification
     * @param {string} data.attribute The attribute path
     * @param {number} data.value     The target attribute value
     * @param {boolean} data.isDelta  Whether the number represents a relative change (true) or an absolute change (false)
     * @param {boolean} data.isBar    Whether the new value is part of an attribute bar, or just a direct value
     * @param {objects} updates       The update delta that will be applied to the Token's actor
     */
    const allowed = Hooks.call("modifyTokenAttribute", {attribute, value, isDelta, isBar}, updates);
    return allowed !== false ? this.update(updates) : this;
  }
  
  static async update(data, options = {}) {
    // Compute AAC from AC
    if (data.data?.ac?.value) {
      data.data.aac = { value: 19 - data.data.ac.value };
    } else if (data.data?.aac?.value) {
      data.data.ac = { value: 19 - data.data.aac.value };
    }

    // Compute Thac0 from BBA
    if (data.data?.thac0?.value) {
      data.data.thac0.bba = 19 - data.data.thac0.value;
    } else if (data.data?.thac0?.bba) {
      data.data.thac0.value = 19 - data.data.thac0.bba;
    }

    super.update(data, options);
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.map((item) => {
      if (item.img === undefined) {
        item.img = OseItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  getExperience(value, options = {}) {
    if (this.data.type != "character") {
      return;
    }
	let value_1 = Math.floor (value * this.data.data.details.xp.share / 100);
	let value_2 = Math.floor (value * this.data.data.details.xp2.share / 100);
	let value_3 = Math.floor (value * this.data.data.details.xp3.share / 100);	
    let modified_1 = Math.floor(
      value_1 + (this.data.data.details.xp.bonus * value_1) / 100
    );
    let modified_2 = Math.floor(
      value_2 + (this.data.data.details.xp2.bonus * value_2) / 100
    );
    let modified_3 = Math.floor(
      value_3 + (this.data.data.details.xp3.bonus * value_3) / 100
    );
	let modified = modified_1 + modified_2 + modified_3;
    return this.update({
      "data.details.xp.value": modified_1 + this.data.data.details.xp.value,
	  "data.details.xp2.value": modified_2 + this.data.data.details.xp2.value,
	  "data.details.xp3.value": modified_3 + this.data.data.details.xp3.value,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        content: game.i18n.format("ADARKDEEP.messages.GetExperience", {
          name: this.name,
          value: modified,
        }),
        speaker,
      });
    });
  }

  isNew() {
    const data = this.data.data;
    if (this.data.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.data.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    }
  }

  generateSave(hd) {
    let saves = {};
    for (let i = 0; i <= hd; i++) {
      let tmp = CONFIG.ADARKDEEP.monster_saves[i];
      if (tmp) {
        saves = tmp;
      }
    }
    // Compute Thac0
    let thac0 = 20;
    Object.keys(CONFIG.ADARKDEEP.monster_thac0).forEach((k) => {
      if (parseInt(hd) < parseInt(k)) {
        return;
      }
      thac0 = CONFIG.ADARKDEEP.monster_thac0[k];
    });
    this.update({
      "data.thac0.value": thac0,
      "data.saves": {
        death: {
          value: saves.d,
        },
        wand: {
          value: saves.w,
        },
        paralysis: {
          value: saves.p,
        },
        breath: {
          value: saves.b,
        },
        spell: {
          value: saves.s,
        },
      },
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  rollHP(options = {}) {
    let roll = new Roll(this.data.data.hp.hd).roll({ async: false });
    return this.update({
      data: {
        hp: {
          max: roll.total,
          value: roll.total,
        },
      },
    });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.saves.${save}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this.data,
      roll: {
        type: "above",
        target: this.data.data.saves[save].value,
        magic:
          this.data.type === "character" ? this.data.data.scores.wis.mod : 0,
      },
      details: game.i18n.format("ADARKDEEP.roll.details.save", { save: label }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    const rollMethod =
      this.data.type == "character" ? OseDice.RollSave : OseDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ADARKDEEP.roll.save", { save: label }),
      title: game.i18n.format("ADARKDEEP.roll.save", { save: label }),
      chatMessage: options.chatMessage,
    });
  }
  
  rollMoraleResult(options = {}) {
    const rollParts = ["1d20"];

    const data = {
      actor: this.data,
      roll: {
        type: "table",
        table: {
          1: game.i18n.format("ADARKDEEP.morale.FightingRetreat", {
            name: this.data.name,
          }),
          4: game.i18n.format("ADARKDEEP.morale.GeneralRetreat", {
            name: this.data.name,
          }),
          7: game.i18n.format("ADARKDEEP.morale.DisarrayRetreat", {
            name: this.data.name,
          }),
          11: game.i18n.format("ADARKDEEP.morale.Surrender", {
            name: this.data.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ADARKDEEP.reaction.check"),
      title: game.i18n.localize("ADARKDEEP.reaction.check"),
    });
  }

  rollMorale(options = {}) {
    const rollParts = [`1d20+${this.data.data.details.morale}`];

    const data = {
      actor: this.data,
      roll: {
        type: "above",
        target: 10,
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return OseDice.Roll({	
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ADARKDEEP.roll.morale"),
      title: game.i18n.localize("ADARKDEEP.roll.morale"),
    });
  }

  rollLoyalty(options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.roll.loyalty`);
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.retainer.loyalty,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["1d100"];

    const data = {
      actor: this.data,
      roll: {
        type: "table",
        table: {
          1: game.i18n.format("ADARKDEEP.reaction.Attack", {
            name: this.data.name,
          }),
          6: game.i18n.format("ADARKDEEP.reaction.Hostile", {
            name: this.data.name,
          }),
          26: game.i18n.format("ADARKDEEP.reaction.Negative", {
            name: this.data.name,
          }),
          37: game.i18n.format("ADARKDEEP.reaction.Neutral", {
            name: this.data.name,
          }),
          65: game.i18n.format("ADARKDEEP.reaction.Positive", {
            name: this.data.name,
          }),
          76: game.i18n.format("ADARKDEEP.reaction.Friendly", {
            name: this.data.name,
          }),
          96: game.i18n.format("ADARKDEEP.reaction.Accepting", {
            name: this.data.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ADARKDEEP.reaction.check"),
      title: game.i18n.localize("ADARKDEEP.reaction.check"),
    });
  }

  rollMRCheck(score, options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.magicresistance.long`);
    const rollParts = ["1d100"];

    const data = {
      actor: this.data,
      roll: {
        type: "mrcheck",
        target: this.data.data.details.magicresist0level*5,
      },

      details: game.i18n.format("ADARKDEEP.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ADARKDEEP.roll.attribute", { attribute: label }),
      title: game.i18n.format("ADARKDEEP.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }
  
  rollCheck(score, options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this.data,
      roll: {
        type: "check",
        target: this.data.data.scores[score].value,
      },

      details: game.i18n.format("ADARKDEEP.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ADARKDEEP.roll.attribute", { attribute: label }),
      title: game.i18n.format("ADARKDEEP.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollHitDice(options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.roll.hd`);
    const rollParts = [this.data.data.hp.hd];
    if (this.data.type == "character") {
      rollParts.push(this.data.data.scores.con.mod);
    }

    const data = {
      actor: this.data,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check == "wilderness") {
      rollParts.push(this.data.data.details.appearing.w);
      label = "(2)";
    } else {
      rollParts.push(this.data.data.details.appearing.d);
      label = "(1)";
    }
    const data = {
      actor: this.data,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ADARKDEEP.roll.appearing", { type: label }),
      title: game.i18n.format("ADARKDEEP.roll.appearing", { type: label }),
    });
  }

  rollExploration(expl, options = {}) {
    const label = game.i18n.localize(`ADARKDEEP.exploration.${expl}.long`);
    const rollParts = ["1d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.exploration[expl],
        blindroll: true,
      },
      details: game.i18n.format("ADARKDEEP.roll.details.exploration", {
        expl: label,
      }),
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ADARKDEEP.roll.exploration", { exploration: label }),
      title: game.i18n.format("ADARKDEEP.roll.exploration", { exploration: label }),
    });
  }

  rollDamage(attData, options = {}) {
    const data = this.data.data;

    const rollData = {
      actor: this.data,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    let dmgParts = [];
    if (!attData.roll.dmg) {
      dmgParts.push("1d6");
    } else {
      dmgParts.push(attData.roll.dmg);
    }

    // Add Str to damage
    if (attData.roll.type == "melee") {
      dmgParts.push(data.scores.str.dmg);
    }

    // Damage roll
    OseDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("ADARKDEEP.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("ADARKDEEP.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (let t of game.user.targets.values()) {
        data.roll.target = t;
        await this.rollAttack(data, {
          type: type,
          skipDialog: options.skipDialog,
        });
      }
    } else {
      this.rollAttack(data, { type: type, skipDialog: options.skipDialog });
    }
  }

  rollAttack(attData, options = {}) {
    const data = this.data.data;
    const rollParts = ["1d20"];
    const dmgParts = [];
	let descri = "";
    let label = game.i18n.format("ADARKDEEP.roll.attacks", {
      name: this.data.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
	  descri = attData.item.data.description;
      label = game.i18n.format("ADARKDEEP.roll.attacksWith", {
        name: attData.item.name,
      });
      dmgParts.push(attData.item.data.damage);
    }

//    let ascending = game.settings.get("adarkdeep", "ascendingAC");
	let ascending = false;
    if (ascending) {
      rollParts.push(data.thac0.bba.toString());
    }
	if (attData.item && !attData.item.data.proficient) {
	  rollParts.push(data.details.nonprofpenalty.toString()
	  );
	}
    if (options.type == "missile") {
      rollParts.push(
        data.scores.dex.missile.toString(),
        data.thac0.mod.missile.toString()
      );
    } else if (options.type == "melee") {
      rollParts.push(
        data.scores.str.tohit.toString(),
        data.thac0.mod.melee.toString()
      );
    }
    if (attData.item && attData.item.data.bonus) {
      rollParts.push(attData.item.data.bonus);
    }
    let thac0 = data.thac0.value;
	let hitbase = data.achitby20.value;
    if (options.type == "melee") {
      dmgParts.push(data.scores.str.dmg);
    }
    const rollData = {
      actor: this.data,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
		hitbase: hitbase,
        dmg: dmgParts,
        save: attData.roll.save,
        target: attData.roll.target,
		description: descri,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.floor(parseInt(amount) * multiplier);
    const hp = this.data.data.hp;

    // Remaining goes to health
    const dh = Math.clamped(hp.value - amount, 0, hp.max);

    // Update the Actor
    return this.update({
      "data.hp.value": dh,
    });
  }

  static _valueFromTable(table, val) {
    let output;
    for (let i = 0; i <= val; i++) {
      if (table[i] != undefined) {
        output = table[i];
      }
    }
    return output;
  }

  _isSlow() {
    this.data.data.isSlow = ![...this.data.items.values()].every((item) => {
      if (
        item.type !== "weapon" ||
        !item.data.data.slow ||
        !item.data.data.equipped
      ) {
        return true;
      }
      return false;
    });
  }

  computeEncumbrance() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;
    let option = game.settings.get("adarkdeep", "encumbranceOption");
    const items = [...this.data.items.values()];
    // Compute encumbrance
    const hasItems = items.every((item) => {
      return item.type != "item" && !item.data.treasure;
    });

    let totalWeight = items.reduce((acc, item) => {
      if (
        item.type === "item" &&
        (["complete", "disabled"].includes(option) || item.data.data.treasure)
      ) {
        return acc + item.data.data.quantity.value * item.data.data.weight;
      }
      if (["weapon", "armor", "container"].includes(item.type) && option !== "basic") {
        return acc + item.data.data.weight;
      }
      return acc;
    }, 0);

    if (option === "detailed" && hasItems) totalWeight += 80;

    const max =
      option === "basic"
        ? game.settings.get("adarkdeep", "significantTreasure")
        : data.encumbrance.max;

    let steps = ["detailed", "complete"].includes(option)
      ? [(100 * 400) / max, (100 * 600) / max, (100 * 800) / max]
      : [];

    data.encumbrance = {
      pct: Math.clamped((100 * parseFloat(totalWeight)) / max, 0, 100),
      max: max,
      encumbered: totalWeight > data.encumbrance.max,
      value: totalWeight,
      steps: steps,
    };

    if (data.config.movementAuto && option != "disabled") {
      this._calculateMovement();
    }
  }

  _calculateMovement() {
    const data = this.data.data;
    let option = game.settings.get("adarkdeep", "encumbranceOption");
    let weight = data.encumbrance.value;
    let delta = data.encumbrance.max - 1600;
    if (["detailed", "complete"].includes(option)) {
      if (weight > data.encumbrance.max) {
        data.movement.base = 0;
      } else if (weight > 800 + delta) {
        data.movement.base = 30;
      } else if (weight > 600 + delta) {
        data.movement.base = 60;
      } else if (weight > 400 + delta) {
        data.movement.base = 90;
      } else {
        data.movement.base = 120;
      }
    } else if (option == "basic") {
      const armors = this.data.items.filter((i) => i.type == "armor");
      let heaviest = 0;
      armors.forEach((a) => {
        if (a.data.equipped) {
          if (a.data.type == "light" && heaviest == 0) {
            heaviest = 1;
          } else if (a.data.type == "heavy") {
            heaviest = 2;
          }
        }
      });
      switch (heaviest) {
        case 0:
          data.movement.base = 120;
          break;
        case 1:
          data.movement.base = 90;
          break;
        case 2:
          data.movement.base = 60;
          break;
      }
      if (weight > game.settings.get("adarkdeep", "significantTreasure")) {
        data.movement.base -= 30;
      }
    }
  }

  computeTreasure() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;
    // Compute treasure
    let total = 0;
    let treasure = this.data.items.filter(
      (i) => i.type == "item" && i.data.data.treasure
    );
    treasure.forEach((item) => {
      total += item.data.data.quantity.value * item.data.data.cost;
    });
    data.treasure = Math.round(total * 100) / 100.0;
  }

  computeExperienceReward() {
    if (this.data.type != "monster") {
      return;
    }
    const data = this.data.data;
    // Compute treasure
    let total = 0;
    let experienceCalc = data.details.xp.compbase + data.details.xp.comphpmult*data.hp.max;
    data.details.xp.value = experienceCalc;
  }

  computeAC() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

    // Compute AC
    let baseAc = 10;
    let AcShield = 0;

    data.ac.naked = (baseAc + data.scores.dex.acadj)>10?10:(baseAc + data.scores.dex.acadj);
    const armors = this.data.items.filter((i) => i.type == "armor");
    armors.forEach((a) => {
      const armorData = a.data.data;
      if (!armorData.equipped) return;
      if (armorData.isShield) {
        AcShield = 1 + armorData.bonus;
        return
      }
      if (baseAc >= armorData.ac - armorData.bonus) {
		baseAc = armorData.ac - armorData.bonus;
	  }
    });
    data.ac.value = baseAc + data.scores.dex.acadj - AcShield - data.ac.mod;
	if (data.ac.value > 10) {
		data.ac.value = 10
	}
	if (data.ac.value < -10) {
		data.ac.value = -10
	}
    data.ac.shield = AcShield;
  }

  computeModifiers() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

    const standard = {
      0: -5,
	  2: -4,
      3: -3,
      4: -2,
      6: -1,
      8: 0,
      13: 1,
      16: 2,
      18: 3,
    };
// define strength bonuses
    const strtohit = {
      0: -5,
	  2: -4,
      3: -3,
      4: -2,
      6: -1,
      8: 0,
	  17: 1,
      19: 3,
      21: 4,
      23: 5,
	  24: 6,
	  25: 7,
    };
    const xstrtohit = {
      0: 2,
	  1: 0,
      51: 1,
    };
    const strdmg = {
      0: -2,
	  3: -1,
      6: 0,
      16: 1,
      18: 2,
      19: 7,
      20: 8,
      21: 9,
      22: 10,
	  23: 11,
	  24: 12,
	  25: 14,
    };
    const xstrdmg = {
      0: 4,
	  1: 1,
      76: 2,
	  91: 3,
    };
    const strwt = {
      0: -55,
	  2: -45,
	  3: -35,
	  4: -25,
      6: -15,
	  8: 0,
	  12: 10,
	  14: 20,
      16: 35,
	  17: 50,
      18: 75,
      19: 450,
      20: 500,
      21: 600,
      22: 750,
	  23: 900,
	  24: 1200,
	  25: 1500,
    };
    const xstrwt = {
      0: 225,
	  1: 25,
	  51: 50,
      76: 75,
	  91: 125,
    };
    const strstuckchance = {
      0: 0,
	  3: 1,
	  8: 2,
	  16: 3,
      19: 7,
	  21: 9,
	  23: 11,
	  25: 22,
    };
    const xstrstuck = {
      0: 2,
	  1: 0,
	  51: 1,
    };
    const strstuckdie = {
      0: 6,
	  19: 8,
	  21: 10,
	  23: 12,
      25: 24,
    };
    const strlockchance = {
      0: 0,
	  19: 3,
	  21: 4,
	  23: 5,
      24: 7,
	  25: 9,
    };
    const xstrlock = {
      0: 2,
	  1: 0,
	  91: 1,
    };
    const strlockdie = {
      0: 6,
	  24: 8,
	  25: 10,
    };
    const strbend = {
      0: 0,
	  8: 1,
	  10: 2,
	  12: 4,
      14: 7,
	  16: 10,
	  17: 13,
	  18: 16,
      19: 50,
	  20: 60,
      21: 70,
      22: 80,
      23: 90,
      24: 100,
    };
    const xstrbend = {
      0: 24,
	  1: 4,
	  51: 9,
      76: 14,
	  91: 19,
    };
// compute strength bonuses
    data.scores.str.mod = OseActor._valueFromTable(
      standard,
      data.scores.str.value
    );
    data.scores.str.tohit = (OseActor._valueFromTable(
      strtohit,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrtohit,
      parseInt(data.scores.str.except)
    ):0);
    data.scores.str.dmg = (OseActor._valueFromTable(
      strdmg,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrdmg,
      parseInt(data.scores.str.except)
    ):0);
    data.scores.str.weight = (OseActor._valueFromTable(
      strwt,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrwt,
      parseInt(data.scores.str.except)
    ):0);
    data.scores.str.stuckdoorchance = (OseActor._valueFromTable(
      strstuckchance,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrstuck,
      parseInt(data.scores.str.except)
    ):0);
    data.scores.str.stuckdoordie = (OseActor._valueFromTable(
      strstuckdie,
      data.scores.str.value
    ));
    data.scores.str.lockdoorchance = (OseActor._valueFromTable(
      strlockchance,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrlock,
      parseInt(data.scores.str.except)
    ):0);
    data.scores.str.lockdoordie = (OseActor._valueFromTable(
      strlockdie,
      data.scores.str.value
    ));
    data.scores.str.barsgates = (OseActor._valueFromTable(
      strbend,
      data.scores.str.value
    )) + ((data.scores.str.exenabled && (data.scores.str.value==18) ) ? OseActor._valueFromTable(
      xstrbend,
      parseInt(data.scores.str.except)
    ):0);
//define intelligence bonuses
    const intlang = {
      0: 0,
	  8: 1,
      10: 2,
      12: 3,
      14: 4,
      16: 5,
      17: 6,
      18: 7,
    };
    const intillus = {
      0: 0,
	  19: 1,
      20: 2,
      21: 3,
      22: 4,
      23: 5,
      24: 6,
      25: 7,
    };
// compute intelligence bonuses
    data.scores.int.mod = OseActor._valueFromTable(
      standard,
      data.scores.int.value
    );
    data.scores.int.maxlang = OseActor._valueFromTable(
      intlang,
      data.scores.int.value
    );
    data.scores.int.illusimmunlvl = OseActor._valueFromTable(
      intillus,
      data.scores.int.value
    );
//define wisdom bonuses
    const wismind = {
      0: -5,
	  2: -4,
      3: -3,
      4: -2,
      5: -1,
      8: 0,
      15: 1,
      16: 2,
	  17: 3,
	  18: 4,
    };
    const wisfail = {
      0: 100,
	  9: 20,
      10: 15,
      11: 10,
      12: 5,
      13: 0,
    };
    const wisenchant = {
      0: 0,
	  19: 1,
      20: 2,
      21: 3,
      22: 4,
      23: 5,
      24: 6,
      25: 7,
    };
//compute wisdom bonuses
    data.scores.wis.mod = OseActor._valueFromTable(
      standard,
      data.scores.wis.value
    );
    data.scores.wis.mindattackadj = OseActor._valueFromTable(
      wismind,
      data.scores.wis.value
    );
    data.scores.wis.spellfail = OseActor._valueFromTable(
      wisfail,
      data.scores.wis.value
    );
    data.scores.wis.enchantimmunlvl = OseActor._valueFromTable(
      wisenchant,
      data.scores.wis.value
    );
//define dexterity bonuses
    const dexinit = {
      0: 5,
	  2: 4,
      3: 3,
      4: 2,
      5: 1,
      6: 0,
      16: -1,
      17: -2,
	  18: -3,
	  21: -4,
	  24: -5,
    };
    const dexac = {
      0: 6,
	  2: 5,
      3: 4,
      4: 3,
      5: 2,
      6: 1,
	  7: 0,
      15: -1,
	  16: -2,
	  17: -3,
	  18: -4,
	  21: -5,
	  24: -6,
    };
//compute dexterity bonuses	
    data.scores.dex.mod = OseActor._valueFromTable(
      standard,
      data.scores.dex.value
    );
    data.scores.dex.init = OseActor._valueFromTable(
      dexinit,
      data.scores.dex.value
    );
    data.scores.dex.missile = 0 - OseActor._valueFromTable(
      dexinit,
      data.scores.dex.value
    );
    data.scores.dex.acadj = OseActor._valueFromTable(
      dexac,
      data.scores.dex.value
    );
//define constitution bonuses
    const conhp = {
      0: -4,
	  2: -3,
      3: -2,
      4: -1,
      7: 0,
      15: 1,
	  16: 2,
      17: 3,
	  18: 4,
	  19: 5,
	  21: 6,
	  24: 7,
    };
    const conshock = {
      0: 25,
	  2: 30,
      3: 35,
      4: 40,
      5: 45,
      6: 50,
	  7: 55,
	  8: 60,
	  9: 65,
	  10: 70,
	  11: 75,
	  12: 80,
	  13: 85,
	  14: 88,
	  15: 91,
	  16: 95,
	  17: 97,
	  18: 99,
    };
    const conress = {
      0: 30,
	  2: 35,
      3: 40,
      4: 45,
      5: 50,
      6: 55,
	  7: 60,
	  8: 65,
	  9: 70,
	  10: 75,
	  11: 80,
	  12: 85,
	  13: 90,
	  14: 92,
	  15: 94,
	  16: 96,
	  17: 98,
	  18: 100,
    };
//compute constitution bonuses
    data.scores.con.mod = OseActor._valueFromTable(
      standard,
      data.scores.con.value
    );
    data.scores.con.hpadj = (data.scores.con.limited && (data.scores.con.value>=16) ) ? 2: OseActor._valueFromTable(
      conhp,
      data.scores.con.value
    );
    data.scores.con.shock = OseActor._valueFromTable(
      conshock,
      data.scores.con.value
    );
    data.scores.con.ressur = OseActor._valueFromTable(
      conress,
      data.scores.con.value
    );
//declare charisma bonuses
    const chahench = {
      0: 0,
      3: 1,
      5: 2,
      7: 3,
      9: 4,
	  12: 5,
      14: 6,
	  15: 7,
	  16: 8,
	  17: 10,
	  18: 15,
	  19: 20,
	  20: 25,
	  21: 30,
	  22: 35,
	  23: 40,
	  24: 45,
	  25: 50,
    };
    const chamorale = {
      0: -8,
	  2: -7,
      3: -6,
      4: -5,
      5: -4,
      6: -3,
	  7: -2,
	  8: -1,
	  9: 0,
	  14: 1,
	  15: 3,
	  16: 4,
	  17: 6,
	  18: 8,
	  19: 10,
	  20: 12,
	  21: 14,
	  22: 16,
	  23: 18,
	  24: 20,
    };
    const chareaction = {
      0: -35,
	  2: -30,
      3: -25,
      4: -20,
      5: -15,
      6: -10,
	  7: -5,
	  8: 0,
	  13: 5,
	  14: 10,
	  15: 15,
	  16: 25,
	  17: 30,
	  18: 35,
	  19: 40,
	  20: 45,
	  21: 50,
	  22: 55,
	  23: 60,
	  24: 65,
	  25: 70,
    };
    data.scores.cha.mod = OseActor._valueFromTable(
      standard,
      data.scores.cha.value
    );
    data.scores.cha.henchmax = OseActor._valueFromTable(
      chahench,
      data.scores.cha.value
    );
    data.scores.cha.moraleadj = OseActor._valueFromTable(
      chamorale,
      data.scores.cha.value
    );
    data.scores.cha.reaction = OseActor._valueFromTable(
      chareaction,
      data.scores.cha.value
    );
    const capped = {
      0: -2,
      3: -2,
      4: -1,
      6: -1,
      9: 0,
      13: 1,
      16: 1,
      18: 2,
    };
///    data.scores.dex.init = OseActor._valueFromTable(
///      capped,
///      data.scores.dex.value
///    );
    data.scores.cha.npc = OseActor._valueFromTable(
      capped,
      data.scores.cha.value
    );
    data.scores.cha.retain = data.scores.cha.mod + 4;
    data.scores.cha.loyalty = data.scores.cha.mod + 7;

    const od = {
      0: 0,
      3: 1,
      9: 2,
      13: 3,
      16: 4,
      18: 5,
    };
    data.exploration.odMod = OseActor._valueFromTable(
      od,
      data.scores.str.value
    );

    const literacy = {
      0: "",
      3: "ADARKDEEP.Illiterate",
      6: "ADARKDEEP.LiteracyBasic",
      9: "ADARKDEEP.Literate",
    };
    data.languages.literacy = OseActor._valueFromTable(
      literacy,
      data.scores.int.value
    );

    const spoken = {
      0: "ADARKDEEP.NativeBroken",
      3: "ADARKDEEP.Native",
      13: "ADARKDEEP.NativePlus1",
      16: "ADARKDEEP.NativePlus2",
      18: "ADARKDEEP.NativePlus3",
    };
    data.languages.spoken = OseActor._valueFromTable(
      spoken,
      data.scores.int.value
    );
  }
}
