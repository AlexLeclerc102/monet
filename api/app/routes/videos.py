import json
from typing import Annotated, Any, DefaultDict, Optional

import cv2
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sam2.sam2_video_predictor import SAM2VideoPredictor

from app.config import settings
from app.dependencies import get_sam2_predictor, get_task_queue
from app.models import Annotation, Box, FrameRange, Point
from app.video_processing import (
    apply_image_mask,
    calculate_resized_size,
    encode_image,
    get_annotation,
    get_videos_sizes,
    process_segmentation,
    read_frame,
    retrieve_video_files,
)

router = APIRouter(prefix="/videos")


@router.get("")
def get_videos():
    videos, images_videos = retrieve_video_files()
    videos_sizes, invalid_images_videos = get_videos_sizes(videos, images_videos)

    if len(invalid_images_videos) > 0:
        print(f"Invalid images videos: {invalid_images_videos}")
        for invalid_image_video in invalid_images_videos:
            images_videos.remove(invalid_image_video)

    videos.extend(images_videos)
    return {"videos": videos, "count": len(videos), "videos_sizes": videos_sizes}


@router.get("/{video_file}/frame/{frame_number}")
def get_frame(
    video_file: str,
    frame_number: int,
    max_height: int = 480,
    max_width: int = 640,
):
    frame, video_name, frame_name = read_frame(video_file, frame_number)
    if video_name is None:
        return HTTPException(status_code=404, detail="Video not found")
    if frame is None or frame_name is None:
        return HTTPException(status_code=404, detail="Frame not found")

    annotation = get_annotation(video_name, frame_number)

    current_height, current_width = frame.shape[:2]
    width, height = calculate_resized_size(
        current_height, current_width, max_height, max_width
    )

    frame = cv2.resize(frame, (width, height))
    try:
        image_base64 = encode_image(frame)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error encoding image: {e}") from e

    mask_file = settings.mask_directory / video_name / frame_name
    try:
        segmented_img = apply_image_mask(
            mask_file,
            frame,
            width,
            height,
            save_name=video_name / frame_name,
            save=True,
        )
        if segmented_img is not None:
            segmented_image_base64 = encode_image(segmented_img)
        else:
            segmented_image_base64 = None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error encoding image: {e}") from e

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
    annotation = get_annotation(video_name.replace(".mp4", ""), frame_number)
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
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

    videos, images_videos = retrieve_video_files()
    if video_name not in images_videos and video_name not in videos:
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
            status_code=400,
            detail="start_frame should be less or equal than frame_number",
        )
    if end_frame > 0 and end_frame < frame_number:
        raise HTTPException(
            status_code=400, detail="end_frame should be greater than frame_number"
        )
    if end_frame >= 0 and start_frame > end_frame:
        raise HTTPException(
            status_code=400, detail="start_frame should be less than end_frame"
        )
    if end_frame < -1:
        raise HTTPException(
            status_code=400, detail="end_frame should be greater than 0 or equal to -1"
        )

    videos, images_videos = retrieve_video_files()
    if video_name not in images_videos and video_name not in videos:
        raise HTTPException(status_code=400, detail="Video not found")

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
