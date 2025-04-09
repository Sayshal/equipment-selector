/**
 * Equipment Selector - A standalone module for selecting character equipment
 * Integrates with HeroMancer API for equipment data and processing
 */

// Foundry application classes
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Equipment Selector Application
 * Displays a window for selecting equipment for a character based on class and background
 * @class
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class EquipmentSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @type {Actor} The actor this selector is for
   */
  actor = null;

  /**
   * @type {Object} Equipment parser instance from HeroMancer
   */
  parser = null;

  /**
   * @type {boolean} Whether this window is attached to the character sheet
   * @private
   */
  #isAttached = false;

  /**
   * @param {Actor} actor - The actor to select equipment for
   * @param {Object} options - Application options
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  /**
   * Default application options
   * @type {Object}
   * @static
   */
  static DEFAULT_OPTIONS = {
    id: 'equipment-selector-app',
    tag: 'form',
    form: {
      handler: EquipmentSelector.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    classes: ['equipment-selector'],
    position: {
      height: 'auto',
      width: 650
    },
    window: {
      icon: 'fas fa-shopping-bag',
      title: 'Equipment Selector',
      resizable: true,
      minimizable: true
    }
  };

  /**
   * Application template parts
   * @type {Object}
   * @static
   */
  static PARTS = {
    header: { template: 'modules/equipment-selector/templates/header.hbs', classes: ['equipment-selector-header'] },
    content: { template: 'modules/equipment-selector/templates/content.hbs', classes: ['equipment-selector-content'] },
    footer: { template: 'modules/equipment-selector/templates/footer.hbs', classes: ['equipment-selector-footer'] }
  };

  /**
   * @returns {string} The window title
   */
  get title() {
    return `Equipment Selector | ${this.actor?.name || 'Character'}`;
  }

  /**
   * Prepare base context data
   * @param {Object} _options - Render options
   * @returns {Object} Context data
   * @protected
   */
  _prepareContext(_options) {
    return { actor: this.actor, isGM: game.user.isGM };
  }

  /**
   * Prepare context data for specific template parts
   * @param {string} partId - ID of the template part
   * @param {Object} context - Base context
   * @returns {Object} Enhanced context
   * @protected
   */
  _preparePartContext(partId, context) {
    const classItem = this.actor.items.find((i) => i.type === 'class');
    const backgroundItem = this.actor.items.find((i) => i.type === 'background');

    switch (partId) {
      case 'header':
        context.actorImg = this.actor.img;
        context.className = classItem?.name || 'No Class';
        context.backgroundName = backgroundItem?.name || 'No Background';
        break;

      case 'footer':
        context.showAttachButton = true;
        context.isAttached = this.#isAttached;
        break;
    }

    return context;
  }

  /**
   * Initialize the UI when first rendered
   * @param {Object} _context - Prepared context data
   * @param {Object} _options - Render options
   * @protected
   */
  async _onFirstRender(_context, _options) {
    try {
      if (!heroMancer) {
        throw new Error('Hero Mancer API not found. Is the module active?');
      }

      // Initialize equipment parser
      this.parser = await heroMancer.initializeEquipmentSelector(this.actor);

      // Get and clear equipment container
      const equipmentContainer = this.element.querySelector('#equipment-container');
      if (!equipmentContainer) {
        throw new Error('Equipment container element not found');
      }
      equipmentContainer.innerHTML = '';

      // Render equipment UI in a temporary container first
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);
      await heroMancer.generateEquipmentUI(tempContainer, this.parser);

      // Move equipment choices to our container
      const equipmentChoices = tempContainer.querySelector('.equipment-choices');
      if (!equipmentChoices) {
        const globalEquipmentChoices = document.querySelector('.equipment-choices');
        if (globalEquipmentChoices) {
          equipmentContainer.appendChild(globalEquipmentChoices.cloneNode(true));
        } else {
          throw new Error('Could not find rendered equipment content');
        }
      } else {
        equipmentContainer.appendChild(equipmentChoices);
      }

      // Ensure sections have proper class names
      equipmentContainer.querySelectorAll('.equipment-choices > div').forEach((section) => {
        if (section.querySelector('h3')?.textContent.toLowerCase().includes('class')) {
          section.classList.add('class-equipment-section');
        } else if (section.querySelector('h3')?.textContent.toLowerCase().includes('background')) {
          section.classList.add('background-equipment-section');
        }
      });

      // Clean up and initialize behaviors
      document.body.removeChild(tempContainer);
      this.#initializeWealthCheckboxes();
      this.#attachEventListeners(equipmentContainer);

      // Position the window next to actor sheet
      this.#positionNextToSheet();
    } catch (error) {
      console.error('Equipment Selector | Error during initialization:', error);
      ui.notifications.error(`Equipment Selector Error: ${error.message}`);

      const equipmentContainer = this.element.querySelector('#equipment-container');
      if (equipmentContainer) {
        equipmentContainer.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            Error loading equipment options: ${error.message}
          </div>
        `;
      }
    }
  }

  /**
   * Position this window next to the actor sheet
   * @private
   */
  #positionNextToSheet() {
    try {
      // Find the actor sheet window by matching the actor ID
      const actorSheet = Object.values(ui.windows).find(
        (w) =>
          w.document?.id === this.actor.id && // Match by actor ID
          w.id !== this.id && // Not this window
          w.element?.length // Has a DOM element
      );

      if (!actorSheet || !actorSheet.element?.[0]) {
        console.log('Equipment Selector | Could not find actor sheet to position next to');
        return;
      }

      // Get positions
      const sheetRect = actorSheet.element[0].getBoundingClientRect();
      const myWidth = this.position.width;

      // Calculate position to the left of sheet
      const left = Math.max(10, sheetRect.left - myWidth - 10);

      // Update window position
      this.setPosition({
        left: left,
        top: sheetRect.top
      });
    } catch (error) {
      console.warn('Equipment Selector | Error positioning window:', error);
    }
  }

  /**
   * Attach event listeners to equipment elements
   * @param {HTMLElement} container - Container element
   * @private
   */
  #attachEventListeners(container) {
    // Checkboxes (except wealth)
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      if (checkbox.id.startsWith('use-starting-wealth')) return;
      checkbox.addEventListener('change', () => {});
    });

    // Dropdown selects
    container.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', () => {});
    });
  }

  /**
   * Initialize wealth checkbox listeners
   * @private
   */
  #initializeWealthCheckboxes() {
    this.element.querySelectorAll('input[id^="use-starting-wealth-"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const checked = event.currentTarget.checked;
        const sectionType = checkbox.id.includes('-class') ? 'class' : 'background';

        // Only select equipment items within the specific section
        const equipmentSection = this.element.querySelector(`.${sectionType}-equipment-section`);
        if (!equipmentSection) return;

        const equipmentItems = equipmentSection.querySelectorAll('.equipment-item');

        equipmentItems.forEach((item) => {
          item.classList.toggle('disabled', checked);
          item.querySelectorAll('select, input[type="checkbox"]').forEach((input) => {
            if (!input.classList.contains('equipment-favorite-checkbox')) {
              input.disabled = checked;
            }
          });
        });
      });
    });
  }

  /**
   * Processes selected favorites from the form
   * @param {Actor} actor - The actor to update
   * @param {HTMLElement} form - The form element
   * @param {Array<Item>} createdItems - Items created on the actor
   * @returns {Promise<void>}
   * @private
   */
  static async #processEquipmentFavorites(actor, form, createdItems) {
    const favoriteCheckboxes = form.querySelectorAll('.equipment-favorite-checkbox:checked');
    if (!favoriteCheckboxes.length) return;

    try {
      const currentActorFavorites = actor.system.favorites || [];
      const newFavorites = await this.#collectNewFavorites(favoriteCheckboxes, createdItems);

      if (newFavorites.length > 0) {
        await this.#updateActorFavorites(actor, currentActorFavorites, newFavorites);
      }
    } catch (error) {
      console.error('Equipment Selector | Error processing favorites:', error);
      ui.notifications.warn(`Error processing favorites: ${error.message}`);
    }
  }

  /**
   * Collects new favorites from selected checkboxes
   * @param {NodeList} favoriteCheckboxes - Selected favorite checkboxes
   * @param {Array<Item>} createdItems - Items created on the actor
   * @returns {Promise<Array<object>>} Favorite data objects
   * @private
   */
  static async #collectNewFavorites(favoriteCheckboxes, createdItems) {
    const newFavorites = [];
    const processedUuids = new Set(); // To avoid duplicates

    for (const checkbox of favoriteCheckboxes) {
      const itemUuids = this.#extractItemUuids(checkbox);
      if (!itemUuids.length) continue;

      for (const uuid of itemUuids) {
        if (processedUuids.has(uuid)) continue;
        processedUuids.add(uuid);

        const favoriteItems = await this.#findMatchingCreatedItems(uuid, createdItems);
        for (const item of favoriteItems) {
          newFavorites.push({
            type: 'item',
            id: `.Item.${item.id}`,
            sort: 100000 + newFavorites.length
          });
        }
      }
    }

    return newFavorites;
  }

  /**
   * Extracts item UUIDs from a favorite checkbox
   * @param {HTMLElement} checkbox - Favorite checkbox element
   * @returns {Array<string>} Extracted UUIDs
   * @private
   */
  static #extractItemUuids(checkbox) {
    if (checkbox.dataset.itemUuids) {
      return checkbox.dataset.itemUuids.split(',');
    } else if (checkbox.id && checkbox.id.includes(',')) {
      return checkbox.id.split(',');
    } else if (checkbox.dataset.itemId) {
      return [checkbox.dataset.itemId];
    }
    return [];
  }

  /**
   * Finds matching created items from source UUID
   * @param {string} uuid - Source item UUID
   * @param {Array<Item>} createdItems - Items created on the actor
   * @returns {Promise<Array<Item>>} Matching items
   * @private
   */
  static async #findMatchingCreatedItems(uuid, createdItems) {
    if (!uuid.startsWith('Compendium.')) return [];

    try {
      const sourceItem = await fromUuid(uuid);
      if (!sourceItem) return [];

      return createdItems.filter((item) => item.name === sourceItem.name || (item.flags?.core?.sourceId && item.flags.core.sourceId.includes(sourceItem.id)));
    } catch (error) {
      console.error(`Equipment Selector | Error processing UUID ${uuid}:`, error);
      return [];
    }
  }

  /**
   * Updates actor favorites with new favorites
   * @param {Actor} actor - The actor to update
   * @param {Array<object>} currentFavorites - Current actor favorites
   * @param {Array<object>} newFavorites - New favorites to add
   * @returns {Promise<void>}
   * @private
   */
  static async #updateActorFavorites(actor, currentFavorites, newFavorites) {
    // Add new favorites without duplicates
    const combinedFavorites = [...currentFavorites];
    for (const newFav of newFavorites) {
      if (!combinedFavorites.some((fav) => fav.id === newFav.id)) {
        combinedFavorites.push(newFav);
      }
    }

    await actor.update({ 'system.favorites': combinedFavorites });
  }

  /**
   * Form submission handler
   * @param {Event} _event - The form event
   * @param {HTMLElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<boolean>} Success status
   * @static
   */
  static async formHandler(_event, form, formData) {
    try {
      const actor = this.actor;

      if (!actor) {
        ui.notifications.error('Actor not found');
        return false;
      }

      // Check individual wealth options
      const useClassWealth = formData.object['use-starting-wealth-class'];
      const useBackgroundWealth = formData.object['use-starting-wealth-background'];

      // Process wealth values for both options if selected
      let updatedCurrency = null;
      if (useClassWealth || useBackgroundWealth) {
        updatedCurrency = await heroMancer.convertWealthToCurrency(formData.object);

        if (updatedCurrency) {
          await actor.update({ 'system.currency': updatedCurrency });
          ui.notifications.info(`Added currency to ${actor.name}`);
        }
      }

      // Collect equipment selections (excluding sections using wealth)
      const equipmentOptions = {
        includeClass: !useClassWealth,
        includeBackground: !useBackgroundWealth
      };

      const equipment = await heroMancer.collectEquipmentSelections({ target: form }, equipmentOptions);

      if (equipment?.length > 0) {
        // Create the items on the actor
        const createdItems = await actor.createEmbeddedDocuments('Item', equipment, { keepId: true });
        ui.notifications.info(`Added ${equipment.length} items to ${actor.name}`);

        // Process favorites
        await EquipmentSelector.#processEquipmentFavorites(actor, form, createdItems);
      } else if (!useClassWealth && !useBackgroundWealth) {
        // Only show warning if neither wealth option was selected
        ui.notifications.warn('No equipment selected');
      }

      // Call hook for equipment added
      Hooks.callAll('equipmentSelector.equipmentAdded', actor);
      return true;
    } catch (error) {
      console.error('Equipment Selector | Form submission error:', error);
      ui.notifications.error(`Error adding equipment: ${error.message}`);
      return false;
    }
  }
}

/* -------------------------------------------- */
/*  Module Initialization                       */
/* -------------------------------------------- */

// Register when Hero Mancer is ready
Hooks.once('heroMancer.Ready', () => {
  console.log('Equipment Selector | Hero Mancer API detected');

  // Register module API
  globalThis.heroMancerEquipmentSelector = {
    /**
     * Opens the equipment selector for an actor
     * @param {Actor} actor - The actor to select equipment for
     * @returns {EquipmentSelector|null} The equipment selector instance or null if failed
     */
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

  // Add support for standard 5e sheets
  setupStandardSheetSupport();

  // Add Tidy5e support if available
  if (game.modules.get('tidy5e-sheet')?.active) {
    console.log('Equipment Selector | Tidy5e detected, adding support');
    setupTidy5eSupport();
  }
});

/**
 * Setup support for standard 5e character sheets
 */
function setupStandardSheetSupport() {
  // Add equipment selector button to character sheets
  Hooks.on('renderActorSheet5e', (app, html, data) => {
    if (app.actor.type !== 'character') return;

    const currencySection = html.find('section.currency');
    if (currencySection.length === 0) return;

    // Create and add equipment selector button
    const equipButton = $(`
      <button type="button" class="item-action unbutton equipment-selector-btn"
              data-action="equipment-selector"
              data-tooltip="Select Equipment"
              aria-label="Select Equipment">
        <i class="fas fa-shopping-bag"></i>
      </button>
    `);

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
}

/**
 * Setup support for Tidy5e character sheets
 */
function setupTidy5eSupport() {
  Hooks.on('tidy5e-sheet.renderActorSheet', (app, html, data) => {
    // Only for character-type actors
    if (app.actor.type !== 'character') return;

    // Find the utility toolbar in the inventory tab
    const inventoryTab = html.querySelector('.tidy-tab.inventory');
    if (!inventoryTab) return;

    const utilityToolbar = inventoryTab.querySelector('.utility-toolbar');
    if (!utilityToolbar) return;

    // Check if our button already exists to prevent duplicates
    if (utilityToolbar.querySelector('button[data-equipment-selector="true"]')) {
      return; // Button already exists, don't add another one
    }

    // Create equipment selector button
    const equipButton = document.createElement('button');
    equipButton.type = 'button';
    equipButton.title = 'Select Equipment';
    equipButton.className = 'inline-icon-button';
    equipButton.setAttribute('tabindex', '-1');
    equipButton.setAttribute('data-tidy-sheet-part', 'utility-toolbar-command');
    equipButton.setAttribute('data-equipment-selector', 'true');
    equipButton.innerHTML = '<i class="fas fa-shopping-bag"></i>';

    // Add click handler
    equipButton.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (heroMancer) {
        const selector = new EquipmentSelector(app.actor);
        selector.render(true);
      } else {
        ui.notifications.error('Hero Mancer not available');
      }
    });

    // Insert before the configuration button (cog icon)
    const configButton = utilityToolbar.querySelector('button[title="Configure Sections"]');
    if (configButton) {
      configButton.before(equipButton);
    } else {
      // Fallback: add to the end of the toolbar
      utilityToolbar.appendChild(equipButton);
    }
  });
}
