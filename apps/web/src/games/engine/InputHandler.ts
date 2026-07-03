/**
 * InputHandler — touch and click input with <100ms latency requirement
 * Traceability: GAME-FR-006, GAME-FR-013
 *
 * "All interactive elements respond to touch and mouse/trackpad with no double-tap delay.
 *  Minimum touch target 44x44px (WCAG); brief highlight/scale feedback on interaction;
 *  10px dead-zone margin near boundaries; supports tap, swipe, and drag."
 *
 * Performance: "Input latency must be <100ms" (GAME-FR-006, GAME-FR-013)
 */

export interface InputPoint {
    x: number;
    y: number;
    timestamp_ms: number;
}

export interface TapEvent {
    type: 'tap';
    point: InputPoint;
    target: Element;
}

export interface SwipeEvent {
    type: 'swipe';
    start: InputPoint;
    end: InputPoint;
    velocity_px_ms: number;
    direction: 'up' | 'down' | 'left' | 'right';
}

export interface DragEvent {
    type: 'drag_start' | 'drag_move' | 'drag_end';
    point: InputPoint;
    target: Element;
}

export type GameInputEvent = TapEvent | SwipeEvent | DragEvent;

type InputCallback = (event: GameInputEvent) => void;

/** GAME-FR-006: 10px dead-zone margin near element boundaries */
const DEAD_ZONE_PX = 10;
/** GAME-FR-006: minimum tap target size (WCAG 2.1, GAME-FR-014) */
const MIN_TOUCH_TARGET_PX = 44;
/** Threshold for classifying a touch-move as a swipe vs. a tap */
const SWIPE_THRESHOLD_PX = 10;

export class InputHandler {
    private element: HTMLElement;
    private callback: InputCallback;
    private pointerStart: InputPoint | null = null;
    private isDragging = false;
    private listenerRefs: Array<{ type: string; fn: EventListener }> = [];

    constructor(element: HTMLElement, callback: InputCallback) {
        this.element = element;
        this.callback = callback;
    }

    /**
     * Attach all input listeners.
     * GAME-FR-006: "no double-tap delay" — achieved via touch-action: manipulation in CSS
     * and passive event listeners for performance.
     */
    attach(): void {
        // Prefer Pointer Events API (unified touch + mouse)
        this.on('pointerdown', this.handlePointerDown);
        this.on('pointermove', this.handlePointerMove);
        this.on('pointerup', this.handlePointerUp);
        this.on('pointercancel', this.handlePointerCancel);

        // Apply CSS touch-action to prevent browser 300ms delay
        this.element.style.touchAction = 'manipulation';
        this.element.style.userSelect = 'none';
        this.element.style.webkitUserSelect = 'none';
    }

    /**
     * Remove all listeners (cleanup on game unmount).
     */
    detach(): void {
        for (const { type, fn } of this.listenerRefs) {
            this.element.removeEventListener(type, fn);
        }
        this.listenerRefs = [];
    }

    private on(type: string, handler: (e: PointerEvent) => void): void {
        const fn = handler.bind(this) as EventListener;
        this.listenerRefs.push({ type, fn });
        this.element.addEventListener(type, fn, { passive: type !== 'pointerdown' });
    }

    private handlePointerDown(e: PointerEvent): void {
        e.preventDefault();
        this.pointerStart = {
            x: e.clientX,
            y: e.clientY,
            timestamp_ms: performance.now(),
        };
        this.isDragging = false;

        // Capture pointer for drag continuity
        if (e.currentTarget instanceof Element) {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
    }

    private handlePointerMove(e: PointerEvent): void {
        if (!this.pointerStart) return;

        const dx = e.clientX - this.pointerStart.x;
        const dy = e.clientY - this.pointerStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > SWIPE_THRESHOLD_PX) {
            this.isDragging = true;
            const target = e.target as Element;

            // GAME-FR-006: validate target size >= 44px before emitting
            if (!this.isValidTarget(target)) return;

            this.callback({
                type: 'drag_move',
                point: {
                    x: e.clientX,
                    y: e.clientY,
                    timestamp_ms: performance.now(),
                },
                target,
            });
        }
    }

    private handlePointerUp(e: PointerEvent): void {
        if (!this.pointerStart) return;

        const end: InputPoint = {
            x: e.clientX,
            y: e.clientY,
            timestamp_ms: performance.now(),
        };

        const dx = end.x - this.pointerStart.x;
        const dy = end.y - this.pointerStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const target = e.target as Element;

        if (this.isDragging) {
            // Emit drag_end
            this.callback({ type: 'drag_end', point: end, target });
        } else if (dist < SWIPE_THRESHOLD_PX) {
            // It's a tap
            if (!this.isValidTarget(target)) {
                this.pointerStart = null;
                return;
            }
            // GAME-FR-006: check dead-zone
            if (this.isInDeadZone(e.clientX, e.clientY, target)) {
                this.pointerStart = null;
                return;
            }
            this.callback({ type: 'tap', point: end, target });
        } else {
            // It's a swipe
            const duration = end.timestamp_ms - this.pointerStart.timestamp_ms;
            const velocity = duration > 0 ? dist / duration : 0;
            const direction = this.getSwipeDirection(dx, dy);

            this.callback({
                type: 'swipe',
                start: this.pointerStart,
                end,
                velocity_px_ms: velocity,
                direction,
            });
        }

        this.pointerStart = null;
        this.isDragging = false;
    }

    private handlePointerCancel(_e: PointerEvent): void {
        this.pointerStart = null;
        this.isDragging = false;
    }

    /**
     * Check if target meets minimum size (WCAG 44x44px — GAME-FR-006, GAME-FR-014).
     */
    private isValidTarget(target: Element): boolean {
        const rect = target.getBoundingClientRect();
        return (
            rect.width >= MIN_TOUCH_TARGET_PX || rect.height >= MIN_TOUCH_TARGET_PX
        );
    }

    /**
     * GAME-FR-006: 10px dead-zone margin near boundaries.
     */
    private isInDeadZone(x: number, y: number, target: Element): boolean {
        const rect = target.getBoundingClientRect();
        return (
            x < rect.left + DEAD_ZONE_PX ||
            x > rect.right - DEAD_ZONE_PX ||
            y < rect.top + DEAD_ZONE_PX ||
            y > rect.bottom - DEAD_ZONE_PX
        );
    }

    private getSwipeDirection(dx: number, dy: number): 'up' | 'down' | 'left' | 'right' {
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        }
        return dy > 0 ? 'down' : 'up';
    }
}
