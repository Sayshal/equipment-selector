const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EquipmentSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'equipment-selector-app',
    tag: 'form',
    form: {
      handler: EquipmentSelector.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      cancel: EquipmentSelector.cancelAction
    },
    classes: ['equipment-selector'],
    position: {
      height: 'auto',
      width: 540,
      top: 100
    },
    window: {
      icon: 'fas fa-shopping-bag',
      title: 'Equipment Selector',
      resizable: true,
      minimizable: true
    }
  };

  /** @override */
  static PARTS = {
    header: { template: 'modules/equipment-selector/templates/header.hbs', classes: ['equipment-selector-header'] },
    content: { template: 'modules/equipment-selector/templates/content.hbs', classes: ['equipment-selector-content'] },
    footer: { template: 'modules/equipment-selector/templates/footer.hbs', classes: ['equipment-selector-footer'] }
  };

  /* -------------------------------------------- */
  /*  Instance Properties                         */
  /* -------------------------------------------- */

  /**
   * The actor this selector is for
   * @type {Actor}
   */
  actor = null;

  /**
   * Equipment parser instance
   * @type {Object}
   */
  parser = null;

  /**
   * Flag to prevent rendering conflicts
   * @private
   * @type {boolean}
   */
  #isRendering = false;

  /* -------------------------------------------- */
  /*  Constructor                                 */
  /* -------------------------------------------- */

  /**
   * @param {Actor} actor - The actor to select equipment for
   * @param {Object} options - Application options
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  /* -------------------------------------------- */
  /*  Getters                                     */
  /* -------------------------------------------- */

  get title() {
    return `Equipment Selector | ${this.actor?.name || 'Character'}`;
  }

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /**
   * @override
   */
  _prepareContext(options) {
    // Basic context with actor info
    const context = {
      actor: this.actor,
      isGM: game.user.isGM
    };

    return context;
  }

  /**
   * @override
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

      case 'content':
        // Equipment container will be populated after render
        break;

      case 'footer':
        // Add any footer context if needed
        break;
    }

    return context;
  }

  /**
   * @override
   */
  async _onFirstRender(_context, _options) {
    try {
      // Get Hero Mancer API

      if (!heroMancer) {
        throw new Error('Hero Mancer API not found. Is the module active?');
      }

      // Initialize the equipment parser
      this.parser = await heroMancer.initializeEquipmentSelector(this.actor);

      // Get the equipment container and clear loading indicator
      const equipmentContainer = this.element.querySelector('#equipment-container');
      if (!equipmentContainer) {
        throw new Error('Equipment container element not found');
      }

      // Clear loading spinner
      equipmentContainer.innerHTML = '';

      // Create a temporary container to hold the rendered content
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);

      // Generate the UI into the temporary container
      await heroMancer.generateEquipmentUI(tempContainer, this.parser);

      // Find the equipment choices in the temporary container
      const equipmentChoices = tempContainer.querySelector('.equipment-choices');
      if (!equipmentChoices) {
        // If not found in the temp container, try document-wide (for backwards compatibility)
        const globalEquipmentChoices = document.querySelector('.equipment-choices');
        if (globalEquipmentChoices) {
          // Copy the content to our container
          equipmentContainer.appendChild(globalEquipmentChoices.cloneNode(true));
        } else {
          throw new Error('Could not find rendered equipment content');
        }
      } else {
        // Copy the content from the temp container to our container
        equipmentContainer.appendChild(equipmentChoices);
      }

      // Remove the temporary container
      document.body.removeChild(tempContainer);

      // Set up event listeners on our container
      this.#initializeWealthCheckboxes();
      this.#attachEventListeners(equipmentContainer);
    } catch (error) {
      console.error('Equipment Selector | Error during initialization:', error);
      ui.notifications.error(`Equipment Selector Error: ${error.message}`);

      // Display error in container
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
   * Attach event listeners to equipment elements
   * @private
   */
  #attachEventListeners(container) {
    // Add event listeners to checkboxes and selects
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      if (checkbox.id.startsWith('use-starting-wealth')) return; // Skip wealth checkboxes

      checkbox.addEventListener('change', (event) => {
        // Handle checkbox changes
        console.log(`Checkbox ${checkbox.id} changed: ${checkbox.checked}`);
      });
    });

    container.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', (event) => {
        // Handle select changes
        console.log(`Select ${select.id} changed to: ${select.value}`);
      });
    });
  }

  /**
   * @override
   */
  async _onRender(_context, options) {
    if (this.#isRendering) return;

    try {
      this.#isRendering = true;

      // Any updates needed during re-render
    } finally {
      this.#isRendering = false;
    }
  }

  /* -------------------------------------------- */
  /*  Private Methods                             */
  /* -------------------------------------------- */

  /**
   * Initialize wealth checkbox listeners
   * @private
   */
  #initializeWealthCheckboxes() {
    const wealthCheckboxes = this.element.querySelectorAll('input[id^="use-starting-wealth-"]');

    wealthCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const checked = event.currentTarget.checked;

        // Toggle equipment item states
        const equipmentItems = this.element.querySelectorAll('.equipment-item');
        equipmentItems.forEach((item) => {
          item.classList.toggle('disabled', checked);

          // Disable all inputs within the item
          item.querySelectorAll('select, input[type="checkbox"]').forEach((input) => {
            input.disabled = checked;
          });
        });
      });
    });
  }

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Form submission handler
   * @static
   */
  static async formHandler(event, form, formData) {
    console.error('FORMHANDLER', { event, form, formData });
    try {
      const actor = this.actor;

      // Check if using wealth option
      const useWealth = formData.object['use-starting-wealth-class'] || formData.object['use-starting-wealth-background'];

      if (useWealth) {
        // Convert wealth to currency
        const currency = await heroMancer.convertWealthToCurrency(formData.object);
        if (currency) {
          await actor.update({ 'system.currency': currency });
          ui.notifications.info(`Added currency to ${actor.name}`);
        }
      } else {
        // Collect equipment selections
        const equipment = await heroMancer.collectEquipmentSelections(event);

        if (equipment && equipment.length > 0) {
          await actor.createEmbeddedDocuments('Item', equipment);
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

  /**
   * Cancel action handler
   * @static
   */
  static async cancelAction(event, _form) {
    // Get the application instance
    const app = ui.windows[_form.closest('.app').dataset.appid];
    if (app instanceof EquipmentSelector) {
      await app.close();
    }
  }
}
