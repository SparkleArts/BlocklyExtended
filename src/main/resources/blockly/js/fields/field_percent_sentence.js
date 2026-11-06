/**
 * A dropdown that turns a percent block into a readable sentence. The picked mode is
 * shown as the phrase between the two number sockets, and the field rewrites the rest
 * of the block around it (prefix/suffix labels and which socket comes first):
 *
 *   OF         ( a ) % of ( b )
 *   VALUE      ( a ) is what % of ( b )
 *   INCREASE   ( b ) increased by ( a ) %
 *   DECREASE   ( b ) decreased by ( a ) %
 *   CHANGE     % change from ( a ) to ( b )
 *   DIFFERENCE % difference between ( a ) and ( b )
 *
 * The menu lists the full sentences ("b increased by a %"); the block only shows the
 * short phrase for the current mode. Mode values are SparkleCore's PercentUtil.Mode
 * constant names, so a block's FTL can append ${field$mode} directly.
 *
 * Block contract (the field looks these up by name and does nothing if one is missing):
 *   - value inputs "a" and "b" (they keep their names whichever one is shown first, so
 *     code generation and saved XML never depend on the layout),
 *   - dummy inputs "PRE_I" (holds label field "PRE"), "MID" (holds this field) and
 *     "POST_I" (holds label field "POST"), in the order PRE_I, a, MID, b, POST_I.
 *
 * Usage in a block's args0 (the field ignores any "options" config):
 * [
 *   { "type": "field_label", "name": "PRE", "text": "" },
 *   { "type": "input_dummy", "name": "PRE_I" },
 *   { "type": "input_value", "name": "a", "check": "Number" },
 *   { "type": "field_percent_sentence", "name": "mode" },
 *   { "type": "input_dummy", "name": "MID" },
 *   { "type": "input_value", "name": "b", "check": "Number" },
 *   { "type": "field_label", "name": "POST", "text": "" },
 *   { "type": "input_dummy", "name": "POST_I" }
 * ]
 */
(function () {
    const MODES = {
        OF: {
            menu: 'a % of b', phrase: '% of', pre: '', post: '', first: 'a', second: 'b',
            tip: 'a % of b = a / 100 × b'
        },
        VALUE: {
            menu: 'a is what % of b', phrase: 'is what % of', pre: '', post: '', first: 'a', second: 'b',
            tip: 'What percent a is of b = a / b × 100 (0 if b is 0)'
        },
        INCREASE: {
            menu: 'b increased by a %', phrase: 'increased by', pre: '', post: '%', first: 'b', second: 'a',
            tip: 'b increased by a % = b × (1 + a / 100)'
        },
        DECREASE: {
            menu: 'b decreased by a %', phrase: 'decreased by', pre: '', post: '%', first: 'b', second: 'a',
            tip: 'b decreased by a % = b × (1 - a / 100)'
        },
        CHANGE: {
            menu: '% change from a to b', phrase: 'to', pre: '% change from', post: '', first: 'a', second: 'b',
            tip: 'Percent change from a to b = (b - a) / a × 100 (0 if a is 0, negative if b < a)'
        },
        DIFFERENCE: {
            menu: '% difference between a and b', phrase: 'and', pre: '% difference between', post: '',
            first: 'a', second: 'b',
            tip: 'Symmetric percent difference = |a - b| / ((a + b) / 2) × 100 (0 if the average is 0)'
        }
    };

    class FieldPercentSentence extends Blockly.FieldDropdown {

        static fromJson(options) {
            return new this();
        }

        constructor() {
            super(Object.keys(MODES).map(function (mode) {
                return [MODES[mode].menu, mode];
            }));
        }

        // The block shows only the short phrase; the menu keeps the full sentences.
        getText_() {
            const mode = MODES[this.getValue()];
            return mode ? mode.phrase : super.getText_();
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.applySentenceLayout_();
        }

        initView() {
            super.initView();
            // The block is still initializing its inputs here, so moving inputs now would disturb
            // that loop; apply the starting layout (hides the empty prefix/suffix) right afterwards.
            setTimeout(() => this.applySentenceLayout_(), 0);
        }

        applySentenceLayout_() {
            const block = this.getSourceBlock();
            const mode = MODES[this.getValue()];
            if (!block || !mode || (block.isDeadOrDying && block.isDeadOrDying()))
                return;

            const names = ['PRE_I', 'a', 'MID', 'b', 'POST_I'];
            if (!names.every(function (name) { return block.getInput(name); }))
                return;

            // Place from the end so each input ends up directly before the next one.
            const order = ['PRE_I', mode.first, 'MID', mode.second, 'POST_I'];
            for (let i = order.length - 2; i >= 0; i--)
                block.moveInputBefore(order[i], order[i + 1]);

            const pre = block.getField('PRE');
            if (pre)
                pre.setValue(mode.pre);
            block.getInput('PRE_I').setVisible(mode.pre !== '');

            const post = block.getField('POST');
            if (post)
                post.setValue(mode.post);
            block.getInput('POST_I').setVisible(mode.post !== '');

            block.setTooltip(mode.tip);

            if (block.rendered && block.queueRender)
                block.queueRender();
        }
    }

    Blockly.fieldRegistry.register('field_percent_sentence', FieldPercentSentence);
})();
