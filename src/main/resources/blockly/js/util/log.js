/**
 * Shared, tagged error/warn logging for BlocklyExtended's custom fields.
 *
 * Every message goes through console.error/console.warn with a consistent
 * "[BlocklyExtended][<tag>]" prefix, so a bug report's console/CEF log dump
 * can be grepped for "[BlocklyExtended]" to find every place this plugin's
 * own code (as opposed to Blockly/MCreator core) logged something, and by
 * "[<tag>]" to narrow to one field. This does NOT catch the reserved-name
 * collision bug class (see the Claude memory
 * feedback_blockly_field_reserved_names.md / FIELD_TYPES.md's enum section
 * bugs #1/#2) - those degrade silently inside Blockly's own code with
 * nothing to catch or log. This is for genuine thrown errors in this
 * plugin's own field code (malformed serialized values, unexpected sibling
 * field state, etc.) that would otherwise just vanish as an uncaught
 * exception with no context about which field/block caused it.
 *
 * Usage:
 *   try {
 *       ...
 *   } catch (err) {
 *       BlocklyExtendedLog.error('field_enum_constant_table', 'failed to parse stored value', err);
 *   }
 */
(function () {
    function prefix(tag) {
        return '[BlocklyExtended]' + (tag ? '[' + tag + ']' : '');
    }

    window.BlocklyExtendedLog = {
        error: function (tag, message, err) {
            if (err !== undefined)
                console.error(prefix(tag) + ' ' + message, err);
            else
                console.error(prefix(tag) + ' ' + message);
        },
        warn: function (tag, message) {
            console.warn(prefix(tag) + ' ' + message);
        }
    };
})();
