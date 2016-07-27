import EditorDomRenderer from 'mobiledoc-kit/renderers/editor-dom';
import RenderTree from 'mobiledoc-kit/models/render-tree';
import PostEditor from 'mobiledoc-kit/editor/post';
import Helpers from '../../test-helpers';
import PostNodeBuilder from 'mobiledoc-kit/models/post-node-builder';
import Range from 'mobiledoc-kit/utils/cursor/range';
import { forEach } from 'mobiledoc-kit/utils/array-utils';

const { module, test } = Helpers;

let editor, editorElement;

function renderBuiltAbstract(post, editor) {
  editor.post = post;
  let unknownCardHandler = () => {};
  let unknownAtomHandler = () => {};
  let renderer = new EditorDomRenderer(
    editor, [], [], unknownCardHandler, unknownAtomHandler);
  let renderTree = new RenderTree(post);
  renderer.render(renderTree);
  return editor;
}

let renderedRange;

class MockEditor {
  constructor(builder) {
    this.builder = builder;
    this.range = Range.blankRange();
  }
  run(callback) {
    let postEditor = new PostEditor(this);
    postEditor.begin();
    let result = callback(postEditor);
    postEditor.end();
    return result;
  }
  rerender() {}
  _postDidChange() {}
  selectRange(range) {
    renderedRange = range;
  }
  _readRangeFromDOM() {}
}

let run = (post, callback) => {
  let builder = new PostNodeBuilder();
  let editor = new MockEditor(builder);

  renderBuiltAbstract(post, editor);

  let postEditor = new PostEditor(editor);
  postEditor.begin();
  let result = callback(postEditor);
  postEditor.complete();
  return result;
};

module('Unit: PostEditor: #deleteRange', {
  beforeEach() {
    renderedRange = null;
    editorElement = $('#editor')[0];
  },

  afterEach() {
    renderedRange = null;
    if (editor) {
      editor.destroy();
      editor = null;
    }
  }
});

test('#deleteRange within a section (single section)', (assert) => {
  let examples = [
    ['ab<c>', 'ab|', 'at tail'],
    ['<a>bc', '|bc', 'at head'],
    ['a<b>c', 'a|c', 'middle']
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    let renderedRange = new Range(position);

    expectedRange = Range.create(post.sections.head, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post (${msg})`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range (${msg})`);
  });
});

test('#deleteRange within a section with markup (single section)', (assert) => {
  let examples = [
    ['abc <*def*> ghi', 'abc | ghi', 'entire markup in middle'],
    ['abc *de<f* ghi>', 'abc *de|*', 'partial markup at end'],
    ['abc *de<f* g>hi', 'abc *de|*hi', 'partial markup in middle (right)'],
    ['ab<c *de>f* ghi', 'ab*|f* ghi', 'partial markup in middle (left)'],
    ['<abc *de>f* ghi', '*|f* ghi', 'partial markup at start'],
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    let renderedRange = new Range(position);

    expectedRange = Range.create(post.sections.head, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post (${msg})`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range (${msg})`);
  });
});

test('#deleteRange entire section (single section)', (assert) => {
  let text = '<abc>';
  let { post, range } = Helpers.postAbstract.buildFromText(text);
  let position = run(post, postEditor => postEditor.deleteRange(range));

  assert.ok(post.sections.length === 1 && post.sections.head.isBlank, 'post has single blank section after deleteRange');
  assert.ok(position.section === post.sections.head, 'position#section is correct');
  assert.equal(position.offset, 0, 'position#offset is correct');
});

test('#deleteRange entire section (multiple sections)', (assert) => {
  let text = ['<abc','def','ghi>'];
  let { post, range } = Helpers.postAbstract.buildFromText(text);
  let position = run(post, postEditor => postEditor.deleteRange(range));

  assert.ok(post.sections.length === 1 && post.sections.head.isBlank, 'post has single blank section after deleteRange');
  assert.ok(position.section === post.sections.head, 'position#section is correct');
  assert.equal(position.offset, 0, 'position#offset is correct');
});

test('#deleteRange across markup section boundaries', (assert) => {
  let examples = [
    [['abc<', '>def'], 'abc|def', 'at boundary'],
    [['abc<', 'd>ef'], 'abc|ef', 'boundary into next section'],
    [['ab<c', '>def'], 'ab|def', 'section into boundary'],
    [['ab<c', 'd>ef'], 'ab|ef', 'containing boundary'],

    [['abc<', 'def', '>ghi'], 'abc|ghi', 'across section at boundary'],
    [['abc<', 'def', 'g>hi'], 'abc|hi', 'across section boundary containing next section'],
    [['ab<c', 'def', '>ghi'], 'ab|ghi', 'across section boundary containing before section'],
    [['ab<c', 'def', 'g>hi'], 'ab|hi', 'across section boundary containing before and after section'],
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    renderedRange = new Range(position);

    expectedRange = Range.create(post.sections.head, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post ${msg}`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range ${msg}`);
  }); 
});

