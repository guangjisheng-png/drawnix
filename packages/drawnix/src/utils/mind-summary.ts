import { getSelectedElements, PlaitBoard } from '@plait/core';
import { MindLayoutType } from '@plait/layouts';
import { canSetAbstract, getRootLayout, MindElement, MindTransforms, PlaitMind } from '@plait/mind';

/** A summary describes one topic or a consecutive range of siblings on the same side. */
export const getMindSummarySelection = (board: PlaitBoard): MindElement[] | undefined => {
  const elements = getSelectedElements(board);
  if (
    PlaitBoard.isReadonly(board) ||
    PlaitBoard.hasBeenTextEditing(board) ||
    !elements.length ||
    !elements.every(
      (element) => MindElement.isMindElement(board, element) && canSetAbstract(element)
    )
  ) {
    return undefined;
  }

  const topics = elements as MindElement[];
  const parent = MindElement.findParent(topics[0]);
  if (!parent || !topics.every((topic) => MindElement.findParent(topic) === parent)) {
    return undefined;
  }

  const indices = topics.map((topic) => parent.children.indexOf(topic)).sort((a, b) => a - b);
  const start = indices[0];
  const end = indices[indices.length - 1];
  if (start < 0 || end - start + 1 !== topics.length) {
    return undefined;
  }

  // Standard mind maps keep both sides in one children array. Do not silently create two summaries.
  if (
    PlaitMind.isMind(parent) &&
    getRootLayout(parent) === MindLayoutType.standard &&
    parent.rightNodeCount !== undefined &&
    start < parent.rightNodeCount &&
    end >= parent.rightNodeCount
  ) {
    return undefined;
  }

  return topics;
};

export const addMindSummary = (board: PlaitBoard): boolean => {
  // Recheck at activation time, since the selection may have changed since rendering the toolbar.
  const topics = getMindSummarySelection(board);
  if (!topics) {
    return false;
  }
  MindTransforms.insertAbstract(board, topics);
  return true;
};
