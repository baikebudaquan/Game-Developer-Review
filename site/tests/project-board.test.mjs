import assert from 'node:assert/strict';
import test from 'node:test';
import { getBoardPageSizes } from '../src/lib/project-board.ts';

test('项目少时按实数展示，11 个项目分成 4、3、4 张', () => {
  const cases = [
    [0, []], [1, [1]], [2, [2]], [3, [3]], [4, [4]],
    [5, [3, 2]], [7, [4, 3]], [10, [3, 4, 3]], [11, [4, 3, 4]],
  ];
  for (const [count, expected] of cases) assert.deepEqual(getBoardPageSizes(count), expected);
});

test('超过五个项目时每组都是三或四张，所有项目都能翻到', () => {
  for (let count = 6; count <= 100; count++) {
    const groups = getBoardPageSizes(count);
    assert.ok(groups.every(size => size === 3 || size === 4));
    assert.equal(groups.reduce((total, size) => total + size, 0), count);
  }
});
