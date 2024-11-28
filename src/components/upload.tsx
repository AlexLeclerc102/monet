import { useState } from "react";
import { ChevronUp } from "../icons/chevronUp";
import { ChevronDown } from "../icons/chevronDown";
import axios from "axios";

interface UploadProps {
  onUpload: () => void;
}

export function Upload({ onUpload }: UploadProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [videoName, setVideoName] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleVideoFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files[0]) {
      setVideoFile(event.target.files[0]);
    }
  };

  const handleImageFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      setImageFiles(Array.from(event.target.files));
    }
  };

  const handleUpload = async () => {
    if (!videoFile && !imageFiles.length) {
      setUploadStatus("No video file selected");
      return;
    }
    if (videoFile && imageFiles.length > 0) {
      setUploadStatus("Please select either video or image files");
      return;
    }

    if (!videoName && imageFiles.length > 0) {
      setUploadStatus("No video name provided for images");
      return;
    }

    const formData = new FormData();
    if (videoFile) {
      formData.append("video", videoFile);
    }
    for (var x = 0; x < imageFiles.length; x++) {
      formData.append("images", imageFiles[x]);
    }
    formData.append("videoName", videoName);

    setIsUploading(true);
    try {
      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200) {
        setUploadStatus("Upload successful!");
        onUpload();
      } else {
        setUploadStatus(`Upload failed: ${response.data.detail[0].msg}`);
      }
    } catch (error: any) {
      setUploadStatus(`Upload error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <h2
        className="text-2xl font-bold mb-2 cursor-pointer flex items-center justify-between"
        onClick={toggleDrawer}
      >
        Upload Files
        {isDrawerOpen ? <ChevronUp /> : <ChevronDown />}
      </h2>
      {isDrawerOpen && (
        <div className="border-t mt-2 pt-2 flex items-center space-x-4">
          <div>
            <label className="block mb-1">Select a video file:</label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFileChange}
              className="mb-2"
            />
          </div>
          <div>
            <label className="block mb-1">Select image files:</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFilesChange}
              className="mb-2"
            />
          </div>
          <div>
            <label className="block mb-1">Enter name for the video:</label>
            <input
              type="text"
              value={videoName}
              onChange={(e) => setVideoName(e.target.value)}
              className="mb-2 border rounded p-2 w-full"
            />
          </div>
          <button
            onClick={handleUpload}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
          {uploadStatus && (
            <div className="mt-2 text-sm text-red-500">{uploadStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}
