import base64
import json
import os
from pathlib import Path
from typing import Optional

import cv2
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from video_utils.image import ImageFromVideo

app = FastAPI()
base_output_dir = Path("./data/annotations")
base_output_dir.mkdir(exist_ok=True)


@app.get("/")
def read_root():
    return {"alive": True}


@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file:
        return {"error": "No file sent"}
    os.makedirs("./data", exist_ok=True)
    file_location = f"./data/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}


@app.get("/videos")
def get_videos():
    videos = os.listdir("./data")
    videos = [video for video in videos if video.endswith(".mp4")]

    videos_sizes = []
    for video in videos:
        video_path = Path(f"./data/{video}")
        video_size = video_path.stat().st_size
        videos_sizes.append(video_size)
    return {"videos": videos, "count": len(videos), "videos_sizes": videos_sizes}


@app.get("/videos/{video_name}/frame/{frame_number}")
def get_frame(
    video_name: str,
    frame_number: int,
    height: int = 480,
    width: int = 640,
):
    video_path = Path(f"./data/{video_name}")
    if not video_path.exists():
        return {"error": "Video not found"}

    imageFromVideo = ImageFromVideo(path=video_path, image_index=frame_number)
    frame = imageFromVideo.read_image()

    if frame is None:
        return {"error": "Frame not found"}

    frame = cv2.resize(frame, (width, height))
    success, encoded_image = cv2.imencode(".webp", frame)

    if not success:
        raise HTTPException(status_code=500, detail="Error encoding frame")

    image_base64 = base64.b64encode(encoded_image).decode("utf-8")

    annotation_file = base_output_dir / video_name / f"{frame_number}.json"
    if not annotation_file.exists():
        annotation = None
    else:
        with open(annotation_file, "r") as f:
            json_file = json.load(f)
            annotation = Annotation.model_validate(json_file)
    return {
        "image": image_base64,
        "frame_number": frame_number,
        "annotation": annotation,
    }


@app.get("/videos/{video_name}/annotations/{frame_number}")
async def get_annotations(video_name: str, frame_number: int):
    annotation_file = base_output_dir / video_name / f"{frame_number}.json"
    if not annotation_file.exists():
        raise HTTPException(status_code=404, detail="Annotations not found")

    with open(annotation_file, "r") as f:
        annotation = json.load(f)

    return annotation


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


@app.post("/videos/{video_name}/annotations/{frame_number}")
async def annotated_frame(
    video_name: str,
    frame_number: int,
    box: Optional[Box] = None,
    positivePoints: list[Point] = [],
    negativePoints: list[Point] = [],
):
    output_dir = base_output_dir / video_name
    output_dir.mkdir(exist_ok=True)

    annotation = Annotation(
        videoName=video_name,
        frameNumber=frame_number,
        box=box,
        positivePoints=positivePoints,
        negativePoints=negativePoints,
    )

    annotation_file = output_dir / f"{frame_number}.json"
    with open(annotation_file, "w") as f:
        json.dump(annotation.model_dump(), f, indent=4)

    return {"info": f"Annotations for frame {frame_number} saved."}
