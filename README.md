# 我的收藏 · 修改与部署教程

这是一个使用 Astro 制作的个人收藏网站。网页界面保持黑白灰，你上传的封面、Banner 和展示图会保留原有彩色。

## 本地打开网站

在项目文件夹中打开 PowerShell：

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器打开终端显示的网址，通常是 `http://localhost:4321`。停止网站时按 `Ctrl + C`。

## 最常修改的文件

| 想修改什么                      | 文件位置                                     |
| -------------------------- | ---------------------------------------- |
| 添加、删除或修改一部作品               | `src/content/works/movie`、`manga`、`game` |
| 修改首页展示和年度推荐                | `src/data/home.ts`                       |
| 修改网站名称、头像、简介、侧栏更新时间、各页面副标题 | `src/data/site.ts`                       |
| 写文章                        | `src/content/articles/*.md`              |
| 替换网站和页面图标                  | `public/icons`                           |
| 调整网站主题颜色                   | `src/styles/global.css`                  |

## 一部作品对应一个 Markdown 文件

作品按照分类保存在 `src/content/works/movie`、`src/content/works/manga` 和 `src/content/works/game`。文件名就是作品网址，请只使用英文小写、数字和短横线。

添加作品时，进入对应分类文件夹并复制一个已有 `.md` 文件，例如在 `movie` 中复制 `interstellar.md`，改名为 `new-work.md`，再修改内容：

```markdown
---
title: 新作品
originalTitle: Original Title
category: movie
releaseDate: '2026.07.15'
meta: 剧情 / 科幻
summary: 显示在搜索结果和网页说明中的简短摘要。
date: '2026.07.14'
tags: [科幻, 成长]
# 简介放在标签下面，支持 Markdown
introduction: |
  这里写作品简介，可以使用 **粗体**、列表、引用和链接。

  - 可以写多段内容
images:
  cover: images/works/new-work/cover.webp
  banner: images/works/new-work/banner.webp
  gallery:
    - src: images/works/new-work/shot-01.webp
      caption: 第一张截图
    - src: images/works/new-work/shot-02.webp
      caption: 第二张截图
---

<!-- 分隔符下面全部作为短评，支持完整 Markdown -->

这里写自己的短评。

> 也可以使用引用格式。
```

- `category` 只能填写 `movie`、`manga` 或 `game`。
- `title` 填写主要显示的中文标题；`originalTitle` 填写作品原始语言标题。`originalTitle: ''` 留空时不显示，填写后会自动显示在作品详情页中文标题下方。
- 除 `Interstellar` 外，现有示例作品的 `originalTitle` 目前都是空字符串，所以暂时不会显示；在引号内填入原标题后即可出现。
- `releaseDate` 是作品本身的日期，统一填写年月日，例如 `2026.07.15`；详情页显示和分类页排序都会使用这个日期。
- 完整作品日期只在作品详情页显示；首页推荐、搜索结果和封面悬停提示等其他位置只显示年份。
- 现有示例作品已临时补全为对应年份的 `01.01`，请按作品的真实日期直接修改各自 Markdown 文件中的 `releaseDate`。
- `date` 是你添加或记录作品的时间，建议使用 `YYYY.MM.DD`。
- `tags` 可以随时增加、修改或删除，标签页会自动更新。
- 删除作品时，直接删除分类文件夹中的对应 `.md` 文件；如果首页设置中使用了它，也要从 `src/data/home.ts` 删除对应文件名。
- `introduction: |` 紧跟在 `tags` 下面，是作品简介；缩进两格后可以使用粗体、列表、引用、链接和多段文字等 Markdown 格式。
- 第二个 `---` 表示作品信息结束；分隔符下面的全部正文都是短评，可以直接使用完整 Markdown，不需要再写 `review:`。
- 网页会按照“简介在上、短评在下”显示，两部分使用一致的样式。

## 作品图片

每个作品建立一个与 Markdown 文件同名的图片文件夹：

```text
public/images/works/new-work/
├── cover.webp       竖版封面，建议 2:3，例如 1000 × 1500
├── banner.webp      横向大图，建议 16:9，例如 1600 × 900
├── shot-01.webp     详情页截图
└── shot-02.webp     详情页截图
```

