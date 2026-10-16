import {
  cacheSelectedElements,
  deleteFragment,
  getSelectedElements,
  IS_TEXT_EDITABLE,
  PlaitElement,
  withHistory,
  withOptions,
} from '@plait/core';
import { AbstractNode, MindLayoutType } from '@plait/layouts';
import { createMindElement, MindElement, PlaitMind, withMind } from '@plait/mind';
import { afterEach, describe, expect, it } from 'vitest';
import { setupDrawnixTestingBoard, DrawnixTestingBoardFixture } from '../../testing';
import { addMindSummary, getMindSummarySelection } from './mind-summary';
import { serializeAsJSON } from '../data/json';
import { loadFromBlob } from '../data/blob';

const topic = (text: string) => createMindElement(text, {});
const mind = (children: MindElement[], layout = MindLayoutType.right): PlaitMind => ({
  ...topic('Project plan'),
  type: 'mind',
  points: [[0, 0]],
  layout,
  children,
});

describe('mind summary', () => {
  let fixture: DrawnixTestingBoardFixture;

  afterEach(() => fixture?.destroy());

  const setup = (roots: PlaitElement[], selectedElements: PlaitElement[]) => {
    fixture = setupDrawnixTestingBoard([withOptions, withHistory, withMind], roots, {
      selectedElements,
    });
    Object.assign(fixture.board, { getI18nValue: () => 'Summary' });
    return fixture.board;
  };

  it.each([1, 2, 3])('summarizes %i consecutive topics using the native model', (count) => {
    const children = [topic('Research'), topic('Design'), topic('Build')];
    const root = mind(children);
    const board = setup([root], children.slice(0, count).reverse());

    expect(addMindSummary(board)).toBe(true);
    const updated = board.children[0] as PlaitMind;
    const summary = updated.children[3];
    expect(summary).toMatchObject({ start: 0, end: count - 1 });
    expect(AbstractNode.isAbstract(summary)).toBe(true);
    expect(updated.children.slice(0, 3)).toEqual(children);
    expect(getSelectedElements(board)).toEqual([summary]);
    expect(addMindSummary(board)).toBe(false);
  });

  it('supports a collapsed topic without changing its descendants', () => {
    const child = { ...topic('Research'), isCollapsed: true, children: [topic('Interview')] };
    const board = setup([mind([child])], [child]);
    expect(addMindSummary(board)).toBe(true);
    expect((board.children[0] as PlaitMind).children[0]).toEqual(child);
  });

  it('accepts consecutive siblings below the first level', () => {
    const children = [topic('Interview'), topic('Findings')];
    const parent = { ...topic('Research'), children };
    const board = setup([mind([parent])], [...children].reverse());
    expect(getMindSummarySelection(board)).toEqual([...children].reverse());
  });

  it('round trips summaries through the existing drawnix serializer and loader', async () => {
    const children = [topic('Research'), topic('Design')];
    const board = setup([mind(children)], children);
    addMindSummary(board);
    const serialized = serializeAsJSON(board);
    const loaded = await loadFromBlob(board, new Blob([serialized]));
    expect(loaded.version).toBe(1);
    expect(loaded.elements).toEqual(board.children);
    expect((loaded.elements[0] as PlaitMind).children[2]).toMatchObject({ start: 0, end: 1 });
  });

  it.each(Object.values(MindLayoutType))('supports the %s layout', (layout) => {
    const child = topic('Research');
    const root = { ...mind([child], layout), rightNodeCount: 1 };
    const board = setup([root], [child]);
    expect(addMindSummary(board)).toBe(true);
    expect((board.children[0] as PlaitMind).children[1]).toMatchObject({ start: 0, end: 0 });
  });

  it.each(['empty', 'root', 'mixed', 'gap', 'parents', 'ancestor', 'covered', 'summary'])(
    'rejects a %s selection without changing the document',
    (selection) => {
      const children = [topic('Research'), topic('Design'), topic('Build')];
      children[0].children = [topic('Interview')];
      const summary = { ...topic('Existing summary'), start: 1, end: 1 };
      const root = mind(
        selection === 'covered' || selection === 'summary' ? [...children, summary] : children
      );
      const other = mind([topic('Other topic')]);
      const shape: PlaitElement = {
        id: 'shape',
        type: 'geometry',
        points: [
          [0, 0],
          [20, 20],
        ],
      };
      const selections: Record<string, PlaitElement[]> = {
        empty: [],
        root: [root],
        mixed: [children[0], shape],
        gap: [children[0], children[2]],
        parents: [children[0], other.children[0]],
        ancestor: [children[0], children[0].children[0]],
        covered: [children[1]],
        summary: [summary],
      };
      const board = setup([root, other, shape], selections[selection]);
      const before = JSON.stringify(board.children);
      expect(getMindSummarySelection(board)).toBeUndefined();
      expect(addMindSummary(board)).toBe(false);
      expect(JSON.stringify(board.children)).toBe(before);
    }
  );

  it('rejects a standard-layout range spanning both sides', () => {
    const children = [topic('Right'), topic('Left')];
    const root = { ...mind(children, MindLayoutType.standard), rightNodeCount: 1 };
    const board = setup([root], children);
    expect(addMindSummary(board)).toBe(false);
    cacheSelectedElements(board, [children[1]]);
    expect(addMindSummary(board)).toBe(true);
    expect((board.children[0] as PlaitMind).children[2]).toMatchObject({ start: 1, end: 1 });
  });

  it('also treats an omitted root layout as the native default standard layout', () => {
    const children = [topic('Right'), topic('Left')];
    const root = { ...mind(children), rightNodeCount: 1 };
    delete root.layout;
    const board = setup([root], children);
    expect(addMindSummary(board)).toBe(false);
    expect((board.children[0] as PlaitMind).children).toHaveLength(2);
  });

  it('rechecks the current selection, readonly and text-editing state', () => {
    const child = topic('Research');
    const root = mind([child]);
    const board = setup([root], [child]);
    expect(getMindSummarySelection(board)).toEqual([child]);
    cacheSelectedElements(board, [root]);
    expect(addMindSummary(board)).toBe(false);
    cacheSelectedElements(board, [child]);
    board.options.readonly = true;
    expect(addMindSummary(board)).toBe(false);
    board.options.readonly = false;
    IS_TEXT_EDITABLE.set(board, true);
    expect(addMindSummary(board)).toBe(false);
    IS_TEXT_EDITABLE.delete(board);
    expect(addMindSummary(board)).toBe(true);
  });

  it('undoes and redoes summary creation as one operation', () => {
    const child = topic('Research');
    const root = mind([child]);
    const board = setup([root], [child]);
    addMindSummary(board);
    const saved = JSON.stringify(board.children);
    board.undo();
    expect(board.children).toEqual([root]);
    board.redo();
    expect(JSON.stringify(board.children)).toBe(saved);
  });

  it('deletes only the selected summary and keeps the summarized topics', () => {
    const children = [topic('Research'), topic('Design')];
    const board = setup([mind(children)], children);
    addMindSummary(board);
    deleteFragment(board);
    expect((board.children[0] as PlaitMind).children).toEqual(children);
  });

  it('shrinks a summary when a covered topic is deleted and removes an empty summary', () => {
    const children = [topic('Research'), topic('Design'), topic('Build')];
    const board = setup([mind(children)], children.slice(0, 2));
    addMindSummary(board);
    cacheSelectedElements(board, [(board.children[0] as PlaitMind).children[0]]);
    deleteFragment(board);
    expect((board.children[0] as PlaitMind).children[2]).toMatchObject({ start: 0, end: 0 });
    cacheSelectedElements(board, [(board.children[0] as PlaitMind).children[0]]);
    deleteFragment(board);
    expect((board.children[0] as PlaitMind).children).toEqual([children[2]]);
  });
});