test('#deleteRange across markup section boundaries including markups', (assert) => {
  let examples = [
    [['*abc*<', '>def'], '*abc*|def', 'at boundary (left markup)'],
    [['*abc*<', 'd>ef'], '*abc*|ef', 'boundary into next section (left markup)'],
    [['*ab<c*', '>def'], '*ab*|def', 'section into boundary (left markup)'],
    [['*ab<c*', 'd>ef'], '*ab*|ef', 'containing boundary (left markup)'],

    [['abc<', '*>def*'], 'abc|*def*', 'at boundary (right markup)'],
    [['abc<', '*d>ef*'], 'abc|*ef*', 'boundary into next section (right markup)'],
    [['ab<c', '*>def*'], 'ab|*def*', 'section into boundary (right markup)'],
    [['ab<c', '*d>ef*'], 'ab|*ef*', 'containing boundary (right markup)'],

    [['abc<', '*def*', '>ghi'], 'abc|ghi', 'across section at boundary (containing markup)'],
    [['abc<', '*def*', 'g>hi'], 'abc|hi', 'across section boundary containing next section (containing markup)'],
    [['ab<c', '*def*', '>ghi'], 'ab|ghi', 'across section boundary containing before section (containing markup)'],
    [['ab<c', '*def*', 'g>hi'], 'ab|hi', 'across section boundary containing before and after section (containing markup)'],

    [['abc<', '*def*', '>*g*hi'], 'abc|*g*hi', 'across section at boundary (into markup)'],
    [['abc<', '*def*', '*g*>hi'], 'abc|hi', 'across section boundary containing next section (into markup)'],
    [['ab<c', '*def*', '>*g*hi'], 'ab|*g*hi', 'across section boundary containing before section (into markup)'],
    [['ab<c', '*def*', '*g*>hi'], 'ab|hi', 'across section boundary containing before and after section (into markup)'],
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    renderedRange = new Range(position);

    expectedRange = Range.create(post.sections.head, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post ${msg}`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range ${msg}`);
  }); 
});

test('#deleteRange across markup/non-markup section boundaries', (assert) => {
  let examples = [
    [['[some-card]<','>abc'], ['[some-card]|', 'abc'], 'card->markup'], 
    [['abc<','>[some-card]'], ['abc|', '[some-card]'], 'markup->card'], 

    [['abc<', '[some-card]', '>def'], ['abc|def'], 'containing card, boundaries in outer sections']
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    renderedRange = new Range(position);

    // FIXME need to figure out how to say which section to expect the range to include
    let sectionIndex;
    forEach(expectedPost.sections, (section, index) => {
      if (section === expectedRange.head.section) { sectionIndex = index; }
    });
    expectedRange = Range.create(post.sections.objectAt(sectionIndex),
                                 expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post ${msg}`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range ${msg}`);
  }); 
});

test('#deleteRange surrounding card section', (assert) => {
  let { post, range } = Helpers.postAbstract.buildFromText(['abc', '<[some-card]>', 'def']);
  let expectedPost = Helpers.postAbstract.build(({post, markupSection, marker}) => {
    return post([
      markupSection('p', [marker('abc')]),
      markupSection('p'),
      markupSection('p', [marker('def')])
    ]);
  });

  let position = run(post, postEditor => postEditor.deleteRange(range));
  renderedRange = new Range(position);

  let expectedRange = Range.create(post.sections.objectAt(1), 0);

  assert.postIsSimilar(post, expectedPost);
  assert.rangeIsEqual(renderedRange, expectedRange);
});

test('#deleteRange across list items', (assert) => {
  let examples = [
    [['* item 1<', '* >item 2'], ['* item 1|item 2'], 'at boundary'],
    [['* item <1', '* i>tem 2'], ['* item |tem 2'], 'surrounding boundary'],
    [['* item 1<', '* i>tem 2'], ['* item 1|tem 2'], 'boundary to next'],
    [['* item <1', '* >item 2'], ['* item |item 2'], 'prev to boundary'],

    [['* item 1<', '* middle', '* >item 2'], ['* item 1|item 2'], 'across item at boundary'],
    [['* item <1', '* middle', '* i>tem 2'], ['* item |tem 2'], 'across item surrounding boundary'],
    [['* item <1', '* middle', '* >item 2'], ['* item |item 2'], 'across item prev to boundary'],
    [['* item 1<', '* middle', '* i>tem 2'], ['* item 1|tem 2'], 'across item boundary to next'],

    [['* item 1<', 'middle', '* >item 2'], ['* item 1|item 2'], 'across markup at boundary'],
    [['* item <1', 'middle', '* i>tem 2'], ['* item |tem 2'], 'across markup surrounding boundary'],

    [['* item 1', '<middle', '* i>tem 2'], ['* item 1', '|tem 2'], 'across markup into next'],

    [['* item 1<', '>middle'], ['* item 1|middle'], 'item tail to markup head'],
    [['start<', '* >middle'], ['start|middle'], 'markup tail to item head']
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    renderedRange = new Range(position);

    // FIXME need to figure out how to say which section to expect the range to include
    let sectionIndex;
    let index = 0;
    expectedPost.walkAllLeafSections(section => {
      if (section === expectedRange.head.section) { sectionIndex = index; }
      index++;
    });

    let section;
    index = 0;
    post.walkAllLeafSections(_section => {
      if (index === sectionIndex) { section = _section; }
      index++;
    });
    expectedRange = Range.create(section, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post ${msg}`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range ${msg}`);
  });
});

test('#deleteRange with atoms', (assert) => {
  let examples = [
    ['abc<@>def', 'abc|def', 'surrounding'],
    ['abc<@d>ef', 'abc|ef', 'into atom into next marker'],
    ['ab<c@>def', 'ab|def', 'into marker into atom'],

    ['ab<c>@def', 'ab|@def', 'prev boundary'],
    ['abc@<d>ef', 'abc@|ef', 'next boundary']
  ];

  examples.forEach(([before, after, msg]) => {
    let { post, range } = Helpers.postAbstract.buildFromText(before);
    let { post: expectedPost, range: expectedRange } = Helpers.postAbstract.buildFromText(after);

    let position = run(post, postEditor => postEditor.deleteRange(range));
    renderedRange = new Range(position);

    expectedRange = Range.create(post.sections.head, expectedRange.head.offset);

    assert.postIsSimilar(post, expectedPost, `post ${msg}`);
    assert.rangeIsEqual(renderedRange, expectedRange, `range ${msg}`);
  });
});
