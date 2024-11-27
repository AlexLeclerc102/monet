from typing import Annotated, Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.config import settings

router = APIRouter(prefix="/upload")


@router.post("")
async def upload_files(
    images: list[UploadFile],
    videoName: Annotated[str | None, Form()],
    video: Optional[UploadFile] = None,
):
    if not video and not images:
        raise HTTPException(status_code=400, detail="No files provided")
    if video and images:
        raise HTTPException(
            status_code=400,
            detail="Cannot upload both images and video at the same time",
        )

    if video:
        if videoName is not None:
            video_location = settings.video_path / videoName
        elif videoName is None and video.filename is not None:
            video_location = settings.video_path / video.filename
        else:
            raise HTTPException(status_code=400, detail="Video name must be provided")

        with open(video_location, "wb") as f:
            f.write(await video.read())

    if images:
        if videoName is None:
            raise HTTPException(
                status_code=400, detail="Video name must be provided for images"
            )

        image_dir = settings.images_path / videoName
        image_dir.mkdir(exist_ok=True, parents=True)

        for image in images:
            if image.filename is None:
                raise HTTPException(
                    status_code=400, detail="Image must have a filename"
                )

            file_location = image_dir / image.filename
            with open(file_location, "wb") as f:
                f.write(await image.read())

    return {"info": "files successfully uploaded"}
