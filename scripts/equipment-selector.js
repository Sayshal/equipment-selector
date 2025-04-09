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
        const equipmentItems = this.element.querySelectorAll('.equipment-item');

        equipmentItems.forEach((item) => {
          item.classList.toggle('disabled', checked);
          item.querySelectorAll('select, input[type="checkbox"]').forEach((input) => {
            input.disabled = checked;
          });
        });
      });
    });
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

      // Check if using wealth option
      const useWealth = formData.object['use-starting-wealth-class'] || formData.object['use-starting-wealth-background'];

      if (useWealth) {
        // Process starting wealth
        const currency = await heroMancer.convertWealthToCurrency(formData.object);
        if (currency) {
          await actor.update({ 'system.currency': currency });
          ui.notifications.info(`Added currency to ${actor.name}`);
        }
      } else {
        // Collect equipment selections
        const equipment = await heroMancer.collectEquipmentSelections({ target: form }, { includeClass: true, includeBackground: true });

        if (equipment?.length > 0) {
          await actor.createEmbeddedDocuments('Item', equipment, { keepId: true });
          ui.notifications.info(`Added ${equipment.length} items to ${actor.name}`);
        } else {
          ui.notifications.warn('No equipment selected');
        }
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

// Initialize module
Hooks.once('init', () => {
  console.log('Equipment Selector | Initializing module');
});

// Register when Hero Mancer is ready
Hooks.once('heroMancer.Ready', () => {
  console.log('Equipment Selector | Hero Mancer API detected');

  // Register module API
  game.modules.get('equipment-selector').api = {
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
});

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
