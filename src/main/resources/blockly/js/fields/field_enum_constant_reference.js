/**
 * A dropdown listing the constants of whichever enum is currently selected
 * in a sibling field (by name, "enumField" config, default "ENUM" - meant to
 * pair with field_enum_type_reference). The option list is rebuilt fresh
 * every time the dropdown opens by reading the matching
 * "enum_definition_local" block's CONSTANTS field live, via
 * field_enum_constant_table's getEnumConstants() - so it can never show a
 * stale constant list, even if the enum was edited after this field was
 * created. Works the same whether the enum is flat or value-carrying -
 * getEnumConstants() only ever returns names.
 *
 * Usage in a block's args0:
 * { "type": "field_enum_constant_reference", "name": "CONSTANT", "enumField": "ENUM" }
 * "enumField" defaults to "ENUM" if omitted.
 */
(function () {
    class FieldEnumConstantReference extends Blockly.FieldDropdown {

        static fromJson(options) {
            return new this(undefined, options);
        }

        constructor(opt_validator, opt_config) {
            super(FieldEnumConstantReference.prototype.buildOptions_, opt_validator, opt_config);
            this.enumField_ = (opt_config && opt_config['enumField']) || 'ENUM';
        }

        buildOptions_() {
            const sourceBlock = this.sourceBlock_;
            // Skip live scanning for toolbox/flyout previews - blocks there
            // aren't real instances.
            if (!sourceBlock || sourceBlock.isInFlyout)
                return [['(no enum selected)', '']];

            const enumTypeField = sourceBlock.getField(this.enumField_ || 'ENUM');
            const enumName = enumTypeField && enumTypeField.getValue();
            if (!enumName)
                return [['(no enum selected)', '']];

            const defBlock = sourceBlock.workspace.getAllBlocks(false).find(block =>
                block.type === 'enum_definition_local' && block.getFieldValue('NAME') === enumName);
            if (!defBlock)
                return [['(enum not found)', '']];

            const constantsField = defBlock.getField('CONSTANTS');
            const constants = constantsField && typeof constantsField.getEnumConstants === 'function' ?
                constantsField.getEnumConstants() : [];

            return constants.length ? constants.map(name => [name, name]) : [['(no constants)', '']];
        }
    }

    Blockly.fieldRegistry.register('field_enum_constant_reference', FieldEnumConstantReference);

    // Dynamic FieldDropdown option lists are re-evaluated on open, but the
    // ON-BLOCK text (while closed) isn't guaranteed to repaint just because
    // the underlying enum changed elsewhere - force both fields to redraw on
    // every workspace change, same setOnChange idiom used throughout this
    // plugin, and flag (rather than silently misrepresent) a reference to an
    // enum/constant that's been renamed or removed out from under it.
    Blockly.Extensions.register('enum_constant_get_refresh', function () {
        this.setOnChange(function () {
            if (this.isInFlyout)
                return;

            const enumField = this.getField('ENUM');
            const constantField = this.getField('CONSTANT');
            if (enumField && typeof enumField.forceRerender === 'function')
                enumField.forceRerender();
            if (constantField && typeof constantField.forceRerender === 'function')
                constantField.forceRerender();

            let warning = null;
            const enumName = enumField && enumField.getValue();
            if (enumName) {
                const defBlock = this.workspace.getAllBlocks(false).find(block =>
                    block.type === 'enum_definition_local' && block.getFieldValue('NAME') === enumName);
                if (!defBlock) {
                    warning = 'Enum "' + enumName + '" no longer exists in this procedure.';
                } else {
                    const constantsField = defBlock.getField('CONSTANTS');
                    const constantName = constantField && constantField.getValue();
                    const constants = constantsField && typeof constantsField.getEnumConstants === 'function' ?
                        constantsField.getEnumConstants() : [];
                    if (constantName && !constants.includes(constantName))
                        warning = 'Constant "' + constantName + '" no longer exists on enum "' + enumName + '".';
                }
            }
            this.setWarningText(warning, 'enum_stale_reference');
        });
    });
})();
