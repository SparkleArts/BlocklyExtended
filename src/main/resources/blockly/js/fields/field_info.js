/**
 * A small clickable label field, "ℹ" by default. On click, shows a popup with the
 * block's tooltip (or a richer text another plugin provides - see info_popup.js).
 *
 * Usage in a block's args0: { "type": "field_info" }
 * Optional overrides: { "type": "field_info", "text": "❓", "class": "my-css-class" }
 */
(function () {
    class FieldInfo extends Blockly.FieldLabel {

        static fromJson(options) {
            return new this(options['text'] || 'ℹ', options['class'], options);
        }

        initView() {
            super.initView();

            const svgRoot = this.getSvgRoot();
            if (!svgRoot)
                return;

            svgRoot.style.cursor = 'pointer';
            svgRoot.classList.add('blockly-extended-field-info');

            const field = this;
            svgRoot.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!field.sourceBlock_ || field.sourceBlock_.isInFlyout)
                    return;

                document.dispatchEvent(new CustomEvent('blockly-extended:field-info-click', {
                    detail: {
                        block: field.sourceBlock_,
                        field: field,
                        rect: svgRoot.getBoundingClientRect()
                    }
                }));
            });
        }
    }

    Blockly.fieldRegistry.register('field_info', FieldInfo);
})();
