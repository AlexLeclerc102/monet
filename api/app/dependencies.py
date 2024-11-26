from collections import defaultdict
from functools import lru_cache

from sam2.sam2_video_predictor import SAM2VideoPredictor


@lru_cache
def get_sam2_predictor():
    return SAM2VideoPredictor.from_pretrained("facebook/sam2-hiera-large")


@lru_cache
def get_task_queue():
    return defaultdict(list)
