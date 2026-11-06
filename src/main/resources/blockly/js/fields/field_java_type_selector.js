/**
 * A double-click-to-select field for enum_field_declaration's TYPE input, opening
 * MCreator's own native "Data list entry selection" dialog (StringSelectorDialog -
 * the same searchable Filter-box-plus-list-plus-"Use selected" popup core uses for
 * its own data-list/procedure Blockly selectors) instead of an inline Blockly
 * dropdown or free-text field. Modeled on MCreator core's own
 * field_data_list_selector.js (plugins/mcreator-core/blockly/js/), simplified since
 * this field has no separate "value" vs. "readable name" - the resolved Java class
 * name (e.g. "ItemStack") *is* the display text, nothing extra to look up.
 *
 * Lists every "variable type" any loaded plugin has registered (VariableTypeLoader -
 * MCreator core's own number/string/itemstack/entity/etc. included, loaded through
 * that exact same mechanism, not special-cased), resolved to the real Java class the
 * *currently active generator* maps it to
 * (blocklyExtendedVariableTypesBridge.openJavaTypeSelector() - see
 * VariableTypeBridge.java on the Java side). No int/long/float here - MCreator's own
 * registry only has one generic numeric type ("number" -> "double"); use
 * enum_field_declaration_custom_type's plain field_input for anything not in this
 * list.
 *
 * Can't reuse core's own javabridge.openEntrySelector(...) for this - its "type"
 * argument is dispatched through a closed, hardcoded switch inside
 * BlocklyJavascriptBridge/BlocklyElementUtil with no plugin extension point (same
 * class of limitation as MCreator's IBlockGenerator registry) - so the Java side
 * calls net.mcreator.ui.dialogs.StringSelectorDialog directly instead, the same
 * plain public core class core's own selector uses internally, just with our own
 * entry list rather than a core-recognized "type" name.
 *
 * Usage in a block's args0: { "type": "field_java_type_selector", "name": "TYPE" }
 */
(function () {
    class FieldJavaTypeSelector extends Blockly.Field {

        EDITABLE = true;
        SERIALIZABLE = true;
        CURSOR = 'pointer';

        constructor(opt_validator, opt_config) {
            super('', opt_validator, opt_config);
        }

        static fromJson(options) {
            return new this(undefined, options);
        }

        static getDefaultText() {
            return 'Double-click to select a Java type';
        }

        // Same double-click idiom as field_data_list_selector.js: a single click
        // just starts the workspace's normal block-drag, only a second click within
        // 500ms inside this field opens the selector.
        onMouseDown_(e) {
            if (!this.sourceBlock_ || this.sourceBlock_.isInFlyout)
                return;

            if (this.lastClickTime !== undefined && (new Date().getTime() - this.lastClickTime) < 500) {
                e.stopPropagation(); // don't let the block "stick" to the mouse from this click
                const thisField = this;
                blocklyExtendedVariableTypesBridge.openJavaTypeSelector(function (value) {
                    // Unlike field_data_list_selector.js, an empty/cancelled result
                    // leaves the current value alone instead of clearing it - closing
                    // the dialog without picking anything shouldn't blank out a type
                    // that was already set.
                    if (!value)
                        return;
                    const group = Blockly.Events.getGroup();
                    Blockly.Events.setGroup(true);
                    thisField.setValue(value);
                    Blockly.Events.setGroup(group);
                    // "javabridge" is core's own always-registered bridge (present on
                    // every Blockly panel regardless of which plugin's fields are in
                    // use, not something this plugin registers itself) - same
                    // post-selection notification core's own field_data_list_selector
                    // sends after setValue().
                    javabridge.triggerEvent();
                });
            } else {
                this.lastClickTime = new Date().getTime();
            }
        }

        getText_() {
            return this.getValue() || FieldJavaTypeSelector.getDefaultText();
        }
    }

    Blockly.fieldRegistry.register('field_java_type_selector', FieldJavaTypeSelector);
})();
