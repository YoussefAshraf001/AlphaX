import Cropper from "react-easy-crop";
import { useState } from "react";
import { getCroppedBase64 } from "../utils/cropImage";

const AvatarCropModal = ({ image, onSave, onClose }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-[#121212] rounded-xl p-6 w-[360px]">
        <div className="relative w-full h-[260px] bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) =>
              setArea(croppedAreaPixels)
            }
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="text-white/60">
            Cancel
          </button>
          <button
            onClick={async () => {
              const base64 = await getCroppedBase64(image, area);
              onSave(base64);
            }}
            className="px-4 py-2 bg-red-600 rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
