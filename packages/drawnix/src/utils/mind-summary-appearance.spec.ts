import { ThemeColorMode, Transforms, withOptions } from '@plait/core';
import { MindLayoutType } from '@plait/layouts';
import {
  createMindElement,
  getDefaultBranchColor,
  MindElement,
  MindThemeColors,
  PlaitMind,
  withMind,
} from '@plait/mind';
import { afterEach, describe, expect, it } from 'vitest';
import { setupDrawnixTestingBoard, DrawnixTestingBoardFixture } from '../../testing';
import { getMindSummaryBranchColor, getMindSummaryStrokeColor } from './mind-summary-appearance';
import { getCurrentStrokeColor } from './property';

const topic = (text = 'Topic') => createMindElement(text, {});
const summary = (start = 0, end = 1) => ({
  ...topic('Summary'),
  start,
  end,
  children: [topic('Detail')],
});
const mind = (children: MindElement[]): PlaitMind => ({
  ...topic('Project'),
  type: 'mind',
  points: [[0, 0]],
  layout: MindLayoutType.right,
  children,
});

describe('summary appearance colors', () => {
  let fixture: DrawnixTestingBoardFixture;
  afterEach(() => fixture?.destroy());
  const setup = (root: PlaitMind) => {
    fixture = setupDrawnixTestingBoard([withOptions, withMind], [root], {
      boardOptions: { themeColors: MindThemeColors },
    });
    return fixture.board;
  };

  it.each(MindThemeColors.map((theme) => theme.mode))(
    'follows the live %s branch palette',
    (mode) => {
      const root = mind([topic('First'), topic('Second'), summary()]);
      const board = setup(root);
      board.theme = { themeColorMode: mode as ThemeColorMode };
      const expected = getDefaultBranchColor(board, root.children[0]);
      expect(getMindSummaryStrokeColor(board, root.children[2])).toBe(expected);
      expect(getMindSummaryBranchColor(board, root.children[2].children[0])).toBe(expected);
      expect(getCurrentStrokeColor(board, root.children[2])).toBe(expected);
      expect(getMindSummaryStrokeColor(board, root.children[1])).toBe(
        getDefaultBranchColor(board, root.children[1])
      );
    }
  );

  it('re-resolves the first covered sibling after range resizing and source changes', () => {
    const root = mind([topic('First'), topic('Second'), summary()]);
    const board = setup(root);
    const detail = root.children[2].children[0];
    Transforms.setNode(board, { start: 1 }, [0, 2]);
    expect(getMindSummaryStrokeColor(board, detail)).toBe(
      getDefaultBranchColor(board, root.children[1])
    );
    Transforms.setNode(board, { strokeColor: '#ff0000', branchColor: '#0000ff' }, [0, 1]);
    expect(getMindSummaryStrokeColor(board, detail)).toBe('#ff0000');
    expect(getMindSummaryBranchColor(board, detail)).toBe('#0000ff');
    expect((board.children[0] as PlaitMind).children[2].children[0]).toBe(detail);
    expect(detail).not.toHaveProperty('strokeColor');
  });

  it('preserves explicit node outline and branch overrides independently', () => {
    const grouped = summary();
    grouped.strokeColor = '#abcdef';
    grouped.branchColor = '#123456';
    const root = mind([topic(), topic(), grouped]);
    const board = setup(root);
    expect(getMindSummaryStrokeColor(board, grouped)).toBe('#abcdef');
    expect(getMindSummaryBranchColor(board, grouped)).toBe('#123456');
    // Native properties apply to their own node, not automatically to children.
    expect(getMindSummaryStrokeColor(board, grouped.children[0])).toBe(
      getDefaultBranchColor(board, root.children[0])
    );
    Transforms.setNode(board, { strokeColor: '#fedcba' }, [0, 2, 0]);
    const detail = (board.children[0] as PlaitMind).children[2].children[0];
    expect(getMindSummaryStrokeColor(board, detail)).toBe('#fedcba');
    expect(getMindSummaryBranchColor(board, detail)).toBe('#fedcba');
  });

  it('handles nested summaries without assigning a new palette slot', () => {
    const outer = summary(1, 1);
    outer.children = [topic(), topic(), summary()];
    const root = mind([topic(), topic(), outer]);
    const board = setup(root);
    const expected = getDefaultBranchColor(board, root.children[1]);
    expect(getMindSummaryStrokeColor(board, outer.children[2])).toBe(expected);
    expect(getMindSummaryBranchColor(board, outer.children[2].children[0])).toBe(expected);
  });

  it('does not mutate persisted elements or create history operations', () => {
    const root = mind([topic(), topic(), summary()]);
    const board = setup(root);
    const saved = JSON.stringify(board.children);
    const operations = [...board.operations];
    getMindSummaryStrokeColor(board, root.children[2]);
    getMindSummaryBranchColor(board, root.children[2].children[0]);
    expect(JSON.stringify(board.children)).toBe(saved);
    expect(board.operations).toEqual(operations);
  });

  it('ignores invalid summary sources rather than recursing into another summary', () => {
    const grouped = summary(2, 2);
    const root = mind([topic(), topic(), grouped]);
    const board = setup(root);
    expect(getMindSummaryStrokeColor(board, grouped)).toBeDefined();
    expect(getMindSummaryBranchColor(board, grouped.children[0])).toBeDefined();
  });
});
