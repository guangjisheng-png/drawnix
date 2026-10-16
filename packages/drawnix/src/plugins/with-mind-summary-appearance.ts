import {
  createG,
  drawLinearPath,
  getRectangleByElements,
  PlaitBoard,
  PlaitPlugin,
  Point,
  RectangleClient,
} from '@plait/core';
import { getStrokeLineDash } from '@plait/common';
import { drawShape, FlowchartSymbols } from '@plait/draw';
import { AbstractNode, isHorizontalLayout } from '@plait/layouts';
import {
  BranchShape,
  getAbstractBranchWidth,
  getBranchColorByMindElement,
  getBranchShapeByMindElement,
  getRectangleByNode,
  getStrokeColorByElement,
  getStrokeStyleByElement,
  MindElement,
  MindNode,
  MindNodeComponent,
  MindQueries,
  PlaitMind,
} from '@plait/mind';
import {
  getMindSummaryBranchColor,
  getMindSummaryStrokeColor,
} from '../utils/mind-summary-appearance';

const LINK_PADDING = 15;
// The native curly-note engine uses 9% of its virtual rectangle for the brace.
const NATIVE_CURLY_WIDTH_RATIO = 0.09;

export const getSummaryBraceGeometry = (
  included: RectangleClient,
  summary: RectangleClient,
  horizontal: boolean,
  reverse: boolean
) => {
  const sign = reverse ? -1 : 1;
  const rangeStart = horizontal ? included.y : included.x;
  const length = horizontal ? included.height : included.width;
  const outer = horizontal
    ? included.x + (reverse ? 0 : included.width)
    : included.y + (reverse ? 0 : included.height);
  const edge = horizontal
    ? summary.x + (reverse ? summary.width : 0)
    : summary.y + (reverse ? summary.height : 0);
  const center = horizontal ? summary.y + summary.height / 2 : summary.x + summary.width / 2;
  const origin = outer + sign * LINK_PADDING;
  const depth = Math.max(0, sign * (edge - origin) - LINK_PADDING);
  return {
    rectangle: { x: 0, y: 0, width: depth / NATIVE_CURLY_WIDTH_RATIO, height: length },
    // Rotate/reflect coordinates rather than scaling strokes for other layouts.
    transform: horizontal
      ? `matrix(${sign} 0 0 1 ${origin} ${rangeStart})`
      : `matrix(0 ${sign} 1 0 ${rangeStart} ${origin})`,
    connector: [
      [depth, length / 2],
      [sign * (edge - origin), center - rangeStart],
    ] as Point[],
  };
};

export const drawSummaryBrace = (board: PlaitBoard, node: MindNode, horizontal: boolean) => {
  const summary = node.origin;
  if (!AbstractNode.isAbstract(summary)) return createG();
  const included = node.parent.children
    .slice(summary.start, summary.end + 1)
    .map((child) => child.origin);
  const geometry = getSummaryBraceGeometry(
    getRectangleByElements(board, included, true),
    getRectangleByNode(node),
    horizontal,
    horizontal ? node.left : node.up
  );
  const width = getAbstractBranchWidth(board, summary);
  const options = {
    stroke: getMindSummaryBranchColor(board, summary),
    strokeWidth: width,
    strokeLineDash: getStrokeLineDash(getStrokeStyleByElement(board, summary), width),
  };
  const g = createG();
  g.setAttribute('transform', geometry.transform);
  g.append(
    drawShape(board, geometry.rectangle, FlowchartSymbols.noteCurlyRight, options),
    drawLinearPath(geometry.connector, options)
  );
  return g;
};

// Adapt only native outline/link strokes. Fills, transparent paths, text,
// selection and add-button colors are deliberately left to their generators.
const replaceStroke = (g: SVGGElement, previous: string, next: string) => {
  if (previous !== next) {
    g.querySelectorAll('[stroke]').forEach((path) => {
      if (path.getAttribute('stroke') === previous) path.setAttribute('stroke', next);
    });
  }
  return g;
};

export class SummaryMindNodeComponent extends MindNodeComponent {
  private appearance = '';

  override initializeGenerator() {
    super.initializeGenerator();
    // These are public, instance-owned generator methods in Plait 0.94.
    // Do not mutate prototypes or the shared native gray defaults.
    const shape = this.nodeShapeGenerator;
    const draw = shape.draw.bind(shape);
    shape.draw = (element, data) =>
      replaceStroke(
        draw(element, data),
        getStrokeColorByElement(this.board, element),
        getMindSummaryStrokeColor(this.board, element)
      );

    const more = this.nodeMoreGenerator;
    const collapse = more.toggleCollapseAndAdd.bind(more);
    more.toggleCollapseAndAdd = (...args) => {
      args[3] = getMindSummaryBranchColor(this.board, this.element);
      collapse(...args);
    };
    const expand = more.toggleExpandBadge.bind(more);
    more.toggleExpandBadge = (...args) => {
      args[3] = getMindSummaryBranchColor(this.board, args[0]);
      expand(...args);
    };
  }

  override initialize() {
    super.initialize();
    this.appearance = this.getAppearance();
  }

  override onContextChanged(
    value: Parameters<MindNodeComponent['onContextChanged']>[0],
    previous: Parameters<MindNodeComponent['onContextChanged']>[1]
  ) {
    super.onContextChanged(value, previous);
    const appearance = this.getAppearance();
    // Range/source changes can leave descendant element and parent identities
    // unchanged. Core still updates their contexts, so refresh derived colors.
    if (appearance !== this.appearance) {
      this.nodeShapeGenerator.processDrawing(this.element, this.getElementG(), { node: this.node });
      this.drawLink();
      this.nodeMoreGenerator.processDrawing(this.element, this.getElementG(), {
        isSelected: this.selected,
      });
    }
    this.appearance = appearance;
  }

  private getAppearance() {
    return JSON.stringify([
      getMindSummaryStrokeColor(this.board, this.element),
      getMindSummaryBranchColor(this.board, this.element),
    ]);
  }

  override drawLink() {
    if (
      AbstractNode.isAbstract(this.element) &&
      getBranchShapeByMindElement(this.board, this.element) !== BranchShape.polyline
    ) {
      this.linkLineG?.remove();
      const layout = MindQueries.getCorrectLayoutByElement(
        this.board,
        MindElement.getParent(this.element)
      );
      this.linkLineG = drawSummaryBrace(this.board, this.node, isHorizontalLayout(layout));
      this.getElementG().append(this.linkLineG);
    } else {
      super.drawLink();
      if (this.linkLineG) {
        replaceStroke(
          this.linkLineG,
          getBranchColorByMindElement(this.board, this.element),
          getMindSummaryBranchColor(this.board, this.element)
        );
      }
    }
  }
}

export const withMindSummaryAppearance: PlaitPlugin = (board) => {
  const { drawElement } = board;
  board.drawElement = (context) => {
    // All non-root nodes need the adapter: an existing component may be moved
    // into or out of a summary subtree without its component being recreated.
    if (MindElement.isMindElement(board, context.element) && !PlaitMind.isMind(context.element)) {
      return SummaryMindNodeComponent;
    }
    return drawElement(context);
  };
  return board;
};
