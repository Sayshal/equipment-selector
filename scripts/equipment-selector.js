import { EquipmentSelector } from './equipment-selector-app.js';

// Initialize module
Hooks.once('init', () => {
  console.log('Equipment Selector | Initializing module');
});

// Register when Hero Mancer is ready
Hooks.once('heroMancer.Ready', () => {
  console.log('Equipment Selector | Hero Mancer API detected');

  // Register module API
  game.modules.get('equipment-selector').api = {
    open: (actor) => {
      if (!actor) {
        ui.notifications.error('No actor provided');
        return null;
      }
      const selector = new EquipmentSelector(actor);
      selector.render(true);
      return selector;
    }
  };
});

// Add equipment selector button to character sheets
Hooks.on('renderActorSheet5e', (app, html, data) => {
  if (app.actor.type !== 'character') return;

  const currencySection = html.find('section.currency');

  if (currencySection.length === 0) {
    console.log('Equipment Selector | Could not find currency section');
    return;
  }

  // Create a button similar to the currency manager button
  const equipButton = $(`
    <button type="button" class="item-action unbutton equipment-selector-btn"
            data-action="equipment-selector"
            data-tooltip="Select Equipment"
            aria-label="Select Equipment">
      <i class="fas fa-shopping-bag"></i>
    </button>
  `);

  // Insert after the first button in the currency section
  currencySection.find('button').first().after(equipButton);

  // Add click handler
  equipButton.click((ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (heroMancer) {
      const selector = new EquipmentSelector(app.actor);
      selector.render(true);
    } else {
      ui.notifications.error('Hero Mancer not available');
    }
  });
});
