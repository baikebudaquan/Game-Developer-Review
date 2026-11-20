import { detail, href, index } from './data';
import { compareProjects, projectStats } from './project-stats';

const artwork: Record<string, [string, string]> = {
  p_kite: ['THE KITE MENDER','kite'], p_windward: ['WINDWARD ISLES','windward'],
  p_thread: ['DREAM POST','thread'], p_bell: ['SEVENTH CHIME','bell'],
  p_tidelight: ['TIDELIGHT','tidelight'], p_lantern: ['LETTERS FROM THE LIGHT','lantern'],
  p_fog: ['MISTBOUND EXPRESS','fog'], p_lastferry: ['THE LAST FERRY','lastferry'],
  p_mossyard: ['MOSS & GEAR','mossyard'], p_emberpath: ['EMBER PATH','emberpath'],
  p_sand: ['DUNE SAILS','sand'], p_snowpost: ['SNOWLINE POST','snowpost'],
};
export const asOf = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(index.generatedAt));
export const statuses: Record<string,string> = {live:'已上线',dev:'在研',cancelled:'已取消',unknown:'状态未知'};
export const projects = index.companies.flatMap(c => {
  const data = detail(c.id);
  const aliases = data.company.aliases ?? [];
  return data.projects.map(project => {
    const reviews = data.reviews.filter(r=>r.projectId===project.id).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
    const art = artwork[project.id];
    const scenes = art ? [1,2,3,4].map(n=>href(`images/projects/${art[1]}-${n}.webp`)) : [];
    const wordmark = art?.[0] || project.name;
    const cover = project.id==='p_kite' ? href('images/projects/kite-cover.webp') : scenes[0];
    return {
      id: project.id, name: project.name, status: statuses[project.status] || '状态未知',
      company: c.name, slug:c.slug, aliases, reviews, scenes, cover, wordmark,
      path:href(`project/${encodeURIComponent(c.slug)}/${encodeURIComponent(project.id)}/`),
      search:[c.name,c.slug,...aliases,project.name,wordmark].join(' ').normalize('NFKC').toLocaleLowerCase(),
      ...projectStats(reviews,asOf)
    };
  });
}).sort(compareProjects);
export type Project = (typeof projects)[number];
export const projectsByStudio = Map.groupBy(projects, project => project.slug);
