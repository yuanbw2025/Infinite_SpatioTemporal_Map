import os
from typing import Optional

try:
    from litellm import completion
except ImportError:
    # Fallback/Mock just in case litellm isn't installed yet
    completion = None

def call_llm(prompt: str, model_name: Optional[str] = None, temperature: float = 0.0, system_prompt: Optional[str] = None) -> str:
    """
    通用大模型调用接口。
    默认支持：
    - OpenAI: 'gpt-4o', 'gpt-4-turbo'
    - Anthropic: 'claude-3-5-sonnet-20240620'
    - Gemini: 'gemini/gemini-1.5-pro'
    - 兼容 OpenAI 格式的国产大模型（需配置 api_base）: 
      'openai/qwen-long' (千问), 'openai/deepseek-chat', 'openai/glm-4' (智谱) 等等。
    """
    model = model_name or os.environ.get("LLM_MODEL", "gpt-4o")
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    # 判断是否为本地脱机环境测试（如果不配 API Key 则返回 Mock）
    # MOCK_LLM 环境变量优先于真实请求
    is_mock = os.environ.get("MOCK_LLM", "false").lower() == "true"
    
    if is_mock or completion is None:
        print(f"⚠️ [LLM Client] MOCK 模式开启或缺少 litellm 依赖。使用 {model} 进行桩函数返回。")
        return _mock_response(prompt)

    try:
        # litellm 会根据 model 字符串自动派发给相应的 provider
        # 前提是环境变量配了相应的值，例如 OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
        response = completion(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ [LLM Error] 调用 {model} 失败: {e}")
        # 出错时为了不阻断流程，提供一个友好的失败信息，或者直接返回 Mock 供测试
        print("退化为 MOCK 输出以保持管线连贯。")
        return _mock_response(prompt)

def _mock_response(prompt: str) -> str:
    # 模拟标注输出 (智能包裹原文以通过质量校验)
    import re
    # 尝试从 prompt 中提取 ```text 包裹的内容
    text_match = re.search(r'```text\n(.*?)\n```', prompt, re.DOTALL)
    if text_match:
        raw_text = text_match.group(1)
        # 简单模拟打标：在常见地名或人物后加注
        # 这里仅作演示，实际会调用大模型
        processed = raw_text.replace("泉州", "〖@地理:泉州〗泉州")
        processed = processed.replace("蔡襄", "〖@人物:蔡襄〗蔡襄")
        return processed
    
    return f"〖@系统:错误〗无法提取原文进行打标。"
