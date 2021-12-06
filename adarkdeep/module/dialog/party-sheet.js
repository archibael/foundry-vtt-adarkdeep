import { OsePartyXP } from "./party-xp.js";

export class OsePartySheet extends FormApplication {
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["adarkdeep", "dialog", "party-sheet"],
      template: "systems/adarkdeep/templates/apps/party-sheet.html",
      width: 280,
      height: 400,
      resizable: true,
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return game.i18n.localize("ADARKDEEP.dialog.partysheet");
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    const settings = {
      ascending: game.settings.get('adarkdeep', 'ascendingAC')
    };
    let data = {
      data: this.object,
      config: CONFIG.ADARKDEEP,
      user: game.user,
      settings: settings
    };
    return data;
  }

  _onDrop(event) {
    event.preventDefault();
    // WIP Drop Items
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }
  }
  /* -------------------------------------------- */

  async _dealXP(ev) {
    new OsePartyXP(this.object, {}).render(true);
  }

  async _selectActors(ev) {
    const entities = this.object.entities.sort((a, b) => b.data.token.disposition - a.data.token.disposition);
    const template = "/systems/adarkdeep/templates/apps/party-select.html";
    const templateData = {
      actors: entities
    }
    const content = await renderTemplate(template, templateData);
    new Dialog({
      title: game.i18n.localize("ADARKDEEP.dialog.partyselect"),
      content: content,
      buttons: {
        set: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize("ADARKDEEP.Update"),
          callback: async (html) => {
            let checks = html.find("input[data-action='select-actor']");
            await Promise.all(checks.map(async (_, c) => {
              let key = c.getAttribute('name');
              await this.object.entities[key].setFlag('adarkdeep', 'party', c.checked);
            }));
            this.render(true);
          },
        },
      },
    }, {
      height: "auto",
      width: 260,
      classes: ["adarkdeep", "dialog", "party-select"]
    })
    .render(true);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html
      .find(".item-controls .item-control .select-actors")
      .click(this._selectActors.bind(this));
    
      html.find(".item-controls .item-control .deal-xp").click(this._dealXP.bind(this));
    
    html.find("a.resync").click(() => this.render(true));

    html.find(".field-img button[data-action='open-sheet']").click((ev) => {
      let actorId = ev.currentTarget.parentElement.parentElement.parentElement.dataset.actorId;
      game.actors.get(actorId).sheet.render(true);
    })
  }
}
