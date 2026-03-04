# UI 设计系统文档

## 设计理念

### 设计原则

- **线条简约**: 使用细边框 (`border-stone-200`) 分割模块，避免厚重装饰和阴影
- **优雅暖色调**: 以玫瑰珊瑚色系为主，营造温暖、优雅、现代的聊天氛围
- **统一背景**: 整体使用统一的低饱和暖米色背景，通过线条区分模块
- **层次清晰**: 通过边框和微妙的色彩变化建立视觉层级

## 色彩系统

### 主色调 (优雅玫瑰珊瑚)

```
Primary:     #C45B4A  (优雅玫瑰珊瑚色 - 强调色)
Primary-50:  #FCF5F4  (极浅玫瑰背景)
Primary-100: #F5E6E4  (浅玫瑰背景 - 用户消息)
Primary-200: #E8D0CC  (边框/悬停)
Primary-500: #D46856  (中玫瑰色)
Primary-600: #C45B4A  (主按钮)
Primary-700: #A84D3E  (深色强调)
Primary-900: #6B3329  (深玫瑰文字)
```

### 中性色 (低饱和暖灰)

```
Background:  #FAF8F6  (统一暖米色背景)
Foreground:  #292524  (暖黑文字)
Card:        #FDFCFB  (暖白卡片 - 略暖于纯白)
Border:      #E5E2DF  (暖灰边框 - 主要分割)
Muted:       #F2F0EE  (暖灰背景)
Muted-FG:    #78716C  (次要文字)
```

### 语义色

```
Success: #15803D  (柔和绿色)
Warning: #A16207  (柔和黄色)
Error:   #C24141  (柔和红色)
Info:    #0369A1  (柔和蓝色)
```

### 消息气泡色

```
User-BG:      #F5E6E4  (浅玫瑰背景)
User-Border:  #E8D0CC  (玫瑰边框)
User-FG:      #6B3329  (深玫瑰文字)
Assistant-BG: #FDFCFB  (暖白背景)
Assistant-Border: #E5E2DF  (暖灰边框)
Assistant-FG: #292524  (深色文字)
```

## 字体系统

### 字体族

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### 字号规范

| 级别 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| H1 | 1.25rem (20px) | 600 | 1.3 | 页面标题 |
| H2 | 1.125rem (18px) | 600 | 1.4 | 区块标题 |
| H3 | 1rem (16px) | 500 | 1.4 | 卡片标题 |
| Body | 0.875rem (14px) | 400 | 1.6 | 正文 |
| Small | 0.75rem (12px) | 400 | 1.5 | 辅助文字 |
| Tiny | 0.625rem (10px) | 500 | 1.4 | 标签/时间 |

## 间距系统

### 基础单位: 4px

```
xs:   4px   (0.25rem)
sm:   8px   (0.5rem)
md:   12px  (0.75rem)
base: 16px  (1rem)
lg:   24px  (1.5rem)
xl:   32px  (2rem)
```

### 组件间距

- **卡片内边距**: 16px
- **表单元素间距**: 16px - 20px
- **按钮内边距**: 8px 16px
- **列表项内边距**: 14px 16px
- **模块间距**: 使用 `border-stone-200` 线条分割

## 圆角系统

```
sm:   4px   (输入框、小按钮)
md:   6px   (卡片、大按钮)
lg:   8px   (模态框、大卡片)
full: 9999px (标签、头像)
```

## 边框系统

### 边框宽度

```
默认: 1px
激活: 2px (选中状态)
```

### 边框颜色

```
主要分割: #E5E2DF (--border / border-stone-200)
次级分割: #F2F0EE (border-stone-100)
强调边框: #E8D0CC (primary-200)
激活边框: #C45B4A (primary)
```

## 组件规范

### 按钮 (Button)

#### 主按钮
```
背景: #C45B4A (primary)
文字: #FFFFFF (primary-foreground)
边框: none
圆角: 6px
内边距: 8px 16px

悬停: 背景 #A84D3E (primary-700)
禁用: 背景 #E8D0CC (primary-200), 文字 #D46856
```

#### 次要按钮
```
背景: transparent
文字: #C45B4A (primary)
边框: 1px solid #E5E2DF
圆角: 6px
内边距: 8px 16px

悬停: 背景 #F5E6E4 (primary-100), 边框 #E8D0CC
```

#### 幽灵按钮
```
背景: transparent
文字: #78716C (muted-foreground)
边框: none

悬停: 背景 #F2F0EE (muted), 文字 #57534E
```

### 输入框 (Input)

```
背景: #F2F0EE (stone-100)
文字: #292524 (foreground)
边框: 1px solid #E5E2DF (border)
圆角: 6px
内边距: 8px 12px
高度: 40px

聚焦: 边框 #C45B4A (primary), ring 2px #F5E6E4
占位符: #A8A29E (stone-400)
禁用: 背景 #F2F0EE
```

### 卡片 (Card)

```
背景: #FDFCFB (card)
边框: 1px solid #E5E2DF (border)
圆角: 6px
内边距: 16px

头部: 底部边框 1px solid #F2F0EE (stone-100)
```

### 消息气泡

#### 用户消息
```
背景: #F5E6E4 (primary-100)
文字: #6B3329 (primary-900)
边框: 1px solid #E8D0CC (primary-200)
圆角: 12px 12px 4px 12px
内边距: 12px 16px
最大宽度: 80%
```

