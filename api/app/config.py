from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    image_directory: Path = Path("./data/images")
    mask_directory: Path = Path("./data/masks")
    segmented_images_directory: Path = Path("./data/segmented_images")
    annotation_directory: Path = Path("./data/annotations")
    sam2_model_name: str = "facebook/sam2-hiera-large"

    video_dir: Path = Path("./data/videos")
    images_dir: Path = Path("./data/images")

    @model_validator(mode="after")
    def validate_directories(self):
        for directory in [
            self.image_directory,
            self.mask_directory,
            self.segmented_images_directory,
            self.annotation_directory,
            self.video_dir,
            self.images_dir,
        ]:
            if not directory.exists():
                directory.mkdir(exist_ok=True, parents=True)
        return self


settings = Settings()
