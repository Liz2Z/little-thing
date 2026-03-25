import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  apiUrl: string;
  model: string;
  setConfig: (config: Partial<ConfigState>) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      apiUrl: 'http://localhost:3000',
      model: 'glm-4',
      setConfig: (config) => set((state) => ({ ...state, ...config })),
    }),
    {
      name: 'agent-config',
    }
  )
);
