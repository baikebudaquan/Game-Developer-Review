import assert from 'node:assert/strict';
import test from 'node:test';
import { projectStats, compareProjects, isRecentPick } from '../src/lib/project-stats.ts';

const asOf='2026-11-20';
const review=(score,publishedAt=asOf)=>({score,publishedAt});
test('近期好评榜同时检查平均分、总好评率和窗口内好评',()=>{
  const eligible = { meanScore:4, ratio:.7, recentPositive:1 };
  assert.ok(isRecentPick(eligible));
  assert.equal(isRecentPick({ ...eligible, ratio:.69, recentPositive:100 }),false);
  assert.equal(isRecentPick({ ...eligible, recentPositive:0 }),false);
  assert.equal(isRecentPick({ ...eligible, meanScore:3.99 }),false);
  assert.equal(isRecentPick(projectStats([4,4,4,1].map(s=>review(s)),asOf)),false);
  assert.equal(isRecentPick(projectStats([],asOf)),false);
});
test('近30个自然日包含今天和首日，仅4或5星计为好评',()=>{
  const stats=projectStats([review(5,'2026-10-21'),review(4,'2026-10-22'),review(5),review(3),review(4,'2026-11-21')],asOf);
  assert.equal(stats.recentPositive,2);
  assert.equal(stats.count,5);
});
test('等级按好评比例和样本量计算，零评价单独展示',()=>{
  assert.equal(projectStats([],asOf).grade,'暂无评价');
  assert.equal(projectStats([review(5)],asOf).grade,'好评');
  assert.equal(projectStats([review(5),review(2)],asOf).grade,'褒贬不一');
  assert.equal(projectStats(Array.from({length:50},()=>review(4)),asOf).grade,'特别好评');
  assert.equal(projectStats(Array.from({length:500},()=>review(4)),asOf).grade,'好评如潮');
});
test('近期好评数优先，历史好评仅用于同数项目的排序',()=>{
  const old=review(5,'2026-10-01');
  const item=(name,reviews)=>({name,path:name,...projectStats(reviews,asOf)});
  const list=[item('历史多',[old,old,old]),item('近期一',[review(4)]),item('近期一且历史多',[review(4),old]),item('近期二',[review(4),review(5)])];
  assert.deepEqual(list.sort(compareProjects).map(p=>p.name),['近期二','近期一且历史多','近期一','历史多']);
});
