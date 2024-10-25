export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  videoName: string;
  frameNumber: number;
  box: Box | null;
  positivePoints: Point[];
  negativePoints: Point[];
}
