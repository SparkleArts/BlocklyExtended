package org.sparklearts.blocklyextended;

import net.mcreator.ui.blockly.BlocklyPanel;
import net.mcreator.ui.ide.RSyntaxTextAreaStyler;
import org.fife.ui.rsyntaxtextarea.RSyntaxTextArea;
import org.fife.ui.rsyntaxtextarea.SyntaxConstants;
import org.fife.ui.rtextarea.RTextScrollPane;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

/**
 * Registered as "blocklyExtendedCodeBridge" in the Blockly JCEF view (see
 * BlocklyExtended's BlocklyPanelRegisterDOMData listener). Opens the same
 * RSyntaxTextArea + RSyntaxTextAreaStyler combo MCreator's own code IDE view
 * (net.mcreator.ui.ide.CodeEditorView) uses, so the popup editor gets real Java
 * syntax highlighting and matches whatever MCreator theme/editor theme is
 * currently active, for free - no bundled JS editor, no new dependencies
 * (rsyntaxtextarea/autocomplete are already pulled in transitively from the
 * :MCreator project dependency).
 */
public class CodeEditorBridge {

    private final BlocklyPanel blocklyPanel;

    public CodeEditorBridge(BlocklyPanel blocklyPanel) {
        this.blocklyPanel = blocklyPanel;
    }

    @SuppressWarnings("unused") public void openCodeEditor(String code, Consumer<String> callback) {
        SwingUtilities.invokeLater(() -> {
            RSyntaxTextArea textArea = new RSyntaxTextArea(code == null ? "" : code);
            textArea.setSyntaxEditingStyle(SyntaxConstants.SYNTAX_STYLE_JAVA);
            textArea.setCodeFoldingEnabled(true);
            textArea.setAntiAliasingEnabled(true);
            textArea.setTabSize(4);

            RTextScrollPane scrollPane = new RTextScrollPane(textArea);
            RSyntaxTextAreaStyler.style(textArea, scrollPane, 13);

            JButton okButton = new JButton("OK");
            JButton cancelButton = new JButton("Cancel");

            JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT));
            buttons.add(okButton);
            buttons.add(cancelButton);

            JPanel panel = new JPanel(new BorderLayout());
            panel.setPreferredSize(new Dimension(760, 520));
            panel.add(scrollPane, BorderLayout.CENTER);
            panel.add(buttons, BorderLayout.SOUTH);

            Window owner = SwingUtilities.getWindowAncestor(blocklyPanel);
            JDialog dialog = new JDialog(owner, "Edit Java code", Dialog.ModalityType.APPLICATION_MODAL);
            dialog.setContentPane(panel);

            boolean[] confirmed = { false };
            okButton.addActionListener(e -> {
                confirmed[0] = true;
                dialog.dispose();
            });
            cancelButton.addActionListener(e -> dialog.dispose());

            dialog.getRootPane().setDefaultButton(okButton);
            dialog.pack();
            dialog.setLocationRelativeTo(owner);
            dialog.setVisible(true); // blocks (modal) until disposed, still fine here - we're inside invokeLater's own Runnable

            callback.accept(confirmed[0] ? textArea.getText() : null);
        });
    }

}
