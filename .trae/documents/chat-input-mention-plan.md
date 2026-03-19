# ChatInput 输入框改造计划

## 需求概述

将现有的 ChatInput 组件改造为支持工具选择、文件插入等能力的富文本输入框，支持通过特定符号唤起下拉选择器。

## 交互设计

### 1. 触发机制

* 输入特定符号（如 `@`）唤起下拉框

* 下拉框出现后，继续输入会对内容进行过滤

### 2. 下拉框交互

* **上下键**：切换选项

* **空格键**：多选（选中但不关闭）

* **回车键**：确认插入并关闭

* **Escape**：关闭下拉框

### 3. 插入项管理

* 插入项以特殊样式显示在输入框中（类似标签）

* 删除时：

  * 第一次按删除键：高亮提示（二次确认）

  * 第二次按删除键：真正删除

### 4. 可配置化设计

每种插入类型支持以下配置：

```typescript
{
  id: "tool",                    // 唯一标识
  title: "工具",                  // 显示标题
  placeholder: "输入 @ 即可选择工具", // 默认占位符，暂时不使用，预留
  trigger: "@",                  // 触发符号
  placeholderOnTrigger: "输入以搜索工具", // 触发后的占位符
  previewComponent: "ToolPreview", // 插入到输入框的预览组件
  dropdownComponent: "ToolSelect", // 下拉框内容组件
}
```

## 技术方案

### 核心组件结构

```
ChatInput/
├── ChatInput.tsx              # 业务组件：处理发送逻辑、状态管理
├── RichInput.tsx              # 通用组件：输入框核心能力（文本+标签混合输入）
├── TriggerDropdown.tsx        # 下拉选择器
├── InputTag.tsx               # 插入项标签组件
├── types.ts                   # 类型定义
├── registry.tsx               # 组件注册表
└── hooks/
    ├── useInputState.ts       # 状态管理
    ├── useTriggerDetection.ts # 触发检测
    └── useKeyboardNavigation.ts # 键盘导航
```

### 组件职责说明

**ChatInput.tsx（业务层）**
- 负责消息发送的业务逻辑
- 与 session store 交互（调用 sendMessage）
- 管理发送状态（isStreaming、disabled）
- 提供发送按钮、快捷键提示等业务 UI
- 将 RichInput 的结构化数据转换为消息字符串

**RichInput.tsx（能力层）**
- 通用的富文本输入组件，不包含业务逻辑
- 处理文本和标签的混合输入与渲染
- 管理输入状态（分段内容、光标位置）
- 处理触发器检测和下拉框交互
- 提供可复用的输入能力，可用于其他场景（如搜索框、评论框等）

**关系**：ChatInput 使用 RichInput 作为底层能力，在其基础上添加业务逻辑。

### 实现步骤

#### 第一阶段：基础架构（核心功能）

**1. 类型定义 (types.ts)**

```typescript
// 触发器配置类型
interface TriggerConfig {
  id: string;
  title: string;
  placeholder: string;
  trigger: string;
  placeholderOnTrigger?: string;
  previewComponent: string;
  dropdownComponent: string;
}

// 插入项数据类型
interface InputItem {
  id: string;
  type: string;  // 对应 TriggerConfig.id
  label: string;
  data: any;      // 自定义数据
}

// 输入内容类型（混合文本和插入项）
interface InputSegment {
  id: string;
  type: 'text' | 'item';
  content: string | InputItem;
}
```

**2. 组件注册表 (registry.tsx)**
```typescript
// 组件注册表
class ComponentRegistry {
  private components: Map<string, React.ComponentType<any>>;
  
  register(name: string, component: React.ComponentType<any>): void;
  get(name: string): React.ComponentType<any> | undefined;
}

// 触发器配置注册表
class TriggerConfigRegistry {
  private configs: Map<string, TriggerConfig>;
  
  register(config: TriggerConfig): void;
  getByTrigger(trigger: string): TriggerConfig | undefined;
  getAll(): TriggerConfig[];
}
```

