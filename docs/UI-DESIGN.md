# UI 设计系统文档

## 设计理念

### 设计原则

- **极简留白**: 去除多余装饰，大量留白，让界面呼吸
- **优雅暖色调**: 以玫瑰珊瑚色系为主，营造温暖、优雅、现代的聊天氛围
- **无边框设计**: 减少边框使用，通过间距和背景色区分层次
- **精致细节**: 小圆角、细线条、微妙的过渡动画

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
Border:      #E5E2DF  (暖灰边框 - 极少使用)
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
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
```

### 字号规范

| 级别 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| H1 | 1.125rem (18px) | 600 | 1.3 | 页面标题 |
| H2 | 1rem (16px) | 500 | 1.4 | 区块标题 |
| H3 | 0.9375rem (15px) | 500 | 1.4 | 卡片标题 |
| Body | 0.875rem (14px) | 400 | 1.6 | 正文 |
| Small | 0.75rem (12px) | 400 | 1.5 | 辅助文字 |
| Tiny | 0.6875rem (11px) | 400 | 1.4 | 标签/时间 |

## 间距系统

### 基础单位: 4px

```
xs:   4px   (0.25rem)
sm:   8px   (0.5rem)
md:   12px  (0.75rem)
base: 16px  (1rem)
lg:   20px  (1.25rem)
xl:   24px  (1.5rem)
```

### 组件间距

- **页面边距**: 16px (p-4)
- **卡片内边距**: 12px - 16px
- **列表项间距**: 4px (space-y-1)
- **元素间距**: 8px - 12px

## 圆角系统

```
sm:   4px   (输入框)
md:   6px   (按钮、小卡片)
lg:   8px   (卡片、面板)
xl:   12px  (大卡片)
full: 9999px (标签、头像)
```

## 边框系统

### 边框宽度

```
默认: 1px (极细)
强调: 2px (选中状态)
```

### 边框颜色

```
主要: #E5E2DF (border-stone-200/60 - 半透明)
次级: #F2F0EE (border-stone-100)
强调: #E8D0CC (primary-200)
激活: #C45B4A (primary)
```

## 布局规范

### 整体布局

```
┌─────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────────────────┐  │
│  │          │  │                     │  │
│  │ 侧边栏    │  │    聊天窗口          │  │
│  │ 280px    │  │                     │  │
│  │          │  │                     │  │
│  │ [设置]   │  │                     │  │
│  └──────────┘  └─────────────────────┘  │
└─────────────────────────────────────────┘

- 无顶部导航栏
- 全屏高度: h-screen
- 外边距: 16px
```

### 侧边栏结构

```
┌─────────────────┐
│ 会话     数量    │
│ [+ 新建]        │
├─────────────────┤
│                 │
│ 会话列表         │
│                 │
├─────────────────┤
│ [设置]          │
└─────────────────┘
```

### 聊天窗口结构

```
┌─────────────────────────┐
│ 会话名称                 │
│ 0 条消息                 │
├─────────────────────────┤
│                         │
│                         │
│      消息列表            │
│      (可滚动)            │
│                         │
│                         │
├─────────────────────────┤
│ [输入消息...        ][➤]│
│ ↵ Enter 发送            │
└─────────────────────────┘
```

### 响应式断点

```
sm: 640px   (手机 - 侧边栏抽屉)
md: 768px   (平板)
lg: 1024px  (桌面)
```

## 组件规范

### 按钮 (Button)

#### 主按钮
```
背景: #C45B4A
文字: #FFFFFF
圆角: 6px
内边距: 8px 16px
```

#### 次要按钮 (outline)
```
背景: transparent
边框: 1px solid #E5E2DF
文字: #57534E
圆角: 6px
悬停: bg-stone-50
```

#### 幽灵按钮 (ghost)
```
背景: transparent
文字: #78716C
悬停: bg-stone-50
```

### 输入框 (Input)

```
背景: #F2F0EE (stone-100)
边框: 1px solid #E5E2DF
圆角: 8px (rounded-lg)
内边距: 10px 14px
聚焦: border-primary/50
```

### 卡片 (Card)

```
背景: #FDFCFB
边框: 1px solid #E5E2DF/60 (半透明)
圆角: 8px (rounded-xl)
阴影: 无
```

### 消息气泡

#### 用户消息
```
背景: #F5E6E4 (primary-100)
文字: #6B3329 (primary-900)
边框: 1px solid #E8D0CC
圆角: 12px 12px 4px 12px
内边距: 12px 16px
```

#### AI 消息
```
背景: #FDFCFB
文字: #292524
边框: 1px solid #E5E2DF
圆角: 12px 12px 12px 4px
内边距: 12px 16px
```

### 会话列表项

```
背景: transparent
圆角: 6px (rounded-lg)
内边距: 10px 12px
间距: 4px (space-y-1)

悬停: bg-stone-100
激活: bg-primary-50/70
```

## 动画规范

### 过渡时间

```
快速: 150ms
正常: 200ms
```

### 缓动函数

```
默认: cubic-bezier(0.4, 0, 0.2, 1)
```

## 图标规范

### 图标库

使用 Lucide React 图标库

### 图标尺寸

```
sm:  14px (w-3.5 h-3.5)
md:  16px (w-4 h-4)
lg:  20px (w-5 h-5)
```

### 常用图标

- `MessageCircle` - 会话列表
- `Plus` - 新建
- `Settings` - 设置
- `Send` - 发送
- `Menu` / `X` - 移动端菜单
- `Trash2` - 删除
- `Loader2` - 加载

## 使用示例

### CSS 变量

```css
:root {
  --background: 30 25% 97%;
  --foreground: 30 10% 18%;
  --card: 30 20% 98%;
  --primary: 8 55% 52%;
  --border: 30 10% 85%;
  --radius: 0.5rem;
}
```

### Tailwind 类名

```html
<!-- 主按钮 -->
<button class="bg-primary hover:bg-primary-600 text-white px-4 py-2 rounded-md">
  发送
</button>

<!-- 卡片 -->
<div class="bg-card border border-stone-200/60 rounded-xl">
  内容
</div>

<!-- 输入框 -->
<input class="bg-stone-100 border-stone-200 rounded-lg px-4 py-2.5" />

<!-- 消息气泡 -->
<div class="bg-primary-100 text-primary-900 border border-primary-200 rounded-message-user px-4 py-3">
  用户消息
</div>
```

## 设计要点总结

1. **极简**: 去除多余装饰，大量留白
2. **暖色**: 玫瑰珊瑚主色，低饱和中性色
3. **精致**: 小圆角、细边框、微妙动画
4. **清晰**: 通过间距和背景色区分层次
5. **一致**: 统一的间距、圆角、色彩规范

## 文件关联

- **实现文件**: [packages/web/src/index.css](file:///Users/lishuang/workDir/little-thing/packages/web/src/index.css)
- **Tailwind 配置**: [packages/web/tailwind.config.js](file:///Users/lishuang/workDir/little-thing/packages/web/tailwind.config.js)
- **AI 开发规范**: [docs/ai-guidelines.md](file:///Users/lishuang/workDir/little-thing/docs/ai-guidelines.md)
