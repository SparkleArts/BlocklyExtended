/**
 * A text input field that renders Minecraft "§" formatting codes (colors,
 * bold/italic/underline/strikethrough, reset) as styled text right on the
 * block, instead of showing the raw "§"-code string, once you finish editing.
 * Meant for message/lore style string fields.
 *
 * The preview intentionally only refreshes when editing ends (not on every
 * keystroke): while the HTML text editor is open, Blockly positions it to match
 * the field's SVG box at that moment and doesn't keep resizing it live, so
 * re-rendering (and resizing) the styled SVG text mid-edit makes it spill out
 * from under the input box as separate, interactable workspace content.
 *
 * Supported codes: §0-§f (colors), §l (bold), §o (italic),
 * §n (underline), §m (strikethrough), §r (reset). §k
 * (obfuscated) is accepted but rendered as plain text, since a static preview
 * can't meaningfully show the scrambling animation.
 *
 * Usage in a block's args0: { "type": "field_text_preview", "name": "text", "text": "" }
 *
 * Optional masking: implements setMasked(boolean), the interface
 * field_mask_toggle.js looks for on whatever field it's pointed at via its
 * own "target" config. When masked, the block face shows a fixed-width
 * "•••••••" instead of the real text (not sized to the real length, so it
 * doesn't leak how long the secret is), and the in-place text editor
 * switches to a real type="password" HTML input while open. This is a
 * display-only precaution against shoulder-surfing/screen-sharing a
 * workspace with an API key or other secret typed into a "text" block - the
 * generated Java code still contains the real literal value either way;
 * masking a block does nothing to keep the secret out of the compiled mod or
 * its source.
 */
(function () {
    const MASK_TEXT = '•••••••';

    const COLOR_CODES = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    function parseFormatting(text) {
        const segments = [];
        let color = null, bold = false, italic = false, underline = false, strikethrough = false;
        let current = '';

        function flush() {
            if (current.length > 0) {
                segments.push({ text: current, color, bold, italic, underline, strikethrough });
                current = '';
            }
        }

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '§' && i + 1 < text.length) {
                const code = text[i + 1].toLowerCase();
                if (COLOR_CODES[code]) {
                    flush();
                    color = COLOR_CODES[code];
                    bold = italic = underline = strikethrough = false;
                    i++;
                    continue;
                } else if (code === 'l') {
                    flush(); bold = true; i++; continue;
                } else if (code === 'o') {
                    flush(); italic = true; i++; continue;
                } else if (code === 'n') {
                    flush(); underline = true; i++; continue;
                } else if (code === 'm') {
                    flush(); strikethrough = true; i++; continue;
                } else if (code === 'r') {
                    flush(); color = null; bold = italic = underline = strikethrough = false; i++; continue;
                } else if (code === 'k') {
                    i++; continue; // obfuscated - no animation in a static preview, just skip the code
                }
                // unrecognized code - fall through, keep the "§" as literal text
            }
            current += ch;
        }
        flush();

        return segments;
    }

    class FieldTextPreview extends Blockly.FieldTextInput {

        SERIALIZABLE = true;

        masked_ = false;

        static fromJson(options) {
            return new this(options['text'] || '', undefined, options);
        }

        // Called by field_mask_toggle (or anything else pointed at this
        // field via its own "target" config) whenever the mask state changes.
        setMasked(masked) {
            masked = !!masked;
            if (masked === this.masked_)
                return;
            this.masked_ = masked;
            this.forceRerender();
        }

        // Plain-text fallback for any Blockly internals that read getText() directly
        // instead of going through our custom render_().
        getText_() {
            if (this.masked_)
                return this.getValue() ? MASK_TEXT : '';
            return (this.getValue() || '').replace(/§./g, '');
        }

        // super.showEditor_() creates the real HTML <input> Blockly overlays
        // on top of this field while editing (stored as this.htmlInput_,
        // stable across Blockly versions) - flip it to a real password input
        // so the value is obscured while typing too, not just on the block face.
        showEditor_(e, quietInput) {
            super.showEditor_(e, quietInput);
            if (this.masked_ && this.htmlInput_)
                this.htmlInput_.type = 'password';
        }

        render_() {
            if (!this.textElement_)
                return;

            while (this.textElement_.firstChild) {
                this.textElement_.removeChild(this.textElement_.firstChild);
            }

            const svgNS = 'http://www.w3.org/2000/svg';

            if (this.masked_) {
                const tspan = document.createElementNS(svgNS, 'tspan');
                tspan.textContent = this.getValue() ? MASK_TEXT : ' ';
                this.textElement_.appendChild(tspan);
                this.updateSize_();
                return;
            }

            const segments = parseFormatting(this.getValue() || '');

            if (segments.length === 0) {
                const tspan = document.createElementNS(svgNS, 'tspan');
                tspan.textContent = ' ';
                this.textElement_.appendChild(tspan);
            } else {
                segments.forEach(function (seg) {
                    const tspan = document.createElementNS(svgNS, 'tspan');
                    tspan.textContent = seg.text;
                    if (seg.color)
                        tspan.setAttribute('fill', seg.color);
                    if (seg.bold)
                        tspan.setAttribute('font-weight', 'bold');
                    if (seg.italic)
                        tspan.setAttribute('font-style', 'italic');
                    const decorations = [];
                    if (seg.underline)
                        decorations.push('underline');
                    if (seg.strikethrough)
                        decorations.push('line-through');
                    if (decorations.length > 0)
                        tspan.setAttribute('text-decoration', decorations.join(' '));
                    this.textElement_.appendChild(tspan);
                }, this);
            }

            this.updateSize_();
        }

        // Blockly's default updateSize_() measures width via a single
        // canvas.measureText() call using one font spec (taken from
        // getComputedStyle() of the outer <text> element) applied to the
        // whole textContent string. It never inspects individual <tspan>
        // children, so our per-segment font-weight="bold" is invisible to
        // it and the box gets sized as if everything were regular weight,
        // while bold glyphs actually render wider. getComputedTextLength()
        // is an SVG API that reflects real per-tspan styling instead.
        updateSize_(margin) {
            const constants = this.getConstants();
            const xPadding = margin !== undefined ? margin
                : (this.isFullBlockField() ? 0 : constants.FIELD_BORDER_RECT_X_PADDING);
            let totalHeight = constants.FIELD_TEXT_HEIGHT;
            let contentWidth = 0;

            if (this.textElement_) {
                contentWidth = this.textElement_.getComputedTextLength();
            }
            if (!this.isFullBlockField()) {
                totalHeight = Math.max(totalHeight, constants.FIELD_BORDER_RECT_HEIGHT);
            }

            this.size_ = new Blockly.utils.Size(xPadding * 2 + contentWidth, totalHeight);
            this.positionTextElement_(xPadding, contentWidth);
            this.positionBorderRect_();
        }
    }

    Blockly.fieldRegistry.register('field_text_preview', FieldTextPreview);
})();
