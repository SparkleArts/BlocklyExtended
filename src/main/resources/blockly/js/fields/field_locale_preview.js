/**
 * A read-only companion field for get_localized_text: pick a locale (via a
 * flag-emoji dropdown, built from whichever locales the workspace already
 * has translations for) and see that locale's current text for the key
 * plugged into the block's "key" socket - live, without leaving the
 * procedure editor or opening MCreator's separate lang-file panel.
 *
 * This field never writes anything - it only reads from the workspace's
 * language map via the read-only "blocklyExtendedLocaleBridge" bridge.
 * Editing translations still happens in MCreator's own lang-file editor;
 * this is a preview, not a replacement for it.
 *
 * The key is read directly off the connected block's field when it's a
 * literal "text" block (the common case, and what get_localized_text's own
 * toolbox default plugs in). A dynamically-computed key (e.g. built via
 * string concatenation) can't be resolved statically, so the preview falls
 * back to "(dynamic key)" rather than guessing.
 *
 * Registers the "get_localized_text_preview_refresh" block extension, which
 * re-reads the preview whenever anything on the workspace changes (cheapest
 * correct way to notice the connected key block's value changing, since
 * Blockly fields don't get notified about sibling input changes on their
 * own - only blocks do, via Block.prototype.setOnChange).
 *
 * Usage in a block's args0: { "type": "field_locale_preview", "name": "LOCALE_PREVIEW", "locale": "en_us" }
 */
