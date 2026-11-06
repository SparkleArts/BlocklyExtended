/**
 * A field that opens a native OS file (or folder) picker dialog via the
 * "blocklyExtendedBridge" Java bridge (registered by BlocklyExtended's
 * BlocklyPanelRegisterDOMData listener) and stores the chosen absolute path.
 * The field itself never lets you type a path directly - clicking it is the
 * only way to change its value, same restriction MCreator core's own
 * field_color_selector.js applies to color values.
 *
 * On-block it shows just the file/folder name (not the full path) to avoid
 * the block growing huge for long paths; the full absolute path is shown via
 * tooltip on hover and is what actually gets serialized/generated.
 *
 * Usage in a block's args0:
 * { "type": "field_file_picker", "name": "PATH", "path": "", "mode": "FILE" }
 * "mode" is one of "FILE" (default), "DIRECTORY", or "BOTH".
 */
(function () {
    class FieldFilePicker extends Blockly.Field {

        EDITABLE = true;
        SERIALIZABLE = true;
        CURSOR = 'pointer';

        constructor(path = '', opt_validator, opt_config) {
            super(path, opt_validator, opt_config);
            this.mode_ = (opt_config && opt_config['mode']) || 'FILE';
            this.setTooltip(() => this.getValue() || '(no file selected)');
        }

        static fromJson(options) {
            return new this(options['path'] || '', undefined, options);
        }

        onMouseDown_(e) {
            if (this.sourceBlock_ && !this.sourceBlock_.isInFlyout) {
                e.stopPropagation();
                const thisField = this;
                blocklyExtendedBridge.openFileDialog(this.getValue() || '', this.mode_, {
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
        }

        getText_() {
            const value = this.getValue();
            if (!value)
                return '(no file selected)';
            const parts = value.split(/[\\/]/);
            return parts[parts.length - 1];
        }
    }

    Blockly.fieldRegistry.register('field_file_picker', FieldFilePicker);
})();
