import { ImageResponse } from "next/og";

// Fetch just the one glyph we need from Google Fonts (icons are generated at build time).
async function loadFraunces() {
  const css = await fetch("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@144,500&text=w").then((r) =>
    r.text(),
  );
  const url = css.match(/src: url\((.+?)\) format/)?.[1];
  return url ? fetch(url).then((r) => r.arrayBuffer()) : null;
}

/** The app mark: a lowercase serif "w" in oat on terracotta. */
export async function renderIcon(size: number) {
  const font = await loadFraunces();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#a95f3c",
          color: "#f4eee4",
          fontFamily: "Fraunces",
          fontSize: size * 0.7,
          lineHeight: 1,
          paddingBottom: size * 0.1,
        }}
      >
        w
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: font ? [{ name: "Fraunces", data: font, weight: 500, style: "normal" }] : undefined,
    },
  );
}
