/**
 * Block-level extension for enum_constant_count_get ("number of constants in
 * <enum>" - Difficulty.values().length). Only field on this block is ENUM
 * (field_enum_type_reference), no CONSTANT/FIELD siblings, and the output is
 * always Number regardless of which enum is picked - so unlike
 * enum_constant_intrinsic_get_refresh there's no setOutput() work to do here,
 * just the same live staleness check the other enum-reference blocks run:
 * force-rerender the dropdown and flag a warning if the selected enum's been
 * renamed/removed out from under it. Same setOnChange idiom as
 * enum_constant_get_refresh in field_enum_constant_reference.js.
 */
(function () {
    Blockly.Extensions.register('enum_constant_count_get_refresh', function () {
        this.setOnChange(function () {
            if (this.isInFlyout)
                return;

            const enumField = this.getField('ENUM');
            if (enumField && typeof enumField.forceRerender === 'function')
                enumField.forceRerender();

            let warning = null;
            const enumName = enumField && enumField.getValue();
            if (enumName && !BlocklyExtendedEnum.findEnumDefinition(this.workspace, enumName))
                warning = 'Enum "' + enumName + '" no longer exists in this procedure.';

            this.setWarningText(warning, 'enum_stale_reference');
        });
    });
})();
