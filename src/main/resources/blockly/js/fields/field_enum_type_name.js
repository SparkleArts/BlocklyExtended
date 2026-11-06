/**
 * A Java-identifier text field constrained to PascalCase (e.g. "Difficulty",
 * "ArmorTier"), meant for naming a locally-declared enum type. Rejects
 * keystrokes that would leave the field holding something that isn't a valid
 * PascalCase Java identifier - same doClassValidation_ convention MCreator
 * core's own field_javaname.js uses, just with a stricter regex.
 *
 * Also live-warns (via Block.prototype.setWarningText, not a hard block on
 * typing) if another "enum_definition_local" block elsewhere in the same
 * workspace already uses the same name - collisions are only meaningful
 * within one procedure's local scope, so this only ever looks at the field's
 * own workspace, no cross-procedure/Java-bridge lookup needed.
 *
 * The same "enum_type_name_collision_refresh" extension also keeps a
 * value-carrying CONSTANTS field (field_enum_constant_table) in sync when
 * this field's name changes (or its sibling FIELDS statement chain changes),
 * since that field bakes both into a generated Java constructor - see
 * refreshBake_() there.
 *
 * Known limitation: doesn't reject Java reserved words (e.g. naming an enum
 * "Class" or "Enum" would pass validation here and fail to compile) - out of
 * scope for this first pass.
 *
 * Usage in a block's args0: { "type": "field_enum_type_name", "name": "NAME", "text": "MyEnum" }
 */
(function () {
    const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

    class FieldEnumTypeName extends Blockly.FieldTextInput {

        SERIALIZABLE = true;

        static fromJson(options) {
            return new this(options['text'] || 'MyEnum', undefined, options);
        }

        doClassValidation_(newValue) {
            if (typeof newValue !== 'string')
                return null;
            if (!PASCAL_CASE.test(newValue))
                return null;
            return newValue;
        }

        initView() {
            super.initView();
            this.refreshCollisionWarning_();
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.refreshCollisionWarning_();
        }

        refreshCollisionWarning_() {
            const sourceBlock = this.sourceBlock_;
            // Toolbox/flyout preview blocks aren't real instances - warning
            // icons and cross-block scanning have no meaning there.
            if (!sourceBlock || !sourceBlock.workspace || sourceBlock.isInFlyout)
                return;

            const name = this.getValue();
            const collision = sourceBlock.workspace.getAllBlocks(false).some(block =>
                block !== sourceBlock &&
                block.type === 'enum_definition_local' &&
                block.getFieldValue('NAME') === name
            );

            sourceBlock.setWarningText(collision ?
                'Another enum named "' + name + '" already exists in this procedure - pick a different name.' : null,
                'enum_name_collision');
        }
    }

    Blockly.fieldRegistry.register('field_enum_type_name', FieldEnumTypeName);

    // A rename on THIS block doesn't by itself re-check every OTHER
    // enum_definition_local block that might now collide (or stop colliding)
    // with it - each such block re-validates itself against the rest of the
    // workspace on every workspace change instead. Same setOnChange
    // live-refresh idiom as get_localized_text_preview_refresh.
    Blockly.Extensions.register('enum_type_name_collision_refresh', function () {
        this.setOnChange(function () {
            const nameField = this.getField('NAME');
            if (nameField && typeof nameField.refreshCollisionWarning_ === 'function')
                nameField.refreshCollisionWarning_();

            const constantsField = this.getField('CONSTANTS');
            if (constantsField && typeof constantsField.refreshBake_ === 'function')
                constantsField.refreshBake_();
        });
    });
})();