**3. Zustand Store (inputStore.ts)**
```typescript
interface InputState {
  // 输入内容
  segments: InputSegment[];           // 输入内容分段
  
  // 下拉框状态
  activeDropdown: string | null;      // 当前激活的下拉框类型
  dropdownPosition: number;           // 下拉框位置
  filterText: string;                 // 过滤文本
  selectedIndex: number;              // 当前选中项
  selectedItems: InputItem[];         // 多选已选项
  
  // 标签删除状态
  highlightedTag: string | null;      // 高亮的标签ID（删除二次确认）
  
  // Actions
  addSegment: (segment: InputSegment) => void;
  removeSegment: (id: string) => void;
  updateTextSegment: (id: string, content: string) => void;
  setSegments: (segments: InputSegment[]) => void;
  
  openDropdown: (type: string, position: number) => void;
  closeDropdown: () => void;
  setFilterText: (text: string) => void;
  setSelectedIndex: (index: number) => void;
  
  selectItem: (item: InputItem) => void;
  toggleItemSelection: (item: InputItem) => void;
  clearSelectedItems: () => void;
  
  highlightTag: (id: string) => void;
  clearHighlight: () => void;
  
  // 组合操作
  insertItem: (item: InputItem, position: number) => void;
  deleteTag: (id: string) => void;
}

export const useInputStore = create<InputState>((set, get) => ({
  // 初始状态
  segments: [],
  activeDropdown: null,
  dropdownPosition: 0,
  filterText: '',
  selectedIndex: 0,
  selectedItems: [],
  highlightedTag: null,
  
  // Actions 实现...
}));
```

**4. 自定义 Hooks（基于 Store）**
```typescript
// useInputSegments.ts - 输入内容管理
function useInputSegments() {
  const { segments, addSegment, removeSegment, updateTextSegment } = useInputStore();
  return { segments, addSegment, removeSegment, updateTextSegment };
}

// useDropdown.ts - 下拉框状态管理
function useDropdown() {
  const { 
    activeDropdown, 
    dropdownPosition, 
    filterText,
    selectedIndex,
    selectedItems,
    openDropdown, 
    closeDropdown,
    setFilterText,
    setSelectedIndex,
    selectItem,
    toggleItemSelection,
    clearSelectedItems
  } = useInputStore();
  
  return {
    activeDropdown,
    dropdownPosition,
    filterText,
    selectedIndex,
    selectedItems,
    openDropdown,
    closeDropdown,
    setFilterText,
    setSelectedIndex,
    selectItem,
    toggleItemSelection,
    clearSelectedItems
  };
}

// useTagHighlight.ts - 标签删除高亮
function useTagHighlight() {
  const { highlightedTag, highlightTag, clearHighlight, deleteTag } = useInputStore();
  return { highlightedTag, highlightTag, clearHighlight, deleteTag };
}
```

**5. 触发检测 Hook (useTriggerDetection.ts)**
```typescript
// 监听输入，检测触发符号
// 与 Zustand Store 集成，自动触发下拉框
function useTriggerDetection(configs: TriggerConfig[]): void;

// 实现逻辑：
// 1. 监听输入内容变化
// 2. 检测触发符号（如 @、#）
// 3. 调用 store.openDropdown() 打开对应类型的下拉框
// 4. 提取触发后的过滤文本，调用 store.setFilterText()
```

**6. 键盘导航 Hook (useKeyboardNavigation.ts)**
```typescript
// 处理下拉框中的键盘导航
// 与 Zustand Store 集成
function useKeyboardNavigation(
  itemCount: number,
  onConfirm: (items: InputItem[]) => void
): {
  selectedIndex: number;
  handleKeyDown: (e: KeyboardEvent) => void;
};

// 实现逻辑：
// 1. 监听键盘事件（上下键、空格、回车、Escape）
// 2. 调用 store.setSelectedIndex() 更新选中项
// 3. 空格键：调用 store.toggleItemSelection() 多选
// 4. 回车键：调用 onConfirm(store.selectedItems) 并 store.closeDropdown()
// 5. Escape：调用 store.closeDropdown()
```

#### 第二阶段：UI 组件实现

**7. InputTag 组件 (InputTag.tsx)**
- 显示插入项的标签样式
- 支持高亮状态（删除二次确认）
- 从 Zustand Store 读取高亮状态
- 使用设计系统的配色和圆角

**8. TriggerDropdown 组件 (TriggerDropdown.tsx)**
- 下拉框容器
- 从 Zustand Store 读取状态（activeDropdown、filterText、selectedIndex、selectedItems）
- 支持过滤功能
- 支持多选显示
- 键盘导航高亮
- 使用 Popover 或自定义定位

**9. RichInput 组件 (RichInput.tsx)**
- 核心：使用 contenteditable 或自定义实现
- 从 Zustand Store 读取 segments
- 支持混合文本和标签的渲染
- 光标位置管理
- 输入事件处理（调用 store actions）

**10. ChatInput 改造 (ChatInput.tsx)**
- 集成 RichInput
- 添加配置注册
- 处理发送逻辑（将分段内容转换为字符串或结构化数据）
- 使用 Zustand Store 管理输入状态

