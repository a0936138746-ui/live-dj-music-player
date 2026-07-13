# DJ 影片媒體設定

## 本機開發

本機 DJ 影片請放這裡：

```text
.local-media/assets
```

播放器會用這個路徑讀取：

```text
/api/local-media/assets/檔名.mp4
```

`.local-media` 不會被 Git 上傳，所以不會進 GitHub，也不會進 Vercel 部署檔案。

## 分享與 Vercel 上線

別人打開你的 Vercel 網站時，看不到你電腦裡的 `.local-media`。要分享給別人看，必須把同一批 MP4 上傳到公開雲端媒體空間，然後在 Vercel 設定：

```text
NEXT_PUBLIC_MEDIA_BASE_URL=https://your-cdn.example.com
```

雲端資料夾要保留同樣結構：

```text
https://your-cdn.example.com/assets/dj-soft.mp4
https://your-cdn.example.com/assets/dj-groove.mp4
https://your-cdn.example.com/assets/dj-peak.mp4
https://your-cdn.example.com/assets/dj-rock-live.mp4
https://your-cdn.example.com/assets/dj-guest-01.mp4
```

推薦放影片的地方：

- Cloudflare R2
- Supabase Storage
- Vercel Blob
- GitHub Releases

不建議用 Google Drive 直連影片，因為公開連結與影片分段播放常常不穩。

## 公開首播曲

新訪客的預設歌單會顯示一首公開首播曲。原始下載檔雖然使用 `.mp3` 副檔名，實際容器是 AAC / M4A，因此雲端與本機統一使用：

```text
starter-tonight-out-of-control.m4a
```

本機放在 `.local-media/assets`，正式網站放在與 DJ 影片相同的雲端媒體庫。使用 GitHub Release 的 `flat` 模式時，檔案與 MP4 平放在同一層。不要將這支約 22 MB 的音訊加入 Git。

GitHub Release 資產原始回應是 `application/octet-stream` 與附件下載，且沒有供 Web Audio 使用的 CORS 標頭。播放器透過固定的 `/api/starter-track` 同源路由轉發 Range 請求，統一回傳 `audio/mp4`、inline 與 CORS 標頭。不要讓前端繞過這條路由直接播放 Release URL。

## 目前播放器會用到的 DJ 影片檔名

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

其他備用或舊影片可以留在 `.local-media/assets`，但上線分享時，只要雲端有上面這些檔名，主要 DJ 播放就能正常工作。

## 新增更多 DJ 的命名規則

目前程式已預留 3 組可選客座 DJ。這些影片不是必備檔案，沒有放也不會讓網站錯誤；只要本機或雲端偵測到，就會加入輪番上鏡。

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

每位 DJ 最少可以先做 4 支：`soft`、`groove`、`peak`、`rock-live`。`guest` 是客座鏡頭專用，可晚一點補。

## 檢查影片是否齊全

檢查本機 `.local-media/assets`：

```powershell
npm run media:check
```

如果已經有雲端網址，可以一起檢查雲端：

```powershell
npm run media:check -- --base-url=https://your-cdn.example.com
```

也可以把 `NEXT_PUBLIC_MEDIA_BASE_URL` 放在 `.env.local`，再執行：

```powershell
npm run media:check -- --cloud
```

## 產生雲端上傳清單

產生必要 DJ 影片的上傳清單：

```powershell
npm run media:manifest
```

清單會輸出到：

```text
.local-media/dj-media-manifest.json
```

如果要一起列出本機資料夾裡多出的 MP4：

```powershell
npm run media:manifest -- --all
```

如果要在清單中直接產生雲端 URL：

```powershell
npm run media:manifest -- --base-url=https://your-cdn.example.com
```

GitHub Release 的影片是平放檔名，不會有 `assets/` 資料夾。要產生 GitHub Release 格式的清單：

```powershell
npm run media:manifest -- --base-url=https://github.com/YOUR_NAME/YOUR_REPO/releases/download/dj-media-v1 --flat
```

上傳到雲端時，請讓每個檔案的雲端路徑符合清單裡的 `targetPath`。例如 `targetPath` 是 `assets/dj-soft.mp4`，雲端 URL 就要是：

```text
https://your-cdn.example.com/assets/dj-soft.mp4
```

## 用 GitHub Release 放 DJ 影片

如果不想先開 Cloudflare R2 或 Supabase，可以用 GitHub Release 當第一版媒體庫。

先確認 GitHub CLI 已登入：

```powershell
gh auth login -h github.com
```

登入後執行：

```powershell
npm run media:github-release
```

完成後，工具會印出 Vercel 要設定的環境變數：

```text
NEXT_PUBLIC_MEDIA_BASE_URL=https://github.com/YOUR_NAME/YOUR_REPO/releases/download/dj-media-v1
NEXT_PUBLIC_MEDIA_PATH_MODE=flat
```
