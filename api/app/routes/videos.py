import base64
import json
import os
from pathlib import Path
from typing import Annotated, Any, DefaultDict, Optional

import cv2
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sam2.sam2_video_predictor import SAM2VideoPredictor
from video_utils.image import ImageFromVideo

from app.config import settings
from app.dependencies import get_sam2_predictor, get_task_queue
from app.models import Annotation, Box, FrameRange, Point
from app.video_processing import process_segmentation

router = APIRouter(prefix="/videos")


@router.get("")
def get_videos():
    videos = os.listdir("./data")
    videos = [video for video in videos if video.endswith(".mp4")]

    videos_sizes = []
    for video in videos:
        video_path = Path(f"./data/{video}")
        video_size = video_path.stat().st_size
        videos_sizes.append(video_size)
    return {"videos": videos, "count": len(videos), "videos_sizes": videos_sizes}


@router.get("/{video_name}/frame/{frame_number}")
def get_frame(
    video_name: str,
    frame_number: int,
    max_height: int = 480,
    max_width: int = 640,
):
    print(f"Getting frame {frame_number} from video {video_name}")
    print(f"Max height: {max_height}, Max width: {max_width}")
    video_path = Path(f"./data/{video_name}")
    if not video_path.exists():
        return {"error": "Video not found"}

    imageFromVideo = ImageFromVideo(path=video_path, image_index=frame_number)
    frame = imageFromVideo.read_image()

    if frame is None:
        return {"error": "Frame not found"}

    current_height, current_width = frame.shape[:2]
    if current_height > max_height or current_width > max_width:
        if current_height > current_width:
            ratio = max_height / current_height
        else:
            ratio = max_width / current_width

        width = int(current_width * ratio)
        height = int(current_height * ratio)
    else:
        width = current_width
        height = current_height

    frame = cv2.resize(frame, (width, height))
    success, encoded_image = cv2.imencode(".webp", frame)

    if not success:
        raise HTTPException(status_code=500, detail="Error encoding frame")

    image_base64 = base64.b64encode(encoded_image).decode("utf-8")

    annotation_file = (
        settings.annotation_directory
        / video_name.replace(".mp4", "")
        / f"{frame_number}.json"
    )
    if not annotation_file.exists():
        annotation = None
    else:
        with open(annotation_file, "r") as f:
            json_file = json.load(f)
            annotation = Annotation.model_validate(json_file)

    mask_file = (
        settings.mask_directory / video_name.replace(".mp4", "") / f"{frame_number}.jpg"
    )
    if mask_file.exists():
        try:
            mask = cv2.imread(str(mask_file), cv2.IMREAD_GRAYSCALE)
            _, mask = cv2.threshold(mask, 8, 255, cv2.THRESH_BINARY)
            mask = cv2.resize(
                mask, (max_width, max_height), interpolation=cv2.INTER_NEAREST
            )
            overlay = frame.copy()
            overlay[mask > 0] = (255, 0, 0)
            segmented_image = cv2.addWeighted(overlay, 0.7, frame, 0.3, 0)

            (settings.segmented_images_directory / video_name).mkdir(
                exist_ok=True, parents=True
            )
            cv2.imwrite(
                str(
                    settings.segmented_images_directory
                    / video_name
                    / f"{frame_number}.jpg"
                ),
                segmented_image,
            )
            success, segmented_image = cv2.imencode(
                ".webp",
                segmented_image,
            )

            segmented_image_base64 = base64.b64encode(segmented_image).decode("utf-8")
        except Exception as e:
            print(f"Error reading mask: {e}")
            segmented_image_base64 = None
    else:
        segmented_image_base64 = None

    return {
        "image": image_base64,
        "segmented_image": segmented_image_base64,
        "frame_number": frame_number,
        "annotation": annotation,
        "width": width,
        "height": height,
    }


@router.get("/{video_name}/annotations/{frame_number}", response_model=Annotation)
async def get_annotations(video_name: str, frame_number: int):
    annotation_file = (
        settings.annotation_directory
        / video_name.replace(".mp4", "")
        / f"{frame_number}.json"
    )
    if not annotation_file.exists():
        raise HTTPException(status_code=404, detail="Annotations not found")

    with open(annotation_file, "r") as f:
        annotation = json.load(f)
        annotation = Annotation.model_validate(annotation)

    return annotation


@router.post("/{video_name}/annotations/{frame_number}")
async def annotate_frame(
    video_name: str,
    frame_number: int,
    box: Optional[Box] = None,
    positivePoints: list[Point] | None = None,
    negativePoints: list[Point] | None = None,
):
    if positivePoints is None:
        positivePoints = []
    if negativePoints is None:
        negativePoints = []

    output_dir = settings.annotation_directory / video_name.replace(".mp4", "")
    output_dir.mkdir(exist_ok=True, parents=True)

    video_path = Path(f"./data/{video_name}")
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    annotation = Annotation(
        videoName=video_name,
        frameNumber=frame_number,
        box=box if box else None,
        positivePoints=positivePoints,
        negativePoints=negativePoints,
    )

    annotation_file = output_dir / f"{frame_number}.json"
    with open(annotation_file, "w") as f:
        json.dump(annotation.model_dump(), f, indent=4)

    return {"info": f"Annotations for frame {frame_number} saved."}


@router.post("/{video_name}/sam/{frame_number}")
async def segment_and_mask(
    video_name: str,
    frame_number: int,
    frame_range: FrameRange,
    background_tasks: BackgroundTasks,
    sam2_predictor: Annotated[SAM2VideoPredictor, Depends(get_sam2_predictor)],
    task_queue: Annotated[DefaultDict[Any, list], Depends(get_task_queue)],
):
    start_frame = frame_range.start_frame
    end_frame = frame_range.end_frame

    if start_frame > frame_number:
        raise HTTPException(
            status_code=400, detail="start_frame should be less than frame_number"
        )
    if end_frame > 0 and end_frame < frame_number:
        raise HTTPException(
            status_code=400, detail="end_frame should be greater than frame_number"
        )
    if end_frame > 0 and start_frame > end_frame:
        raise HTTPException(
            status_code=400, detail="start_frame should be less than end_frame"
        )
    if end_frame <= 0:
        raise HTTPException(
            status_code=400, detail="end_frame should be greater than 0"
        )

    video_path = Path(f"./data/{video_name}")
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    if (video_name, frame_number) in task_queue:
        raise HTTPException(status_code=400, detail="Task already in queue")

    task_queue[(video_name, frame_number)].append((start_frame, end_frame))
    background_tasks.add_task(
        process_segmentation,
        video_name,
        frame_number,
        start_frame,
        end_frame,
        sam2_predictor,
        task_queue,
    )

    return {
        "info": f"Segmentation and mask for frame {frame_number} is being processed."
    }
