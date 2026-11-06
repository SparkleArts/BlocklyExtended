/**
 * A dropdown field that renders every option as a segment of a single
 * segmented control instead of a text label + menu, so a value can be read
 * (and changed) without opening anything. Meant for 2-4 short, mutually
 * exclusive options where seeing all choices at a glance matters more than
 * saving horizontal space (e.g. side, damage type, rarity).
 *
 * Extends Blockly.FieldDropdown for its option list/value/serialization
 * machinery unchanged - only rendering and click handling are replaced.
 * Keyboard activation still falls back to FieldDropdown's normal dropdown
 * menu (showEditor_ is untouched), so the field stays keyboard-accessible;
 * only onMouseDown_ is overridden to select the clicked segment directly.
 *
 * Usage in a block's args0 (same "options" format as a normal dropdown):
 * {
 *   "type": "field_toggle_group",
 *   "name": "TYPE",
 *   "options": [["Physical", "PHYSICAL"], ["Magic", "MAGIC"], ["True", "TRUE"]]
 * }
 *
 * Known limitation: the option list is assumed fixed for the field's
 * lifetime (one <text> element is created per option in initView()). A
 * dynamic (function-based) menuGenerator whose option *count* changes after
 * the field is created isn't supported.
 */
(function () {
    const SEGMENT_H_PADDING = 7;
    const HIGHLIGHT_INSET = 4;

    class FieldToggleGroup extends Blockly.FieldDropdown {

        CURSOR = 'pointer';

        static fromJson(options) {
            return new this(options['options'], undefined, options);
        }

        initView() {
            super.initView();

            if (this.svgArrow)
                this.svgArrow.style.display = 'none';
            if (this.arrow)
                this.arrow.style.display = 'none';

            const svgNS = 'http://www.w3.org/2000/svg';

            this.highlightElement_ = document.createElementNS(svgNS, 'rect');
            this.highlightElement_.setAttribute('fill', 'rgba(255, 255, 255, 0.92)');
            this.fieldGroup_.appendChild(this.highlightElement_);

            this.dividerLines_ = [];
            this.segmentTexts_ = [];

            const options = this.getOptions(false);
            options.forEach((option, i) => {
                if (i > 0) {
                    const divider = document.createElementNS(svgNS, 'line');
                    divider.setAttribute('stroke', 'rgba(255, 255, 255, 0.35)');
                    divider.setAttribute('stroke-width', '1');
                    this.fieldGroup_.appendChild(divider);
                    this.dividerLines_.push(divider);
                }

                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('text-anchor', 'middle');
                text.textContent = Array.isArray(option) ? option[0] : option;
                Blockly.utils.dom.addClass(text, 'blocklyText');
                this.fieldGroup_.appendChild(text);
                this.segmentTexts_.push(text);
            });
        }

        onMouseDown_(e) {
            if (!this.sourceBlock_ || this.sourceBlock_.isInFlyout)
                return;
            e.stopPropagation();

            const rect = this.fieldGroup_.getBoundingClientRect();
            if (rect.width === 0)
                return;

            const fraction = (e.clientX - rect.left) / rect.width;
            const localX = fraction * this.size_.width;
            let index = Math.floor((localX - this.xPadding_) / this.segmentWidth_);
            index = Math.max(0, Math.min(this.segmentTexts_.length - 1, index));

            const options = this.getOptions(false);
            const newValue = options[index][1];
            if (newValue !== this.getValue())
                this.setValue(newValue);
        }

        render_() {
            this.getTextContent().nodeValue = '';
            if (this.imageElement)
                this.imageElement.style.display = 'none';

            const constants = this.getConstants();
            const hasBorder = !!this.borderRect_;
            const height = Math.max(
                hasBorder ? constants.FIELD_DROPDOWN_BORDER_RECT_HEIGHT : 0,
                constants.FIELD_TEXT_HEIGHT
            );
            const xPadding = hasBorder ? constants.FIELD_BORDER_RECT_X_PADDING : 0;

            let segmentWidth = 0;
            this.segmentTexts_.forEach(text => {
                segmentWidth = Math.max(segmentWidth, text.getComputedTextLength() + SEGMENT_H_PADDING * 2);
            });

            const count = this.segmentTexts_.length;
            this.xPadding_ = xPadding;
            this.segmentWidth_ = segmentWidth;
            this.size_ = new Blockly.utils.Size(segmentWidth * count + xPadding * 2, height);

            const options = this.getOptions(false);
            const selectedIndex = options.findIndex(option => option[1] === this.getValue());
            const baselineY = height / 2 + 5;

            this.segmentTexts_.forEach((text, i) => {
                const active = i === selectedIndex;
                text.setAttribute('x', xPadding + segmentWidth * i + segmentWidth / 2);
                text.setAttribute('y', baselineY);
                text.setAttribute('fill', active ? '#1B2333' : '#FFFFFF');
                text.setAttribute('fill-opacity', active ? '1' : '0.75');
                text.style.fontWeight = active ? '600' : 'normal';
            });

            this.dividerLines_.forEach((line, i) => {
                const x = xPadding + segmentWidth * (i + 1);
                line.setAttribute('x1', x);
                line.setAttribute('x2', x);
                line.setAttribute('y1', height * 0.22);
                line.setAttribute('y2', height * 0.78);
            });

            this.highlightElement_.setAttribute('x', xPadding + segmentWidth * selectedIndex + HIGHLIGHT_INSET);
            this.highlightElement_.setAttribute('y', HIGHLIGHT_INSET);
            this.highlightElement_.setAttribute('width', Math.max(0, segmentWidth - HIGHLIGHT_INSET * 2));
            this.highlightElement_.setAttribute('height', Math.max(0, height - HIGHLIGHT_INSET * 2));
            this.highlightElement_.setAttribute('rx', Math.max(0, height - HIGHLIGHT_INSET * 2) / 2);

            this.positionBorderRect_();
        }
    }

    Blockly.fieldRegistry.register('field_toggle_group', FieldToggleGroup);
})();
