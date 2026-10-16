import { PlaitBoard, ThemeColorMode, Transforms, toSvgData, withOptions } from '@plait/core';
import { StrokeStyle, updateElementSizeCache } from '@plait/common';
import { MindLayoutType } from '@plait/layouts';
import {
  BranchShape,
  createMindElement,
  getDefaultBranchColor,
  MindElement,
  MindElementShape,
  MindNodeComponent,
  MindThemeColors,
  PlaitMind,
  PlaitMindComponent,
  withMind,
} from '@plait/mind';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupDrawnixTestingBoard, DrawnixTestingBoardFixture } from '../../testing';
import {
  getMindSummaryBranchColor,
  getMindSummaryStrokeColor,
} from '../utils/mind-summary-appearance';
import {
  getSummaryBraceGeometry,
  SummaryMindNodeComponent,
  withMindSummaryAppearance,
} from './with-mind-summary-appearance';

type MindContext = Parameters<MindNodeComponent['onContextChanged']>[0];

const topic = (text = 'Topic') => createMindElement(text, {});
const grouped = (): MindElement => ({
  ...topic('Summary'),
  start: 0,
  end: 1,
  children: [topic('Detail')],
});
const mind = (children: MindElement[], layout = MindLayoutType.right): PlaitMind => ({
  ...topic('Project'),
  type: 'mind',
  points: [[0, 0]],
  layout,
  rightNodeCount: 2,
  children,
});
const strokes = (g: SVGGElement) =>
  [...g.querySelectorAll('[stroke]')]
    .map((p) => p.getAttribute('stroke'))
    .filter((s) => s !== 'none');

