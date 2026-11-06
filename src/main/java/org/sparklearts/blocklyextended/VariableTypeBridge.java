package org.sparklearts.blocklyextended;

import net.mcreator.ui.blockly.BlocklyPanel;
import net.mcreator.ui.dialogs.StringSelectorDialog;
import net.mcreator.ui.init.L10N;
import net.mcreator.workspace.Workspace;
import net.mcreator.workspace.elements.VariableType;
import net.mcreator.workspace.elements.VariableTypeLoader;

import javax.swing.SwingUtilities;
import java.util.TreeSet;
import java.util.function.Consumer;

/**
 * Registered as "blocklyExtendedVariableTypesBridge" in the Blockly JCEF view (see
 * BlocklyExtended's BlocklyPanelRegisterDOMData listener). Powers
 * field_java_type_selector for enum_field_declaration's TYPE field.
 *
 * VariableTypeLoader.INSTANCE holds every "VariableType" any loaded plugin has
 * registered via its own variables/*.json (MCreator core's own number/string/
 * itemstack/entity/etc. are loaded through this exact same mechanism, not treated
 * specially) - that's the actual "variables registered via plugins" list. Each
 * VariableType's own friendly name (e.g. "itemstack") means nothing to Java though;
 * VariableType#getJavaType(Workspace) resolves it to the real class the *currently
 * active generator* maps it to (NameMapper(workspace, "types") - the same
 * <generator>/mappings/types.yaml lookup MCreator's own local-variable-declaration
 * codegen uses, e.g. "itemstack" -> "ItemStack" on neoforge-26.1.2), so that's what
 * gets exposed here.
 */
public class VariableTypeBridge {

    private final BlocklyPanel blocklyPanel;

    // Recomputed by refresh_() on every openJavaTypeSelector() call rather than
    // cached across calls - the registered variable-type list only realistically
    // changes between MCreator sessions, but there's no change signal to invalidate
    // a cache on, so it's cheap enough to just always recompute.
    private String[] javaTypes = new String[0];

    public VariableTypeBridge(BlocklyPanel blocklyPanel) {
        this.blocklyPanel = blocklyPanel;
    }

    /**
     * Opens MCreator's own native searchable list selector (StringSelectorDialog -
     * the exact "Filter:" + list + "Use selected" modal core's own data-list/
     * procedure Blockly selectors use, via net.mcreator.ui.dialogs.ListSelectorDialog)
     * populated with every registered variable type's resolved Java class, rather
     * than an inline Blockly dropdown. Core's own equivalent,
     * javabridge.openEntrySelector(type, ...), can't be reused directly for this -
     * its "type" string is dispatched through a closed, hardcoded switch inside
     * BlocklyJavascriptBridge/BlocklyElementUtil with no plugin extension point (the
     * same class of limitation as MCreator's IBlockGenerator registry) - so this
     * calls StringSelectorDialog directly instead, a plain public core class, with
     * our own entry list rather than a core-recognized "type" name.
     */
    @SuppressWarnings("unused") public void openJavaTypeSelector(Consumer<String> callback) {
        SwingUtilities.invokeLater(() -> {
            refresh_();
            String selected = StringSelectorDialog.openSelectorDialog(blocklyPanel.getMCreator(), w -> javaTypes,
                    L10N.t("dialog.selector.title"), "Select a Java type:");
            callback.accept(selected);
        });
    }

    private void refresh_() {
        Workspace workspace = blocklyPanel.getMCreator().getWorkspace();

        // TreeSet: deduped (two variable types can resolve to the same Java class
        // for a given generator, e.g. "number" and a plugin's own numeric type both
        // mapping to "double") and sorted for free.
        TreeSet<String> types = new TreeSet<>();
        for (VariableType type : VariableTypeLoader.INSTANCE.getAllVariableTypes()) {
            if (!type.isSupportedInWorkspace(workspace))
                continue;

            String javaType = type.getJavaType(workspace);
            if (javaType != null && !javaType.isBlank())
                types.add(javaType);
        }

        javaTypes = types.toArray(new String[0]);
    }

}
