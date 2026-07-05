# AI Singer Frame Packs

Each folder is one animation action. Keep transparent PNG frames named with this pattern:

- `idle/idle-01.png` to `idle/idle-16.png`
- `groove/groove-01.png` to `groove/groove-16.png`
- `sing/sing-01.png` to `sing/sing-16.png`
- `chorus/chorus-01.png` to `chorus/chorus-16.png`
- `drop/drop-01.png` to `drop/drop-16.png`
- `wave/wave-01.png` to `wave/wave-16.png`
- `point/point-01.png` to `point/point-16.png`
- `clap/clap-01.png` to `clap/clap-16.png`
- `transition/transition-01.png` to `transition/transition-16.png`

The app plays these frames by BPM. Replace any frame pack with higher quality hand-drawn or AI-generated transparent PNGs later without changing code.

## Replacement Rules

- Keep every frame as transparent PNG.
- Keep the singer centered in the same canvas size.
- Keep the feet inside the hologram platform area.
- Keep frame 01 and frame 16 visually close enough to loop smoothly.
- Do not include background, stage, DJ booth, text, watermark, or camera shake.
- The main DJ image/video is separate. These frames are only for the small AI backing singer.

## Motion Notes

- `idle`: subtle breathing, tiny foot weight shift.
- `groove`: side-step dance, alternating left and right foot.
- `sing`: microphone near mouth, small front/back step.
- `chorus`: bigger open-close dance step, stronger body lift.
- `drop`: bass crouch or stomp, strong downbeat.
- `wave`: one hand waving while the feet keep tempo.
- `point`: pointing to the crowd with one foot stepping forward.
- `clap`: small hop with clap timing.
- `transition`: soft fade-like body turn, useful between song sections.
