# 雲端部署流程

這個專案可以用 GitHub + Vercel 自動部署。

## 1. 本機先確認

```powershell
npm install
npm run dev
```

開啟：

```text
http://localhost:3000
```

## 2. 建立 GitHub repo

如果目前資料夾還不是有效 Git repo，先執行：

```powershell
git init
git add .
git commit -m "Initial cloud-ready player"
```

到 GitHub 建立新 repo 後，照 GitHub 畫面給的指令加入遠端：

```powershell
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## 3. 連到 Vercel

1. 登入 Vercel。
2. 選 `Add New Project`。
3. 匯入剛剛的 GitHub repo。
4. Framework 選 Next.js。
5. Build command 使用 `npm run build`。
6. Deploy。

之後只要 push 到 GitHub，Vercel 就會自動部署新版。

## 4. 大型歌曲 / DJ 影片

本機測試可以繼續放：

```text
public/assets/
public/music/
```

但正式上線後，MP3 / MP4 建議放到 Vercel Blob、Cloudflare R2 或其他 CDN，避免 repo 越來越大。

目前 GitHub 部署包只保留核心 DJ 影片。測試歌曲、多餘備用影片、小歌手圖序列預設不會上傳，這是為了避免 Vercel 靜態檔部署過大。

搬到雲端後，在 Vercel 專案的 Environment Variables 加：

```text
NEXT_PUBLIC_MEDIA_BASE_URL=https://your-cdn-domain.com
```

小歌手圖序列搬到雲端後，再加：

```text
NEXT_PUBLIC_ENABLE_SINGER_FRAMES=true
```

備用 DJ 影片也搬到雲端後，再加：

```text
NEXT_PUBLIC_ENABLE_DJ_VARIANTS=true
```

播放器會自動把：

```text
/assets/dj-soft.mp4
/music/song.mp3
```

轉成：

```text
https://your-cdn-domain.com/assets/dj-soft.mp4
https://your-cdn-domain.com/music/song.mp3
```

如果 `NEXT_PUBLIC_MEDIA_BASE_URL` 留空，就會繼續使用本機 `public` 資料夾。

## 5. 目前需要人工授權的地方

Codex 可以幫你整理檔案和指令，但以下需要你登入或授權：

- GitHub 建立 repo / 授權 push
- Vercel 連 GitHub
- Vercel Blob 或 Cloudflare R2 上傳素材

授權完成後，後續更新可以走：

```powershell
git add .
git commit -m "Update player"
git push
```
