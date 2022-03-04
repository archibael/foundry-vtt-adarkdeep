import { OseActor } from "./entity.js";
import { OseActorSheet } from "./actor-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class OseActorSheetMonster extends OseActorSheet {
  constructor(...args) {
    super(...args);
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["adarkdeep", "sheet", "monster", "actor"],
      template: "systems/adarkdeep/templates/actors/monster-sheet.html",
      width: 450,
      height: 560,
      resizable: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
    });
  }

  /**
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {
    const itemsData = this.actor.data.items;
    const containerContents = {};
    const attackPatterns = {};

    // Partition items by category
    let [items, armors, spells, containers] = itemsData.reduce(
      (arr, item) => {
        // Classify items into types
        const containerId = item?.data?.data?.containerId;
        if (containerId) {
          containerContents[containerId] = [...(containerContents[containerId] || []), item];
          return arr;
        }
        // Grab attack groups
        if (["weapon", "ability"].includes(item.type)) {
          if (attackPatterns[item.data.data.pattern] === undefined) attackPatterns[item.data.data.pattern] = [];
          attackPatterns[item.data.data.pattern].push(item);
          return arr;
        }
        // Classify items into types
        if (item.type === "item") arr[0].push(item);
        else if (item.type === "armor") arr[1].push(item);
        else if (item.type === "spell") arr[2].push(item);
        else if (item.type === "container") arr[3].push(item);
        return arr;
      },
      [[], [], [], []]
    );
    // Sort spells by level
    var sortedSpells = {};
    var slots = {};
    for (var i = 0; i < spells.length; i++) {
      let lvl = spells[i].data.data.lvl;
      if (!sortedSpells[lvl]) sortedSpells[lvl] = [];
      if (!slots[lvl]) slots[lvl] = 0;
      slots[lvl] += spells[i].data.data.memorized;
      sortedSpells[lvl].push(spells[i]);
    }
    data.slots = {
      used: slots,
    };
    containers.map((container, key, arr) => {
      arr[key].data.data.itemIds = containerContents[container.id] || [];
      arr[key].data.data.totalWeight = containerContents[container.id]?.reduce((acc, item) => {
        return acc + item.data?.data?.weight * (item.data?.data?.quantity?.value || 1);
      }, 0);
      return arr;
    });
    // Assign and return
    data.owned = {
      items: items,
      containers: containers,
      armors: armors,
    };
    data.attackPatterns = attackPatterns;
    data.spells = sortedSpells;
    [...Object.values(data.attackPatterns), ...Object.values(data.owned), ...Object.values(data.spells)].forEach(o => o.sort((a, b) => (a.data.sort || 0) - (b.data.sort || 0)));
  
  }

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData() {
    const data = super.getData();
    // Prepare owned items
    this._prepareItems(data);

    // Settings
    data.config.morale = game.settings.get("adarkdeep", "morale");
    data.data.details.treasure.link = TextEditor.enrichHTML(data.data.details.treasure.table);
    data.isNew = this.actor.isNew();
    return data;
  }

  /**
   * Monster creation helpers
   */
  async generateSave() {
    let choices = CONFIG.ADARKDEEP.monster_saves;

    let templateData = { choices: choices },
      dlg = await renderTemplate(
        "/systems/adarkdeep/templates/actors/dialogs/monster-saves.html",
        templateData
      );
    //Create Dialog window
    new Dialog({
      title: game.i18n.localize("ADARKDEEP.dialog.generateSaves"),
      content: dlg,
      buttons: {
        ok: {
          label: game.i18n.localize("ADARKDEEP.Ok"),
          icon: '<i class="fas fa-check"></i>',
          callback: (html) => {
            let hd = html.find('input[name="hd"]').val();
			let type = "monster";
            this.actor.generateSave(hd,type);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("ADARKDEEP.Cancel"),
        },
      },
      default: "ok",
    }, {
      width: 250
    }).render(true);
  }

  async _onDrop(event) {
    super._onDrop(event);
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (data.type !== "RollTable") return;
    } catch (err) {
      return false;
    }

    let link = "";
    if (data.pack) {
      let tableData = game.packs.get(data.pack).index.filter(el => el._id === data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${tableData[0].name}}`;
    } else {
      link = `@RollTable[${data.id}]`;
    }
    this.actor.update({ "data.details.treasure.table": link });
  }


  async _onDropItem(event, data) {
	super._onDropItem(event, data);
    if ( !this.actor.isOwner ) return false;
	const item = await Item.implementation.fromDropData(data);
	if (!(item.data.type == "race" || item.data.type == "class")) {
		const itemData = item.toObject();
    // Handle item sorting within the same Actor
		if ( await this._isFromSameActor(data) ) return this._onSortItem(event, itemData);
    // Create the owned item
		return this._onDropItemCreate(itemData);
	};
	if (item.data.type == "race" || item.data.type == "class") {
		if (this.actor.data.type == "character" && item.data.type == "class") {
			if (this.actor.data.details.nonprofpenalty < item.data.details.nonprof) {
				this.actor.data.details.nonprofpenalty = item.data.details.nonprof;
			}
			if (!this.actor.data.details.class) {
				this.actor.data.details.class = item.data.name;
				this.actor.data.details.savetable = item.data.details.savingthrowtable;
				this.actor.data.scores.str.exenabled = item.data.details.exceptstr;
				this.actor.data.scores.con.limited = item.data.details.conltd;
			} else if (!this.actor.data.details.class2) {
				this.actor.data.details.class2 = item.data.name;
				this.actor.data.details.savetable2 = item.data.details.savingthrowtable;
				if(!this.actor.data.scores.str.exenabled && !this.actor.data.details.dualclass) {
					this.actor.data.scores.str.exenabled = item.data.details.exceptstr;
				};
				if(this.actor.data.scores.con.limited && !this.actor.data.details.dualclass) {
					this.actor.data.scores.con.limited = item.data.details.conltd;
				};
			} else if (!this.actor.data.details.class3) {
				this.actor.data.details.class3 = item.data.name;
				this.actor.data.details.savetable3 = item.data.details.savingthrowtable;
				if(!this.actor.data.scores.str.exenabled) {
					this.actor.data.scores.str.exenabled = item.data.details.exceptstr;
				};
				if(this.actor.data.scores.con.limited) {
					this.actor.data.scores.con.limited = item.data.details.conltd;
				};
			}
		};
		if (this.actor.data.type == "character" && item.data.type == "race") {
			this.actor.data.details.race = item.data.name;
		};
		let tags = item.data.data.tags.split(',');
		let eData = {};
		let indexfields = {fields: ['name','img','type','data.requirements']};
		game.packs.get('adarkdeep.Racial Abilities').getIndex(indexfields);
		const raceAbilityArray = game.collections.get('Item').filter(el=> tags.some( (element) => el.data.data.requirements?.split(',').includes(element) ?? false  ));
		raceAbilityArray.forEach(e => {
			eData = e.toObject(); 
//			if ( await this._isFromSameActor(data) ) return this._onSortItem(event, eData);
			return this._onDropItemCreate(eData);
		});
	};
 	
  }

  /* -------------------------------------------- */

  async _chooseItemType(choices = ["weapon", "armor", "shield", "gear"]) {
    let templateData = { types: choices },
      dlg = await renderTemplate(
        "systems/adarkdeep/templates/items/entity-create.html",
        templateData
      );
    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("ADARKDEEP.dialog.createItem"),
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("ADARKDEEP.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                type: html.find('select[name="type"]').val(),
                name: html.find('input[name="name"]').val(),
              });
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("ADARKDEEP.Cancel"),
          },
        },
        default: "ok",
      }).render(true);
    });
  }

  async _resetAttacks(event) {
    const weapons = this.actor.data.items.filter(i => i.type === 'weapon');
    for (let wp of weapons) {
      const item = this.actor.items.get(wp.id);
      await item.update({
        data: {
          counter: {
            value: parseInt(wp.data.data.counter.max),
          },
        },
      });
    }
  }

  async _onCountChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (event.target.dataset.field == "value") {
      return item.update({
        "data.counter.value": parseInt(event.target.value),
      });
    } else if (event.target.dataset.field == "max") {
      return item.update({
        "data.counter.max": parseInt(event.target.value),
      });
    }
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".morale-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollMorale({ event: event });
    });

    html.find(".reaction-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollReaction({ event: event });
    });

    html.find(".appearing-check a").click((ev) => {
      let actorObject = this.actor;
      let check = $(ev.currentTarget).closest('.check-field').data('check');
      actorObject.rollAppearing({ event: event, check: check });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find(".item-delete").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      await this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.find(".item-create").click((event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const type = header.dataset.type;

      // item creation helper func
      let createItem = function (type, name = `New ${type.capitalize()}`) {
        const itemData = {
          name: name ? name : `New ${type.capitalize()}`,
          type: type,
          data: duplicate(header.dataset),
        };
        delete itemData.data["type"];
        return itemData;
      };

      // Getting back to main logic
      if (type == "choice") {
        const choices = header.dataset.choices.split(",");
        this._chooseItemType(choices).then((dialogInput) => {
          const itemData = createItem(dialogInput.type, dialogInput.name);
          this.actor.createEmbeddedDocuments("Item", [itemData], {});
        });
        return;
      }
      const itemData = createItem(type);
      return this.actor.createEmbeddedDocuments("Item", [itemData], {});
    });

    html.find(".item-reset[data-action='reset-attacks']").click((ev) => {
      this._resetAttacks(ev);
    });

    html
      .find(".counter input")
      .click((ev) => ev.target.select())
      .change(this._onCountChange.bind(this));

    html.find(".hp-roll").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollHP({ event: event });
    });

    html.find(".item-pattern").click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      let currentColor = item.data.data.pattern;
      let colors = Object.keys(CONFIG.ADARKDEEP.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      item.update({
        "data.pattern": colors[index]
      })
    });

    html.find('button[data-action="generate-saves"]').click(() => this.generateSave());
  }
}
