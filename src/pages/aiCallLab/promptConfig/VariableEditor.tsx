import { SearchOutlined } from '@ant-design/icons';
import { type JSONContent, mergeAttributes, Node } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Empty, Input, Modal, Typography } from 'antd';
import React, { useEffect, useId, useMemo, useState } from 'react';
import type { AiCallLabPromptVariable } from '@/services/ruoyi/ai-call-lab';

const TOKEN_RE = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
const EMPTY_VARIABLE: AiCallLabPromptVariable = { key: '', label: '' };
const { Text } = Typography;

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
  onChange: (value: string) => void;
  onSaveVariable: (
    variable: AiCallLabPromptVariable,
  ) => AiCallLabPromptVariable | undefined;
};

const VariableEditor = ({
  value,
  variables,
  minHeight = 120,
  onChange,
  onSaveVariable,
}: Props) => {
  const variableLabelId = useId();
  const variableKeyId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<AiCallLabPromptVariable>(EMPTY_VARIABLE);
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

  const filteredVariables = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? variables.filter(
          (variable) =>
            variable.label.toLowerCase().includes(keyword) ||
            variable.key.toLowerCase().includes(keyword),
        )
      : variables;
  }, [search, variables]);
  const selectedVariable = variables.find(
    (variable) => variable.key === selectedKey,
  );

  const closePicker = () => {
    setPickerOpen(false);
    setSearch('');
    setSelectedKey(undefined);
    setCreating(false);
    setDraft(EMPTY_VARIABLE);
  };

  const closeCreate = () => {
    setCreating(false);
    setDraft(EMPTY_VARIABLE);
  };

  const saveVariable = () => {
    const saved = onSaveVariable(draft);
    if (!saved) return;
    setSelectedKey(saved.key);
    closeCreate();
  };

  const insertVariable = () => {
    if (!editor || !selectedVariable) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: 'variable', attrs: selectedVariable })
      .run();
    closePicker();
  };

  return (
    <>
      <div className="ai-call-variable-editor">
        <div className="ai-call-variable-editor-toolbar">
          <Button
            size="small"
            disabled={!editor}
            onClick={() => setPickerOpen(true)}
          >
            插入变量
          </Button>
        </div>
        <EditorContent editor={editor} style={{ minHeight }} />
      </div>

      <Modal
        title={creating ? '新建变量' : '插入变量'}
        open={pickerOpen}
        okText={creating ? '创建' : '插入'}
        cancelText={creating ? '返回' : '取消'}
        okButtonProps={{
          disabled: creating
            ? !draft.label.trim() || !draft.key.trim()
            : !selectedVariable,
        }}
        onOk={creating ? saveVariable : insertVariable}
        onCancel={creating ? closeCreate : closePicker}
      >
        <div className="ai-call-variable-picker">
          {creating ? (
            <div className="ai-call-variable-picker-form">
              <label htmlFor={variableLabelId}>
                <Text>中文表头</Text>
                <Input
                  autoFocus
                  id={variableLabelId}
                  placeholder="例如：公司名"
                  value={draft.label}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </label>
              <label htmlFor={variableKeyId}>
                <Text>变量标识</Text>
                <Input
                  id={variableKeyId}
                  placeholder="例如：companyName"
                  value={draft.key}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      key: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ) : (
            <>
              <div className="ai-call-variable-picker-toolbar">
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索变量"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button type="link" onClick={() => setCreating(true)}>
                  新建变量
                </Button>
              </div>

              {filteredVariables.length ? (
                <div className="ai-call-variable-picker-list">
                  {filteredVariables.map((variable) => (
                    <Button
                      key={variable.key}
                      type={
                        selectedKey === variable.key ? 'primary' : 'default'
                      }
                      onClick={() => setSelectedKey(variable.key)}
                    >
                      {variable.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    search ? '没有匹配的变量' : '暂无变量，请先新建'
                  }
                />
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default VariableEditor;
