# 真人 DJ 動態音樂播放器

## 開發預覽

```powershell
npm install
npm run dev
```

開啟 http://localhost:3000

## 目前功能

- 可匯入本機 MP3 / WAV 等音訊。
- 可一次匯入多首歌曲。
- 匯入後會儲存在瀏覽器 IndexedDB，重新整理後仍會保留。
- 可搜尋歌曲、歌手、BPM。
- 可依風格篩選：科技電音、搖滾、抒情。
- 可下架歌曲，之後再加回。
- 可永久刪除歌曲。
- 可一鍵清除目前歌單、下架區與本機儲存。
- 自動估算 BPM、能量與歌曲風格。
- 自動判斷不準時，可在右側快速切換 AUTO / 電音 / 搖滾 / 抒情。
- 真人 DJ 影片依 BPM、風格、能量與歌曲進度切換。
- 進度條、播放 / 暫停、上一首 / 下一首、音量、單曲循環、歌詞高亮。
- 鍵盤操作：空白鍵播放 / 暫停，左右鍵切歌。

## 替換 DJ 素材

目前主要使用影片：

```text
public/assets/dj-soft.mp4
public/assets/dj-soft-01.mp4
public/assets/dj-groove.mp4
public/assets/dj-groove-01.mp4
public/assets/dj-peak.mp4
public/assets/dj-peak-01.mp4
public/assets/dj-rock-live.mp4
public/assets/dj-rock-live-01.mp4
public/assets/dj-guest.mp4
public/assets/dj-guest-01.mp4
```

如果某個影片不存在，播放器會退回 `dj-soft.mp4`，避免舞台空白。之後新增其他風格影片，可以繼續放在 `public/assets/`，或搬到雲端素材庫。

## 歌曲分類規則

DJ 動作不是依照中文、泰文、日文、英文分類。語言只作為歌曲資訊顯示。

真正影響 DJ 反應的是：

```text
mood: tech / rock / ballad
bpm: 歌曲速度
progress: 歌曲進度
```

目前大致對應：

```text
ballad 或低 BPM -> dj-soft.mp4
tech / 中速 -> dj-groove.mp4
tech 高潮或快速 -> dj-peak.mp4
rock -> dj-rock-live.mp4
快歌中後段 -> dj-guest.mp4 可客串出現
```

未來新增歌曲時，語言只用來顯示。播放器會先在本機自動掃描音檔，估出 `bpm`、能量和建議 `mood`，再用這些結果驅動 DJ。歌曲資料裡手動填的 `mood` 和 `bpm` 是 fallback。

本機自動分檢不會上傳音檔，也不需要外部 AI API。

頁面上的「加入歌曲」可以直接選本機音訊檔，播放器會加入清單並自動分檢。匯入歌曲會儲存在瀏覽器 IndexedDB，不會寫回專案檔案。

歌曲卡片上的下架只會從目前播放清單移到下架區，不會刪除硬碟上的音樂檔。下架區中的歌曲可以再加回播放清單。

「全部清除」會清掉目前歌單、下架區、分析快取、風格覆蓋與瀏覽器本機儲存。

自動分檢會顯示信心度。若信心度不足，DJ 會改用歌曲資料中的 fallback。頁面也提供風格覆蓋選單，可以直接把當前歌曲改成 `tech`、`rock` 或 `ballad`。

## 雲端部署與素材

部署流程請看：

```text
DEPLOYMENT.md
```

本機測試可以繼續使用 `public/assets/` 和 `public/music/`。正式上線後，MP3 / MP4 建議放到 Vercel Blob、Cloudflare R2 或其他 CDN。

設定環境變數後，播放器會自動把 `/assets/...` 和 `/music/...` 改成雲端網址：

```text
NEXT_PUBLIC_MEDIA_BASE_URL=https://your-cdn-domain.com
NEXT_PUBLIC_ENABLE_SINGER_FRAMES=false
NEXT_PUBLIC_ENABLE_DJ_VARIANTS=false
```

`NEXT_PUBLIC_MEDIA_BASE_URL` 留空時會繼續使用本機 `public`。小歌手圖序列與備用 DJ 影片搬到雲端前，兩個啟用開關先維持 `false`。

## 加入真正音樂

把音樂檔放到：

```text
public/music/
```

例如：

```text
public/music/mandarin-night.mp3
```

再到 `app/page.tsx` 的歌曲資料加入：

```ts
{
  id: "new-song",
  title: "New Song",
  artist: "Artist Name",
  language: "英文",
  mood: "tech",
  bpm: 128,
  duration: 210,
  audioSrc: "/music/new-song.mp3",
  minAge: 0,
  accent: "#25f3ff",
  lyric: ["line 1", "line 2", "line 3"],
}
```

沒有 `audioSrc` 時，播放器會維持展示模式，用假的進度條呈現 UI。

## AI DJ Next Fit

- AI DJ 會用目前歌曲的 `mood`、`bpm`、本機分析結果與手動風格覆寫，推薦比較適合銜接的下一首。
- 推薦邏輯不是中文、泰文、日文、英文分類；語言只是歌曲資訊，真正影響 DJ 反應的是 `tech / rock / ballad` 與 BPM。
- 畫面右側會顯示 `Next fit`，按 `接下一首` 可以直接切到推薦歌曲。

## DJ 影片插槽

之後要恢復多 DJ 出場時，把新影片放到 `public/assets/`，使用這些固定檔名：

```text
dj-soft.mp4       慢歌 / 抒情
dj-groove.mp4     中速電音
dj-peak.mp4       快歌 / 高潮
dj-rock-live.mp4  搖滾
dj-guest.mp4      客座 DJ
```

如果某個檔案不存在，播放器會自動用 `dj-soft.mp4` 代替，避免畫面空白。

目前也支援同類備用影片輪替：

```text
dj-soft-01.mp4
dj-groove-01.mp4
dj-peak-01.mp4
dj-rock-live-01.mp4
dj-guest-01.mp4
```

同一首歌播放中不會一直切換，避免閃爍；換歌時才會在同類影片裡輪替。
