export class OsePartyXP extends FormApplication {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["adarkdeep", "dialog", "party-xp"],
            template: "systems/adarkdeep/templates/apps/party-xp.html",
            width: 300,
            height: "auto",
            resizable: false,
        });
    }

    /* -------------------------------------------- */

    /**
     * Add the Entity name into the window title
     * @type {String}
     */
    get title() {
        return game.i18n.localize("ADARKDEEP.dialog.xp.deal");
    }

    /* -------------------------------------------- */

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @return {Object}
     */
    getData() {
        const actors = this.object.documents.filter(e => e.data.type === "character" && e.data.flags.adarkdeep && e.data.flags.adarkdeep.party === true);
        let data = {
            actors: actors,
            data: this.object,
            config: CONFIG.ADARKDEEP,
            user: game.user,
            settings: settings
        };
        return data;
    }

    _onDrop(event) {
        event.preventDefault();
        // WIP Drop Item Quantity
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
            if (data.type !== "Item") return;
        } catch (err) {
            return false;
        }
    }
    /* -------------------------------------------- */

    _calculateShare(ev) {
        const actors = this.object.documents.filter(e => e.data.type === "character" && e.data.flags.adarkdeep && e.data.flags.adarkdeep.party === true);
        const toDeal = $(ev.currentTarget.parentElement).find('input[name="total"]').val();
        const html = $(this.form);
        const value = parseFloat(toDeal) / actors.length;
        actors.forEach(a => {
            html.find(`li[data-actor-id='${a.id}'] input`).val(Math.floor((a.data.data.details.xp.share + a.data.data.details.xp2.share + a.data.data.details.xp3.share) / 100 * value));
        })
    }

    _dealXP(ev) {
        const html = $(this.form);
        const rows = html.find('.actor');
        rows.each((_, row) => {
            const qRow = $(row);
            const value = qRow.find('input').val();
            const id = qRow.data('actorId');
            const actor = this.object.documents.find(e => e.id === id);
            if (value) {
                actor.getExperience(Math.floor(parseInt(value)));
            }
        })
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        html
            .find('button[data-action="calculate-share"')
            .click(this._calculateShare.bind(this));
        html
            .find('button[data-action="deal-xp"')
            .click(this._dealXP.bind(this));
    }
}
