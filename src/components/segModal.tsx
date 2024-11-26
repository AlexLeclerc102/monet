import { useState } from "react";
import Modal from "./Modal"; // Assuming you have a Modal component
import React from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

interface SegModalProps {
  selectedVideo: string;
  frame_number: number;
}

const SegModal: React.FC<SegModalProps> = ({ selectedVideo, frame_number }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startFrame, setStartFrame] = useState<number | null>(null);
  const [endFrame, setEndFrame] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const handleSegmentation = async () => {
    if (frame_number && startFrame !== null && endFrame !== null) {
      await axios.post(`/api/videos/${selectedVideo}/sam/${frame_number}`, {
        start_frame: startFrame,
        end_frame: endFrame,
      });
      setIsModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["video_frames", selectedVideo],
      });
    }
  };

  return (
    <>
      <button
        className="m-1 py-1 px-3 bg-pink-700 rounded-md text-white"
        onClick={() => setIsModalOpen(true)}
      >
        Segment Frames
      </button>

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          title="Segment Frames"
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleSegmentation}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block mb-2">Start Frame:</label>
              <input
                type="number"
                value={startFrame ?? ""}
                onChange={(e) => setStartFrame(Number(e.target.value))}
                className="border rounded p-2 w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2">End Frame:</label>
              <input
                type="number"
                value={endFrame ?? ""}
                onChange={(e) => setEndFrame(Number(e.target.value))}
                className="border rounded p-2 w-full"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default SegModal;
