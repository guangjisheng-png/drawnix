import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cacheSelectedElements,
  hasInputOrTextareaTarget,
  IS_TEXT_EDITABLE,
  PlaitBoard,
  withOptions,
} from '@plait/core';
import { MindLayoutType } from '@plait/layouts';
import { createMindElement, MindTransforms, PlaitMind, withMind } from '@plait/mind';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupDrawnixTestingBoard, DrawnixTestingBoardFixture } from '../../../../testing';
import { I18nProvider } from '../../../i18n';
import { PopupSummaryButton } from './summary-button';

describe('summary toolbar button', () => {
  let fixture: DrawnixTestingBoardFixture;

  afterEach(() => {
    cleanup();
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  const setup = () => {
    const child = createMindElement('Research', {});
    const root: PlaitMind = {
      ...createMindElement('Project plan', {}),
      type: 'mind',
      layout: MindLayoutType.right,
      points: [[0, 0]],
      children: [child],
    };
    fixture = setupDrawnixTestingBoard([withOptions, withMind], [root], {
      selectedElements: [child],
    });
    Object.assign(fixture.board, { getI18nValue: () => 'Summary' });
    return { board: fixture.board, child, root };
  };

  const renderButton = () =>
    render(
      <I18nProvider initialLanguage="en">
        <PopupSummaryButton board={fixture.board} />
      </I18nProvider>
    );

  it('exposes an accessible action and creates only one summary on repeated activation', () => {
    const { board } = setup();
    renderButton();
    const button = screen.getByRole('button', { name: 'Add summary' });
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    fireEvent.click(button);
    expect((board.children[0] as PlaitMind).children).toHaveLength(2);
    expect((board.children[0] as PlaitMind).children[1]).toMatchObject({ start: 0, end: 0 });
  });

  it('disables the action with an explanatory tooltip for the root topic', () => {
    const { board, root } = setup();
    cacheSelectedElements(board, [root]);
    renderButton();
    const button = screen.getByRole('button', { name: 'Add summary' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.title).toContain('consecutive sibling topics');
    fireEvent.click(button);
    expect((board.children[0] as PlaitMind).children).toHaveLength(1);
  });

  it.each(['empty', 'shape', 'readonly', 'editing'])('hides the action when %s', (state) => {
    const { board } = setup();
    if (state === 'empty') cacheSelectedElements(board, []);
    if (state === 'shape') cacheSelectedElements(board, [{ id: 'shape', type: 'geometry' }]);
    if (state === 'readonly') board.options.readonly = true;
    if (state === 'editing') IS_TEXT_EDITABLE.set(board, true);
    renderButton();
    expect(screen.queryByRole('button', { name: 'Add summary' })).toBeNull();
    IS_TEXT_EDITABLE.delete(board);
  });

  it('rechecks selection when a previously enabled action is activated', () => {
    const { board, root } = setup();
    renderButton();
    cacheSelectedElements(board, [root]);
    fireEvent.click(screen.getByRole('button', { name: 'Add summary' }));
    expect((board.children[0] as PlaitMind).children).toHaveLength(1);
  });

  it.each([
    { key: 'Enter', keyCode: 13 },
    { key: ' ', keyCode: 32 },
    { key: 'Tab', keyCode: 9 },
  ])(
    'keeps $key out of canvas shortcuts without preventing its native default',
    ({ key, keyCode }) => {
      const { board } = setup();
      board.selection = { anchor: [0, 0], focus: [0, 0] };
      const insertSibling = vi
        .spyOn(MindTransforms, 'insertSiblingNode')
        .mockImplementation(() => {});
      const insertChild = vi.spyOn(MindTransforms, 'insertChildNode').mockImplementation(() => {});
      // Mirror react-board's window listener, including the real withMind keyboard handlers.
      const onKeyDown = (event: KeyboardEvent) => {
        board.globalKeyDown(event);
        if (
          PlaitBoard.isFocus(board) &&
          !PlaitBoard.hasBeenTextEditing(board) &&
          !hasInputOrTextareaTarget(event.target)
        ) {
          board.keyDown(event);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      try {
        renderButton();
        const button = screen.getByRole('button', { name: 'Add summary' });
        button.focus();
        const event = new KeyboardEvent('keydown', {
          key,
          keyCode,
          bubbles: true,
          cancelable: true,
        });
        fireEvent(button, event);
        expect(event.defaultPrevented).toBe(false);
        expect(insertSibling).not.toHaveBeenCalled();
        expect(insertChild).not.toHaveBeenCalled();
        expect((board.children[0] as PlaitMind).children).toHaveLength(1);
      } finally {
        window.removeEventListener('keydown', onKeyDown);
      }
    }
  );
});
