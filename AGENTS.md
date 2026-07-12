# AGENTS.md

這份文件給之後接手本專案的 AI / 協作者使用。請先讀完再改程式，避免破壞目前已經能運作的 DJ 播放、媒體部署與雲端分享流程。

## 專案定位

這是 Next.js / React 製作的「真人 DJ 動態音樂播放器」。

核心目標不是一般音樂播放器，而是：

- 播放歌曲時，中央舞台有真人 DJ 影片。
- DJ 會依歌曲 `mood`、`bpm`、能量、播放進度切換。
- 支援本機匯入歌曲、BPM / 風格分析、下架區、清除歌單。
- 支援雲端部署，朋友打開 Vercel 網站也能看到 DJ 影片。
- 可擴充多位 DJ 輪番上鏡。

## 重要檔案

- `app/page.tsx`：主要播放器 UI、歌曲邏輯、DJ 導播邏輯。
- `app/globals.css`：舞台、播放器、DJ、光效、RWD 樣式。
- `MEDIA.md`：DJ 影片檔名、媒體資料夾、雲端上傳規則。媒體相關以這份為準。
- `DEPLOYMENT.md`：部署與 Vercel / GitHub 相關說明。
- `tools/dj-media-config.mjs`：必備 / 可選 DJ 影片清單。
- `tools/check-dj-media.mjs`：檢查本機與雲端 DJ 影片。
- `tools/create-dj-media-manifest.mjs`：產生雲端上傳清單。
- `tools/upload-dj-media-github-release.mjs`：上傳必備 DJ 影片到 GitHub Release。

## 媒體檔規則

不要把大型 MP4 / MP3 直接加入 Git。

本機 DJ 影片放在：

```text
.local-media/assets
```

`.local-media` 應維持不進 Git。正式分享或 Vercel 上線時，DJ 影片要放到公開雲端媒體位置，並設定：

```text
NEXT_PUBLIC_MEDIA_BASE_URL=https://your-cdn.example.com
NEXT_PUBLIC_MEDIA_PATH_MODE=assets
```

若使用 GitHub Release，路徑模式為：

```text
NEXT_PUBLIC_MEDIA_PATH_MODE=flat
```

## 必備 DJ 影片

目前上線穩定運作需要這 9 支：

```text
dj-soft.mp4
dj-soft-01.mp4
dj-groove.mp4
dj-groove-01.mp4
dj-peak.mp4
dj-peak-01.mp4
dj-rock-live.mp4
dj-rock-live-01.mp4
dj-guest-01.mp4
```

缺必備影片時，播放器會盡量 fallback，但分享給朋友時可能看不到完整 DJ 效果。

## 可選新增 DJ

程式已預留三組可選 DJ。這些不是必備，沒有放不算錯；只要本機或雲端偵測到，就會加入輪番上鏡。

```text
VIOLET DJ
dj-violet-soft.mp4
dj-violet-groove.mp4
dj-violet-peak.mp4
dj-violet-rock-live.mp4
dj-violet-guest.mp4

GOLD DJ
dj-gold-soft.mp4
dj-gold-groove.mp4
dj-gold-peak.mp4
dj-gold-rock-live.mp4
dj-gold-guest.mp4

SILVER DJ
dj-silver-soft.mp4
dj-silver-groove.mp4
dj-silver-peak.mp4
dj-silver-rock-live.mp4
dj-silver-guest.mp4
```

新增 DJ 時，先做 `groove` 和 `peak` 最有感；`soft`、`rock-live`、`guest` 可以後續補。

## DJ 導播邏輯

不要把 DJ 只用語言分類。中文、泰文、日文、英文只做歌曲資訊顯示。

真正影響 DJ 的是：

```text
mood: tech / rock / ballad
bpm
progress
liveAudioMetrics
```

目前程式會用 `getDjState` 決定目前需要 soft / groove / peak / rock-live 類型，再用 DJ performer roster 決定哪位 DJ 上主位、哪位支援。

避免重新寫成「固定紅髮或黑髮」；多 DJ 必須走 `DjPerformer` / `djPerformerConfigs` / `pickFeatureDjPerformer` 這套設定。

## DJ 出場編排

每首歌只選定一位特色 DJ，歌曲播放途中不要因進度百分比重新抽選角色。下一首歌再依歌單位置輪換，避免主位在同一首歌中無理由換人。

- `BLACK DJ`：穩定開場、段落銜接與收尾的主控。
- `RED DJ`：搖滾、高 BPM、Drop 與高能量段落優先。
- `VIOLET DJ`：抒情、旋律、人聲與較柔和段落優先。
- `GOLD DJ`：Hip-hop、流行舞曲、中高速科技電音優先。
- `SILVER DUO`：完整雙人主場，不放在客座小窗；接管主舞台前段先使用 `guest`，再切換歌曲對應動作。

單人特色 DJ 先用自己的 `guest` 影片在客座框預告，再於導播時段接管主位。BLACK 回到支援位時使用當前歌曲風格影片。不要讓同一 performer 同時出現在主位與客座框。

## UI 修改原則

除非使用者明確要求，請不要大改中央舞台結構：

- 不要任意移動主 DJ 舞台位置。
- 不要把主 DJ 改成抽象光球。
- 不要用低品質卡通小人替代真人 DJ。
- 不要讓同一位 DJ 在主位和客座框同時重複出現。
- 不要讓不存在的可選 DJ 佔位或閃現。
- 歌曲清單、右側 Now Playing、底部播放控制列應維持清楚可操作。

## 驗證指令

改程式後至少跑：

```powershell
npm run typecheck
npm run media:check
npm run build
```

如果要檢查目前 GitHub Release 雲端影片：

```powershell
npm run media:check -- --base-url=https://github.com/a0936138746-ui/live-dj-music-player/releases/download/dj-media-v1 --flat
```

Windows 上 `npm run build` 有時需要較高權限，因為 Next.js 打包會建立暫存程序。

## 部署

目前 GitHub repo：

```text
https://github.com/a0936138746-ui/live-dj-music-player.git
```

目前 Vercel 網站：

```text
https://live-dj-music-player.vercel.app
```

推到 `main` 後，Vercel 會自動部署。

## 工作習慣

- 修改前先看 `git status --short`，避免覆蓋使用者未提交的變更。
- 不要使用 `git reset --hard` 或強制還原，除非使用者明確要求。
- 手動編輯檔案時使用 patch，保持改動可追蹤。
- 大型媒體檔只放 `.local-media/assets` 或雲端，不要 commit。
- README 可能含早期說明；媒體流程請以 `MEDIA.md` 和本檔案為準。