(function () {
    function localeFlagEmoji(locale) {
        const country = (locale || '').split('_').pop();
        if (!/^[a-zA-Z]{2}$/.test(country || ''))
            return '🌐'; // globe - locale code doesn't look like "xx_YY"
        const points = country.toUpperCase().split('').map(c => 0x1F1E6 + (c.charCodeAt(0) - 65));
        return String.fromCodePoint(...points);
    }

    // Same "§"-code -> styled-segment parsing as field_text_preview - duplicated
    // rather than shared, since script load order between the two field files
    // isn't guaranteed (alphabetically this file loads first). The localized
    // preview text can itself contain "§" formatting codes (that's exactly what
    // a lang-file value looks like), so it deserves the same auto text coloring
    // instead of showing the raw codes.
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

    // Same background-detection trick as field_dropdown_searchable.js -
    // duplicated rather than shared for the same load-order-independence
    // reason as parseFormatting above. The locale dropdown's background comes
    // from Blockly.DropDownDiv.setColour(sourceBlock colour) and varies by
    // block colour/theme, so a fixed text color reads fine in one case and is
    // unreadable in the other. Walk up to find the real rendered background
    // color, then pick black or white by standard perceived brightness.
    function findEffectiveBackgroundColor(element) {
        let el = element;
        while (el) {
            const bg = window.getComputedStyle(el).backgroundColor;
            const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
                const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
                if (alpha > 0)
                    return [Number(match[1]), Number(match[2]), Number(match[3])];
            }
            el = el.parentElement;
        }
        return [255, 255, 255]; // fallback: assume a light background
    }

    function readableTextColorFor(element) {
        const [r, g, b] = findEffectiveBackgroundColor(element);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000; // YIQ perceived brightness
        return brightness >= 128 ? '#000000' : '#ffffff';
    }

    class FieldLocalePreview extends Blockly.Field {

        EDITABLE = true;
        SERIALIZABLE = true;
        CURSOR = 'pointer';

        constructor(locale = 'en_us', opt_validator, opt_config) {
            super(locale, opt_validator, opt_config);
            this.previewText_ = '';
        }

        static fromJson(options) {
            return new this(options['locale'] || 'en_us', undefined, options);
        }

        initView() {
            super.initView();
            this.refreshPreview();
            // On XML load, sibling blocks (like the "text" block plugged into
            // "key") may not be fully attached/valued yet at this exact point -
            // defer one tick so the preview reflects the fully-loaded block tree
            // instead of whatever was available mid-deserialization.
            setTimeout(() => this.refreshPreview(), 0);
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.refreshPreview();
        }

        onMouseDown_(e) {
            if (!this.sourceBlock_ || this.sourceBlock_.isInFlyout)
                return;
            e.stopPropagation();

            const locales = blocklyExtendedLocaleBridge.getDefinedLocales();
            const contentDiv = Blockly.DropDownDiv.getContentDiv();
            contentDiv.innerHTML = '';
            contentDiv.style.padding = '4px';

            // setColour() must run before we read the dropdown's actual
            // rendered background below - it's what sets that background in
            // the first place.
            Blockly.DropDownDiv.setColour(this.sourceBlock_.getColour(), this.sourceBlock_.getColourTertiary());
            const textColor = readableTextColorFor(contentDiv);
            const hoverBackground = textColor === '#000000' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.16)';

            (locales && locales.length ? locales : ['en_us']).forEach(locale => {
                const item = document.createElement('div');
                item.textContent = localeFlagEmoji(locale) + '  ' + locale;
                item.style.padding = '6px 12px';
                item.style.cursor = 'pointer';
                item.style.whiteSpace = 'nowrap';
                item.style.color = textColor;
                item.addEventListener('mouseenter', () => item.style.background = hoverBackground);
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                item.addEventListener('click', () => {
                    this.setValue(locale);
                    Blockly.DropDownDiv.hideWithoutAnimation();
                });
                contentDiv.appendChild(item);
            });

            Blockly.DropDownDiv.showPositionedByField(this, () => {
            });
        }

        refreshPreview() {
            const keyBlock = this.sourceBlock_ && this.sourceBlock_.getInputTargetBlock('key');
            const key = (keyBlock && keyBlock.type === 'text') ? keyBlock.getFieldValue('TEXT') : null;

            this.previewText_ = key ?
                (blocklyExtendedLocaleBridge.getLocalizedTextPreview(key, this.getValue()) || '(not set)') :
                '(dynamic key)';

            // forceRerender() (not render_() directly) - it also queues the
            // *block's* own re-layout, which is what actually resizes the
            // block's outer shape to match this field's new content. Calling
            // render_() alone only redraws this field's own elements and
            // leaves the block outline stale until something else (e.g. a
            // real value change elsewhere) happens to trigger a full re-layout.
            this.forceRerender();
        }

        // Plain-text fallback for any Blockly internals that read getText() directly
        // instead of going through our custom render_().
        getText_() {
            return localeFlagEmoji(this.getValue()) + '  ' + this.previewText_.replace(/§./g, '');
        }

        render_() {
            if (!this.textElement_)
                return;

            while (this.textElement_.firstChild) {
                this.textElement_.removeChild(this.textElement_.firstChild);
            }

            const svgNS = 'http://www.w3.org/2000/svg';

            const prefix = document.createElementNS(svgNS, 'tspan');
            prefix.textContent = localeFlagEmoji(this.getValue()) + '  ';
            this.textElement_.appendChild(prefix);

            const segments = parseFormatting(this.previewText_ || '');
            if (segments.length === 0) {
                const tspan = document.createElementNS(svgNS, 'tspan');
                tspan.textContent = ' ';
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

        // See field_text_preview's identical override for why: default
        // updateSize_() measures width with a single canvas.measureText() call
        // using one font spec, so per-tspan font-weight="bold" segments (and the
        // wider glyphs they render as) are invisible to it.
        // getComputedTextLength() reflects real per-tspan styling instead.
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

    Blockly.fieldRegistry.register('field_locale_preview', FieldLocalePreview);

    Blockly.Extensions.register('get_localized_text_preview_refresh', function () {
        this.setOnChange(function () {
            const previewField = this.getField('LOCALE_PREVIEW');
            if (previewField && typeof previewField.refreshPreview === 'function')
                previewField.refreshPreview();
        });
    });
})();
