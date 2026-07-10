import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/constants";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #E07A3A 0%, #2D6A4F 100%)",
          color: "white",
          fontSize: 120,
          fontWeight: 700,
          borderRadius: 96,
        }}
      >
        {APP_NAME.charAt(0)}
      </div>
    ),
    { ...size },
  );
}
