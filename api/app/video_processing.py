import base64
import json
from pathlib import Path
from typing import Any, DefaultDict

import cv2
import numpy as np
from sam2.sam2_video_predictor import SAM2VideoPredictor
from video_utils.image import ImageFromVideo

from app.config import settings
from app.models import Annotation, Point


def get_size_video(path) -> tuple:
    if path.is_dir():
        images = list(path.glob("*.jpg")) + list(path.glob("*.png"))
        height, width = cv2.imread(str(images[0])).shape[:2]
        return width, height

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


def retrieve_video_files():
    videos = settings.video_dir.glob("*.mp4")
    videos = [video.name for video in videos]

    images_videos = settings.images_dir.glob("*")
    images_videos = [image.name for image in images_videos]
    return videos, images_videos


def get_videos_sizes(videos: list[str], images_videos: list[str]):
    videos_sizes = []
    for video in videos:
        video_path = settings.video_dir / video
        video_size = video_path.stat().st_size
        videos_sizes.append(video_size)

    invalid_images_videos = []
    for image_video in images_videos:
        if image_video not in videos:
            images = list(settings.images_dir.glob(f"{image_video}/*.jpg")) + list(
                settings.images_dir.glob(f"{image_video}/*.png")
            )
            images = [image.name for image in images]
            print(images)
            if len(images) > 0:
                video_size = sum(
                    [
                        (settings.images_dir / image_video / image).stat().st_size
                        for image in images
                    ]
                )
                videos_sizes.append(video_size)
            else:
                invalid_images_videos.append(image_video)
                videos_sizes.append(0)
    return videos_sizes, invalid_images_videos


def calculate_resized_size(current_height, current_width, max_height, max_width):
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

    return width, height


def read_frame_from_image(image_path: Path):
    frame = cv2.imread(str(image_path))

    return frame


def read_frame_from_video(video_path: Path, frame_number: int):
    imageFromVideo = ImageFromVideo(path=video_path, image_index=frame_number)
    frame = imageFromVideo.read_image()

    return frame


def get_frame_name(images_dir: Path, frame_number: int):
    frames = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
    frames = sorted([frame.name for frame in frames])
    frame_name = frames[frame_number]

    return frame_name


def read_frame(video_file: str, frame_number: int):
    videos, images_videos = retrieve_video_files()
    if video_file in images_videos:
        video_name = Path(video_file)
        video_path = settings.images_dir / video_file
        frame_name = get_frame_name(video_path, frame_number)
        frame = read_frame_from_image(video_path / frame_name)
    elif video_file in videos:
        video_name = Path(video_file.replace(".mp4", ""))
        video_path = settings.video_dir / video_file
        frame = read_frame_from_video(video_path, frame_number)
    else:
        return None, None

    return frame, video_name


def get_annotation(video_name: Path | str, frame_number: int):
    annotation_file = (
        settings.annotation_directory / video_name / f"{frame_number}.json"
    )
    if not annotation_file.exists():
        return None

    with open(annotation_file, "r") as f:
        annotation = json.load(f)
        annotation = Annotation.model_validate(annotation)

    return annotation


def apply_image_mask(
    mask_path: Path,
    frame: np.ndarray,
    width: int,
    height: int,
    save_name: Path,
    weight: float = 0.3,
    save: bool = False,
):
    if mask_path.exists():
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        _, mask = cv2.threshold(mask, 8, 255, cv2.THRESH_BINARY)
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        overlay = frame.copy()
        overlay[mask > 0] = (255, 0, 0)
        segmented_image = cv2.addWeighted(overlay, 1 - weight, frame, weight, 0)

        if save:
            (settings.segmented_images_directory / save_name.parent).mkdir(
                exist_ok=True, parents=True
            )
            cv2.imwrite(
                str(settings.segmented_images_directory / save_name),
                segmented_image,
            )
    else:
        segmented_image = None

    return segmented_image


def encode_image(image: np.ndarray):
    success, encoded_image = cv2.imencode(".webp", image)
    if not success:
        raise Exception("Error encoding image")

    return base64.b64encode(encoded_image).decode("utf-8")


