/**
 * An inline editor for an enum's constants (rows only). The enum's typed
 * constructor fields ("columns") are NOT managed here - they're declared as
 * separate "enum_field_declaration" child blocks stacked inside
 * enum_definition_local's "FIELDS" statement input (see that block's JSON
 * and enum_field_declaration.json). This field only adds/removes/reorders
 * constants and, if the enum currently has any fields, lets you fill in one
 * value per field per constant.
 *
 * Flat mode (no field_declaration blocks placed): behaves exactly like the
 * simple no-payload chip-list editor this field started as
 * (field_enum_constant_list, retired) - just constant names, no value
 * inputs shown. This is purely a live consequence of getFieldColumns_()
 * returning an empty array, not a separate stored mode.
 *
 * Value-carrying mode (>=1 field_declaration block present): this field
 * bakes the ENTIRE rest of the enum body into its own serialized value -
 * the constants-with-args list, the "final <type> <name>;" field
 * declarations, and the constructor - by reading the live field_declaration
 * blocks' NAME/TYPE values at bake time. FTL stays a trivial, unchanged
 * passthrough ("enum ${field$NAME} { ${field$CONSTANTS} }") either way,
 * matching this plugin's "do the work in the field" convention - see
 * IDEAS.md's "value-carrying constant table" section.
 *
 * Serialized value format (what field$CONSTANTS resolves to in FTL, and
 * what round-trips through saved workspace XML):
 *  - Flat: unchanged plain ", "-joined name string ("EASY, MEDIUM, HARD").
 *  - Value-carrying: a leading "// BXT_ENUM_DATA:<json>" Java line comment
 *    (harmless, syntactically valid - only comments out its own line) with
 *    ONLY the per-row values (keyed by the owning field_declaration block's
 *    own Blockly block id, not by field name or position - stays correct
 *    even if fields are renamed/reordered/retyped later), followed by the
 *    baked Java fragment on the next line. Field/column metadata itself is
 *    NEVER stored here - it's re-read live from the sibling FIELDS
 *    statement chain every time, so there is nothing to keep in sync.
 *
 * The constructor's name and parameter list have to track the sibling NAME
 * field and the live FIELDS chain, both of which can change after this
 * field last baked its value. enum_definition_local's existing
 * "enum_type_name_collision_refresh" extension (field_enum_type_name.js)
 * already runs on every workspace change (blunt but cheap, same idiom used
 * throughout this plugin) - it now also calls this field's refreshBake_(),
 * which rebakes only when a signature of (enum name + live columns) has
 * actually changed since the last bake.
 *
 * IMPORTANT - do not reuse a property/method name Blockly's own Field class
 * already uses internally (checked against the vendored
 * blockly_compressed.js for every custom name below before picking it) -
 * see the Claude memory feedback_blockly_field_reserved_names.md and this
 * file's own bug history (when it still owned column state directly) for
 * why this matters: a collision degrades silently into NaN/undefined
 * rendering with nothing thrown, not an error you can catch.
 *
 * Usage in a block's args0:
 * { "type": "field_enum_constant_table", "name": "CONSTANTS", "constants": ["EASY", "MEDIUM", "HARD"] }
 */
