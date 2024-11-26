import { useState } from "react";
import Modal from "./Modal"; // Assuming you have a Modal component
import React from "react";

interface SegModalProps {
  frame_number: number;
  setFrame: (frame: number) => void;
}

const ChangeFrameModal: React.FC<SegModalProps> = ({
  frame_number,
  setFrame,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFrame, setNewFrame] = useState<number | null>(null);

  const handleNumberChange = async () => {
    console.log("New Frame", newFrame, frame_number);
    if (newFrame !== null) {
      setIsModalOpen(false);
      setFrame(newFrame);
    }
  };

  return (
    <>
      <button
        className="m-1 py-1 px-2 bg-slate-700 rounded-md text-white text-sm"
        onClick={() => setIsModalOpen(true)}
      >
        Change Frame
      </button>

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          title="Change Frame"
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleNumberChange}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block mb-2">Frame number:</label>
              <input
                type="number"
                value={newFrame ?? ""}
                onChange={(e) => setNewFrame(Number(e.target.value))}
                className="border rounded p-2 w-full"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ChangeFrameModal;
