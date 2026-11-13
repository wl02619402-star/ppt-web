# 簡報美編工坊（純網頁）

## 使用者怎麼用
1. 開網站 → 把空白文字檔 pptx 拖進去（檔案只在瀏覽器內處理，不會上傳）
2. 自動出現現場 16:9 版 + 線上長條版預覽；右側可改文字、紅字、字級、長條位置、換主題或上傳自己的背景圖；單頁可獨立換背景（純色、別的主題、自己的圖）；經文可獨立字型、文字陰影、標題色塊、行距（PowerPoint 多行倍數）
3. 按右上「匯出全部」→ 下載 zip：現場版 pptx、長條版 pptx（透明背景）、全部 PNG

## 部署（二選一，都是免費靜態網站）
- Vercel：把 ppt-web 資料夾拖到 vercel.com/new
- GitHub Pages：推到 repo，Settings → Pages
本機測試：`python3 -m http.server 8765` 後開 http://localhost:8765

## 檔案
- index.html 介面　- app.js 解析/排版/編輯/匯出　- themes.js（手繪 40 套）、themes2.js（程式化 72 套）、themes3.js（撕邊紙 5 套與自動版型），共 117 套背景（背景與長條共用同一組裝飾）
- 需要網路載入：Noto Sans TC 字型、JSZip、PptxGenJS（CDN）
