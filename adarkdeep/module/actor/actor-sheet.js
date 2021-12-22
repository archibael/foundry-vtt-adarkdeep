import { OseActor } from "./entity.js";
import { OseEntityTweaks } from "../dialog/entity-tweaks.js";

export class OseActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
  }
  /* -------------------------------------------- */

  getData() {
    const data = foundry.utils.deepClone(super.getData().data);
    data.owner = this.actor.isOwner;
    data.editable = this.actor.sheet.isEditable;

    data.config = {
      ...CONFIG.ADARKDEEP,
//      ascendingAC: game.settings.get("adarkdeep", "ascendingAC"),
      initiative: game.settings.get("adarkdeep", "initiative") != "group",
      encumbrance: game.settings.get("adarkdeep", "encumbranceOption")
    };
    data.isNew = this.actor.isNew();

    return data;
  }

  activateEditor(name, options, initialContent) {
    // remove some controls to the editor as the space is lacking
    if (name == "data.details.description") {
      options.toolbar = "styleselect bullist hr table removeFormat save";
    }
    super.activateEditor(name, options, initialContent);
  }

  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
      item = this.actor.items.get(li.data("item-id")),
      description = TextEditor.enrichHTML(item.data.data.description);

    // Toggle summary
    if (li.hasClass("expanded")) {
      let summary = li.parents(".item-entry").children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      // Add item tags
      let div = $(
        `<div class="item-summary"><ol class="tag-list">${item.getTags()}</ol><div>${description}</div></div>`
      );
      li.parents(".item-entry").append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  async _onSpellChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (event.target.dataset.field == "cast") {
      return item.update({ "data.cast": parseInt(event.target.value) });
    } else if (event.target.dataset.field == "memorize") {
      return item.update({
        "data.memorized": parseInt(event.target.value),
      });
    }
  }

  async _resetSpells(event) {
    let spells = $(event.currentTarget)
      .closest(".inventory.spells")
      .find(".item");
    spells.each((_, el) => {
      let itemId = el.dataset.itemId;
      const item = this.actor.items.get(itemId);
      item.update({
        _id: item.id,
        "data.cast": item.data.data.memorized,
      });
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Item summaries
    html
      .find(".item .item-name h4")
      .click((event) => this._onItemSummary(event));

    html.find(".item .item-controls .item-show").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.show();
    });

    html.find(".saving-throw .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let save = element.parentElement.parentElement.dataset.save;
      actorObject.rollSave(save, { event: ev });
    });

    html.find(".item .item-rollable .item-image").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item.type == "weapon") {
        if (this.actor.data.type === "monster") {
          item.update({
            data: { counter: { value: item.data.data.counter.value - 1 } },
          });
        }
        item.rollWeapon({ skipDialog: ev.ctrlKey });
      } else if (item.type == "spell") {
        item.spendSpell({ skipDialog: ev.ctrlKey });
      } else {
        item.rollFormula({ skipDialog: ev.ctrlKey });
      }
    });

    html.find(".attack a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let attack = element.parentElement.parentElement.dataset.attack;
      const rollData = {
        actor: this.data,
        roll: {},
      };
      actorObject.targetAttack(rollData, attack, {
        type: attack,
        skipDialog: ev.ctrlKey,
      });
    });

    html.find(".hit-dice .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollHitDice({ event: ev });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html
      .find(".memorize input")
      .click((ev) => ev.target.select())
      .change(this._onSpellChange.bind(this));


    html.find(".spells .item-reset[data-action='reset-spells']").click((ev) => {
      this._resetSpells(ev);
    });

    html.find(".item-entry .consumable-counter .empty-mark").click(ev => {
      const el = ev.currentTarget.parentElement.parentElement.children[0];
      const id = el.dataset.itemId;
      const item = this.actor.items.get(id);
      item.update({ "data.quantity.value": item.data.data.quantity.value + 1 });
    });

    html.find(".item-entry .consumable-counter .full-mark").click(ev => {
      const el = ev.currentTarget.parentElement.parentElement.children[0];
      const id = el.dataset.itemId;
      const item = this.actor.items.get(id);
      item.update({ "data.quantity.value": item.data.data.quantity.value - 1 });
    });
  }

  _onSortItem(event, itemData) {

    // Dragging items into a container
    const source = this.actor.items.get(itemData._id);
    const siblings = this.actor.items.filter(i => {
      return i.data._id !== source.data._id;
    });
    const dropTarget = event.target.closest("[data-item-id]");
    const targetId = dropTarget ? dropTarget.dataset.itemId : null;
    const target = siblings.find(s => s.data._id === targetId);
    
    if (target?.data.type == "container") {
      this.actor.updateEmbeddedDocuments("Item", [
        { _id: source.id, "data.containerId": target.id }
      ]);
      return;
    }
    if (itemData.data.containerId != "") {
      this.actor.updateEmbeddedDocuments("Item", [
        { _id: source.id, "data.containerId": "" }
      ]);
    }

    super._onSortItem(event, itemData);
  }

  // Override to set resizable initial size
  async _renderInner(...args) {
    const html = await super._renderInner(...args);
    this.form = html[0];

    // Resize resizable classes
    let resizable = html.find(".resizable");
    if (resizable.length == 0) {
      return;
    }
    resizable.each((_, el) => {
      let heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
    });
    return html;
  }

  async _onResize(event) {
    super._onResize(event);

    let html = $(this.form);
    let resizable = html.find(".resizable");
    if (resizable.length == 0) {
      return;
    }
    // Resize divs
    resizable.each((_, el) => {
      let heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
    });
    // Resize editors
    let editors = html.find(".editor");
    editors.each((id, editor) => {
      let container = editor.closest(".resizable-editor");
      if (container) {
        let heightDelta = this.position.height - this.options.height;
        editor.style.height = `${heightDelta + parseInt(container.dataset.editorSize)
          }px`;
      }
    });
  }

  _onConfigureActor(event) {
    event.preventDefault();
    new OseEntityTweaks(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Extend and override the sheet header buttons
   * @override
   */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    // Token Configuration
    const canConfigure = game.user.isGM || this.actor.owner;
    if (this.options.editable && canConfigure) {
      buttons = [
        {
          label: game.i18n.localize("ADARKDEEP.dialog.tweaks"),
          class: "configure-actor",
          icon: "fas fa-code",
          onclick: (ev) => this._onConfigureActor(ev),
        },
      ].concat(buttons);
    }
    return buttons;
  }
}
