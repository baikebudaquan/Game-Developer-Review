async function commitPublish(client, config, { review, company, reviewPath, companyPath }) {
  const { owner, publicRepo, publicBranch } = config;
  const ref = await client.getRef(owner, publicRepo, publicBranch);
  const base = await client.getCommit(owner, publicRepo, ref.object.sha);
  const [reviewBlob, companyBlob] = await Promise.all([
    client.createBlob(owner, publicRepo, JSON.stringify(review, null, 2) + '\n'),
    client.createBlob(owner, publicRepo, JSON.stringify(company, null, 2) + '\n'),
  ]);
  const tree = await client.createTree(owner, publicRepo, {
    base_tree: base.tree.sha,
    tree: [
      { path: reviewPath, mode: '100644', type: 'blob', sha: reviewBlob.sha },
      { path: companyPath, mode: '100644', type: 'blob', sha: companyBlob.sha },
    ],
  });
  const commit = await client.createCommit(owner, publicRepo, {
    message: `data: add review ${review.id}`,
    tree: tree.sha,
    parents: [ref.object.sha],
  });
  await client.patchRef(owner, publicRepo, publicBranch, commit.sha);
}

/**
 * 把审核结果原子写入公开仓。重复调用时以 reviewId 判断是否已写入，可安全重试。
 */
export async function publishReview({ client, config, review, company }) {
  const { owner, publicRepo, publicBranch, reviewsDir, companiesDir } = config;
  const reviewPath = `${reviewsDir}/${review.companyId}/${review.id}.json`;
  const companyPath = `${companiesDir}/${review.companyId}.json`;
  const existing = await client.getFile(owner, publicRepo, reviewPath, publicBranch);
  let published = false;

  if (!existing) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await commitPublish(client, config, { review, company, reviewPath, companyPath });
        published = true;
        break;
      } catch (error) {
        if (error.status === 409 && attempt === 0) continue;
        throw error;
      }
    }
  }

  return { reviewPath, companyPath, published };
}
