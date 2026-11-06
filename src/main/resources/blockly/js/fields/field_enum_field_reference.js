/**
 * A dropdown listing the typed fields ("columns") of whichever enum is
 * currently selected in a sibling field (by name, "enumField" config,
 * default "ENUM" - same pairing convention as field_enum_constant_reference).
 * Meant for enum_constant_field_get, to pick which field's value to pull
 * back out of a constant, e.g. "Difficulty.EASY.level".
 *
 * Option values are the field's baked Java identifier
 * (BlocklyExtendedEnum.columnJavaName(), shared with
 * field_enum_constant_table.js's own constructor-baking logic) rather than
 * the raw, unsanitized name typed into the enum_field_declaration block -
 * that's exactly what "${field$FIELD}" needs to already be for
 * enum_constant_field_get's trivial FTL passthrough to produce valid Java.
 * Option labels show the raw name plus its type for readability
 * ("level (int)").
 *
 * Usage in a block's args0:
 * { "type": "field_enum_field_reference", "name": "FIELD", "enumField": "ENUM" }
 * "enumField" defaults to "ENUM" if omitted.
 */
(function () {
    class FieldEnumFieldReference extends Blockly.FieldDropdown {

        static fromJson(options) {
            return new this(undefined, options);
        }

        constructor(opt_validator, opt_config) {
            super(FieldEnumFieldReference.prototype.buildOptions_, opt_validator, opt_config);
            this.enumField_ = (opt_config && opt_config['enumField']) || 'ENUM';
        }

        buildOptions_() {
            const sourceBlock = this.sourceBlock_;
            if (!sourceBlock || sourceBlock.isInFlyout)
                return [['(no enum selected)', '']];

            const enumTypeField = sourceBlock.getField(this.enumField_ || 'ENUM');
            const enumName = enumTypeField && enumTypeField.getValue();
            if (!enumName)
                return [['(no enum selected)', '']];

            const defBlock = BlocklyExtendedEnum.findEnumDefinition(sourceBlock.workspace, enumName);
            if (!defBlock)
                return [['(enum not found)', '']];

            const columns = BlocklyExtendedEnum.getFieldColumns(defBlock);
            if (!columns.length)
                return [['(no fields)', '']];

            return columns.map(col => [col.name + ' (' + col.type + ')', BlocklyExtendedEnum.columnJavaName(col)]);
        }
    }

    Blockly.fieldRegistry.register('field_enum_field_reference', FieldEnumFieldReference);

    // enum_constant_field_get's output type depends on which field is
    // currently selected (a "level" of type int should plug into Number
    // sockets, "label" of type String into String sockets, etc.) - Blockly
    // supports changing a block's own output check after creation via
    // setOutput(), so this recomputes it on every workspace change (same
    // blunt setOnChange idiom used throughout this plugin) rather than
    // trying to pin it down once at creation time, since the referenced
    // enum/constant/field can all change independently afterwards. Also
    // force-rerenders the three dropdowns and flags a block warning if the
    // selection points at something that's been renamed/removed out from
    // under it - same staleness-detection idiom as
    // enum_constant_get_refresh in field_enum_constant_reference.js.
    Blockly.Extensions.register('enum_constant_field_get_refresh', function () {
        this.setOnChange(function () {
            if (this.isInFlyout)
                return;

            const enumField = this.getField('ENUM');
            const constantField = this.getField('CONSTANT');
            const fieldField = this.getField('FIELD');
            [enumField, constantField, fieldField].forEach(f => {
                if (f && typeof f.forceRerender === 'function')
                    f.forceRerender();
            });

            let warning = null;
            let checkType = null;
            const enumName = enumField && enumField.getValue();
            if (enumName) {
                const defBlock = BlocklyExtendedEnum.findEnumDefinition(this.workspace, enumName);
                if (!defBlock) {
                    warning = 'Enum "' + enumName + '" no longer exists in this procedure.';
                } else {
                    const constantsField = defBlock.getField('CONSTANTS');
                    const constantName = constantField && constantField.getValue();
                    const constants = constantsField && typeof constantsField.getEnumConstants === 'function' ?
                        constantsField.getEnumConstants() : [];
                    if (constantName && !constants.includes(constantName))
                        warning = 'Constant "' + constantName + '" no longer exists on enum "' + enumName + '".';

                    const columns = BlocklyExtendedEnum.getFieldColumns(defBlock);
                    const fieldName = fieldField && fieldField.getValue();
                    const column = columns.find(col => BlocklyExtendedEnum.columnJavaName(col) === fieldName);
                    if (fieldName && !column)
                        warning = warning || ('Field "' + fieldName + '" no longer exists on enum "' + enumName + '".');
                    else if (column)
                        checkType = BlocklyExtendedEnum.javaTypeToCheck(column.type);
                }
            }
            this.setOutput(true, checkType);
            this.setWarningText(warning, 'enum_stale_reference');
        });
    });
})();
