import { useConfigStore } from '@/store/configStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, Key, Globe, Bot, Save } from 'lucide-react';

export function SettingsPage() {
  const { apiUrl, apiKey, model, setConfig } = useConfigStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setConfig({
      apiUrl: formData.get('apiUrl') as string,
      apiKey: formData.get('apiKey') as string,
      model: formData.get('model') as string,
    });
    alert('设置已保存');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-stone-700">设置</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* API 配置卡片 - 使用线条分割 */}
        <Card className="border-stone-200 bg-card">
          <CardHeader className="pb-4 border-b border-stone-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stone-600">
              <Globe className="w-4 h-4 text-stone-400" />
              API 配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                API 地址
              </label>
              <Input
                type="text"
                name="apiUrl"
                defaultValue={apiUrl}
                placeholder="http://localhost:3000"
                className="bg-stone-100 border-stone-200 focus:border-primary focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-stone-400">
                Server API 地址，默认: http://localhost:3000
              </p>
            </div>

            <Separator className="bg-stone-200" />

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                API Key
              </label>
              <Input
                type="password"
                name="apiKey"
                defaultValue={apiKey}
                placeholder="sk-..."
                className="bg-stone-100 border-stone-200 focus:border-primary focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-stone-400">
                LLM API Key，留空则使用 Server 端配置
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 模型选择卡片 */}
        <Card className="border-stone-200 bg-card">
          <CardHeader className="pb-4 border-b border-stone-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stone-600">
              <Bot className="w-4 h-4 text-stone-400" />
              模型选择
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <label className="block text-sm font-medium text-stone-600 mb-1.5">
              模型
            </label>
            <select
              name="model"
              defaultValue={model}
              className="w-full h-10 px-3 rounded-md border border-stone-200 bg-stone-100 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-subtle"
            >
              <optgroup label="智谱 GLM">
                <option value="glm-4">GLM-4</option>
                <option value="glm-4-plus">GLM-4 Plus</option>
                <option value="glm-4-flash">GLM-4 Flash</option>
                <option value="glm-4-air">GLM-4 Air</option>
              </optgroup>
              <optgroup label="Moonshot">
                <option value="moonshot-v1-8k">Moonshot v1 8k</option>
                <option value="moonshot-v1-32k">Moonshot v1 32k</option>
                <option value="moonshot-v1-128k">Moonshot v1 128k</option>
              </optgroup>
            </select>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary-600 text-primary-foreground h-11"
        >
          <Save className="w-4 h-4 mr-2" />
          保存设置
        </Button>
      </form>

      {/* 说明卡片 */}
      <Card className="mt-5 border-stone-200 bg-stone-100/50">
        <CardContent className="pt-5">
          <ul className="text-sm text-stone-500 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>设置保存在浏览器本地存储中</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>API Key 留空则使用 Server 端配置</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>修改 API 地址后需要刷新页面</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
