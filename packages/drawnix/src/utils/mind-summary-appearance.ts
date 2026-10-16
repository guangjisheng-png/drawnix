import { PlaitBoard, PlaitNode } from '@plait/core';
import { AbstractNode } from '@plait/layouts';
import {
  getBranchColorByMindElement,
  getStrokeColorByElement,
  MindElement,
  PlaitMind,
} from '@plait/mind';

// Resolve the range on the live board: copying a palette color into the model
// would stop summaries following theme changes, range resizing and reordering.
const getSummarySource = (board: PlaitBoard, element: MindElement): MindElement | undefined => {
  if (PlaitMind.isMind(element)) return;
  const summary = AbstractNode.isAbstract(element)
    ? element
    : MindElement.getAncestors(board, element).find(AbstractNode.isAbstract);
  if (!summary || !Number.isInteger(summary.start) || summary.start < 0) return;
  const path = PlaitBoard.findPath(board, summary);
  const parent = PlaitNode.get(board, path.slice(0, -1));
  const source = parent.children?.[summary.start] as MindElement | undefined;
  // A valid native range contains ordinary siblings, never another summary.
  if (source && !AbstractNode.isAbstract(source)) return source;
  return;
};

export const getMindSummaryStrokeColor = (board: PlaitBoard, element: MindElement): string => {
  if (element.strokeColor) return element.strokeColor;
  const source = getSummarySource(board, element);
  return source
    ? getMindSummaryStrokeColor(board, source)
    : getStrokeColorByElement(board, element);
};

export const getMindSummaryBranchColor = (board: PlaitBoard, element: MindElement): string => {
  const explicitColor = element.branchColor || element.strokeColor;
  if (explicitColor) return explicitColor;
  const source = getSummarySource(board, element);
  return source
    ? getMindSummaryBranchColor(board, source)
    : getBranchColorByMindElement(board, element);
};
