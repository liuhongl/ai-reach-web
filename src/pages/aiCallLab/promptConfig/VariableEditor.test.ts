import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { promptDocumentToText, VariableNode } from './VariableEditor';

describe('VariableEditor', () => {
  it('keeps variables as atomic inline nodes and serializes their keys', () => {
    expect(VariableNode.config.atom).toBe(true);
    expect(VariableNode.config.selectable).toBe(true);
    expect(
      promptDocumentToText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '您好' },
              {
                type: 'variable',
                attrs: { key: 'customerName', label: '客户名称' },
              },
            ],
          },
        ],
      }),
    ).toBe('您好{{customerName}}');
  });

  it.each([
    ['Backspace', 4],
    ['Delete', 3],
  ])('deletes the whole variable with %s at its edge', (key, position) => {
    const editor = new Editor({
      extensions: [StarterKit, VariableNode],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '您好' },
              {
                type: 'variable',
                attrs: { key: 'customerName', label: '客户名称' },
              },
            ],
          },
        ],
      },
    });
    editor.commands.setTextSelection(position);

    editor.commands.keyboardShortcut(key);

    expect(promptDocumentToText(editor.getJSON())).toBe('您好');
    editor.destroy();
  });
});
