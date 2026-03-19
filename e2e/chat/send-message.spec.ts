import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test('should send a message', async ({ page }) => {
    await page.goto('/');

    // 输入消息
    const messageInput = page.locator('textarea[placeholder*="message" i], textarea[placeholder*="输入" i], div[contenteditable="true"]').first();
    await messageInput.fill('Hello, AI!');

    // 发送消息
    await page.click('button[aria-label*="send" i], button:has-text("Send"), button:has-text("发送")');

    // 验证消息出现在聊天列表中
    await expect(page.locator('text=Hello, AI!')).toBeVisible();
  });

  test('should display streaming response', async ({ page }) => {
    await page.goto('/');

    // 发送消息
    const messageInput = page.locator('textarea[placeholder*="message" i], textarea[placeholder*="输入" i], div[contenteditable="true"]').first();
    await messageInput.fill('Tell me a joke');
    await page.click('button[aria-label*="send" i], button:has-text("Send"), button:has-text("发送")');

    // 等待响应开始
    await page.waitForSelector('[data-testid="assistant-message"], .message.assistant, .ai-message', { timeout: 10000 });

    // 验证响应内容
    const response = page.locator('[data-testid="assistant-message"], .message.assistant, .ai-message').last();
    await expect(response).toBeVisible();
  });

  test('should clear chat history', async ({ page }) => {
    await page.goto('/');

    // 点击清空按钮
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("清空")');
    if (await clearButton.isVisible()) {
      await clearButton.click();

      // 验证聊天记录已清空
      const messages = page.locator('[data-testid="message"], .message');
      await expect(messages).toHaveCount(0);
    }
  });

  test('should handle markdown in messages', async ({ page }) => {
    await page.goto('/');

    // 发送包含 markdown 的消息
    const messageInput = page.locator('textarea[placeholder*="message" i], textarea[placeholder*="输入" i], div[contenteditable="true"]').first();
    await messageInput.fill('```js\nconsole.log("Hello");\n```');
    await page.click('button[aria-label*="send" i], button:has-text("Send"), button:has-text("发送")');

    // 验证代码块被正确渲染
    await expect(page.locator('code, pre')).toBeVisible();
  });
});
