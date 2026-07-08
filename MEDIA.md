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
