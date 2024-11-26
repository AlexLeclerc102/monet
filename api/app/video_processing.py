import json
from pathlib import Path
from typing import Any, DefaultDict

import cv2
import numpy as np
from sam2.sam2_video_predictor import SAM2VideoPredictor
from video_utils.image import ImageFromVideo

from app.config import settings
from app.models import Annotation


def get_size_video(path) -> tuple:
    cap = cv2.VideoCapture(str(path))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    return width, height


def extract_frames(
    video_path: Path, output_dir: Path, start_frame: int, end_frame: int
):
    video_capture = cv2.VideoCapture(str(video_path))
    video_capture.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_number = start_frame
    while True:
        success, frame = video_capture.read()
        if not success:
            raise ValueError("Failed to read frame")
        if end_frame > 0 and frame_number >= end_frame:
            break
        cv2.imwrite(str(output_dir / f"{frame_number}.jpg"), frame)
        frame_number += 1
    video_capture.release()

    return frame_number - start_frame, width, height


def clear_directory(directory: Path):
    if directory.exists() and directory.is_dir():
        for file in directory.iterdir():
            file.unlink()
        directory.rmdir()

    directory.mkdir(parents=True, exist_ok=True)


def process_segmentation(
    video_name: str,
    frame_number: int,
    start_frame: int,
    end_frame: int,
    sam2_predictor: SAM2VideoPredictor,
    task_queue: DefaultDict[Any, list],
):
    video_path = Path(f"./data/{video_name}")
    imageFromVideo = ImageFromVideo(path=video_path, image_index=frame_number)
    _ = imageFromVideo.read_image()

    annotation_file = (
        settings.annotation_directory
        / video_name.replace(".mp4", "")
        / f"{frame_number}.json"
    )
    with open(annotation_file, "r") as f:
        annotation = json.load(f)
        annotation = Annotation.model_validate(annotation)

    mask_output_directory = settings.mask_directory / video_name.replace(".mp4", "")
    clear_directory(mask_output_directory)

    image_output_dir = settings.image_directory / video_name.replace(".mp4", "")
    clear_directory(image_output_dir)

    n_frames, width, height = extract_frames(
        video_path, image_output_dir, start_frame, end_frame
    )
    try:
        state = sam2_predictor.init_state(str(image_output_dir))
    except Exception as e:
        print(f"Error while initializing state: {e}")
        task_queue.pop((video_name, frame_number))
        return

    points = np.array(
        [
            [point.x * width, point.y * height]
            for point in annotation.positivePoints + annotation.negativePoints
        ],
        dtype=np.float32,
    )
    labels = np.array(
        [1] * len(annotation.positivePoints) + [0] * len(annotation.negativePoints),
        dtype=np.int32,
    )

    frame_idx = frame_number - start_frame
    frame_idx, object_ids, masks = sam2_predictor.add_new_points_or_box(
        inference_state=state,
        frame_idx=frame_idx,
        obj_id=0,
        points=points,
        labels=labels,
    )

    video_segments = {}
    for frame_idx, object_ids, masks in sam2_predictor.propagate_in_video(state):
        video_segments[frame_idx] = {
            out_obj_id: (masks[i] > 0.0).cpu().permute(1, 2, 0).numpy()
            for i, out_obj_id in enumerate(object_ids)
        }

    for frame_idx, masks in video_segments.items():
        for obj_id, mask in masks.items():
            frame_n = start_frame + frame_idx
            mask_path = mask_output_directory / f"{frame_n}.jpg"
            mask = mask.astype(np.uint8) * 255
            mask_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(mask_path), mask)

    task_queue.pop((video_name, frame_number))
