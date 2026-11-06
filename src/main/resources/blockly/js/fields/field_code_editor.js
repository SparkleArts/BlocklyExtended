/**
 * A field that opens a native, full Java-syntax-highlighting code editor
 * (an RSyntaxTextArea dialog, via the "blocklyExtendedCodeBridge" Java bridge)
 * instead of the plain single-box multiline text editor MCreator core's own
 * "java_code"/"java_code_get" blocks use. Stores the edited code as its raw
 * value, same as any plain text field - the field itself is never typed into
 * directly, clicking is the only way to open the editor.
 *
 * On-block it shows a short one-line preview (first non-empty line,
 * truncated) instead of the full snippet, to avoid the block growing huge for
 * multi-line code; the full code is shown via tooltip on hover and is what
 * actually gets serialized/generated.
 *
 * Usage in a block's args0: { "type": "field_code_editor", "name": "CODE", "code": "" }
 */
(function () {
    const PREVIEW_MAX_LENGTH = 48;

    function previewFor(code) {
        if (!code || !code.trim())
            return '(empty)';

        const lines = code.split('\n');
        const firstLine = lines.find(line => line.trim().length > 0) || '';
        const truncated = firstLine.trim().length > PREVIEW_MAX_LENGTH ?
            firstLine.trim().slice(0, PREVIEW_MAX_LENGTH) + '…' : firstLine.trim();

        return lines.length > 1 ? truncated + '  (+' + (lines.length - 1) + ' more line' + (lines.length > 2 ? 's' : '') + ')' : truncated;
    }

    class FieldCodeEditor extends Blockly.Field {

        EDITABLE = true;
        SERIALIZABLE = true;
        CURSOR = 'pointer';

        constructor(code = '', opt_validator, opt_config) {
            super(code, opt_validator, opt_config);
            this.setTooltip(() => this.getValue() || '(empty)');
        }

        static fromJson(options) {
            return new this(options['code'] || '', undefined, options);
        }

        onMouseDown_(e) {
            if (!this.sourceBlock_ || this.sourceBlock_.isInFlyout)
                return;
            e.stopPropagation();

            const thisField = this;
            blocklyExtendedCodeBridge.openCodeEditor(this.getValue() || '', {
                'callback': function (value) {
                    if (value === null || value === undefined)
                        return; // dialog was cancelled

                    const group = Blockly.Events.getGroup();
                    Blockly.Events.setGroup(true);
                    thisField.setValue(value);
                    Blockly.Events.setGroup(group);
                    javabridge.triggerEvent();
                }
            });
        }

        getText_() {
            return previewFor(this.getValue());
        }
    }

    Blockly.fieldRegistry.register('field_code_editor', FieldCodeEditor);
})();
