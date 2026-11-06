package org.sparklearts.blocklyextended;

import net.mcreator.ui.blockly.BlocklyPanel;

import javax.swing.JFileChooser;
import javax.swing.SwingUtilities;
import java.io.File;
import java.util.function.Consumer;

/**
 * Registered as "blocklyExtendedBridge" in the Blockly JCEF view (see
 * BlocklyExtended's BlocklyPanelRegisterDOMData listener), mirroring the same
 * javabridge.openColorSelector(...)-style callback convention MCreator core
 * uses for its own native-dialog fields.
 */
public class FilePickerBridge {

    private final BlocklyPanel blocklyPanel;

    public FilePickerBridge(BlocklyPanel blocklyPanel) {
        this.blocklyPanel = blocklyPanel;
    }

    @SuppressWarnings("unused") public void openFileDialog(String initialPath, String mode, Consumer<String> callback) {
        SwingUtilities.invokeLater(() -> {
            JFileChooser chooser = new JFileChooser();
            chooser.setFileSelectionMode(switch (mode == null ? "" : mode) {
                case "DIRECTORY" -> JFileChooser.DIRECTORIES_ONLY;
                case "BOTH" -> JFileChooser.FILES_AND_DIRECTORIES;
                default -> JFileChooser.FILES_ONLY;
            });

            if (initialPath != null && !initialPath.isEmpty()) {
                File initial = new File(initialPath);
                File directory = initial.isDirectory() ? initial : initial.getParentFile();
                if (directory != null)
                    chooser.setCurrentDirectory(directory);
                if (initial.exists())
                    chooser.setSelectedFile(initial);
            }

            int result = chooser.showOpenDialog(blocklyPanel);
            callback.accept(result == JFileChooser.APPROVE_OPTION ? chooser.getSelectedFile().getAbsolutePath() : null);
        });
    }

}
