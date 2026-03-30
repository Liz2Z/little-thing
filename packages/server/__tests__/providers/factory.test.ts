import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { InternalError } from '../../src/errors/types';
import { InternalErrors } from '../../src/errors/codes';

const mockAnthropicModel = mock(() => 'anthropic-model');
const mockOpenAIModel = mock(() => 'openai-model');
const mockCompatibleModel = mock(() => 'compatible-model');

const mockCreateAnthropic = mock(() => mockAnthropicModel);
const mockCreateOpenAI = mock(() => mockOpenAIModel);
const mockCreateOpenAICompatible = mock(() => mockCompatibleModel);

mock.module('@ai-sdk/anthropic', () => ({
  createAnthropic: mockCreateAnthropic,
}));

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mockCreateOpenAICompatible,
}));

const { createModel } = await import('../../src/providers/factory');

describe('Provider Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.includes('API_KEY') || key.startsWith('TEST_')) {
        delete process.env[key];
      }
    }
    mockCreateAnthropic.mockClear();
    mockCreateOpenAI.mockClear();
    mockCreateOpenAICompatible.mockClear();
    mockAnthropicModel.mockClear();
    mockOpenAIModel.mockClear();
    mockCompatibleModel.mockClear();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe('createModel', () => {
    describe('error handling', () => {
      it('should throw error with UNKNOWN_PROVIDER code when provider does not exist', () => {
        try {
          createModel('non-existent-provider', 'some-model');
          expect(true).toBe(false);
        } catch (error) {
          expect((error as InternalError).code).toBe(InternalErrors.UNKNOWN_PROVIDER[0]);
          expect((error as InternalError).status).toBe(500);
          expect((error as InternalError).details.message).toContain('non-existent-provider');
        }
      });

      it('should throw error with MISSING_API_KEY code when no API key is configured', () => {
        try {
          createModel('zhipuai-coding-plan', 'glm-4.7');
          expect(true).toBe(false);
        } catch (error) {
          expect((error as InternalError).code).toBe(InternalErrors.MISSING_API_KEY[0]);
          expect((error as InternalError).status).toBe(500);
          expect((error as InternalError).details.message).toContain('ZHIPU_API_KEY');
        }
      });
    });

    describe('model creation for zhipuai-coding-plan', () => {
      it('should create openai-compatible model with correct config', () => {
        process.env.ZHIPU_API_KEY = 'test-zhipu-key';

        const model = createModel('zhipuai-coding-plan', 'glm-4.7');

        expect(model).toBe('compatible-model');
        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'zhipuai-coding-plan',
          apiKey: 'test-zhipu-key',
          baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
        });
        expect(mockCompatibleModel).toHaveBeenCalledWith('glm-4.7');
      });

      it('should pass different modelId to the created provider', () => {
        process.env.ZHIPU_API_KEY = 'test-key';

        createModel('zhipuai-coding-plan', 'glm-4.5-flash');

        expect(mockCompatibleModel).toHaveBeenCalledWith('glm-4.5-flash');
      });

      it('should not call other SDK creators for openai-compatible provider', () => {
        process.env.ZHIPU_API_KEY = 'test-key';

        createModel('zhipuai-coding-plan', 'glm-4.7');

        expect(mockCreateAnthropic).not.toHaveBeenCalled();
        expect(mockCreateOpenAI).not.toHaveBeenCalled();
        expect(mockCreateOpenAICompatible).toHaveBeenCalled();
      });
    });

    describe('multiple model calls', () => {
      it('should create separate model instances for different calls', () => {
        process.env.ZHIPU_API_KEY = 'test-key';

        const model1 = createModel('zhipuai-coding-plan', 'glm-4.7');
        const model2 = createModel('zhipuai-coding-plan', 'glm-4.5-flash');

        expect(model1).toBe('compatible-model');
        expect(model2).toBe('compatible-model');
        expect(mockCompatibleModel).toHaveBeenCalledTimes(2);
        expect(mockCompatibleModel).toHaveBeenNthCalledWith(1, 'glm-4.7');
        expect(mockCompatibleModel).toHaveBeenNthCalledWith(2, 'glm-4.5-flash');
      });
    });
  });

  describe('getApiKey', () => {
    it('should use the first available API key from env array', () => {
      process.env.ZHIPU_API_KEY = 'zhipu-key';

      const model = createModel('zhipuai-coding-plan', 'glm-4.7');

      expect(model).toBe('compatible-model');
      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'zhipu-key',
        })
      );
    });

    it('should throw error when all environment variables are empty', () => {
      try {
        createModel('zhipuai-coding-plan', 'glm-4.7');
        expect(true).toBe(false);
      } catch (error) {
        expect((error as InternalError).code).toBe(InternalErrors.MISSING_API_KEY[0]);
        const details = (error as InternalError).details;
        expect(details.message).toContain('ZHIPU_API_KEY');
      }
    });
  });
});
