import assert from 'node:assert/strict';
import {
  newReviewId,
  parseSubmission,
  listPendingPaths,
  rejectedPath,
  auditEntry,
  validateDraft,
  validateCompany,
  buildReview,
  buildCompany,
  mergeCompany,
  today,
} from '../admin/lib/review.js';
import { publishReview, rejectSubmission } from '../admin/lib/publish.js';

const taxonomy = {
  roles: [{ key: 'program', label: '程序' }],
  tenures: [{ key: '1-3y', label: '1–3 年' }],
  employments: [{ key: 'former', label: '已离职' }],
  cities: [{ key: 'shanghai', label: '上海' }],
  tags: [{ key: 'overtime', label: '加班' }],
};

const company = {
  schemaVersion: 1,
  id: 'c_cloudcape',
  slug: 'cloudcape',
  name: '云岬互动',
  aliases: [],
  projects: [{ id: 'p_starport', name: '星港', status: 'live' }],
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};

const draft = {
  id: newReviewId(),
  companyId: 'c_cloudcape',
  projectId: 'p_starport',
  score: 4,
  title: '节奏清楚',
  comment: '项目节奏清楚，评审也及时。',
  profile: { role: 'program', tenure: '1-3y', employment: 'former', city: 'shanghai' },
  tags: ['overtime'],
  publishedAt: today(),
};

assert.match(draft.id, /^rv_[0-9A-Z]+$/);
assert.notEqual(newReviewId(), newReviewId());

assert.deepEqual(validateDraft(draft, { taxonomy, company }), []);
assert.deepEqual(validateCompany(company), []);

assert.ok(validateDraft({ ...draft, score: 6 }, { taxonomy, company }).some(message => message.includes('评分')));
assert.ok(validateDraft({ ...draft, projectId: 'p_missing' }, { taxonomy, company }).some(message => message.includes('项目')));
assert.ok(validateDraft({ ...draft, tags: ['unknown'] }, { taxonomy, company }).some(message => message.includes('标签')));
assert.ok(validateCompany({ ...company, slug: '大写 Slug' }).length > 0);

const review = buildReview(draft);
assert.equal(review.schemaVersion, 1);
assert.equal(review.projectId, 'p_starport');
assert.equal(review.revision, 1);

const fresh = buildCompany({ id: 'c_new', slug: 'new', name: '新公司', project: { id: 'p_new', name: '新项目', status: 'dev' }, date: '2026-11-20' });
assert.equal(fresh.projects.length, 1);
const merged = mergeCompany(company, { project: { id: 'p_new', name: '新项目', status: 'dev' }, date: '2026-11-20' });
assert.equal(merged.projects.length, 2);
assert.equal(merged.updatedAt, '2026-11-20');
assert.equal(company.projects.length, 1);

const raw = {
  submissionId: '4d0f3f0e-8a3d-4b2f-9c1e-7f6a5b4c3d2e',
  submittedAt: '2026-11-20T10:00:00.000Z',
  payload: { company: '云岬互动', project: '星港', score: 4, comment: '正文', profile: { role: 'program' } },
  meta: { flags: ['fast_submit'], ipHash: 'abc' },
};
const view = parseSubmission(raw);
assert.equal(view.company, '云岬互动');
assert.deepEqual(view.flags, ['fast_submit']);

const tree = { tree: [
  { type: 'blob', path: 'submissions/pending/2026/11/a.json' },
  { type: 'tree', path: 'submissions/pending/2026' },
  { type: 'blob', path: 'submissions/rejected/2026/11/b.json' },
] };
assert.deepEqual(listPendingPaths(tree, 'submissions/pending'), ['submissions/pending/2026/11/a.json']);
assert.equal(rejectedPath('submissions/pending/2026/11/a.json'), 'submissions/rejected/2026/11/a.json');

const audit = auditEntry({ action: 'approve', reviewer: 'devA', submissionId: 'sub', reviewId: 'rv_1', companyId: 'c_x' });
assert.ok(audit.includes('"action":"approve"'));
assert.ok(!audit.includes('正文'));

function mockClient() {
  const calls = [];
  return {
    calls,
    async getFile(owner, repo, path) {
      calls.push(['getFile', repo, path]);
      return null;
    },
    async getRef() { calls.push(['getRef']); return { object: { sha: 'base-sha' } }; },
    async getCommit() { calls.push(['getCommit']); return { tree: { sha: 'base-tree' } }; },
    async createBlob(owner, repo, content) { calls.push(['createBlob', content]); return { sha: `blob-${calls.length}` }; },
    async createTree(owner, repo, body) { calls.push(['createTree', body]); return { sha: 'new-tree' }; },
    async createCommit(owner, repo, body) { calls.push(['createCommit', body]); return { sha: 'new-commit' }; },
    async patchRef(owner, repo, branch, sha) { calls.push(['patchRef', branch, sha]); },
    async deleteFile(owner, repo, path, options) { calls.push(['deleteFile', repo, path, options.sha]); },
    async putFile(owner, repo, path, options) { calls.push(['putFile', repo, path, options.content]); },
  };
}

const config = {
  owner: 'owner',
  publicRepo: 'public',
  stagingRepo: 'staging',
  publicBranch: 'main',
  stagingBranch: 'main',
  companiesDir: 'data/companies',
  reviewsDir: 'data/reviews',
  auditDir: 'audit',
};

const client = mockClient();
const result = await publishReview({
  client,
  config,
  submission: raw,
  review,
  company,
  pendingPath: 'submissions/pending/2026/11/' + raw.submissionId + '.json',
  pendingSha: 'pending-sha',
  reviewer: 'devA',
});
assert.equal(result.published, true);
const treeCall = client.calls.find(call => call[0] === 'createTree');
assert.deepEqual(treeCall[1].tree.map(item => item.path).sort(), [
  'data/companies/c_cloudcape.json',
  'data/reviews/c_cloudcape/' + review.id + '.json',
]);
const commitCall = client.calls.find(call => call[0] === 'createCommit');
assert.ok(commitCall[1].message.includes('data: add review'));
assert.ok(client.calls.some(call => call[0] === 'patchRef' && call[2] === 'new-commit'));
assert.ok(client.calls.some(call => call[0] === 'deleteFile' && call[1] === 'staging'));
assert.ok(client.calls.some(call => call[0] === 'putFile' && call[2].startsWith('audit/')));

const rejectClient = mockClient();
const rejected = await rejectSubmission({
  client: rejectClient,
  config,
  submission: raw,
  pendingPath: 'submissions/pending/2026/11/' + raw.submissionId + '.json',
  pendingSha: 'pending-sha',
  reason: '包含联系方式',
  reviewer: 'devA',
});
assert.equal(rejected.targetPath, 'submissions/rejected/2026/11/' + raw.submissionId + '.json');
assert.ok(rejectClient.calls.some(call => call[0] === 'putFile' && call[2] === rejected.targetPath));
assert.ok(rejectClient.calls.some(call => call[0] === 'deleteFile' && call[2].includes('/pending/')));
assert.ok(rejectClient.calls.some(call => call[0] === 'putFile' && call[2].startsWith('audit/')));

console.log('M3 审核与发布流程测试通过');
