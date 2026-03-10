# 前端开发规范

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^18.3.1 | UI 框架 |
| TypeScript | ^5.4.5 | 类型安全 |
| Vite | ^5.2.0 | 构建工具 |
| Tailwind CSS | ^3.4.1 | 样式系统 |
| shadcn/ui | - | UI 组件库 |
| Zustand | ^4.5.0 | 状态管理 |
| React Router | ^6.22.0 | 路由管理 |
| Lucide React | ^0.576.0 | 图标库 |

## 重点规则

- 使用主题变量定义颜色、间距、字体等样式，避免硬编码颜色值
- UI 组件放在 `src/components/ui/` 目录下，业务组件放在 `src/components/` 目录下
- 更倾向于使用命名导出，而不是默认导出
- useEffect 的依赖里绝对只放需要监听的状态，而不是所有用到的状态都放进去，否则会导致无限循环渲染。忽略 react-hooks/exhaustive-deps eslint 警告.
- store 的函数（如 Zustand 的 action、selector 返回的函数等）引用是稳定的，不需要放入 useEffect 依赖数组。只有当状态变化需要触发 effect 重新执行时，才将该状态放入依赖数组。
  ```tsx
  // 正确：只监听状态变化
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  // 错误：initialize 是稳定的函数引用，不需要监听
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);
  ```


