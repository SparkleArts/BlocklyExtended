package org.sparklearts.blocklyextended;

import net.mcreator.ui.blockly.BlocklyPanel;
import net.mcreator.ui.init.L10N;

import java.util.Map;

/**
 * Registered as "blocklyExtendedLocaleBridge" in the Blockly JCEF view (see
 * BlocklyExtended's BlocklyPanelRegisterDOMData listener). Read-only lookups
 * into the current workspace's in-memory language map (Workspace#getLanguageMap()),
 * which is also what MCreator's own lang-file editor panel reads/writes -
 * this bridge never touches that map, only reads it, for a live preview.
 */
public class LocalizationPreviewBridge {

    private final BlocklyPanel blocklyPanel;

    public LocalizationPreviewBridge(BlocklyPanel blocklyPanel) {
        this.blocklyPanel = blocklyPanel;
    }

    @SuppressWarnings("unused") public String getLocalizedTextPreview(String key, String locale) {
        if (key == null || locale == null)
            return "";

        Map<String, String> localeMap = blocklyPanel.getMCreator().getWorkspace().getLanguageMap().get(locale);
        if (localeMap == null)
            return "";

        return localeMap.getOrDefault(key, "");
    }

    /** Replaces core's javabridge.t(key), which MCreator 2026.3 removed. Returns "" for an unknown key. */
    @SuppressWarnings("unused") public String t(String key) {
        String text = key == null ? null : L10N.t(key);
        return text == null ? "" : text;
    }

    @SuppressWarnings("unused") public String[] getDefinedLocales() {
        return blocklyPanel.getMCreator().getWorkspace().getLanguageMap().keySet().toArray(new String[0]);
    }

}
