/**
 * Block-level extension for enum_constant_intrinsic_get (Difficulty.EASY.name() /
 * Difficulty.EASY.ordinal()). Unlike enum_constant_field_get, there's no per-enum
 * data to look up for the INTRINSIC choice itself - name()/ordinal() are Java's
 * built-in per-constant methods, always available, always the same return type - so
 * this only needs a plain stock "field_dropdown" for INTRINSIC (no new custom field
 * class), reusing field_enum_type_reference/field_enum_constant_reference exactly as
 * enum_constant_get does for ENUM/CONSTANT.
 *
 * Only job here: keep the block's own output check in sync with whichever method is
 * currently selected (name -> String, ordinal -> Number) via setOutput(), and flag
 * (rather than silently misrepresent) a reference to an enum/constant that's been
 * renamed or removed out from under it - same setOnChange idiom as
 * enum_constant_get_refresh / enum_constant_field_get_refresh in
 * field_enum_constant_reference.js / field_enum_field_reference.js.
 */
(function () {
    Blockly.Extensions.register('enum_constant_intrinsic_get_refresh', function () {
        this.setOnChange(function () {
            if (this.isInFlyout)
                return;

            const enumField = this.getField('ENUM');
            const constantField = this.getField('CONSTANT');
            [enumField, constantField].forEach(f => {
                if (f && typeof f.forceRerender === 'function')
                    f.forceRerender();
            });

            let warning = null;
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
                }
            }

            const intrinsicField = this.getField('INTRINSIC');
            const intrinsic = intrinsicField && intrinsicField.getValue();
            this.setOutput(true, intrinsic === 'ordinal' ? 'Number' : 'String');
            this.setWarningText(warning, 'enum_stale_reference');
        });
    });
})();
