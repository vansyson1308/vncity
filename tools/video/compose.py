"""Frames from record.mjs -> captioned MP4.

Each scene gets a caption with the street (nearest named road) and the capture date, the
imagery credit (CC BY-SA asks for it), and a short fade through black between scenes.

Usage: python tools/video/compose.py <frames dir> <site>/tour.json <out.mp4> [fps]
"""
import json
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FADE = 8          # frames to and from black at each cut


def main():
    frames, out = pathlib.Path(sys.argv[1]), sys.argv[3]
    names = {str(sc["pano"]): sc.get("street") for sc in json.loads(pathlib.Path(sys.argv[2]).read_text())["scenes"]}
    fps = int(sys.argv[4]) if len(sys.argv) > 4 else 30
    meta = json.loads((frames / "meta.json").read_text())
    files = sorted(frames.glob("f*.jpg"))
    assert len(files) == len(meta), (len(files), len(meta))
    big, small, tag = ImageFont.truetype(FONT_BOLD, 26), ImageFont.truetype(FONT, 17), ImageFont.truetype(FONT_BOLD, 20)
    starts = [i for i, m in enumerate(meta) if i == 0 or m["k"] != meta[i - 1]["k"]]
    ends = starts[1:] + [len(meta)]
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
                           "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
                           "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for s, e in zip(starts, ends):
        m = meta[s]
        street = names.get(m["id"]) or "Cầu Giấy"
        d = m["shot"][:10].split("-")
        line1 = f"{street}, Cầu Giấy, Hà Nội"
        line2 = f"Ảnh thật {m['source']} chụp {d[2]}/{d[1]}/{d[0]} (CC BY-SA 4.0) · không gian 3D dựng từ độ sâu ước lượng"
        for i in range(s, e):
            im = Image.open(files[i]).convert("RGB")
            dr = ImageDraw.Draw(im, "RGBA")
            dr.rectangle((0, im.height - 78, im.width, im.height), fill=(0, 0, 0, 120))
            dr.text((24, im.height - 70), line1, font=big, fill=(255, 255, 255))
            dr.text((24, im.height - 32), line2, font=small, fill=(225, 225, 225))
            dr.text((im.width - 24, 18), "vncity", font=tag, fill=(255, 255, 255), anchor="ra", stroke_width=2, stroke_fill=(0, 0, 0))
            dr.text((im.width - 24, 46), "nhân vật: Microsoft Rocketbox (MIT)", font=small, fill=(240, 240, 240),
                    anchor="ra", stroke_width=2, stroke_fill=(0, 0, 0))
            k = min(i - s, e - 1 - i)
            if k < FADE:
                im = Image.blend(Image.new("RGB", im.size), im, (k + 1) / (FADE + 1))
            im.save(ff.stdin, "JPEG", quality=95)
    ff.stdin.close()
    ff.wait()
    print(f"{out}: {len(files)} frames, {len(starts)} scenes, {len(files) / fps:.1f} s")


if __name__ == "__main__":
    main()
