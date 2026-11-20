export const config = {
  owner: 'baikebudaquan',
  publicRepo: 'Game-Developer-Review',
  stagingRepo: 'Game-Developer-Review-staging',
  publicBranch: 'main',
  stagingBranch: 'main',

  taxonomyPath: 'data/taxonomy.json',
  companiesDir: 'data/companies',
  reviewsDir: 'data/reviews',
  pendingDir: 'submissions/pending',
  rejectedDir: 'submissions/rejected',
  auditDir: 'audit',

  // 为空表示只校验 token 对两个仓库的写权限
  allowedLogins: [],

  maxPending: 100,
};
