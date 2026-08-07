# 退休金流管理

追蹤退休後每月花費是否落在預算內。花費資料直接讀取自 Notion「退休每月金流管理」頁面，每次開啟網頁會自動抓最新資料，並用圖表顯示：

- 當月花費 vs 每月預算上限（可在網頁上調整，預設 NT$30,000）
- 歷史每月結餘 / 透支，以及累積結餘 / 透支趨勢

## Notion 資料格式

在「退休每月金流管理」頁面底下，每個月各建立一個子頁面，標題格式為 `N月`（例如 `8月`）。子頁面內容以純文字記錄，每筆一行，格式為：

```
8/1 咖啡 710
8/2 機車加油 107
8/6 其他ss 3000
```

不符合這個格式的行（空行、備註文字）會被忽略。

## 設定 Notion 存取權限

1. 到 [notion.so/my-integrations](https://www.notion.so/my-integrations) 建立一個 internal integration，複製它的 secret（開頭通常是 `ntn_` 或 `secret_`）。
2. 打開 Notion 裡的「退休每月金流管理」頁面 → 右上角 `Share` → 把剛剛建立的 integration 加入分享權限（子頁面會自動繼承，不需要逐一分享）。

## 本機開發

```bash
cp .env.local.example .env.local
# 編輯 .env.local，填入自己的 NOTION_TOKEN（步驟見上）
# NOTION_ROOT_PAGE_ID 已預填好「退休每月金流管理」頁面的 ID，通常不用改

npm install
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000) 查看。

## 部署到 Vercel

1. 把這個專案 push 到 GitHub，在 [vercel.com](https://vercel.com) 匯入這個 repo。
2. 在 Vercel 專案的 **Settings → Environment Variables** 設定：
   - `NOTION_TOKEN`：你的 Notion integration secret
   - `NOTION_ROOT_PAGE_ID`：`130bbaa19830801cbd43ecc6d569b008`
3. Deploy。之後每次開啟部署好的網址，就會自動讀取 Notion 最新資料。

`NOTION_TOKEN` 只存在伺服器端環境變數，不會出現在前端程式碼或 git 紀錄中。

## 每月新增資料

到下個月時，在「退休每月金流管理」頁面底下新增一個子頁面（例如 `9月`），用相同的純文字格式記錄花費即可，網頁會自動抓到並列入歷史圖表。
