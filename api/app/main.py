import base64
import json
import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from sam2.sam2_video_predictor import SAM2VideoPredictor
from video_utils.image import ImageFromVideo

app = FastAPI()
image_directory = Path("./data/images")
image_directory.mkdir(exist_ok=True)
segmented_image_directory = Path("./data/segmented_images")
segmented_image_directory.mkdir(exist_ok=True)
annotation_directory = Path("./data/annotations")
annotation_directory.mkdir(exist_ok=True)


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

    annotation_file = annotation_directory / video_name / f"{frame_number}.json"
    if not annotation_file.exists():
        annotation = None
    else:
        with open(annotation_file, "r") as f:
            json_file = json.load(f)
            annotation = Annotation.model_validate(json_file)

    segmented_image_file = (
        segmented_image_directory / video_name / f"{frame_number}.jpg"
    )
    if segmented_image_file.exists():
        with open(segmented_image_file, "rb") as f:
            segmented_image = f.read()
            segmented_image_base64 = base64.b64encode(segmented_image).decode("utf-8")
    else:
        segmented_image_base64 = None

    return {
        "image": image_base64,
        "segmented_image": segmented_image_base64,
        "frame_number": frame_number,
        "annotation": annotation,
    }


@app.get("/videos/{video_name}/annotations/{frame_number}")
async def get_annotations(video_name: str, frame_number: int):
    annotation_file = annotation_directory / video_name / f"{frame_number}.json"
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
    output_dir = annotation_directory / video_name
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


sam2_predictor = SAM2VideoPredictor.from_pretrained("facebook/sam2-hiera-large")


def extract_frames(
    video_path: Path, output_dir: Path, start_frame: int, end_frame: int
):
    video_capture = cv2.VideoCapture(str(video_path))
    video_capture.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    frame_number = start_frame
    while True:
        success, frame = video_capture.read()
        if not success:
            break
        if end_frame > 0 and frame_number > end_frame:
            break
        cv2.imwrite(str(output_dir / f"{frame_number}.jpg"), frame)
        frame_number += 1
    video_capture.release()

    return frame_number - start_frame


@app.post("/videos/{video_name}/sam/{frame_number}")
def segment_and_mask(
    video_name: str, frame_number: int, start_frame: int = 0, end_frame: int = 0
):
    video_path = Path(f"./data/{video_name}")
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    imageFromVideo = ImageFromVideo(path=video_path, image_index=frame_number)
    frame = imageFromVideo.read_image()

    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found")

    annotation_file = annotation_directory / video_name / f"{frame_number}.json"
    if not annotation_file.exists():
        raise HTTPException(status_code=404, detail="Annotations not found")

    with open(annotation_file, "r") as f:
        annotation = json.load(f)
        annotation = Annotation.model_validate(annotation)

    if annotation.box is None and not annotation.positivePoints:
        raise HTTPException(status_code=404, detail="No annotations found")

    seg_output_dir = segmented_image_directory / video_name
    seg_output_dir.mkdir(exist_ok=True)

    image_output_dir = image_directory / video_name
    image_output_dir.mkdir(exist_ok=True)

    extract_frames(video_path, image_output_dir, start_frame, end_frame)

    state = sam2_predictor.init_state(image_output_dir)

    # add new prompts and instantly get the output on the same frame
    points = np.array(
        [
            [point.x, point.y]
            for point in annotation.positivePoints + annotation.negativePoints
        ],
        dtype=np.float32,
    )
    labels = np.array(
        [1] * len(annotation.positivePoints) + [0] * len(annotation.negativePoints),
        dtype=np.int32,
    )
    frame_idx, object_ids, masks = sam2_predictor.add_new_points_or_box(
        inference_state=state,
        frame_idx=frame_number,
        obj_id=0,
        points=points,
        labels=labels,
    )

    # propagate the prompts to get masklets throughout the video
    video_segments = {}  # video_segments contains the per-frame segmentation results
    for frame_idx, object_ids, masks in sam2_predictor.propagate_in_video(state):
        video_segments[frame_idx] = {
            out_obj_id: (masks[i] > 0.0).cpu().numpy()
            for i, out_obj_id in enumerate(object_ids)
        }
    return {"info": f"Segmentation and mask for frame {frame_number} saved."}