#### 第三阶段：示例实现

**10. 示例配置**
```typescript
// 工具选择配置示例
const toolConfig: TriggerConfig = {
  id: 'tool',
  title: '工具',
  placeholder: '输入 @ 即可选择工具',
  trigger: '@',
  placeholderOnTrigger: '输入以搜索工具',
  previewComponent: 'ToolPreview',
  dropdownComponent: 'ToolSelect',
};

// 文件选择配置示例
const fileConfig: TriggerConfig = {
  id: 'file',
  title: '文件',
  placeholder: '输入 # 即可选择文件',
  trigger: '#',
  placeholderOnTrigger: '输入以搜索文件',
  previewComponent: 'FilePreview',
  dropdownComponent: 'FileSelect',
};
```

**11. 示例组件**
- ToolPreview: 工具预览标签
- ToolSelect: 工具选择下拉内容
- FilePreview: 文件预览标签
- FileSelect: 文件选择下拉内容

## 技术选型考虑

### 输入框实现方案

**方案一：contenteditable div**

* ✅ 原生支持富文本

* ✅ 光标管理方便

* ❌ 浏览器兼容性问题

* ❌ 复制粘贴处理复杂

**方案二：自定义渲染 + 隐藏 textarea**

* ✅ 更好的控制

* ✅ 样式一致性好

* ❌ 光标管理复杂

* ❌ 需要手动处理很多交互

**方案三：使用成熟库**

* 推荐：`@tiptap/react` 或 `lexical`

* ✅ 功能完善

* ✅ 可扩展性好

* ❌ 增加依赖

**推荐方案**：先使用方案二（自定义渲染），后续如有需要再迁移到 TipTap

### 下拉框定位

使用 `@radix-ui/react-popover` 或自定义实现：

* 项目已有 Radix UI 依赖

* Popover 提供良好的定位和键盘交互

## 文件清单

### 新建文件
1. `src/components/ChatInput/types.ts` - 类型定义
2. `src/components/ChatInput/registry.tsx` - 组件注册表
3. `src/components/ChatInput/store/inputStore.ts` - Zustand 状态管理
4. `src/components/ChatInput/hooks/useInputSegments.ts` - 输入内容管理 Hook
5. `src/components/ChatInput/hooks/useDropdown.ts` - 下拉框状态 Hook
6. `src/components/ChatInput/hooks/useTagHighlight.ts` - 标签删除高亮 Hook
7. `src/components/ChatInput/hooks/useTriggerDetection.ts` - 触发检测 Hook
8. `src/components/ChatInput/hooks/useKeyboardNavigation.ts` - 键盘导航 Hook
9. `src/components/ChatInput/InputTag.tsx` - 标签组件
10. `src/components/ChatInput/TriggerDropdown.tsx` - 下拉框组件
11. `src/components/ChatInput/RichInput.tsx` - 输入框核心
12. `src/components/ChatInput/index.ts` - 导出入口
13. `src/components/ChatInput/examples/ToolTrigger.tsx` - 工具示例
14. `src/components/ChatInput/examples/FileTrigger.tsx` - 文件示例

### 修改文件
1. `src/components/ChatInput.tsx` - 重构为使用新的 RichInput

## 实现优先级

### P0 - 核心功能（必须实现）
1. 类型定义和注册表
2. 状态管理 Hook
3. InputTag 组件
4. TriggerDropdown 组件
5. RichInput 基础实现
6. ChatInput 集成

### P1 - 重要功能

1. 键盘导航
2. 过滤功能
3. 多选支持
4. 删除二次确认

### P2 - 增强功能

1. 示例配置和组件
2. 动画效果
3. 无障碍支持

## 风险和注意事项

1. **光标管理**：自定义输入框的光标定位和选择是难点，需要仔细处理
2. **性能**：频繁的状态更新可能影响性能，需要优化
3. **兼容性**：不同浏览器对 contenteditable 的支持有差异
4. **可访问性**：需要添加适当的 ARIA 属性
5. **移动端**：触摸设备的交互需要特别处理

## 测试计划

1. 单元测试：各 Hook 和工具函数
2. 组件测试：各 UI 组件的渲染和交互
3. 集成测试：完整的输入流程
4. E2E 测试：用户交互场景

## 时间估算

* 第一阶段（基础架构）：2-3 小时

* 第二阶段（UI 组件）：3-4 小时

* 第三阶段（示例和优化）：1-2 小时

* 测试和调试：1-2 小时

**总计**：7-11 小时
