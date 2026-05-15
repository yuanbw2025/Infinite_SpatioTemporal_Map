#!/usr/bin/env python3
"""
convert_shiji_kb.py
将 shiji-kb 的 tagged.md 格式转换为本项目的 XML 标注 JSON 格式。
保留所有实体标注类型，映射到本项目扩展标签体系。

shiji-kb 许可证：CC BY-NC-SA 4.0，作者：鲍捷 (baojie@gmail.com)
"""

import re
import json
import os
import glob
from pathlib import Path

# ============================================================
# 符号映射表
# ============================================================

# 〖X...〗 方括号实体
LENTICULAR_MAP = {
    '@': 'p',       # 人名
    '=': 'loc',     # 地名
    ';': 'off',     # 官职
    '#': 'role',    # 身份/社会角色
    '%': 'time',    # 时间纪年
    '◆': 'state',   # 邦国/政权
    '&': 'clan',    # 氏族
    '^': 'sys',     # 制度
    '_': 'idea',    # 思想/概念
    '[': 'law',     # 刑法
    '~': 'tribe',   # 族群
    '•': 'art',     # 器物
    '!': 'astro',   # 天文
    '+': 'bio',     # 生物
    '{': 'book',    # 典籍
    ':': 'rite',    # 礼仪
    '$': 'qty',     # 数量
    '?': 'myth',    # 神话
}

# ⟦X⟧ 动词标注
VERB_MAP = {
    '◉': 'vact',   # 军事/暴力动词（杀、伐、诛）
    '○': 'vpol',   # 政治动词（立、封、废）
    '◎': 'vecon',  # 经济动词（赐、赋、纳）
    '●': 'vpen',   # 刑罚动词
}


# ============================================================
# 纯文本还原（去除所有标注符号）
# ============================================================

def strip_annotations(text):
    def strip_lenticular(m):
        inner = m.group(1)
        rest = inner[1:]  # 去掉第一个符号字符
        return rest.split('|')[0] if '|' in rest else rest

    def strip_verb(m):
        content = m.group(2)
        return content.split('|')[0] if '|' in content else content

    def strip_idiom(m):
        content = m.group(1)
        return content.split('|')[0] if '|' in content else content

    text = re.sub(r'〖([^〗]+)〗', strip_lenticular, text)
    text = re.sub(r'⟦([◉○◎●])([^⟧]+)⟧', strip_verb, text)
    text = re.sub(r'〘※([^〙]+)〙', strip_idiom, text)
    return text


# ============================================================
# XML 标注转换
# ============================================================

def convert_lenticular(m):
    """〖SYMdisplay〗 或 〖SYMdisplay|canonical〗 → <tag name="canonical">display</tag>"""
    inner = m.group(1)
    sym = inner[0]
    rest = inner[1:]
    tag = LENTICULAR_MAP.get(sym, 'unk')

    if '|' in rest:
        display, canonical = rest.split('|', 1)
    else:
        display = canonical = rest

    if canonical and canonical != display:
        return f'<{tag} name="{canonical}">{display}</{tag}>'
    return f'<{tag}>{display}</{tag}>'


def convert_verb(m):
    """⟦◉X⟧ → <vact>X</vact>"""
    verb_sym = m.group(1)
    content = m.group(2)
    tag = VERB_MAP.get(verb_sym, 'vact')

    if '|' in content:
        display, canonical = content.split('|', 1)
        return f'<{tag} name="{canonical}">{display}</{tag}>'
    return f'<{tag}>{content}</{tag}>'


def convert_idiom(m):
    """〘※X〙 或 〘※display|canonical〙 → <idiom>X</idiom>"""
    content = m.group(1)
    if '|' in content:
        display, canonical = content.split('|', 1)
        return f'<idiom name="{canonical}">{display}</idiom>'
    return f'<idiom>{content}</idiom>'


def annotate_text(text):
    """将 shiji-kb 格式文本转换为 XML 标注格式（顺序很重要）"""
    text = re.sub(r'〘※([^〙]+)〙', convert_idiom, text)           # 成语（先处理）
    text = re.sub(r'⟦([◉○◎●])([^⟧]+)⟧', convert_verb, text)     # 动词
    text = re.sub(r'〖([^〗]+)〗', convert_lenticular, text)        # 实体
    return text


# ============================================================
# tagged.md 解析
# ============================================================

