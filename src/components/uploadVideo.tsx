import { useState } from "react";

interface UploadVideoProps {
  onUpload: () => void;
}

export function UploadVideo({ onUpload }: UploadVideoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

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

  return (
    <div>
      <input type="file" accept="video/*" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload Video</button>
      {uploadStatus && <div>{uploadStatus}</div>}
    </div>
  );
}
