/**
 * Info popup system backing field_info.js (and any other field/UI that wants to
 * show a small text popup near a block). Listens for the
 * "blockly-extended:field-info-click" CustomEvent on `document` (detail:
 * { block, field, rect }) and shows a popup with the resolved text at that spot.
 *
 * Text resolution, via window.BlocklyExtended.resolveFieldInfoText(block), prefers
 * a dedicated "blockly.block.<machine_name>.info" lang key (resolved through
 * this plugin's "blocklyExtendedLocaleBridge.t" (core's javabridge.t was removed in 2026.3) -
 * L10N lookup) and falls back to the block's tooltip.
 * Any plugin can still override resolveFieldInfoText entirely for custom behavior,
 * as long as it does so before this script runs.
 */
(function () {
    window.BlocklyExtended = window.BlocklyExtended || {};
    window.BlocklyExtended.resolveFieldInfoText = window.BlocklyExtended.resolveFieldInfoText || function (block) {
        var info = typeof blocklyExtendedLocaleBridge !== 'undefined' ? blocklyExtendedLocaleBridge.t('blockly.block.' + block.type + '.info') : null;
        if (info) return info;
        return typeof block.tooltip === 'function' ? block.tooltip() : block.tooltip;
    };

    if (window.__blocklyExtendedInfoPopupInit)
        return;
    window.__blocklyExtendedInfoPopupInit = true;

    var style = document.createElement('style');
    style.textContent = '.blockly-extended-info-popup {' +
        'position: fixed; z-index: 99999; display: none; max-width: 260px;' +
        'padding: 6px 10px; font-size: 12px; line-height: 1.4;' +
        'background: #fffbe6; color: #333; border: 1px solid #c9b458;' +
        'border-radius: 4px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);' +
        '}';
    document.head.appendChild(style);

    var popup = document.createElement('div');
    popup.className = 'blockly-extended-info-popup';
    document.body.appendChild(popup);

    function hidePopup() {
        popup.style.display = 'none';
        popup.dataset.blockId = '';
    }

    document.addEventListener('click', function (e) {
        if (!popup.contains(e.target) && !(e.target && e.target.closest && e.target.closest('.blockly-extended-field-info'))) {
            hidePopup();
        }
    }, true);

    document.addEventListener('blockly-extended:field-info-click', function (e) {
        var block = e.detail.block;
        var rect = e.detail.rect;

        if (popup.style.display === 'block' && popup.dataset.blockId === block.id) {
            hidePopup();
            return;
        }

        popup.textContent = window.BlocklyExtended.resolveFieldInfoText(block) || '';
        popup.dataset.blockId = block.id;
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + 4) + 'px';
        popup.style.display = 'block';
    });
})();
