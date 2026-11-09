# 小霖的摩拖車停放紀錄

手機優先的多人共用停放紀錄網頁，使用 GitHub Pages + Supabase。

## 功能
- 四個固定地點（全聯、紀醫師、舊小象、85度C）：只記錄地點名稱，不取 GPS。
- 其他位置：按下 GPS 定位後保存緯度、經度。
- 同一天可新增多筆紀錄。
- 所有登入成員共用查詢、新增、修改日期／位置／GPS／備註及刪除紀錄。
- 可依日期及地點篩選；自訂位置可開啟 Google Maps。
- 使用 Supabase Auth 個人帳號登入。

## Supabase 設定
1. 建立一個**獨立的 Supabase 專案**，不要與其他系統共用資料庫。
2. 在 SQL Editor 執行本專案的 `schema.sql`。
3. 到 Project Settings → API，複製 Project URL 與 anon/public key。
4. 將兩項資料填入 `config.js`。
5. 不可將 service_role key 放進前端。

## 多人帳號與資料權限
- 建議採邀請制：在 Supabase Authentication → Users 由管理者逐一建立／邀請共同使用者帳號，不要開放陌生人自行註冊。
- 所有已登入帳號共用同一份停放紀錄。
- 本版 RLS 允許所有已登入成員查看、新增、修改及刪除所有紀錄。請只邀請可信任的共同使用者。

## GitHub Pages
在 GitHub Repository → Settings → Pages：
- Build and deployment：Deploy from a branch
- Branch：main
- Folder：/(root)
儲存後等待 GitHub Pages 部署完成。

網站網址預計為：
https://tms0313.github.io/xiaolin-motorcycle-parking/

## GPS
GPS 定位需使用 HTTPS，GitHub Pages 符合此條件。iPhone Safari 首次定位時需允許網站存取位置。
