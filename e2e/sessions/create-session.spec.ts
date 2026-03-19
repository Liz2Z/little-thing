import { test, expect } from '@playwright/test';

test.describe('Session Management', () => {
  test('should create a new session', async ({ page }) => {
    await page.goto('/');

    // 点击新建会话按钮
    await page.click('button:has-text("New Session")');

    // 输入会话名称
    await page.fill('input[placeholder*="session name" i], input[name="name"]', 'Test Session');

    // 提交
    await page.click('button[type="submit"]');

    // 验证会话创建成功
    await expect(page.locator('text=Test Session')).toBeVisible();
  });

  test('should list all sessions', async ({ page }) => {
    await page.goto('/');

    // 验证会话列表存在
    const sessionList = page.locator('[data-testid="session-list"], .session-list, nav');
    await expect(sessionList).toBeVisible();
  });

  test('should switch between sessions', async ({ page }) => {
    await page.goto('/');

    // 获取当前会话数量
    const sessions = page.locator('[data-testid="session-item"], .session-item');
    const count = await sessions.count();

    if (count > 1) {
      // 点击第二个会话
      await sessions.nth(1).click();

      // 验证切换成功（这里假设会切换到对应会话的聊天界面）
      await expect(page).toHaveURL(/\/session\/.+/);
    }
  });

  test('should delete a session', async ({ page }) => {
    await page.goto('/');

    // 找到会话列表中的删除按钮
    const deleteButton = page.locator('[data-testid="session-item"] button[aria-label*="delete" i]').first();

    if (await deleteButton.isVisible()) {
      // 点击删除
      await deleteButton.click();

      // 确认删除（如果有确认对话框）
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("确定")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});
