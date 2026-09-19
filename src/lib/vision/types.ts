/** Shared vision types. Kept separate so the pure maths never imports React. */

export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface Landmark extends Point {
  readonly visibility?: number;
}

/** How much a given reading should be trusted. Never a percentage in the UI. */
export type Confidence = 'high' | 'medium' | 'low';

export interface FrameSize {
  readonly width: number;
  readonly height: number;
}
