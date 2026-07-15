export type Category = 'movie' | 'manga' | 'game';

export interface WorkImages {
  /** 卡片使用的竖版封面，建议 1000 × 1500（2:3） */
  cover?: string;
  /** 首页推荐和详情页顶部使用的横幅，建议 1600 × 900 */
  banner?: string;
  /** 详情页“喜欢的瞬间”截图，可随时增减 */
  gallery?: Array<{ src: string; caption?: string }>;
}

export interface LibraryItem {
  slug: string;
  category: Category;
  title: string;
  originalTitle?: string;
  releaseDate: string;
  meta: string;
  summary: string;
  tags: string[];
  introduction: string;
  images: WorkImages;
  date: string;
}
