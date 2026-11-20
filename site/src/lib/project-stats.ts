export interface RatedEntry { score: number; publishedAt: string }
const day = 86_400_000;

export function projectStats(reviews: RatedEntry[], asOf: string) {
  const end = Date.parse(asOf + 'T00:00:00Z');
  const start = end - 29 * day;
  let positive = 0, recentPositive = 0, latest = '';
  for (const review of reviews) {
    if (review.publishedAt > latest) latest = review.publishedAt;
    if (review.score < 4) continue;
    positive++;
    const date = Date.parse(review.publishedAt.slice(0,10) + 'T00:00:00Z');
    if (date >= start && date <= end) recentPositive++;
  }
  const count = reviews.length, ratio = count ? positive / count : 0;
  let grade = '暂无评价';
  if (count) {
    if (ratio >= .95 && count >= 500) grade = '好评如潮';
    else if (ratio >= .8 && count >= 50) grade = '特别好评';
    else if (ratio >= .8) grade = '好评';
    else if (ratio >= .7) grade = '多半好评';
    else if (ratio >= .4) grade = '褒贬不一';
    else if (ratio <= .05 && count >= 500) grade = '差评如潮';
    else if (ratio < .2 && count >= 50) grade = '特别差评';
    else if (ratio < .2) grade = '差评';
    else grade = '多半差评';
  }
  return { count, positive, recentPositive, latest, grade, ratio };
}

type Ranked = ReturnType<typeof projectStats> & { name: string; path: string };
export function compareProjects(a: Ranked, b: Ranked) {
  return b.recentPositive-a.recentPositive || b.positive-a.positive || b.count-a.count ||
    b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name,'zh-CN') || a.path.localeCompare(b.path);
}
