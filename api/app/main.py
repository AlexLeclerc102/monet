from fastapi import FastAPI

from app.routes import upload, videos

app = FastAPI()
app.include_router(videos.router)
app.include_router(upload.router)


@app.get("/")
def read_root():
    return {"alive": True}