def parse_tagged_md(filepath):
    """解析单个 tagged.md 文件，返回 (章节标题, 段落列表)"""
    text = open(filepath, encoding='utf-8').read()
    lines = text.split('\n')

    # 提取章节标题（首行：# [N] 章名）
    chapter_title = ''
    m = re.match(r'^#\s+\[\d+\]\s+(.+)', lines[0].strip())
    if m:
        chapter_title = m.group(1).strip()

    paragraphs = []
    current_pid = None
    current_lines = []

    def flush():
        if current_pid is None or not current_lines:
            return
        # 合并行，去掉 blockquote >
        raw = ' '.join(
            re.sub(r'^>\s*', '', l).strip()
            for l in current_lines if l.strip()
        )
        if not raw.strip():
            return
        annotated = annotate_text(raw)
        plain = strip_annotations(raw)
        paragraphs.append({
            'pid': current_pid,
            'text': plain,
            'annotated': annotated,
        })

    for line in lines[1:]:
        stripped = line.strip()

        if not stripped:
            continue
        if stripped.startswith('#'):
            continue

        # 段落编号行：[1]、[1.1]、[12.3]
        m = re.match(r'^\[(\d+(?:\.\d+)?)\]\s*(.*)', stripped)
        if m:
            flush()
            current_pid = m.group(1)
            rest = m.group(2).strip()
            current_lines = [rest] if rest else []
            continue

        # blockquote（对话/引文），附加到当前段落
        if current_pid is not None:
            current_lines.append(stripped)

    flush()
    return chapter_title, paragraphs


# ============================================================
# 章节类型判断
# ============================================================

def get_chapter_type(num):
    n = int(num)
    if n <= 12:   return '本纪'
    if n <= 22:   return '表'
    if n <= 30:   return '书'
    if n <= 60:   return '世家'
    return '列传'


# ============================================================
# 单章转换
# ============================================================

def convert_chapter(input_path, output_dir):
    fname = Path(input_path).stem                     # 007_项羽本纪.tagged
    base = fname.replace('.tagged', '')               # 007_项羽本纪
    num = base.split('_')[0]                          # 007

    chapter_title, paragraphs = parse_tagged_md(input_path)

    output = {
        'work': '史记',
        'chapter': chapter_title,
        'chapter_file': base,
        'chapter_type': get_chapter_type(num),
        'source': 'shiji-kb (CC BY-NC-SA 4.0, baojie@gmail.com)',
        'paragraph_count_total': len(paragraphs),
        'paragraph_count_done': len(paragraphs),
        'paragraphs': paragraphs,
    }

    out_path = os.path.join(output_dir, f'{base}.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return base, chapter_title, len(paragraphs)


# ============================================================
# 主程序
# ============================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(description='转换 shiji-kb tagged.md → 本项目 JSON')
    parser.add_argument('--sample', action='store_true', help='只转换 007_项羽本纪 做抽样验证')
    parser.add_argument(
        '--input-dir',
        default='/Users/v_yuanbowen01/Downloads/shiji-kb-main/chapter_md'
    )
    parser.add_argument(
        '--output-dir',
        default='/Users/v_yuanbowen01/Desktop/Infinite_SpatioTemporal_Map/app/public/data/shiji'
    )
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    if args.sample:
        files = [os.path.join(args.input_dir, '007_项羽本纪.tagged.md')]
    else:
        files = sorted(glob.glob(os.path.join(args.input_dir, '*.tagged.md')))

    print(f'转换 {len(files)} 个章节...\n')

    index_chapters = []
    total_paras = 0

    for fpath in files:
        base, title, n = convert_chapter(fpath, args.output_dir)
        num = base.split('_')[0]
        index_chapters.append({
            'num': num,
            'file': base,
            'title': title,
            'type': get_chapter_type(num),
            'paragraphs': n,
        })
        total_paras += n
        print(f'  ✓ {base}  ({n} 段)')

    # 写索引
    index = {
        'source': 'shiji-kb (CC BY-NC-SA 4.0, baojie@gmail.com)',
        'total_chapters': len(index_chapters),
        'total_paragraphs': total_paras,
        'chapters': index_chapters,
    }
    with open(os.path.join(args.output_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f'\n完成：{len(index_chapters)} 章节，{total_paras:,} 段落')
    print(f'输出：{args.output_dir}')


if __name__ == '__main__':
    main()
