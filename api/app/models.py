from typing import Optional

from pydantic import BaseModel


class Box(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Point(BaseModel):
    x: float
    y: float


class Annotation(BaseModel):
    videoName: str
    frameNumber: int
    box: Optional[Box] = None
    positivePoints: list[Point] = []
    negativePoints: list[Point] = []


class FrameRange(BaseModel):
    start_frame: int
    end_frame: int