#### AI 消息
```
背景: #FDFCFB (card)
文字: #292524 (foreground)
边框: 1px solid #E5E2DF (border)
圆角: 12px 12px 12px 4px
内边距: 12px 16px
最大宽度: 80%
```

### 会话列表项

```
背景: transparent
边框: 底部 1px solid #E5E2DF (border)
内边距: 14px 16px

悬停: 背景 #F2F0EE (stone-100)
激活: 背景 #F5E6E4 (primary-100), 左边框 2px #C45B4A (primary)
```

### 导航栏

```
背景: #FDFCFB (card)
边框: 底部 1px solid #E5E2DF (border)
高度: 56px
内边距: 0 16px
```

### 模块分割

```
侧边栏与主内容: border-r border-stone-200
头部与内容: border-b border-stone-200
输入框区域: border-t border-stone-200
卡片内部: border-b border-stone-100 (头部)
```

## 布局规范

### 页面布局

```
整体背景: #FAF8F6 (background)
最大宽度: 1400px
水平居中
侧边栏宽度: 288px (72 * 4)
主内容区: 自适应
```

### 响应式断点

```
sm: 640px   (手机)
md: 768px   (平板)
lg: 1024px  (小桌面)
xl: 1280px  (桌面)
2xl: 1400px (大桌面)
```

### 移动端适配

- 侧边栏变为抽屉式
- 会话列表全屏显示
- 输入框固定在底部
- 增加触摸目标大小 (最小 44px)

## 动画规范

### 过渡时间

```
快速: 150ms (按钮、链接)
正常: 200ms (卡片、面板)
```

### 缓动函数

```
默认: cubic-bezier(0.4, 0, 0.2, 1)
```

### 阴影 (极少使用)

```css
/* 仅用于浮层 */
--shadow-subtle: 0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-subtle-sm: 0 1px 1px 0 rgb(0 0 0 / 0.02);
```

## 暗色模式

### 暗色配色

```
Background:  #1C1917  (深暖灰)
Foreground:  #FAFAF9  (暖白文字)
Card:        #292524  (卡片背景)
Border:      #44403C  (边框)
Muted:       #44403C  (次要背景)
Muted-FG:    #A8A29E  (次要文字)

Primary:     #D97364  (玫瑰珊瑚)
Primary-50:  #3D1F1B  (深色背景)
```

## 图标规范

### 图标库

使用 Lucide React 图标库

### 图标尺寸

```
sm:  14px
md:  16px (默认)
lg:  20px
xl:  24px
```

### 图标颜色

```
默认: 继承文字颜色
次要: --muted-foreground (#78716C)
强调: --primary (#C45B4A)
```

## 使用示例

### 主题变量 CSS

```css
:root {
  /* 优雅玫瑰珊瑚色调主题 */
  --background: 30 25% 97%;
  --foreground: 30 10% 18%;
  --card: 30 20% 98%;
  --card-foreground: 30 10% 18%;
  --primary: 8 55% 52%;
  --primary-foreground: 0 0% 100%;
  --secondary: 30 15% 93%;
  --secondary-foreground: 30 10% 25%;
  --muted: 30 12% 91%;
  --muted-foreground: 30 8% 45%;
  --accent: 30 15% 93%;
  --accent-foreground: 30 10% 18%;
  --destructive: 0 65% 55%;
  --destructive-foreground: 0 0% 100%;
  --border: 30 10% 85%;
  --input: 30 10% 85%;
  --ring: 8 55% 52%;
  --radius: 0.5rem;
}
```

### Tailwind 使用

```html
<!-- 主按钮 -->
<button class="bg-primary text-primary-foreground hover:bg-primary-600 px-4 py-2 rounded-md">
  发送
</button>

<!-- 卡片 - 使用线条分割 -->
<div class="bg-card border border-stone-200 rounded-md">
  <div class="px-4 py-3 border-b border-stone-100">
    <h3 class="text-stone-600 font-semibold text-sm">标题</h3>
  </div>
  <div class="p-4">
    <p class="text-stone-500 text-sm">内容</p>
  </div>
</div>

<!-- 用户消息 - 带边框 -->
<div class="bg-primary-100 text-primary-900 border border-primary-200 rounded-message-user px-4 py-3">
  消息内容
</div>

<!-- 模块分割 -->
<div class="border-r border-stone-200">侧边栏</div>
<div class="border-t border-stone-200">底部区域</div>
```

## 设计要点总结

1. **优雅玫瑰**: 主色调采用玫瑰珊瑚色，比橙色更优雅，比粉色更中性
2. **统一背景**: 所有区域使用统一的暖米色背景 `#FAF8F6`
3. **线条分割**: 使用 `border-stone-200` 作为主要分割方式
4. **微妙层次**: 通过 `bg-card` (#FDFCFB) 和 `bg-stone-100` (#F2F0EE) 区分层次
5. **暖色文字**: 文字使用暖灰色系，避免纯黑

## 文件关联

- **实现文件**: [packages/web/src/index.css](file:///Users/lishuang/workDir/little-thing/packages/web/src/index.css)
- **Tailwind 配置**: [packages/web/tailwind.config.js](file:///Users/lishuang/workDir/little-thing/packages/web/tailwind.config.js)
- **AI 开发规范**: [docs/ai-guidelines.md](file:///Users/lishuang/workDir/little-thing/docs/ai-guidelines.md)
