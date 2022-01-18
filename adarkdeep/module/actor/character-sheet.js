import { OseActor } from "./entity.js";
import { OseActorSheet } from "./actor-sheet.js";
import { OseCharacterModifiers } from "../dialog/character-modifiers.js";
import { OseCharacterCreator } from "../dialog/character-creation.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class OseActorSheetCharacter extends OseActorSheet {
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
      classes: ["adarkdeep", "sheet", "actor", "character"],
      template: "systems/adarkdeep/templates/actors/character-sheet.html",
      width: 450,
      height: 530,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
      scrollY: [
        '.inventory'
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
    // Partition items by category
    let [containers, treasures, items, weapons, armors, abilities, spells, skills] = itemsData.reduce(
      (arr, item) => {
        // Classify items into types
        const containerId = item?.data?.data?.containerId;
        if (containerId) {
          containerContents[containerId] = [...(containerContents[containerId] || []), item];
        }
        else if (item.type === "container") arr[0].push(item);
        else if (item.type === "item" && item?.data?.data?.treasure) arr[1].push(item);
        else if (item.type === "item") arr[2].push(item);
        else if (item.type === "weapon") arr[3].push(item);
        else if (item.type === "armor") arr[4].push(item);
        else if (item.type === "ability") arr[5].push(item);
        else if (item.type === "spell") arr[6].push(item);
        else if (item.type === "skill") arr[7].push(item);
        return arr;
      },
      [[], [], [], [], [], [], [], []]
    );
    // Sort spells by level
    var sortedSpells = {};
    var slots = {};
    for (var i = 0; i < spells.length; i++) {
      const lvl = spells[i].data.data.lvl;
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
      armors: armors,
      weapons: weapons,
      treasures: treasures,
      containers: containers,
    };
    data.containers = containers;
    data.abilities = abilities;
	data.skills = skills;
    data.spells = sortedSpells;

    // Sort by sort order (see ActorSheet)
    [...Object.values(data.owned), ...Object.values(data.spells), data.abilities, data.skills].forEach(o => o.sort((a, b) => (a.data.sort || 0) - (b.data.sort || 0)));
  }

  generateScores() {
    new OseCharacterCreator(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData() {
    const data = super.getData();
    // Prepare owned items
    this._prepareItems(data);
    return data;
  }


  async _chooseLang() {
    let choices = CONFIG.ADARKDEEP.languages;

    let templateData = { choices: choices },
      dlg = await renderTemplate(
        "/systems/adarkdeep/templates/actors/dialogs/lang-create.html",
        templateData
      );
    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: "",
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("ADARKDEEP.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                choice: html.find('select[name="choice"]').val(),
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

  _pushLang(table) {
    const data = this.actor.data.data;
    let update = duplicate(data[table]);
    this._chooseLang().then((dialogInput) => {
      const name = CONFIG.ADARKDEEP.languages[dialogInput.choice];
      if (update.value) {
        update.value.push(name);
      } else {
        update = { value: [name] };
      }
      let newData = {};
      newData[table] = update;
      return this.actor.update({ data: newData });
    });
  }

  _popLang(table, lang) {
    const data = this.actor.data.data;
    let update = data[table].value.filter((el) => el != lang);
    let newData = {};
    newData[table] = { value: update };
    return this.actor.update({ data: newData });
  }

  /* -------------------------------------------- */

  async _onQtChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "data.quantity.value": parseInt(event.target.value) });
  }

  _onShowModifiers(event) {
    event.preventDefault();
    new OseCharacterModifiers(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

   async _onShowItemTooltip(event) {
    let templateData = {},
      dlg = await renderTemplate(
        "systems/adarkdeep/templates/actors/partials/character-item-tooltip.html",
        templateData
      );
      document.querySelector(".game").append(dlg);
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".item-square").hover((event) => {
      this._onShowItemTooltip(event);
    })

    html.find(".ability-score .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let score = element.parentElement.parentElement.dataset.score;
      let stat = element.parentElement.parentElement.dataset.stat;
      if (!score) {
        if (stat == "lr") {
          actorObject.rollMorale(score, { event: ev });
        }
      } else {
        actorObject.rollCheck(score, { event: ev });
      }
    });

    html.find(".exploration .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let expl = element.parentElement.parentElement.dataset.exploration;
      actorObject.rollExploration(expl, { event: ev });
    });

    html.find(".inventory .item-titles .item-caret").click((ev) => {
      let items = $(ev.currentTarget.parentElement.parentElement).children(
        ".item-list"
      );
      if (items.css("display") == "none") {
        let el = $(ev.currentTarget).find(".fas.fa-caret-right");
        el.removeClass("fa-caret-right");
        el.addClass("fa-caret-down");
        items.slideDown(200);
      } else {
        let el = $(ev.currentTarget).find(".fas.fa-caret-down");
        el.removeClass("fa-caret-down");
        el.addClass("fa-caret-right");
        items.slideUp(200);
      }
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      this._onShowModifiers(ev);
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
    html.find(".item-delete").click((ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      if (item.type == "container") {
        const updateData = item.data.data.itemIds.reduce((acc, val) => {
          acc.push({
            _id: val.id,
            "data.containerId": ""
          })
          return acc;
        }, []);
        this.actor.updateEmbeddedDocuments("Item", updateData).then(() => {
          this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
        });
        return;
      }
      this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
      $(li).slideUp(200, () => this.render(false));
    });

    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });

    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(
        table,
        $(ev.currentTarget).closest(".item").data("lang")
      );
    });

    html.find(".item-create").click((event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const type = header.dataset.type;
      const itemData = {
        name: `New ${type.capitalize()}`,
        type: type,
        data: duplicate(header.dataset),
      };
      delete itemData.data["type"];
      return this.actor.createEmbeddedDocuments("Item", [itemData]);
    });

    //Toggle Equipment
    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        data: {
          equipped: !item.data.data.equipped,
        },
      });
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change(this._onQtChange.bind(this));

    html.find("a[data-action='generate-scores']").click((ev) => {
      this.generateScores(ev);
    });
  }
}
