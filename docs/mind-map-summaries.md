# Mind-map summaries

Select a topic and click **Add summary** (the bracket icon) in the floating toolbar. A summary can describe a single topic, including a collapsed topic, or several consecutive sibling topics. Shift-click to select more than one topic.

- Double-click the summary text to edit it.
- Select the summary and drag either range handle to change which sibling topics it covers.
- Delete the selected summary to remove its bracket and text while keeping the summarized topics.
- Undo and redo work as usual. Summaries are preserved in `.drawnix` files and image exports.

The button is disabled for a root topic, an existing summary, topics already covered by a summary, nonconsecutive topics, or topics with different parents. In a two-sided mind map, select topics on the same side. The action is hidden for non-mind-map selections and while editing text.

The default bracket uses Drawnix's built-in curly-note shape. An explicitly chosen polyline branch remains a polyline. Range handles, editing and layout still use the native summary.

Summary outlines, links and collapse controls follow the first covered topic's live branch colors. If a summary covers differently colored branches, the first topic is the color source. The summary's children use the same branch palette, including after a theme change or range resize. Each node's explicit outline color, branch color, fill, width and stroke style still wins. As with ordinary topics, changing only a parent's explicit color does not automatically recolor its children.

A board-local rendering adapter implements this behavior against Plait 0.94.0; derived colors are never saved as overrides. Plait's transient drag ghost uses a separate internal renderer and can still show its native gray while dragging a summary descendant; its final rendered node uses the inherited color.

The implementation uses Plait's existing summary (`start`/`end`) model and does not change the `.drawnix` format or add a keyboard shortcut.

For a synthetic example, open [`mind-summary.drawnix`](../apps/web-e2e/src/fixtures/mind-summary.drawnix) from the app menu, then select **Research** to add a single-topic summary or Shift-click **Design** and **Build** to add a multi-topic summary.

For an already-created colorful summary with a nested annotation subtree, open [`mind-summary-styles.drawnix`](../apps/web-e2e/src/fixtures/mind-summary-styles.drawnix), switch themes, or resize the summary range.
