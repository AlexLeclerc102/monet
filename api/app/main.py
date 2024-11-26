import os

from fastapi import FastAPI, File, UploadFile

from app.routes import videos

app = FastAPI()
app.include_router(videos.router)


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