describe('native summary appearance adapter', () => {
  let fixture: DrawnixTestingBoardFixture;
  let rootComponent: PlaitMindComponent;
  const components: SummaryMindNodeComponent[] = [];
  afterEach(() => {
    components.splice(0).forEach((component) => component.destroy());
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  const context = (
    board: PlaitBoard,
    element: MindElement,
    parent: MindElement | PlaitBoard
  ): MindContext => ({
    board: board as MindContext['board'],
    element,
    parent: parent as MindContext['parent'],
    index: 0,
    selected: false,
    hasThemeChanged: false,
  });
  const setup = (root: PlaitMind) => {
    fixture = setupDrawnixTestingBoard([withOptions, withMind, withMindSummaryAppearance], [root], {
      withRoughSVG: true,
      boardOptions: { themeColors: MindThemeColors },
    });
    const board = fixture.board;
    const cache = (element: MindElement) => {
      updateElementSizeCache(board, element.data.topic, { width: 70, height: 24 });
      element.children.forEach(cache);
    };
    cache(root);
    rootComponent = new PlaitMindComponent();
    rootComponent.context = context(board, root, board);
    rootComponent.updateMindLayout();
    return board;
  };
  const refresh = (component: SummaryMindNodeComponent, value: MindContext) => {
    const previous = component.context;
    // Test this component's lifecycle; child-list orchestration is owned by core.
    component.initialized = false;
    component.context = value;
    component.initialized = true;
    component.onContextChanged(value, previous);
  };
  const mount = (element: MindElement, parent: MindElement) => {
    const component = new SummaryMindNodeComponent();
    component.context = context(fixture.board, element, parent);
    // jsdom has no layout/text editor; use the real native geometry and controls.
    vi.spyOn(component, 'drawTopic').mockImplementation(() => {});
    vi.spyOn(component, 'updateTopic').mockImplementation(() => {});
    component.initialize();
    components.push(component);
    return component;
  };

  it.each(Object.values(MindLayoutType))(
    'renders a native cubic curly brace in %s layout',
    (layout) => {
      const root = mind([topic('First'), topic('Second'), grouped()], layout);
      const board = setup(root);
      const summary = root.children[2];
      const component = mount(summary, root);
      const path = component.linkLineG!.querySelector('path')!;
      expect(path.getAttribute('d')).toContain('C');
      expect(component.linkLineG!.getAttribute('transform')).toMatch(/^matrix/);
      expect(component.linkLineG!.outerHTML).not.toMatch(/NaN|Infinity/);
      expect(strokes(component.linkLineG!)).toContain(getMindSummaryBranchColor(board, summary));
      expect(strokes(component.nodeShapeGenerator.g!)).toContain(
        getMindSummaryStrokeColor(board, summary)
      );
    }
  );

  it('keeps explicit polyline branches and node fill, dashed stroke, width and underline styles', () => {
    const summary = {
      ...grouped(),
      branchShape: BranchShape.polyline,
      fill: '#ffeeaa',
      strokeColor: '#123456',
      strokeWidth: 4,
      strokeStyle: StrokeStyle.dashed,
    };
    const root = mind([topic(), topic(), summary]);
    setup(root);
    const component = mount(summary, root);
    expect(component.linkLineG!.getAttribute('transform')).toBeNull();
    expect(component.nodeShapeGenerator.g!.querySelector('[fill="#ffeeaa"]')).not.toBeNull();
    expect(component.nodeShapeGenerator.g!.querySelector('[stroke-width="4"]')).not.toBeNull();
    expect(component.nodeShapeGenerator.g!.querySelector('[stroke-dasharray]')).not.toBeNull();
    Transforms.setNode(fixture.board, { shape: MindElementShape.underline }, [0, 2]);
    const updated = fixture.board.children[0] as PlaitMind;
    rootComponent.updateMindLayout(updated);
    refresh(component, context(fixture.board, updated.children[2], updated));
    expect(component.nodeShapeGenerator.g).toBeUndefined();
  });

  it('updates unchanged descendants when a source color or summary range changes', () => {
    const root = mind([topic(), topic(), grouped()]);
    const board = setup(root);
    const detail = root.children[2].children[0];
    const component = mount(detail, root.children[2]);
    Transforms.setNode(board, { strokeColor: '#cc0000', branchColor: '#00cc00' }, [0, 0]);
    let updated = board.children[0] as PlaitMind;
    rootComponent.updateMindLayout(updated);
    refresh(component, context(board, detail, updated.children[2]));
    expect(strokes(component.nodeShapeGenerator.g!)).toContain('#cc0000');
    expect(strokes(component.linkLineG!)).toContain('#00cc00');
    Transforms.setNode(board, { start: 1 }, [0, 2]);
    updated = board.children[0] as PlaitMind;
    rootComponent.updateMindLayout(updated);
    refresh(component, context(board, detail, updated.children[2]));
    expect(strokes(component.nodeShapeGenerator.g!)).toContain(
      getDefaultBranchColor(board, updated.children[1])
    );
  });

  it('updates unchanged descendants after a theme switch', () => {
    const root = mind([topic(), topic(), grouped()]);
    const board = setup(root);
    const component = mount(root.children[2].children[0], root.children[2]);
    board.theme = { themeColorMode: ThemeColorMode.colorful };
    refresh(component, { ...component.context, hasThemeChanged: true });
    expect(strokes(component.linkLineG!)).toContain(getDefaultBranchColor(board, root.children[0]));
    expect(strokes(component.nodeShapeGenerator.g!)).toContain(
      getDefaultBranchColor(board, root.children[0])
    );
  });

  it('uses node colors for collapsed badges without recoloring fixed add-button colors', () => {
    const root = mind([topic(), topic(), grouped()]);
    const board = setup(root);
    const component = mount(root.children[2], root);
    const color = getMindSummaryBranchColor(board, component.element);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      measureText: () => ({ width: 12 }),
    } as unknown as CanvasRenderingContext2D);
    component.nodeMoreGenerator.toggleExpandBadge(
      component.element,
      [
        [0, 0],
        [10, 0],
      ],
      [20, 0],
      'gray',
      component.getElementG(),
      true,
      false
    );
    expect(
      component.getElementG().querySelector('.expanded-button text')?.getAttribute('fill')
    ).toBe(color);
    expect(strokes(component.getElementG().querySelector('.expanded-button')!)).toContain(color);

    component.nodeMoreGenerator.toggleCollapseAndAdd(
      [0, 0],
      [20, 0],
      null,
      'gray',
      component.getElementG(),
      true,
      true,
      false,
      false,
      false,
      false,
      false
    );
    expect(
      component
        .getElementG()
        .querySelector(`.collapse-button [stroke="${color}"]`)
        ?.getAttribute('stroke')
    ).toBe(color);
    expect(
      component
        .getElementG()
        .querySelector('.add-button [stroke="transparent"]')
        ?.getAttribute('stroke')
    ).toBe('transparent');
  });

  it('retains a node component across moves into and out of a summary subtree', () => {
    const ordinary = { ...topic('Ordinary'), children: [topic('Move me')] };
    const root = mind([topic('Covered'), topic(), grouped(), ordinary]);
    const board = setup(root);
    const moved = ordinary.children[0];
    const component = mount(moved, ordinary);
    Transforms.moveNode(board, [0, 3, 0], [0, 2, 1]);
    let updated = board.children[0] as PlaitMind;
    rootComponent.updateMindLayout(updated);
    refresh(component, context(board, moved, updated.children[2]));
    expect(strokes(component.nodeShapeGenerator.g!)).toContain(
      getDefaultBranchColor(board, updated.children[0])
    );
    Transforms.moveNode(board, [0, 2, 1], [0, 3, 0]);
    updated = board.children[0] as PlaitMind;
    rootComponent.updateMindLayout(updated);
    refresh(component, context(board, moved, updated.children[3]));
    expect(strokes(component.nodeShapeGenerator.g!)).toContain(
      getDefaultBranchColor(board, updated.children[3])
    );
  });

  it('supports a single collapsed source and explicit curly-brace styling', () => {
    const source = { ...topic('Collapsed'), isCollapsed: true, children: [topic('Hidden')] };
    const summary = {
      ...grouped(),
      start: 0,
      end: 0,
      branchColor: '#aabbcc',
      branchWidth: 5,
      strokeStyle: StrokeStyle.dotted,
    };
    const root = mind([source, topic(), summary]);
    setup(root);
    const component = mount(summary, root);
    expect(component.linkLineG!.querySelector('[stroke="#aabbcc"]')).not.toBeNull();
    expect(component.linkLineG!.querySelector('[stroke-width="5"]')).not.toBeNull();
    expect(component.linkLineG!.querySelector('[stroke-dasharray]')).not.toBeNull();
    expect(component.linkLineG!.outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('is board-local and selects the adapter for ordinary nodes before they move', () => {
    const root = mind([topic(), topic(), grouped()]);
    const board = setup(root);
    expect(board.drawElement(context(board, root.children[0], root))).toBe(
      SummaryMindNodeComponent
    );
    expect(board.drawElement(context(board, root, board))).toBe(PlaitMindComponent);
    const other = setupDrawnixTestingBoard([withOptions, withMind], [mind([topic()])]);
    try {
      const otherRoot = other.board.children[0] as PlaitMind;
      expect(other.board.drawElement(context(other.board, otherRoot.children[0], otherRoot))).toBe(
        MindNodeComponent
      );
    } finally {
      other.destroy();
    }
  });

  it('keeps render changes out of the native model and native SVG export contains the brace', async () => {
    const root = mind([topic(), topic(), grouped()]);
    const board = setup(root);
    const saved = JSON.stringify(board.children);
    const component = mount(root.children[2], root);
    const svg = await toSvgData(board, { elements: [component.element] });
    expect(svg).toContain('matrix(');
    expect(svg).toContain(getMindSummaryBranchColor(board, root.children[2]));
    expect(JSON.stringify(board.children)).toBe(saved);
    expect(board.operations).toHaveLength(0);
  });
});

describe('brace placement', () => {
  it.each([
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ])('keeps the cusp connected with horizontal=%s reverse=%s', (horizontal, reverse) => {
    const included = { x: 10, y: 20, width: 100, height: 120 };
    const label = horizontal
      ? { x: reverse ? -100 : 160, y: 55, width: 60, height: 30 }
      : { x: 40, y: reverse ? -80 : 190, width: 60, height: 30 };
    const geometry = getSummaryBraceGeometry(included, label, horizontal, reverse);
    expect(geometry.connector[0]).toEqual([
      geometry.rectangle.width * 0.09,
      geometry.rectangle.height / 2,
    ]);
    expect(geometry.rectangle.width).toBeGreaterThan(0);
    expect(geometry.transform).not.toMatch(/NaN|Infinity/);
  });
});
