package org.sparklearts.blocklyextended;

import net.mcreator.plugin.JavaPlugin;
import net.mcreator.plugin.Plugin;
import net.mcreator.plugin.events.ui.BlocklyPanelRegisterDOMData;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class BlocklyExtended extends JavaPlugin {

    private static final Logger LOG = LogManager.getLogger("BlocklyExtended");

    public BlocklyExtended(Plugin plugin) {
        super(plugin);

        addListener(BlocklyPanelRegisterDOMData.class, event -> {
            event.addJavaScriptBridge("blocklyExtendedBridge", new FilePickerBridge(event.getBlocklyPanel()));
            event.addJavaScriptBridge("blocklyExtendedLocaleBridge",
                    new LocalizationPreviewBridge(event.getBlocklyPanel()));
            event.addJavaScriptBridge("blocklyExtendedCodeBridge", new CodeEditorBridge(event.getBlocklyPanel()));
            event.addJavaScriptBridge("blocklyExtendedVariableTypesBridge",
                    new VariableTypeBridge(event.getBlocklyPanel()));
        });

        LOG.info("Blockly Extended plugin was loaded");
    }

}
