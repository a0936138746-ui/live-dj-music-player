# AI Backing Singer Frame Generation Prompts

Use these prompts to replace the current program-generated frame packs with higher quality AI-generated transparent PNG sequences.

## Global Character Lock

Use this same character description for every frame:

精緻 3D / CG 風格的 AI 伴唱小歌手，紅色或酒紅色長髮，黑色舞台服，戴發光耳機，手拿麥克風，像真人 DJ 的 AI 全息分身。身形是專業舞台偶像比例，不是 Q 版，不是幼兒卡通。全身透明背景 PNG，腳下可以有小型 cyan / purple 全息圓台光，但不要背景、不要 DJ 台、不要文字、不要浮水印。

Style lock:

- Full body, front three-quarter view.
- Transparent background.
- Same face, same hair, same outfit, same microphone in all frames.
- Same canvas size for every frame.
- Feet stay inside the same hologram platform area.
- Frame 01 and frame 16 must be loop-compatible.

Negative prompt:

不要背景，不要舞台，不要文字，不要浮水印，不要多個人物，不要分鏡格，不要低品質卡通，不要 Q 版，不要讓角色變臉，不要更換服裝，不要切掉腳，不要手指畸形，不要多餘手腳。

## idle

Create 16 transparent PNG frames named `idle-01.png` to `idle-16.png`.

Motion:

待機輕微呼吸，肩膀和頭部微微上下，左右腳只有很小的重心轉移。麥克風自然拿在嘴邊附近，表情放鬆，像等下一段音樂進來。動作要可無縫循環，第 16 張回到接近第 1 張。

## groove

Create 16 transparent PNG frames named `groove-01.png` to `groove-16.png`.

Motion:

中速 groove 舞步，左右側踏，重心從左腳換到右腳。膝蓋有自然彎曲，腳尖方向會跟著節奏轉動。上半身拿麥輕微搖擺，頭髮有一點慣性，但不要誇張。第 1 張和第 16 張要能順暢循環。

## sing

Create 16 transparent PNG frames named `sing-01.png` to `sing-16.png`.

Motion:

唱歌模式，麥克風靠近嘴巴，嘴巴有簡單開合。腳步是小型前後踩步，不是站著不動。身體有呼吸和節奏感，表情專注，像在跟主 DJ 合唱。保持透明背景與同一角色。

## chorus

Create 16 transparent PNG frames named `chorus-01.png` to `chorus-16.png`.

Motion:

副歌大動作，左右開合步，腳步比 groove 更大。身體向上拉升，手臂有舞台感，髮絲和裙擺跟著動。節奏明顯、漂亮、有偶像舞台魅力，但不要失控。第 16 張要能回到第 1 張。

## drop

Create 16 transparent PNG frames named `drop-01.png` to `drop-16.png`.

Motion:

重低音爆點，先微微蓄力，再下沉蹲點或強力踏地，腳下全息圓台可以亮一下。身體有短促衝擊感，像 bass drop 的 stomp。不要做成摔倒或失衡，保持帥氣。

## wave

Create 16 transparent PNG frames named `wave-01.png` to `wave-16.png`.

Motion:

一手拿麥，另一手向觀眾揮手帶氣氛。腳步維持小側踏，不能上半身動、腳完全不動。表情熱情，像在帶動現場觀眾。

## point

Create 16 transparent PNG frames named `point-01.png` to `point-16.png`.

Motion:

指向觀眾或鏡頭的舞台動作，腳步有一腳往前點地再收回。身體微微前傾，眼神有互動感，麥克風仍在手上。動作要循環自然。

## clap

Create 16 transparent PNG frames named `clap-01.png` to `clap-16.png`.

Motion:

拍手帶節奏，小跳或腳尖彈跳，雙腳有同步落地的節奏。拍手位置在胸前或臉旁，不要遮住整張臉。適合快歌和觀眾互動。

## transition

Create 16 transparent PNG frames named `transition-01.png` to `transition-16.png`.

Motion:

段落轉場動作，身體輕微轉向再回正，腳步小幅換重心。不要太大動作，用來連接歌曲段落。第 16 張接回第 1 張要自然。

## Export Checklist

For each folder:

- 16 PNG files.
- Transparent background.
- Same character and outfit.
- Same canvas size.
- Same approximate position and scale.
- No background or text.
- Frame names exactly match the folder name.
