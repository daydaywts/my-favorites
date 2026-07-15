# 头像放置说明

把头像放进这个文件夹，例如：

```text
public/images/profile/avatar.webp
```

然后打开 `src/data/site.ts`，修改：

```ts
avatar: 'images/profile/avatar.webp',
```

建议使用正方形图片，例如 800 × 800。页面会自动裁切为圆形并转成黑白显示。将 `avatar` 留空会继续显示默认占位头像。
