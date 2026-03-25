# 需求：Settings 配置系统设计


## 背景

项目需要提供配置读取和修改的能力，以方便用户快捷的自定义需求。 目前是从环境变量读取配置，但是环境变量的方式比较繁琐，用户需要重启服务才能生效。

## 目标

1. 提供配置读取和修改的能力
2. 支持多层级合并：cli 参数 > 环境变量 > 本地配置 > 用户配置 > 默认值
3. 支持 credentials 敏感信息管理，credentials 与 settings 物理分离，读取时自动合并
4. 支持配置校验


## 期待用法

```typescript
import z from 'zod';
import { Settings } from './core';

// 声明
const settings = new Settings(
  // 声明 app name， 按照 xdg dir 规范，存储在 ~/.config/<app_name>/settings.json 和 ~/.config/<app_name>/credentials.json 中
  'littlething',
  z.object({
    llm: z.object({
      name: z.string(),
      baseUrl: z.string(),
      model: z.string(),
      apiKey: z.string(),
    }).default({
      name: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      apiKey: '',
    }),
    channel: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).default([]),
  }),
);

// 加载配置
const settings = settings.load();

// 访问配置
console.log('Full settings:', settings.get());
console.log('LLM config:', settings.llm.get());
console.log('LLM API Key:', settings.llm.get('apiKey'));

// 修改配置
settings.llm.apiKey.set('sk-1234567890abcdef1234567890abcdef');
console.log('Updated API Key:', settings.llm.get('apiKey'));
```


## 开放问题

1. **配置热重载**：配置文件变更后是否需要自动重载？目前设计需要重启才能生效
2. **运行时修改持久化**：是否需要支持运行时修改配置并保存到 settings.json？
3. **模型列表缓存策略**：模型列表缓存多久？如何失效？