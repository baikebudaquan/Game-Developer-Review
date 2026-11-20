import { auditEntry, rejectedPath } from './review.js';

async function appendAudit(client, config, line) {
  const { owner, stagingRepo, stagingBranch, auditDir } = config;
  const month = new Date().toISOString().slice(0, 7);
  const path = `${auditDir}/${month}.jsonl`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await client.getFile(owner, stagingRepo, path, stagingBranch);
    const content = (existing?.content || '') + line + '\n';
    try {
      await client.putFile(owner, stagingRepo, path, {
        message: 'audit: append review action',
        content,
        sha: existing?.sha,
        branch: stagingBranch,
      });
      return;
    } catch (error) {
      if (error.status === 409 && attempt === 0) continue;
      throw error;
    }
  }
}

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

export async function publishReview({ client, config, submission, review, company, pendingPath, pendingSha, reviewer }) {
  const { owner, publicRepo, publicBranch, stagingRepo, stagingBranch, reviewsDir, companiesDir } = config;
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

  try {
    await client.deleteFile(owner, stagingRepo, pendingPath, {
      message: `data: publish ${review.id}`,
      sha: pendingSha,
      branch: stagingBranch,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  await appendAudit(client, config, auditEntry({
    action: 'approve',
    reviewer,
    submissionId: submission.submissionId,
    reviewId: review.id,
    companyId: review.companyId,
    projectId: review.projectId,
  }));

  return { reviewPath, companyPath, published };
}

export async function rejectSubmission({ client, config, submission, pendingPath, pendingSha, reason, reviewer }) {
  const { owner, stagingRepo, stagingBranch, rejectedDir } = config;
  const targetPath = rejectedPath(pendingPath);
  const target = await client.getFile(owner, stagingRepo, targetPath, stagingBranch);
  const record = {
    ...submission,
    rejectedAt: new Date().toISOString(),
    rejectReason: reason,
  };

  await client.putFile(owner, stagingRepo, targetPath, {
    message: `data: reject ${submission.submissionId}`,
    content: JSON.stringify(record, null, 2) + '\n',
    sha: target?.sha,
    branch: stagingBranch,
  });
  try {
    await client.deleteFile(owner, stagingRepo, pendingPath, {
      message: `data: reject ${submission.submissionId}`,
      sha: pendingSha,
      branch: stagingBranch,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  await appendAudit(client, config, auditEntry({
    action: 'reject',
    reviewer,
    submissionId: submission.submissionId,
    companyId: submission.companyId,
    reason,
  }));

  return { targetPath };
}
