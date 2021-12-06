export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        //Character Sheets
        'systems/adarkdeep/templates/actors/character-sheet.html',
        'systems/adarkdeep/templates/actors/monster-sheet.html',
        //Actor partials
        //Sheet tabs
        'systems/adarkdeep/templates/actors/partials/character-header.html',
        'systems/adarkdeep/templates/actors/partials/character-attributes-tab.html',
        'systems/adarkdeep/templates/actors/partials/character-abilities-tab.html',
        'systems/adarkdeep/templates/actors/partials/character-spells-tab.html',
        'systems/adarkdeep/templates/actors/partials/character-inventory-tab.html',
        'systems/adarkdeep/templates/actors/partials/character-notes-tab.html',
		'systems/adarkdeep/templates/actors/partials/character-skills-tab.html',


        'systems/adarkdeep/templates/actors/partials/monster-header.html',
        'systems/adarkdeep/templates/actors/partials/monster-attributes-tab.html'
    ];
    return loadTemplates(templatePaths);
};
