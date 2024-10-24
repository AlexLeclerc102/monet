import base64
import os
from pathlib import Path

import cv2
from fastapi import FastAPI, File, UploadFile
from video_utils.image import ImageFromVideo

app = FastAPI()


@app.get("/")
def read_root():
    return {"alive": True}


@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file:
        return {"error": "No file sent"}
    print(f"Received file: {file.filename}")
    os.makedirs("./data", exist_ok=True)
    file_location = f"./data/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}


@app.get("/videos")
def get_videos():
    videos = os.listdir("./data")
    videos = [video for video in videos if video.endswith(".mp4")]
    return {"videos": videos}


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
        return {"error": "Error encoding image"}

    image_base64 = base64.b64encode(encoded_image).decode("utf-8")

    return {"image": image_base64, "frame_number": frame_number}
