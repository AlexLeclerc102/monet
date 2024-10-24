import { useState } from "react";
import { ChevronUp } from "../icons/chevronUp";
import { ChevronDown } from "../icons/chevronDown";

interface UploadVideoProps {
  onUpload: () => void;
}

export function UploadVideo({ onUpload }: UploadVideoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("No file selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadStatus("Upload successful!");
        onUpload();
      } else {
        const errorData = await response.json();
        setUploadStatus(`Upload failed: ${errorData.detail[0].msg}`);
      }
    } catch (error: any) {
      setUploadStatus(`Upload error: ${error.message}`);
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
        Upload Video
        {isDrawerOpen ? <ChevronUp /> : <ChevronDown />}
      </h2>
      {isDrawerOpen && (
        <div className="border-t mt-2 pt-2">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="mb-2"
          />
          <button
            onClick={handleUpload}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Upload Video
          </button>
          {uploadStatus && (
            <div className="mt-2 text-sm text-red-500">{uploadStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}
