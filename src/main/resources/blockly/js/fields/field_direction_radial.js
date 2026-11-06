/**
 * A compass/dial field for picking a Direction (NORTH/SOUTH/EAST/WEST/UP/DOWN).
 * Clicking the field opens a small radial picker - NORTH/EAST/SOUTH/WEST as
 * buttons arranged around a circle, UP/DOWN as buttons in the center - instead
 * of a text dropdown. Clicking a button sets the value and closes the picker.
 *
 * Usage in a block's args0: { "type": "field_direction_radial", "name": "direction" }
 * Optional override: { "type": "field_direction_radial", "direction": "NORTH" } (default value)
 */
(function () {
    const DIRECTIONS = ['NORTH', 'EAST', 'SOUTH', 'WEST', 'UP', 'DOWN'];

    class FieldDirectionRadial extends Blockly.Field {

        SERIALIZABLE = true;

        constructor(value, validator, config) {
            super(DIRECTIONS.includes(value) ? value : 'DOWN', validator, config);
        }

        static fromJson(options) {
            return new this(options['direction'] || 'DOWN', undefined, options);
        }

        doClassValidation_(newValue) {
            return DIRECTIONS.includes(newValue) ? newValue : null;
        }

        getText_() {
            return this.getValue();
        }

        showEditor_() {
            Blockly.DropDownDiv.clearContent();
            const contentDiv = Blockly.DropDownDiv.getContentDiv();

            const size = 160;
            const cx = size / 2;
            const cy = size / 2;
            const cardinalRadius = size / 2 - 22;
            const current = this.getValue();
            const field = this;

            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.width = size + 'px';
            container.style.height = size + 'px';

            function makeButton(dir, x, y) {
                const btn = document.createElement('button');
                btn.textContent = dir;
                btn.title = dir;
                btn.style.position = 'absolute';
                btn.style.left = x + 'px';
                btn.style.top = y + 'px';
                btn.style.transform = 'translate(-50%, -50%)';
                btn.style.padding = '4px 6px';
                btn.style.fontSize = '10px';
                btn.style.fontWeight = 'bold';
                btn.style.borderRadius = '4px';
                btn.style.border = '1px solid #999';
                btn.style.background = dir === current ? '#4285f4' : '#e8e8e8';
                btn.style.color = dir === current ? '#fff' : '#333';
                btn.style.cursor = 'pointer';
                btn.style.whiteSpace = 'nowrap';
                btn.addEventListener('click', function () {
                    const group = Blockly.Events.getGroup();
                    Blockly.Events.setGroup(true);
                    field.setValue(dir);
                    Blockly.Events.setGroup(group);

                    // Field editors driven by a floating DropDownDiv (rather than an inline
                    // Blockly edit) don't reliably reach the workspace's generic change
                    // listener - explicitly tell Java to refresh the code preview, same as
                    // MCreator's own field_data_list_selector.js does for its own popup editor.
                    if (typeof javabridge !== 'undefined')
                        javabridge.triggerEvent();

                    Blockly.DropDownDiv.hideIfOwner(field);
                });
                container.appendChild(btn);
            }

            // NORTH/EAST/SOUTH/WEST arranged around the circle, compass-style
            [
                { dir: 'NORTH', angle: -90 },
                { dir: 'EAST', angle: 0 },
                { dir: 'SOUTH', angle: 90 },
                { dir: 'WEST', angle: 180 }
            ].forEach(function (c) {
                const rad = c.angle * Math.PI / 180;
                makeButton(c.dir, cx + cardinalRadius * Math.cos(rad), cy + cardinalRadius * Math.sin(rad));
            });

            // UP/DOWN have no compass angle, so they sit stacked in the center
            makeButton('UP', cx, cy - 14);
            makeButton('DOWN', cx, cy + 14);

            contentDiv.appendChild(container);
            Blockly.DropDownDiv.setColour('#ffffff', '#999999');
            Blockly.DropDownDiv.showPositionedByField(this, function () {});
        }
    }

    Blockly.fieldRegistry.register('field_direction_radial', FieldDirectionRadial);
})();
