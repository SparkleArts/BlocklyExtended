/**
 * A dropdown listing every locally-declared enum type currently in the same
 * workspace (i.e. every "enum_definition_local" block's current NAME value).
 * Used to pick *which* enum a field_enum_constant_reference sibling field
 * should then list constants from.
 *
 * The option list is a function (dynamic menuGenerator), so it's rebuilt
 * fresh from the live workspace every time the dropdown opens - same
 * approach MCreator core's field_dropdown-based fields use for any
 * non-fixed option list.
 *
 * Usage in a block's args0: { "type": "field_enum_type_reference", "name": "ENUM" }
 */
(function () {
    class FieldEnumTypeReference extends Blockly.FieldDropdown {

        static fromJson(options) {
            return new this(undefined, options);
        }

        constructor(opt_validator, opt_config) {
            // Passed as an unbound function reference - Blockly always calls
            // it as "this.menuGenerator_()", so "this" inside buildOptions_
            // correctly refers to this field instance at call time.
            super(FieldEnumTypeReference.prototype.buildOptions_, opt_validator, opt_config);
        }

        buildOptions_() {
            const sourceBlock = this.sourceBlock_;
            // Skip live scanning for toolbox/flyout previews - blocks there
            // aren't real instances.
            if (!sourceBlock || !sourceBlock.workspace || sourceBlock.isInFlyout)
                return [['(no enum defined)', '']];

            const names = sourceBlock.workspace.getAllBlocks(false)
                .filter(block => block.type === 'enum_definition_local')
                .map(block => block.getFieldValue('NAME'))
                .filter(Boolean);

            return names.length ? names.map(name => [name, name]) : [['(no enum defined)', '']];
        }
    }

    Blockly.fieldRegistry.register('field_enum_type_reference', FieldEnumTypeReference);
})();
