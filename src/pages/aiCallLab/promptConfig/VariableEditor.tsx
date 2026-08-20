import { DownOutlined } from '@ant-design/icons';
import { type JSONContent, mergeAttributes, Node } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Dropdown, Empty } from 'antd';
import React, { useEffect } from 'react';
import type { AiCallLabPromptVariable } from '@/services/ruoyi/ai-call-lab';

const TOKEN_RE = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;

export const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ key: { default: '' }, label: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-type="variable"]' }],
  addKeyboardShortcuts() {
    const deleteVariable = (side: 'before' | 'after') =>
      this.editor.commands.command(({ state, dispatch }) => {
        const { $from, empty } = state.selection;
        if (!empty) return false;
        const node = side === 'before' ? $from.nodeBefore : $from.nodeAfter;
        if (node?.type.name !== this.name) return false;
        const from = side === 'before' ? $from.pos - node.nodeSize : $from.pos;
        dispatch?.(state.tr.delete(from, from + node.nodeSize));
        return true;
      });
    return {
      Backspace: () => deleteVariable('before'),
      Delete: () => deleteVariable('after'),
    };
  },
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-type': 'variable',
      class: 'ai-call-prompt-variable',
      contenteditable: 'false',
    }),
    String(HTMLAttributes.label || HTMLAttributes.key || ''),
  ],
});

const toDocument = (value: string, variables: AiCallLabPromptVariable[]) => ({
  type: 'doc',
  content: value.split('\n').map((line) => {
    const content: Record<string, unknown>[] = [];
    let index = 0;
    for (const match of line.matchAll(TOKEN_RE)) {
      if (match.index > index) {
        content.push({ type: 'text', text: line.slice(index, match.index) });
      }
      const variable = variables.find((item) => item.key === match[1]);
      content.push(
        variable
          ? { type: 'variable', attrs: variable }
          : { type: 'text', text: match[0] },
      );
      index = (match.index || 0) + match[0].length;
    }
    if (index < line.length)
      content.push({ type: 'text', text: line.slice(index) });
    return { type: 'paragraph', ...(content.length ? { content } : {}) };
  }),
});

export const promptDocumentToText = (document: JSONContent) =>
  (document.content || [])
    .map((block) =>
      (block.content || [])
        .map((node) =>
          node.type === 'variable'
            ? `{{${String(node.attrs?.key || '')}}}`
            : node.text || '',
        )
        .join(''),
    )
    .join('\n');

type Props = {
  value: string;
  variables: AiCallLabPromptVariable[];
  minHeight?: number;
  onAddVariable?: () => void;
  onChange: (value: string) => void;
};

const VariableEditor = ({
  value,
  variables,
  minHeight = 120,
  onAddVariable,
  onChange,
}: Props) => {
  const editor = useEditor({
    extensions: [StarterKit, VariableNode],
    content: toDocument(value, variables),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) =>
      onChange(promptDocumentToText(current.getJSON())),
  });

  useEffect(() => {
    if (!editor) return;
    if (promptDocumentToText(editor.getJSON()) !== value) {
      editor.commands.setContent(toDocument(value, variables), {
        emitUpdate: false,
      });
    }
  }, [editor, value, variables]);

  const items = variables.map((variable) => ({
    key: variable.key,
    label: variable.label,
    onClick: () =>
      editor
        ?.chain()
        .focus()
        .insertContent({ type: 'variable', attrs: variable })
        .run(),
  }));

  return (
    <div className="ai-call-variable-editor">
      <div className="ai-call-variable-editor-toolbar">
        {onAddVariable ? (
          <Button size="small" onClick={onAddVariable}>
            定义变量
          </Button>
        ) : null}
        <Dropdown
          menu={{ items }}
          disabled={!editor || !variables.length}
          popupRender={(menu) =>
            variables.length ? (
              menu
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="请先定义变量"
              />
            )
          }
        >
          <Button size="small">
            插入变量（{variables.length}） <DownOutlined />
          </Button>
        </Dropdown>
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  );
};

export default VariableEditor;