def copy_images_to_input(video_name: str, start_frame: int = 0, end_frame: int = 0):
    images_dir = settings.images_dir / video_name
    input_dir = settings.input_dir / video_name
    clear_directory(input_dir)

    images = sorted(list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png")))

    for image in images[start_frame:end_frame]:
        image_name = image.name
        image_name = image_name.replace(".png", ".jpg")
        image_path = input_dir / image_name

        frame = cv2.imread(str(image))
        cv2.imwrite(str(image_path), frame)


def add_points_to_state(
    sam2_predictor: SAM2VideoPredictor,
    state: Any,
    positive_points: list[Point],
    negative_points: list[Point],
    width: int,
    height: int,
    frame_idx: int,
):
    points = np.array(
        [
            [point.x * width, point.y * height]
            for point in positive_points + negative_points
        ],
        dtype=np.float32,
    )
    labels = np.array(
        [1] * len(positive_points) + [0] * len(negative_points), dtype=np.int32
    )

    frame_idx, object_ids, masks = sam2_predictor.add_new_points_or_box(
        inference_state=state,
        frame_idx=frame_idx,
        obj_id=0,
        points=points,
        labels=labels,
    )

    return frame_idx, object_ids, masks


def process_segmentation(
    video_file: str,
    frame_number: int,
    start_frame: int,
    end_frame: int,
    sam2_predictor: SAM2VideoPredictor,
    task_queue: DefaultDict[Any, list],
    use_all_annotations: bool = False,
):
    videos, images_videos = retrieve_video_files()
    is_video = False
    if video_file in videos:
        video_path = settings.video_dir / video_file
        video_name = video_file.replace(".mp4", "")
        is_video = True
    elif video_file in images_videos:
        video_name = video_file
        video_path = settings.images_dir / video_name
    else:
        print(f"Video {video_file} not found")
        task_queue.pop((video_file, frame_number))
        return

    mask_output_directory = settings.mask_directory / video_name
    clear_directory(mask_output_directory)

    image_output_dir = settings.input_dir / video_name
    clear_directory(image_output_dir)

    if is_video:
        n_frames, width, height = extract_frames(
            video_path, image_output_dir, start_frame, end_frame
        )
    else:
        width, height = get_size_video(video_path)
        copy_images_to_input(video_name, start_frame, end_frame)

    try:
        state = sam2_predictor.init_state(str(image_output_dir))
    except Exception as e:
        print(f"Error while initializing state: {e}")
        task_queue.pop((video_file, frame_number))
        return

    if not use_all_annotations:
        annotation = get_annotation(video_name, frame_number)
        if annotation is None:
            task_queue.pop((video_file, frame_number))
            return
        add_points_to_state(
            sam2_predictor=sam2_predictor,
            state=state,
            positive_points=annotation.positivePoints,
            negative_points=annotation.negativePoints,
            width=width,
            height=height,
            frame_idx=frame_number - start_frame,
        )
    else:
        one_annotation = False
        for frame_idx in range(start_frame, end_frame):
            annotation = get_annotation(video_name, frame_idx)
            if annotation is not None:
                one_annotation = True
                add_points_to_state(
                    sam2_predictor=sam2_predictor,
                    state=state,
                    positive_points=annotation.positivePoints,
                    negative_points=annotation.negativePoints,
                    width=width,
                    height=height,
                    frame_idx=frame_idx - start_frame,
                )
        if not one_annotation:
            task_queue.pop((video_file, frame_number))
            return

    video_segments = {}
    for frame_idx, object_ids, masks in sam2_predictor.propagate_in_video(state):
        video_segments[frame_idx] = {
            out_obj_id: (masks[i] > 0.0).cpu().permute(1, 2, 0).numpy()
            for i, out_obj_id in enumerate(object_ids)
        }

    if start_frame < frame_number:
        for frame_idx, object_ids, masks in sam2_predictor.propagate_in_video(
            state, reverse=True
        ):
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

    task_queue.pop((video_file, frame_number))
