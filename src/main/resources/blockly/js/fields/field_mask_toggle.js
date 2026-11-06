/**
 * A field_checkbox variant purpose-built for toggling masking on one or more
 * *other* fields on the same block ("target", by field name) - e.g. hiding
 * an API key typed into a field_text_preview or field_input field. Renders
 * as a checkbox whose "checked" glyph is a lock (instead of the default
 * checkmark), so no separate field_label icon is needed alongside it to
 * explain what it does.
 *
 * "Compatible" target fields are ones that implement setMasked(boolean).
 * field_text_preview implements it natively; this file also globally
 * re-registers Blockly's own "field_input" and "field_label" field types
 * (same "last script wins" override convention as field_dropdown_searchable.js
 * uses for "field_dropdown" - see FIELD_TYPES.md's "Weight & override notes")
 * with maskable subclasses, so those two become compatible too, everywhere -
 * not just on blocks that actually use masking. They behave identically to
 * stock unless something actually calls setMasked(true) on them.
 *
 * Pointing "target" at an incompatible field (a dropdown, a plain checkbox,
 * anything with nothing to obscure) is a no-op with a console warning rather
 * than a hard error, since a stray/typo'd target shouldn't break the whole
 * block from loading.
 *
 * Usage in a block's args0:
 * { "type": "field_mask_toggle", "name": "MASKED", "checked": false, "target": ["TEXT"] }
 * "target" accepts a single field name string or an array of them (to mask
 * several fields on the same block at once); defaults to ["TEXT"] if omitted.
 */
(function () {
    const MASK_TEXT = '•••••••';

    class FieldInputMaskable extends Blockly.FieldTextInput {
        masked_ = false;

        setMasked(masked) {
            masked = !!masked;
            if (masked === this.masked_)
                return;
            this.masked_ = masked;
            this.forceRerender();
        }

        // Returning null here (rather than a computed string) tells Blockly's
        // base Field.getText() "no override, use the plain value" - the exact
        // behavior every other field_input in MCreator (core and other
        // plugins) needs to keep having whenever it's not masked, since this
        // override applies globally.
        getText_() {
            if (this.masked_)
                return this.getValue() ? MASK_TEXT : '';
            return typeof super.getText_ === 'function' ? super.getText_() : null;
        }

        showEditor_(e, quietInput) {
            super.showEditor_(e, quietInput);
            if (this.masked_ && this.htmlInput_)
                this.htmlInput_.type = 'password';
        }
    }

    Blockly.fieldRegistry.register('field_input', FieldInputMaskable);

    class FieldLabelMaskable extends Blockly.FieldLabel {
        masked_ = false;

        setMasked(masked) {
            masked = !!masked;
            if (masked === this.masked_)
                return;
            this.masked_ = masked;
            this.forceRerender();
        }

        getText_() {
            if (this.masked_)
                return this.getValue() ? MASK_TEXT : '';
            return typeof super.getText_ === 'function' ? super.getText_() : null;
        }
    }

    Blockly.fieldRegistry.register('field_label', FieldLabelMaskable);

    class FieldMaskToggle extends Blockly.FieldCheckbox {

        static fromJson(options) {
            return new this(options['checked'] === true, undefined, options);
        }

        constructor(state, opt_validator, opt_config) {
            super(state, opt_validator, opt_config);
            // Public, documented Blockly.FieldCheckbox API for swapping the
            // "checked" glyph - this is what makes the lock icon inherent to
            // the field itself instead of a separate field_label sibling.
            this.setCheckCharacter('🔒');

            const target = opt_config && opt_config['target'];
            this.targets_ = Array.isArray(target) ? target.slice()
                : (typeof target === 'string' && target) ? [target]
                    : ['TEXT'];
        }

        initView() {
            super.initView();
            // Sync every target's masked state once on creation too, not just
            // on future toggles - covers both a fresh block dragged from the
            // toolbox and a block just deserialized from saved XML (by the
            // time initView runs, every field in args0 already exists on
            // sourceBlock_, since Blockly constructs them all synchronously
            // during block init, before XML field values are applied).
            this.pushMaskState_();
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.pushMaskState_();
        }

        pushMaskState_() {
            if (!this.sourceBlock_)
                return;

            const masked = this.getValueBoolean();
            this.targets_.forEach(name => {
                const targetField = this.sourceBlock_.getField(name);
                if (!targetField) {
                    console.warn('field_mask_toggle: no sibling field named "' + name + '" on this block.');
                    return;
                }
                if (typeof targetField.setMasked !== 'function') {
                    console.warn('field_mask_toggle: target field "' + name + '" does not support masking (missing setMasked()).');
                    return;
                }
                targetField.setMasked(masked);
            });
        }
    }

    Blockly.fieldRegistry.register('field_mask_toggle', FieldMaskToggle);
})();
