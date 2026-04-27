import re

def verify_zero_tampering(original_text: str, annotated_text: str) -> bool:
    """
    质量门禁：验证 AI 没有由于幻觉或误操作修改原文的任何一个字符。
    逻辑：把标注后的 markdown 里面的所有 〖...〗 删除，然后去空字符后逐字比对。
    """
    # 1. 从 annotated_text 剔除所有插入的标记: 匹配 〖任意非〗字符 〗
    cleaned_annotated = re.sub(r'〖[^〗]+〗', '', annotated_text)
    
    # 2. 去除所有空白字符（空格，换行，等），进行纯内容对比
    # 因为 LLM 可能会因为输出 markdown 而改变了换行格式，这是允许的，但不改变字
    def _strip_whitespaces(text: str) -> str:
        return re.sub(r'\s+', '', text)
        
    pure_original = _strip_whitespaces(original_text)
    pure_annotated = _strip_whitespaces(cleaned_annotated)
    
    if pure_original == pure_annotated:
        return True
        
    # 如果不匹配，找到第一个不同的字以便 debug
    min_len = min(len(pure_original), len(pure_annotated))
    for i in range(min_len):
        if pure_original[i] != pure_annotated[i]:
            context_org = pure_original[max(0, i-10):i+10]
            context_ann = pure_annotated[max(0, i-10):i+10]
            print(f"❌ 质量门禁失败！原文与输出在索引 {i} 处出现分歧。")
            print(f"   原文片段: ...{context_org}...")
            print(f"   AI改写为: ...{context_ann}...")
            break
            
    print(f"   长度比对: 原文 {len(pure_original)} 字, 清洗后 {len(pure_annotated)} 字。")
    return False

if __name__ == "__main__":
    # 简单测试用例
    orig = "向日紅，湖北大冶人。恩選，貢生，明萬曆四年。"
    # 正确标注
    anno_good = "〖@名宦:向日紅〗向日紅，〖=湖北大冶〗人。恩選，〖§貢生〗，〖⌚明萬曆四年〗。"
    # 错误篡改 (改了一个字：湖北大冶人 -> 楚国大冶人)
    anno_bad = "〖@名宦:向日紅〗向日紅，〖=湖北大冶〗楚国人。恩選，〖§貢生〗，〖⌚明萬曆四年〗。"
    
    assert verify_zero_tampering(orig, anno_good) == True
    assert verify_zero_tampering(orig, anno_bad) == False
    print("✅ Lint script 单元测试通过。")
