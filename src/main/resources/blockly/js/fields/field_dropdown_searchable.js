/**
 * Extends Blockly's own native "field_dropdown" (Blockly.FieldDropdown) with
 * an optional "searchable" config flag. Re-registers under the SAME name
 * "field_dropdown" (Blockly.fieldRegistry.register allows this - it always
 * passes allowOverrides=true internally, confirmed against the vendored
 * source), so this affects every dropdown in the app, core and plugins
 * alike - but only fields that explicitly opt in with "searchable": true
 * get different behavior. Every other dropdown falls straight through to
 * super.showEditor_(), the real vanilla implementation, unmodified.
 *
 * Usage in a block's args0: { "type": "field_dropdown", "options": [...], "searchable": true }
 *
 * There's no small override seam inside FieldDropdown.showEditor_()/
 * dropdownCreate() for injecting a search box - the searchable path below is
 * a reimplementation of showEditor_(), coupled to this exact vendored
 * Blockly version. If MCreator's bundled Blockly version ever changes,
 * re-verify this against the new blockly_compressed.js before assuming it
 * still works.
 */
(function () {
    // Blockly.Css.register() only works before Blockly's own CSS is
    // injected into the document, which has already happened by the time
    // plugin scripts run (each procedure editor panel is a fresh JCEF
    // document, and Blockly finishes its own init before plugin JS loads
    // into it) - it throws "CSS already injected" here. A plain <style>
    // tag sidesteps Blockly's injection timing entirely.
    const style = document.createElement('style');
    style.textContent = `
        .blocklyExtendedDropdownSearch {
            box-sizing: border-box;
            display: block;
            width: 100%;
            padding: 6px 8px;
            margin-bottom: 4px;
            border: none;
            border-bottom: 1px solid rgba(0, 0, 0, 0.2);
            font: inherit;
            font-size: 13px;
            outline: none;
            background: transparent;
        }
        .blocklyExtendedDropdownSearch::placeholder {
            color: inherit;
            opacity: 0.6;
        }
    `;
    document.head.appendChild(style);

    // The dropdown's actual background varies (per-block colour when
    // FIELD_DROPDOWN_COLOURED_DIV is on, otherwise whatever the editor
    // theme uses - light or dark), so a fixed text color would read fine
    // in one case and be unreadable in the other. Walk up past the search
    // box's own transparent background to find the real rendered color
    // behind it, then pick black or white by standard perceived brightness.
    function findEffectiveBackgroundColor(element) {
        let el = element;
        while (el) {
            const bg = window.getComputedStyle(el).backgroundColor;
            const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
                const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
                if (alpha > 0)
                    return [Number(match[1]), Number(match[2]), Number(match[3])];
            }
            el = el.parentElement;
        }
        return [255, 255, 255]; // fallback: assume a light background
    }

    function readableTextColorFor(element) {
        const [r, g, b] = findEffectiveBackgroundColor(element);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000; // YIQ perceived brightness
        return brightness >= 128 ? '#000000' : '#ffffff';
    }

    class FieldDropdownSearchable extends Blockly.FieldDropdown {

        constructor(menuGenerator, validator, config) {
            super(menuGenerator, validator, config);
            this.searchable_ = !!(config && config['searchable']);
        }

        showEditor_(e) {
            if (!this.searchable_) {
                super.showEditor_(e);
                return;
            }

            const sourceBlock = this.getSourceBlock();
            if (!sourceBlock)
                throw new Blockly.UnattachedFieldError();

            this.dropdownCreate();
            if (!this.menu_)
                return;

            this.menu_.openingCoords = (e && typeof e.clientX === 'number') ?
                new Blockly.utils.Coordinate(e.clientX, e.clientY) : null;

            Blockly.DropDownDiv.clearContent();
            const contentDiv = Blockly.DropDownDiv.getContentDiv();

            const searchBox = document.createElement('input');
            searchBox.type = 'text';
            searchBox.placeholder = 'Search...';
            searchBox.className = 'blocklyExtendedDropdownSearch';
            contentDiv.appendChild(searchBox);

            const menuElement = this.menu_.render(contentDiv);
            Blockly.utils.dom.addClass(menuElement, 'blocklyDropdownMenu');

            if (this.getConstants().FIELD_DROPDOWN_COLOURED_DIV) {
                Blockly.DropDownDiv.setColour(sourceBlock.getColour(), this.sourceBlock_.getColourTertiary());
            }

            searchBox.style.color = readableTextColorFor(searchBox);

            Blockly.DropDownDiv.showPositionedByField(this, this.dropdownDispose_.bind(this));

            // .blocklyDropDownContent has max-height: 300px in Blockly's own
            // stylesheet but no "overflow" set (defaults to visible) - vanilla
            // dropdowns rarely exceed 300px so this never matters, but a long
            // option list plus the search box easily does, and content past
            // 300px then spills out past the dropdown's own border/shadow
            // instead of scrolling inside it. Cap + scroll explicitly.
            const CONTENT_MAX_HEIGHT = 300;
            const resizeContent = () => {
                contentDiv.style.height = Math.min(contentDiv.scrollHeight, CONTENT_MAX_HEIGHT) + 'px';
                contentDiv.style.overflowY = 'auto';
            };
            resizeContent();

            const menuItems = this.menu_.getMenuItems();
            searchBox.addEventListener('input', () => {
                const query = searchBox.value.trim().toLowerCase();
                menuItems.forEach(item => {
                    const element = item.getElement();
                    const matches = !query || (element.textContent || '').toLowerCase().includes(query);
                    element.style.display = matches ? '' : 'none';
                    // Hiding via display alone still leaves a filtered-out
                    // item reachable by keyboard nav (Menu.getMenuItems()
                    // isn't visibility-aware) - disabling it too makes
                    // highlightNext()/highlightPrevious() correctly skip it.
                    item.setEnabled(matches);
                });
                resizeContent();
            });

            // The search box needs actual focus to be typable, but vanilla
            // FieldDropdown focuses the menu instead (so arrow keys work
            // immediately). Forward the keys the menu would normally handle.
            searchBox.addEventListener('keydown', evt => {
                if (evt.key === 'ArrowDown') {
                    evt.preventDefault();
                    this.menu_.highlightNext();
                } else if (evt.key === 'ArrowUp') {
                    evt.preventDefault();
                    this.menu_.highlightPrevious();
                } else if (evt.key === 'Enter') {
                    evt.preventDefault();
                    const highlighted = this.menu_.highlightedItem;
                    if (highlighted)
                        highlighted.performAction(evt);
                }
            });

            this.selectedMenuItem && this.menu_.setHighlighted(this.selectedMenuItem);
            this.applyColour();
            searchBox.focus();
        }
    }

    Blockly.fieldRegistry.register('field_dropdown', FieldDropdownSearchable);
})();
