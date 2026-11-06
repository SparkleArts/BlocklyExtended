/**
 * Shared helpers for reading a locally-declared enum's structure off the
 * live block tree. Used by field_enum_constant_table.js (to bake the
 * constructor) and by field_enum_field_reference.js / enum_constant_field_get
 * (to let you pull a field's value back out of a constant elsewhere) - both
 * need to agree, byte-for-byte, on which Java identifier a given
 * enum_field_declaration block's NAME sanitizes to, so this lives in one
 * place instead of two copies that could drift apart.
 *
 * Exposed as window.BlocklyExtendedEnum rather than mixed into any Field or
 * Block prototype, specifically so it carries zero risk of the
 * reserved-name-collision bug class documented in
 * feedback_blockly_field_reserved_names.md / FIELD_TYPES.md's enum section -
 * these are plain functions on a plain namespace object, never added to
 * Blockly's own class hierarchies.
 */
(function () {
    // Best-effort turn an enum_field_declaration block's free-typed NAME
    // into a valid Java identifier for codegen purposes - the block's own
    // field_input doesn't block invalid keystrokes (kept intentionally
    // simple, see FIELD_TYPES.md's known limitations for that block).
    function columnJavaName(col) {
        let name = (col.name || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^[0-9]/, '_$&');
        name = name.replace(/^_+|_+$/g, '');
        if (!name)
            return 'value';
        return name.charAt(0).toLowerCase() + name.slice(1);
    }

    // Live-reads an enum_definition_local block's typed fields off its
    // FIELDS statement chain - never cached, always the current on-canvas
    // state. Returns [] for a missing/flyout-preview block.
    function getFieldColumns(defBlock) {
        if (!defBlock)
            return [];
        const input = defBlock.getInput('FIELDS');
        let block = input && input.connection && input.connection.targetBlock();
        const columns = [];
        while (block) {
            columns.push({
                id: block.id,
                name: block.getFieldValue('NAME') || 'value',
                type: block.getFieldValue('TYPE') || 'int'
            });
            block = block.getNextBlock();
        }
        return columns;
    }

    // Finds the enum_definition_local block in the given workspace whose
    // NAME field currently matches enumName - same scan every enum
    // reference field in this plugin already does.
    function findEnumDefinition(workspace, enumName) {
        if (!workspace || !enumName)
            return null;
        return workspace.getAllBlocks(false).find(block =>
            block.type === 'enum_definition_local' && block.getFieldValue('NAME') === enumName) || null;
    }

    // Maps an enum_field_declaration's Java type to the MCreator/Blockly
    // output "check" a get-field-value block should expose, so it plugs
    // into ordinary Number/String/Boolean sockets instead of nothing.
    // Since field_java_type_input made TYPE free-typeable (any Java type, not
    // just the old fixed int/long/double/float/boolean/String list), only the
    // handful of recognizable primitive-ish keywords get a strict check here -
    // an unrecognized/custom type (ItemStack, a generic, a typo) falls back to
    // null (universally connectable), same precedent as enum_constant_get's own
    // untyped output, rather than the old blanket "anything else is Number",
    // which would have been actively wrong (and misleadingly blocked valid
    // connections) for anything that wasn't actually numeric.
    function javaTypeToCheck(type) {
        switch (type) {
            case 'boolean':
                return 'Boolean';
            case 'String':
                return 'String';
            case 'int':
            case 'long':
            case 'short':
            case 'byte':
            case 'double':
            case 'float':
                return 'Number';
            default:
                return null;
        }
    }

    window.BlocklyExtendedEnum = { columnJavaName, getFieldColumns, findEnumDefinition, javaTypeToCheck };
})();