上传的图片会保持原有彩色，不再自动变成黑白。没有填写图片时会显示黑白灰占位图。`cover`、`banner`、`gallery` 各自用途独立，不会混用。详情页在图片不足时会自动补足 3 个 16:9 占位位置，方便确认排版。

## 修改首页收藏内容

打开 `src/data/home.ts`：

```ts
export const homeCollections = {
  movie: ['interstellar', 'spirited-away'],
  manga: ['star-sea', 'cloud-letter'],
  game: ['elden-ring', 'zelda'],
};
```

引号里的文字必须与 `src/content/works/movie`、`manga` 或 `game` 中的 Markdown 文件名一致，但不包含 `.md`。调整顺序即可调整首页顺序。首页桌面端每行显示 6 项，数量可以自由增减。

## 修改年度推荐

同样打开 `src/data/home.ts`，修改：

```ts
export const annualRecommendations = [
  'interstellar',
  'star-sea',
  'elden-ring',
  'spirited-away',
  'zelda',
];
```

年度推荐使用每部作品 Markdown 文件里的 `images.banner`。轮播每 4 秒切换一次，鼠标悬停或键盘聚焦时暂停。建议保持 5 项。

## 写 Markdown 文章

在 `src/content/articles` 中复制一个现有 `.md` 文件并改名：

```markdown
---
title: 文章标题
summary: 文章摘要。
date: '2026.07.14'
tags: [随笔, 影视]
---

这里开始写文章正文。
```

左侧会按 `date` 从新到旧自动展示最多 5 篇文章，不足 5 篇时显示现有数量。全部文章可从“更多文章”进入。

## 头像和图标

- 头像放到 `public/images/profile`，然后在 `src/data/site.ts` 中填写 `avatar: 'images/profile/avatar.webp'`。
- 影视、漫画、游戏、文章和标签页的副标题统一在 `src/data/site.ts` 的 `pageDescriptions` 中修改。
- 左下角引语框可在 `src/data/site.ts` 中通过 `showQuote: true` 显示，改成 `false` 即可隐藏。
- 左侧日夜模式旁的更新时间在 `src/data/site.ts` 中修改 `updatedAt`。
- 浏览器图标和页面小图标位于 `public/icons`，用自己的 SVG 覆盖同名文件即可。

## 搜索和标签

- 右上角搜索支持作品标题、作品标签和文章，也可以按 `Ctrl + K`。
- 分类页搜索支持标题和标签。
- 分类页标签可以多选，只要作品命中任意一个已选标签就会显示；再次点击标签可以取消选择，“全部标签”会清空选择。
- 影视页独有的“二次元”开关默认开启；关闭后会隐藏所有带有 `二次元` 标签的影视作品。
- 分类页可以按照作品日期从新到旧或从旧到新排列。
- 左侧“标签”会打开“标签筛选”页面，并自动汇总所有作品 Markdown 文件中的标签。
- 顶部“文章”可以打开文章列表，文章页支持按照文章时间从新到旧或从旧到新排列。

## 发布前检查

```powershell
npm.cmd run build
npm.cmd run preview
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，例如 `my-favorites`。
2. 将项目推送到仓库的 `main` 分支。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
5. 等待 Actions 中的部署任务完成。

以后每次向 `main` 分支推送修改，网站都会自动更新。



结论：项目源码可以迁移，但不能保证复制到任意电脑后“零设置直接开发”。我没有修改任何文件。

需要注意：

- `node_modules` 占约 191 MB，包含 Windows x64 专用组件。换电脑后建议运行 `npm ci` 重新安装，不要依赖直接复制。
- 新电脑需要安装 Node.js 22.12 或更高版本以及 Git。
- 推送 GitHub 前，需要在新电脑重新登录：`gh auth login`。登录凭据不会随文件夹复制。
- 当前发布工具尚未提交到 Git。如果通过 U 盘复制整个文件夹，它会保留；如果重新从 GitHub 克隆，则不会包含发布工具。
- `启动发布工具.cmd` 只能在 Windows 使用；macOS/Linux 可运行 `npm run deploy-tool`。
- 项目中没有写死当前电脑的盘符、目录或用户名，`.git` 仓库和远程地址也完整。

如果目标仍是另一台 Windows x64 电脑，复制整个文件夹后安装 Node、Git，再运行一次 `npm ci`，即可继续开发。
