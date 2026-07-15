# 图片放置说明

## 推荐文件夹结构

每个作品建立一个独立文件夹，文件夹名称必须与 `src/content/works/movie`、`manga` 或 `game` 中的 Markdown 文件名相同：

```text
public/images/works/
└── interstellar/
    ├── cover.webp
    ├── banner.webp
    ├── shot-01.webp
    ├── shot-02.webp
    └── shot-03.webp
```

## 每张图片对应哪里

- `cover.webp`：2:3 竖版封面，显示在影视、漫画、游戏卡片中。建议 1000 × 1500。
- `banner.webp`：横向大图，只显示在首页推荐和详情页顶部。建议 1600 × 900。未填写时显示横向占位图，不会使用竖版封面代替。
- `shot-01.webp` 等：详情页“展示图”。数量不限，建议使用 16:9 横图。没有图片时页面会先显示 3 个 16:9 占位位置。

然后在对应的作品 Markdown 文件中填写：

```yaml
images:
  cover: images/works/interstellar/cover.webp
  banner: images/works/interstellar/banner.webp
  gallery:
    - src: images/works/interstellar/shot-01.webp
      caption: 截图说明
    - src: images/works/interstellar/shot-02.webp
      caption: 截图说明
```

支持 JPG、PNG、WebP，推荐使用 WebP。图片会保持原有色彩。文件名建议只用英文小写、数字和短横线，不要使用空格。
