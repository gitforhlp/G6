import type { BaseStyleProps, DisplayObject } from '@antv/g';
import { debounce, isFunction } from '@antv/util';
import { GraphEvent } from '../constants';
import type { RuntimeContext } from '../runtime/types';
import type { IViewportEvent } from '../types/event';
import { setVisibility } from '../utils/visibility';
import type { BaseBehaviorOptions } from './base-behavior';
import { BaseBehavior } from './base-behavior';

/**
 * <zh/> 画布优化交互配置项
 *
 * <en/> Canvas optimization behavior options
 */
export interface OptimizeViewportTransformOptions extends BaseBehaviorOptions {
  /**
   * <zh/> 是否启用画布优化功能
   *
   * <en/> Whether to enable canvas optimization function
   * @defaultValue true
   */
  enable?: boolean | ((event: IViewportEvent) => boolean);
  /**
   * <zh/> 始终保留的图形类名。操作画布过程中会隐藏元素reservedShapes（除了指定类名的图形），以提高性能
   *
   * <en/> Persistently reserved shape classnames. Elements are hidden during canvas manipulation (except for shapes with specified classnames) to enhance performance.
   * @defaultValue `{ node: ['key'] }`
   */
  shapes?: {
    node?: string[];
    edge?: string[];
    combo?: string[];
  };
  /**
   * <zh/> 设置防抖时间
   *
   * <en/> Set debounce time
   * @defaultValue 200
   */
  debounce?: number;
}

/**
 * <zh/> 操作画布过程中隐藏元素
 *
 * <en/> Hide elements during canvas operations (dragging, zooming, scrolling)
 */
export class OptimizeViewportTransform extends BaseBehavior<OptimizeViewportTransformOptions> {
  static defaultOptions: Partial<OptimizeViewportTransformOptions> = {
    enable: true,
    debounce: 200,
    shapes: { node: ['key'] },
  };

  private isVisible: boolean = true;

  constructor(context: RuntimeContext, options: OptimizeViewportTransformOptions) {
    super(context, Object.assign({}, OptimizeViewportTransform.defaultOptions, options));
    this.bindEvents();
  }

  private filterShapes = (shapes: DisplayObject[], classnames?: string[]) => {
    return shapes.filter((shape) => shape.className && !classnames?.includes(shape.className));
  };

  private setElementsVisibility = (
    elements: DisplayObject[],
    visibility: BaseStyleProps['visibility'],
    excludedClassnames?: string[],
  ) => {
    elements.forEach((element) => {
      setVisibility(
        element,
        visibility,
        false,
        (shape) => !!shape.className && !excludedClassnames?.includes(shape.className),
      );
    });
  };

  private hideShapes = (event: IViewportEvent) => {
    if (!this.validate(event) || !this.isVisible) return;

    const { element } = this.context;
    const { shapes = {} } = this.options;
    this.setElementsVisibility(element!.getNodes(), 'hidden', shapes.node);
    this.setElementsVisibility(element!.getEdges(), 'hidden', shapes.edge);
    this.setElementsVisibility(element!.getCombos(), 'hidden', shapes.combo);
    this.isVisible = false;
  };

  private showShapes = debounce((event: IViewportEvent) => {
    if (!this.validate(event) || this.isVisible) return;

    const { element } = this.context;
    this.setElementsVisibility(element!.getNodes(), 'visible');
    this.setElementsVisibility(element!.getEdges(), 'visible');
    this.setElementsVisibility(element!.getCombos(), 'visible');
    this.isVisible = true;
  }, this.options.debounce);

  private bindEvents() {
    const { graph } = this.context;

    graph.on(GraphEvent.BEFORE_TRANSFORM, this.hideShapes);
    graph.on(GraphEvent.AFTER_TRANSFORM, this.showShapes);
  }

  private unbindEvents() {
    const { graph } = this.context;

    graph.off(GraphEvent.BEFORE_TRANSFORM, this.hideShapes);
    graph.off(GraphEvent.AFTER_TRANSFORM, this.showShapes);
  }

  private validate(event: IViewportEvent) {
    if (this.destroyed) return false;

    const { enable } = this.options;
    if (isFunction(enable)) return enable(event);
    return !!enable;
  }

  public destroy() {
    this.unbindEvents();
    super.destroy();
  }
}