(function () {
    const TAG = 'field_enum_constant_table';
    const DATA_MARKER = '// BXT_ENUM_DATA:';
    const PREVIEW_MAX = 3;

    // Same background-detection trick as field_dropdown_searchable.js /
    // field_locale_preview.js - duplicated rather than shared, since script
    // load order between field files isn't guaranteed.
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
        return [255, 255, 255];
    }

    function readableTextColorFor(element) {
        const [r, g, b] = findEffectiveBackgroundColor(element);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 128 ? '#000000' : '#ffffff';
    }

    function sanitizeConstantName(raw) {
        let name = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^[0-9]/, '_$&');
        return name.replace(/^_+|_+$/g, '');
    }

    function formatJavaValue(raw, type) {
        const v = (raw || '').trim();
        if (type === 'String') {
            if (v.startsWith('"') && v.endsWith('"') && v.length >= 2)
                return v;
            return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        }
        if (type === 'boolean')
            return v === 'true' ? 'true' : 'false';
        return v || '0';
    }

    function buildJavaFragment(enumName, columns, rows) {
        const javaNames = columns.map(BlocklyExtendedEnum.columnJavaName);
        const constantsPart = rows.map(row => {
            const args = columns.map((col, i) => formatJavaValue(row.values[col.id], col.type)).join(', ');
            return row.name + '(' + args + ')';
        }).join(', ');
        const fieldDecls = columns.map((col, i) => 'final ' + col.type + ' ' + javaNames[i] + ';').join(' ');
        const params = columns.map((col, i) => col.type + ' ' + javaNames[i]).join(', ');
        const assigns = columns.map((col, i) => 'this.' + javaNames[i] + ' = ' + javaNames[i] + ';').join(' ');
        const ctor = enumName + '(' + params + ') { ' + assigns + ' }';
        return constantsPart + '; ' + fieldDecls + ' ' + ctor;
    }

    // Returns just the row list - column/field metadata is never stored in
    // this field's own value, only read live via getFieldColumns_().
    function parseStoredValue(value) {
        if (!value)
            return [];
        if (value.startsWith(DATA_MARKER)) {
            const lineEnd = value.indexOf('\n');
            const jsonText = lineEnd === -1 ? value.slice(DATA_MARKER.length) : value.slice(DATA_MARKER.length, lineEnd);
            try {
                const parsed = JSON.parse(jsonText);
                return Array.isArray(parsed.rows) ?
                    parsed.rows.map(row => ({
                        name: row.name,
                        values: (row.values && typeof row.values === 'object') ? row.values : {}
                    })) : [];
            } catch (err) {
                BlocklyExtendedLog.error(TAG, 'failed to parse stored constant data, falling back to an empty list', err);
                return [];
            }
        }
        return value.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, values: {} }));
    }

    class FieldEnumConstantTable extends Blockly.Field {

        EDITABLE = true;
        SERIALIZABLE = true;
        CURSOR = 'pointer';

        constructor(constants = [], opt_validator, opt_config) {
            const initial = Array.isArray(constants) ? constants.join(', ') : (constants || '');
            super(initial, opt_validator, opt_config);
            // doValueUpdate_() may already have populated rows_ during the
            // super() call above (Field's base constructor calls
            // setValue() internally) - don't clobber it if so.
            if (!this.rows_)
                this.rows_ = parseStoredValue(initial);
            this.lastBakedSignature_ = null;
        }

        static fromJson(options) {
            return new this(options['constants'] || [], undefined, options);
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            // commit_() sets committing_ around its own setValue() call - skip
            // re-parsing in that case, since this.rows_ is already the
            // authoritative in-memory state serialize_() just built newValue
            // from. Re-parsing here would replace it with a fresh array of
            // fresh row objects, silently detaching any OTHER still-open
            // popup input's closure from thisField.rows_ (they'd go on
            // mutating the now-orphaned old objects) - which is exactly what
            // made editing more than one constant's value in one popup
            // session before closing it only keep the first edit. Only
            // genuinely external value changes (undo/redo, workspace load)
            // should reset rows_ from the serialized string.
            if (this.committing_)
                return;
            this.rows_ = parseStoredValue(newValue);
        }

        getEnumConstants() {
            return this.rows_.map(row => row.name);
        }

        getEnumName_() {
            const nameField = this.sourceBlock_ && this.sourceBlock_.getField('NAME');
            return (nameField && nameField.getValue()) || 'MyEnum';
        }

        // Live-reads the enum's typed fields off the sibling FIELDS
        // statement chain - never cached, always the current on-canvas
        // state. Toolbox/flyout preview instances have no FIELDS input
        // wired up (or no sourceBlock_ at all yet) and correctly resolve
        // to no columns, matching flat/plain rendering. Delegates to the
        // shared helper (enum_helpers.js) so this and
        // field_enum_field_reference.js can never disagree about what a
        // field's columns are.
        getFieldColumns_() {
            return BlocklyExtendedEnum.getFieldColumns(this.sourceBlock_);
        }

        // Called by field_enum_type_name.js's collision-refresh extension
        // on every workspace change - only actually rebakes (and fires a
        // change event) when the enum name or its live fields have
        // genuinely changed since the last bake, so this doesn't spam
        // commits on unrelated edits.
        refreshBake_() {
            const columns = this.getFieldColumns_();
            const signature = columns.length ?
                JSON.stringify({ name: this.getEnumName_(), columns }) : null;
            if (signature === this.lastBakedSignature_)
                return;
            this.commit_();
        }

        serialize_() {
            const columns = this.getFieldColumns_();
            if (!columns.length) {
                this.lastBakedSignature_ = null;
                return this.rows_.map(row => row.name).join(', ');
            }
            const enumName = this.getEnumName_();
            this.lastBakedSignature_ = JSON.stringify({ name: enumName, columns });
            let fragment;
            try {
                fragment = buildJavaFragment(enumName, columns, this.rows_);
            } catch (err) {
                BlocklyExtendedLog.error(TAG, 'failed to build generated Java for enum "' + enumName + '", falling back to a flat constant list', err);
                fragment = this.rows_.map(row => row.name).join(', ');
            }
            return DATA_MARKER + JSON.stringify({ rows: this.rows_ }) + '\n' + fragment;
        }

        commit_() {
            const group = Blockly.Events.getGroup();
            Blockly.Events.setGroup(true);
            this.committing_ = true;
            try {
                this.setValue(this.serialize_());
            } finally {
                this.committing_ = false;
            }
            Blockly.Events.setGroup(group);
            javabridge.triggerEvent();
        }

        // Plain-text fallback for any Blockly internals that read getText()
        // directly instead of going through the default render_() pipeline.
        getText_() {
            if (!this.rows_.length)
                return '(empty)';
            const preview = this.rows_.slice(0, PREVIEW_MAX).map(row => row.name).join(', ');
            const more = this.rows_.length > PREVIEW_MAX ?
                ', … (+' + (this.rows_.length - PREVIEW_MAX) + ')' : '';
            const columnsHint = this.getFieldColumns_().length ? ' [value-carrying]' : '';
            return preview + more + columnsHint;
        }

        onMouseDown_(e) {
            if (!this.sourceBlock_ || this.sourceBlock_.isInFlyout)
                return;
            e.stopPropagation();

            const contentDiv = Blockly.DropDownDiv.getContentDiv();
            contentDiv.innerHTML = '';
            contentDiv.style.padding = '8px';
            contentDiv.style.minWidth = '280px';

            Blockly.DropDownDiv.setColour(this.sourceBlock_.getColour(), this.sourceBlock_.getColourTertiary());
            const textColor = readableTextColorFor(contentDiv);
            const thisField = this;
            const columns = this.getFieldColumns_();

            if (columns.length) {
                const header = document.createElement('div');
                header.textContent = 'Fields: ' + columns.map(col => col.name + ' (' + col.type + ')').join(', ');
                header.style.cssText = 'font-size:11px;opacity:0.7;margin-bottom:6px;';
                header.style.color = textColor;
                contentDiv.appendChild(header);
            }

            const rowsList = document.createElement('div');
            contentDiv.appendChild(rowsList);

            const addRowInput = document.createElement('input');
            addRowInput.type = 'text';
            addRowInput.placeholder = 'Constant name (or a, b, c list), Enter to add';
            addRowInput.style.cssText = 'box-sizing:border-box;display:block;width:100%;padding:6px 8px;' +
                'margin-top:8px;border:none;border-bottom:1px solid rgba(128,128,128,0.4);' +
                'background:transparent;outline:none;font:inherit;';
            addRowInput.style.color = textColor;
            contentDiv.appendChild(addRowInput);

            let dragIndex = null;

            const renderRows = () => {
                rowsList.innerHTML = '';
                thisField.rows_.forEach((row, rowIndex) => {
                    const rowDiv = document.createElement('div');
                    rowDiv.draggable = true;
                    rowDiv.style.cssText = 'display:flex;align-items:center;gap:4px;' +
                        'padding:4px 6px;margin-bottom:4px;border-radius:4px;' +
                        'background:rgba(128,128,128,0.15);cursor:grab;';
                    rowDiv.style.color = textColor;

                    const nameLabel = document.createElement('span');
                    nameLabel.textContent = row.name;
                    nameLabel.style.cssText = 'font-weight:bold;min-width:70px;';
                    rowDiv.appendChild(nameLabel);

                    columns.forEach(col => {
                        const cellInput = document.createElement('input');
                        cellInput.type = 'text';
                        cellInput.placeholder = col.name;
                        cellInput.value = row.values[col.id] || '';
                        cellInput.style.cssText = 'flex:1;min-width:0;border:none;border-bottom:1px solid rgba(128,128,128,0.4);' +
                            'background:transparent;outline:none;font:inherit;';
                        cellInput.style.color = textColor;
                        cellInput.addEventListener('blur', () => {
                            if (row.values[col.id] !== cellInput.value) {
                                row.values[col.id] = cellInput.value;
                                thisField.commit_();
                            }
                        });
                        rowDiv.appendChild(cellInput);
                    });

                    const remove = document.createElement('span');
                    remove.textContent = '✕';
                    remove.title = 'Remove constant';
                    remove.style.cssText = 'cursor:pointer;opacity:0.7;';
                    remove.addEventListener('click', () => {
                        thisField.rows_.splice(rowIndex, 1);
                        thisField.commit_();
                        renderRows();
                    });
                    rowDiv.appendChild(remove);

                    rowDiv.addEventListener('dragstart', () => {
                        dragIndex = rowIndex;
                    });
                    rowDiv.addEventListener('dragover', ev => ev.preventDefault());
                    rowDiv.addEventListener('drop', ev => {
                        ev.preventDefault();
                        if (dragIndex === null || dragIndex === rowIndex)
                            return;
                        const [moved] = thisField.rows_.splice(dragIndex, 1);
                        thisField.rows_.splice(rowIndex, 0, moved);
                        dragIndex = null;
                        thisField.commit_();
                        renderRows();
                    });

                    rowsList.appendChild(rowDiv);
                });
            };

            addRowInput.addEventListener('keydown', ev => {
                if (ev.key !== 'Enter')
                    return;
                ev.preventDefault();
                // A comma, semicolon, space or line break separates several names, so a pasted
                // list (EASY, MEDIUM, HARD) adds one constant per name instead of one merged name.
                const names = addRowInput.value.split(/[,;\s]+/).map(sanitizeConstantName).filter(Boolean);
                addRowInput.value = '';
                let added = false;
                names.forEach(name => {
                    if (thisField.rows_.some(row => row.name === name))
                        return;
                    thisField.rows_.push({ name, values: {} });
                    added = true;
                });
                if (!added)
                    return;
                thisField.commit_();
                renderRows();
            });

            renderRows();
            Blockly.DropDownDiv.showPositionedByField(this, () => {
            });
            addRowInput.focus();
        }
    }

    Blockly.fieldRegistry.register('field_enum_constant_table', FieldEnumConstantTable);
})();
