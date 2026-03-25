import z from 'zod';
import { Settings } from '../../src/settings/core';

const config = new Settings(
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

const settings = config.load();
console.log('Full settings:', settings.get());

console.log('LLM config:', settings.llm.get());
console.log('LLM API Key:', settings.llm.get('apiKey'));

settings.llm.apiKey.set('sk-1234567890abcdef1234567890abcdef');
console.log('Updated API Key:', settings.llm.get('apiKey'));
