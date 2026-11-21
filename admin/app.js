import { createClient } from './lib/github.js';
import { createApi } from './lib/api.js';
import { config } from './config.js';
import { h } from './lib/dom.js';
import { bestKeyScore, buildAliasIndex, normalize, AUTO_MATCH_THRESHOLD } from './lib/match.js';
import { createCombobox } from './lib/combo.js';
import {
  parseSubmission,
  parseJson,
  newReviewId,
  today,
  buildReview,
  buildCompany,
  mergeCompany,
  validateDraft,
  validateCompany,
  autoSlug,
} from './lib/review.js';
import { publishReview, publishReviews } from './lib/publish.js';

const TOKEN_KEY = 'gdr.admin.token';
const STAGING_KEY = 'gdr.admin.staging';

const $ = selector => document.querySelector(selector);
const loginView = $('#login-view');
const loginForm = $('#login-form');
const tokenInput = $('#token');
const loginStatus = $('#login-status');
const appView = $('#app-view');
const logoutButton = $('#logout-button');
const userLabel = $('#user-label');
const filterInput = $('#filter');
const refreshButton = $('#refresh-button');
const deployButton = $('#deploy-button');
const localMode = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
const pendingList = $('#pending-list');
const pendingCount = $('#pending-count');
const tabPending = $('#tab-pending');
const tabStaged = $('#tab-staged');
const stagedBar = $('#staged-bar');
const stagedSummary = $('#staged-summary');
const publishBatchButton = $('#publish-batch-button');
const stageButton = $('#stage-button');
const detailEmpty = $('#detail-empty');
const reviewForm = $('#review-form');
const summaryEl = $('#submission-summary');
const companyCombo = createCombobox({
  input: $('#company-input'),
  list: $('#company-list'),
  onSelect: handleCompanySelect,
  onBlur: handleCompanyBlur,
});
const projectCombo = createCombobox({
  input: $('#project-input'),
  list: $('#project-list'),
  onSelect: handleProjectSelect,
  onBlur: handleProjectBlur,
});
const newCompanyBox = $('#new-company');
const newCompanyId = $('#new-company-id');
const newCompanySlug = $('#new-company-slug');
const newCompanyName = $('#new-company-name');
const newProjectBox = $('#new-project');
const newProjectId = $('#new-project-id');
const newProjectName = $('#new-project-name');
const newProjectStatus = $('#new-project-status');
const scoreSelect = $('#review-score');
const titleInput = $('#review-title');
const commentInput = $('#review-comment');
const tagList = $('#tag-list');
const roleSelect = $('#profile-role');
const tenureSelect = $('#profile-tenure');
const employmentSelect = $('#profile-employment');
const citySelect = $('#profile-city');
const approveButton = $('#approve-button');
const rejectButton = $('#reject-button');
const detailStatus = $('#detail-status');
const globalStatus = $('#global-status');

const state = {
  client: null,
  api: null,
  taxonomy: null,
  companies: new Map(),
  library: { companies: [], projects: [] },
  aliasIndex: new Map(),
  pending: [],
  pendingTotal: 0,
  staging: loadStaging(),
  tab: 'pending',
  selected: null,
  selectedId: null,
  reviewId: null,
  busy: false,
};

function setStatus(element, message, isError = false) {
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(isError));
}

function describeError(error) {
  if (error instanceof TypeError) return '无法连接审核 API，请确认本地控制台窗口仍在运行，或网络能访问 gdr-admin.pages.dev（必要时开启代理后刷新）。';
  if (error.status === 401) return error.body?.message || 'token 已失效或权限不足，请重新登录。';
  if (error.status === 403) return error.body?.message || '没有仓库写权限，请检查 token 权限。';
  if (error.status === 404) return error.body?.message || '仓库或文件不存在，请检查配置与权限。';
  if (error.status === 409) return '并发冲突，请刷新后重试。';
  return error.message || '操作失败';
}

function findCompany(name) {
  const target = String(name || '').trim().toLowerCase();
  return [...state.companies.values()].find(company =>
    company.name.toLowerCase() === target ||
    company.slug === target ||
    (company.aliases || []).some(alias => alias.toLowerCase() === target));
}

function fillSelect(select, entries, emptyLabel = '不填') {
  select.replaceChildren(
    h('option', { value: '' }, emptyLabel),
    ...(entries || []).map(entry => h('option', { value: entry.key }, entry.label)),
  );
}

function renderTaxonomyOptions() {
  const taxonomy = state.taxonomy;
  fillSelect(roleSelect, taxonomy.roles);
  fillSelect(tenureSelect, taxonomy.tenures);
  fillSelect(employmentSelect, taxonomy.employments);
  fillSelect(citySelect, taxonomy.cities);
  tagList.replaceChildren(...taxonomy.tags.map(tag =>
    h('label', {}, h('input', { type: 'checkbox', value: tag.key }), tag.label)));
}

function loadStaging() {
  try {
    const data = JSON.parse(localStorage.getItem(STAGING_KEY) || '[]');
    return Array.isArray(data)
      ? data.filter(entry => entry?.submissionId && entry.review?.id && entry.company?.id)
      : [];
  } catch {
    return [];
  }
}

function saveStaging() {
  localStorage.setItem(STAGING_KEY, JSON.stringify(state.staging));
}

function projectName(review, company) {
  return (company.projects || []).find(project => project.id === review.projectId)?.name || '';
}

function renderList() {
  const query = filterInput.value.trim().toLowerCase();
  const staged = state.tab === 'staged';
  const stagedIds = new Set(state.staging.map(entry => entry.submissionId));
  const visiblePending = state.pending.filter(item => !stagedIds.has(item.id));
  const totalPending = Math.max(0, state.pendingTotal - (state.pending.length - visiblePending.length));

  tabPending.classList.toggle('active', !staged);
  tabStaged.classList.toggle('active', staged);
  tabPending.textContent = `待审 ${totalPending}`;
  tabStaged.textContent = `暂存 ${state.staging.length}`;
  stagedBar.hidden = !staged || !state.staging.length;
  stagedSummary.textContent = `共 ${state.staging.length} 条，合并为一次提交`;

  const matches = (company, project) => !query || `${company} ${project}`.toLowerCase().includes(query);
  const items = staged
    ? state.staging.filter(entry => matches(entry.company.name || '', projectName(entry.review, entry.company)))
    : visiblePending.filter(item => matches(item.view.company || '', item.view.project || ''));

  pendingList.replaceChildren();
  if (!items.length) {
    pendingList.append(h('p', { class: 'empty' }, query ? '没有匹配项' : staged ? '暂存区为空' : '暂无待审提交'));
  }

  if (staged) {
    items.forEach(entry => {
      pendingList.append(h('div', { class: 'item' },
        h('div', { class: 'item-head' },
          h('strong', {}, entry.company.name || '（未填公司）'),
          h('span', {}, `${entry.review.score} 分`)),
        h('div', { class: 'item-meta' },
          [projectName(entry.review, entry.company), (entry.stagedAt || '').slice(0, 10)].filter(Boolean).join(' · ')),
        h('button', {
          type: 'button',
          class: 'ghost small',
          onClick: () => unstageItem(entry.submissionId),
        }, '移出暂存'),
      ));
    });
  } else {
    items.forEach(item => {
      pendingList.append(h('button', {
        type: 'button',
        class: 'item' + (item.id === state.selectedId ? ' active' : ''),
        onClick: () => selectItem(item),
      },
        h('div', { class: 'item-head' },
          h('strong', {}, item.view.company || '（未填公司）'),
          h('span', {}, `${item.view.score} 分`)),
        h('div', { class: 'item-meta' }, [item.view.project, (item.raw.submittedAt || '').slice(0, 10)].filter(Boolean).join(' · ')),
        item.view.flags.length ? h('div', { class: 'flags' }, item.view.flags.join(' · ')) : null,
      ));
    });
  }

  pendingCount.textContent = staged
    ? `暂存 ${state.staging.length} 条`
    : (totalPending > visiblePending.length ? `显示 ${visiblePending.length} / 共 ${totalPending} 条` : `共 ${visiblePending.length} 条`);
  publishBatchButton.disabled = state.busy || !state.staging.length;
}

function setTab(tab) {
  if (state.tab === tab) return;
  state.tab = tab;
  renderList();
}

function unstageItem(submissionId) {
  state.staging = state.staging.filter(entry => entry.submissionId !== submissionId);
  saveStaging();
  renderList();
}

function toggleNewCompany() {
  newCompanyBox.hidden = companyCombo.value !== '__new';
}

function toggleNewProject() {
  newProjectBox.hidden = projectCombo.value !== '__new';
}

function syncCompanyFields() {
  const name = newCompanyName.value.trim();
  if (newCompanySlug.dataset.touched !== '1') {
    newCompanySlug.value = autoSlug(name);
  }
  if (newCompanyId.dataset.touched !== '1') {
    newCompanyId.value = newCompanySlug.value ? `c_${newCompanySlug.value}` : 'c_';
  }
}

function matchCompanyByName() {
  const name = newCompanyName.value.trim();
  const matched = name ? findCompany(name) : null;
  if (!matched) return false;
  const pendingProject = newProjectName.value.trim();
  companyCombo.setValue(matched.id);
  toggleNewCompany();
  renderProjectOptions(matched, pendingProject);
  setStatus(detailStatus, `已匹配现有公司「${matched.name}」，无需新建`);
  return true;
}

function syncProjectId() {
  if (newProjectId.dataset.touched === '1') return;
  const name = newProjectName.value.trim();
  newProjectId.value = name ? `p_${autoSlug(name)}` : '';
}

function matchProjectByName() {
  const name = newProjectName.value.trim();
  const company = companyCombo.value === '__new' ? null : state.companies.get(companyCombo.value);
  if (!name || !company) return false;
  const target = name.toLowerCase();
  const matched = company.projects.find(project => project.name.toLowerCase() === target);
  if (!matched) return false;
  projectCombo.setValue(matched.id);
  toggleNewProject();
  setStatus(detailStatus, `已匹配现有项目「${matched.name}」，无需新建`);
  return true;
}

/**
 * 一个公司的全部检索键：名称 / ID / slug / 自带别名 / 别名库补充别名，
 * 以及项目名与项目别名（命中项目时顺带把公司带出来）。
 */
function companyKeys(company) {
  const idx = state.aliasIndex.get(company.id);
  const keys = [
    { k: company.name },
    { k: company.id },
    ...(company.slug ? [{ k: company.slug }] : []),
    ...(company.aliases || []).map(k => ({ k })),
    ...(idx?.aliases || []).map(k => ({ k })),
  ];
  for (const project of company.projects || []) {
    keys.push({ k: project.name, project: project.id, pn: project.name });
    for (const alias of idx?.projects.get(project.id) || []) {
      keys.push({ k: alias, project: project.id, pn: project.name });
    }
  }
  for (const extra of idx?.extra || []) {
    keys.push({ k: extra.name, project: null, pn: extra.name });
    for (const alias of extra.aliases) keys.push({ k: alias, project: null, pn: extra.name });
  }
  return keys;
}

/** 在全部公司里模糊查找，threshold 提高可只接受精确 / 前缀命中。 */
function matchCompany(text, threshold = AUTO_MATCH_THRESHOLD) {
  if (!text) return null;
  let best = null;
  for (const company of state.companies.values()) {
    const { score, key } = bestKeyScore(text, companyKeys(company));
    if (score >= threshold && (!best || score > best.score)) best = { company, score, key };
  }
  return best;
}

/**
 * 在指定公司下模糊匹配项目，返回 { project, hint }。
 * hint 用于别名命中与「公司下还没建这个项目」的提示。
 */
function matchProject(company, text, threshold = AUTO_MATCH_THRESHOLD) {
  if (!company || !text) return { project: null, hint: '' };
  const idx = state.aliasIndex.get(company.id);
  let best = null;
  for (const project of company.projects || []) {
    const keys = [
      { k: project.name },
      { k: project.id },
      ...(idx?.projects.get(project.id) || []).map(k => ({ k })),
    ];
    const { score, key } = bestKeyScore(text, keys);
    if (score >= threshold && (!best || score > best.score)) best = { project, key };
  }
  if (best) {
    const keyText = best.key?.k ? normalize(best.key.k) : '';
    const viaAlias = keyText && keyText !== normalize(best.project.name) && keyText !== normalize(best.project.id);
    return {
      project: best.project,
      hint: viaAlias ? `已按别名「${best.key.k}」匹配项目「${best.project.name}」` : '',
    };
  }
  for (const extra of idx?.extra || []) {
    const { score, key } = bestKeyScore(text, [{ k: extra.name }, ...extra.aliases.map(k => ({ k }))]);
    if (score >= threshold) {
      return {
        project: null,
        hint: `「${text}」接近已知项目「${extra.name}」（命中「${key?.k}」），当前公司还没有该项目`,
      };
    }
  }
  return { project: null, hint: '' };
}

function renderProjectOptions(company, projectText) {
  const idx = state.aliasIndex.get(company?.id);
  projectCombo.setOptions([
    { value: '__none', label: '不关联项目' },
    ...(company?.projects || []).map(project => ({
      value: project.id,
      label: project.name,
      sub: project.id,
      keys: [
        { k: project.name },
        { k: project.id },
        ...(idx?.projects.get(project.id) || []).map(k => ({ k })),
      ],
    })),
    { value: '__new', label: '＋ 新建项目' },
  ]);

  const { project: matched, hint } = matchProject(company, projectText);
  const value = matched ? matched.id : (projectText ? '__new' : '__none');
  projectCombo.setValue(value, matched ? matched.name : projectText);
  newProjectName.value = value === '__new' ? projectText : '';
  newProjectId.dataset.touched = '';
  newProjectId.value = newProjectName.value.trim() ? `p_${autoSlug(newProjectName.value)}` : '';
  newProjectStatus.value = 'unknown';
  toggleNewProject();
  return hint;
}

function handleCompanySelect(value, { query = '', projectName = '' } = {}) {
  if (value === '__new') {
    const text = query.trim();
    if (text) newCompanyName.value = text;
    newCompanySlug.dataset.touched = '';
    newCompanyId.dataset.touched = '';
    syncCompanyFields();
    toggleNewCompany();
    if (matchCompanyByName()) return;
    renderProjectOptions(null, '');
    return;
  }
  toggleNewCompany();
  renderProjectOptions(state.companies.get(value) || null, projectName);
}

function handleCompanyBlur(text) {
  const value = companyCombo.value;
  const query = text.trim();
  if (value !== '__new' && query === companyCombo.labelOf(value)) return;
  if (!query) {
    companyCombo.setValue(value);
    return;
  }
  if (value === '__new' && query === newCompanyName.value.trim()) return;

  // 搜了但没点：命中足够可信就自动选中，否则按新建公司处理
  const matched = matchCompany(query, 90);
  if (matched) {
    companyCombo.setValue(matched.company.id);
    toggleNewCompany();
    renderProjectOptions(matched.company, '');
    setStatus(detailStatus, `已选择公司「${matched.company.name}」`);
    return;
  }
  companyCombo.setValue('__new', query);
  newCompanyName.value = query;
  newCompanySlug.dataset.touched = '';
  newCompanyId.dataset.touched = '';
  syncCompanyFields();
  toggleNewCompany();
  if (!matchCompanyByName()) renderProjectOptions(null, '');
}

function handleProjectSelect(value, { query = '' } = {}) {
  if (value === '__new') {
    const text = query.trim();
    if (text) newProjectName.value = text;
    newProjectId.dataset.touched = '';
    syncProjectId();
    toggleNewProject();
    matchProjectByName();
    return;
  }
  toggleNewProject();
}

function handleProjectBlur(text) {
  const value = projectCombo.value;
  const query = text.trim();
  if (value !== '__new' && query === projectCombo.labelOf(value)) return;
  if (!query) {
    projectCombo.setValue(value);
    return;
  }
  if (value === '__new' && query === newProjectName.value.trim()) return;

  const company = state.companies.get(companyCombo.value);
  const { project: matched } = matchProject(company, query, 90);
  if (matched) {
    projectCombo.setValue(matched.id);
    toggleNewProject();
    setStatus(detailStatus, `已选择项目「${matched.name}」`);
    return;
  }
  projectCombo.setValue('__new', query);
  newProjectName.value = query;
  newProjectId.dataset.touched = '';
  syncProjectId();
  toggleNewProject();
  matchProjectByName();
}

function renderDetail(item) {
  const view = item.view;
  detailEmpty.hidden = true;
  reviewForm.hidden = false;
  setStatus(detailStatus, '');

  summaryEl.textContent = [
    `提交编号：${view.submissionId}`,
    `公司原文：${view.company || '—'}`,
    `项目原文：${view.project || '—'}`,
    `评分：${view.score}`,
    `提交时间：${(view.submittedAt || '').slice(0, 19).replace('T', ' ')}`,
    view.wish ? `希望被吐槽：${view.wish}` : '',
    view.flags.length ? `风控标记：${view.flags.join(', ')}` : '',
    `正文：${view.comment}`,
  ].filter(Boolean).join('\n');

  companyCombo.setOptions([...state.companies.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map(company => ({ value: company.id, label: company.name, sub: company.id, keys: companyKeys(company) })));

  const notes = [];
  let matched = view.companyId ? state.companies.get(view.companyId) : null;
  if (matched) {
    notes.push(`已按提交的公司 ID 匹配「${matched.name}」`);
  } else {
    const found = matchCompany(view.company);
    if (found) {
      matched = found.company;
      const via = found.key?.k && normalize(found.key.k) !== normalize(found.company.name)
        ? `（命中「${found.key.k}」）`
        : '';
      notes.push(`已匹配现有公司「${found.company.name}」${via}`);
    }
  }
  companyCombo.setValue(matched ? matched.id : '__new', matched ? matched.name : view.company);
  toggleNewCompany();

  newCompanyName.value = view.company || '';
  newCompanySlug.dataset.touched = '';
  newCompanySlug.value = autoSlug(newCompanyName.value);
  newCompanyId.dataset.touched = '';
  newCompanyId.value = newCompanySlug.value ? `c_${newCompanySlug.value}` : 'c_';

  const projectHint = renderProjectOptions(matched, view.project);
  if (projectHint) notes.push(projectHint);
  setStatus(detailStatus, notes.join('；'));
  scoreSelect.value = String(view.score || 3);
  titleInput.value = '';
  commentInput.value = view.comment || '';

  roleSelect.value = view.profile?.role || '';
  tenureSelect.value = view.profile?.tenure || '';
  employmentSelect.value = view.profile?.employment || '';
  citySelect.value = view.profile?.city || '';

  tagList.querySelectorAll('input').forEach(input => { input.checked = false; });
}

function showEmptyDetail() {
  reviewForm.hidden = true;
  detailEmpty.hidden = false;
  state.selected = null;
  state.selectedId = null;
  state.reviewId = null;
  renderList();
}

function selectItem(item) {
  state.selected = item;
  state.selectedId = item.id;
  state.reviewId = newReviewId();
  renderList();
  renderDetail(item);
}

function collectProfile() {
  const profile = {};
  if (roleSelect.value) profile.role = roleSelect.value;
  if (tenureSelect.value) profile.tenure = tenureSelect.value;
  if (employmentSelect.value) profile.employment = employmentSelect.value;
  if (citySelect.value) profile.city = citySelect.value;
  return profile;
}

function collectTags() {
  return [...tagList.querySelectorAll('input:checked')].map(input => input.value);
}

function setBusy(busy) {
  state.busy = busy;
  approveButton.disabled = busy;
  stageButton.disabled = busy;
  rejectButton.disabled = busy;
  publishBatchButton.disabled = busy || !state.staging.length;
  approveButton.textContent = busy ? '处理中…' : '通过并发布';
}

async function loadAliases() {
  try {
    const response = await fetch('/lib/aliases.json');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data?.companies)) state.library.companies = data.companies;
    if (Array.isArray(data?.projects)) state.library.projects = data.projects;
  } catch {
    // 别名库缺失或损坏时退回纯名称匹配，不阻塞审核
  }
}

async function loadData() {
  const { client, api } = state;
  setStatus(globalStatus, '正在加载数据…');

  const [taxonomyFile, companyTree, pendingResult] = await Promise.all([
    client.getFile(config.owner, config.publicRepo, config.taxonomyPath, config.publicBranch),
    client.getTree(config.owner, config.publicRepo, config.publicBranch),
    api.listPending(config.maxPending),
    loadAliases(),
  ]);
  if (!taxonomyFile) throw new Error('公开仓缺少 taxonomy.json');

  state.taxonomy = parseJson(taxonomyFile.content, config.taxonomyPath);
  renderTaxonomyOptions();

  const companyPaths = (companyTree.tree || [])
    .filter(item => item.type === 'blob' && item.path.startsWith(`${config.companiesDir}/`) && item.path.endsWith('.json'))
    .map(item => item.path);
  const companyFiles = await Promise.all(companyPaths.map(async path => {
    const file = await client.getFile(config.owner, config.publicRepo, path, config.publicBranch);
    return file ? parseJson(file.content, path) : null;
  }));
  state.companies = new Map(companyFiles.filter(Boolean).map(company => [company.id, company]));
  state.aliasIndex = buildAliasIndex(state.companies, state.library);

  state.pending = (pendingResult.items || [])
    .map(item => {
      const view = parseSubmission(item.submission);
      return view ? { id: item.id, raw: item.submission, view } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.raw.submittedAt || '').localeCompare(a.raw.submittedAt || ''));
  state.pendingTotal = pendingResult.total || 0;
  state.selected = null;
  state.selectedId = null;
  state.reviewId = null;
  showEmptyDetail();
  renderList();
}

async function signIn(token, { silent = false } = {}) {
  if (!silent) setStatus(loginStatus, '正在验证 token…');
  try {
    const client = createClient(token);
    const api = createApi(token);
    const me = await api.me();

    sessionStorage.setItem(TOKEN_KEY, token);
    state.client = client;
    state.api = api;
    await loadData();

    loginView.hidden = true;
    appView.hidden = false;
    logoutButton.hidden = false;
    userLabel.textContent = `@${me.login}`;
    setStatus(loginStatus, '');
    setStatus(globalStatus, `已加载 ${state.pending.length} 条待审提交`);
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    state.client = null;
    state.api = null;
    setStatus(loginStatus, describeError(error), true);
  }
}

function signOut(message = '') {
  sessionStorage.removeItem(TOKEN_KEY);
  state.client = null;
  state.api = null;
  state.pending = [];
  state.pendingTotal = 0;
  state.companies = new Map();
  state.aliasIndex = new Map();
  state.selected = null;
  state.selectedId = null;
  state.reviewId = null;
  loginView.hidden = false;
  appView.hidden = true;
  logoutButton.hidden = true;
  userLabel.textContent = '';
  pendingList.replaceChildren();
  pendingCount.textContent = '';
  reviewForm.hidden = true;
  detailEmpty.hidden = false;
  setStatus(loginStatus, message, Boolean(message));
  setStatus(globalStatus, '');
}

function collectDraft() {
  const projectChoice = projectCombo.value;
  let newProject = null;
  let projectId = '';
  if (projectChoice === '__new') {
    newProject = {
      id: newProjectId.value.trim(),
      name: newProjectName.value.trim(),
      status: newProjectStatus.value,
    };
    projectId = newProject.id;
  } else if (projectChoice !== '__none') {
    projectId = projectChoice;
  }

  let company;
  if (companyCombo.value === '__new') {
    const companyId = newCompanyId.value.trim();
    if (state.companies.has(companyId)) throw new Error('公司 ID 已存在，请直接选择现有公司');
    company = buildCompany({
      id: companyId,
      slug: newCompanySlug.value.trim(),
      name: newCompanyName.value.trim(),
      project: newProject,
      date: today(),
    });
  } else {
    const base = state.companies.get(companyCombo.value);
    if (!base) throw new Error('未找到公司');
    if (newProject && base.projects.some(project => project.id === newProject.id)) {
      throw new Error('项目 ID 已存在，请直接选择现有项目');
    }
    company = mergeCompany(base, { project: newProject, date: today() });
  }

  const draft = {
    id: state.reviewId,
    companyId: company.id,
    projectId,
    score: Number(scoreSelect.value),
    title: titleInput.value.trim(),
    comment: commentInput.value.trim(),
    profile: collectProfile(),
    tags: collectTags(),
    publishedAt: today(),
  };

  const errors = [
    ...validateCompany(company),
    ...validateDraft(draft, { taxonomy: state.taxonomy, company }),
  ];
  if (errors.length) throw new Error(errors.join('；'));

  return { review: buildReview(draft), company };
}

function handleStage() {
  if (state.busy || !state.selected) return;
  const item = state.selected;
  try {
    const { review, company } = collectDraft();
    state.staging = state.staging.filter(entry => entry.submissionId !== item.id);
    state.staging.push({ submissionId: item.id, review, company, stagedAt: new Date().toISOString() });
    saveStaging();
    showEmptyDetail();
    setStatus(globalStatus, `已暂存 ${review.id}；到「暂存」标签可一次全部发布`);
  } catch (error) {
    setStatus(detailStatus, error.message, true);
  }
}

async function updateShowcase() {
  if (!localMode) return '';
  try {
    const response = await fetch('/api/local/deploy', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    return data.ok ? '；展示站已更新' : `；展示站未更新：${data.message || `HTTP ${response.status}`}`;
  } catch (error) {
    return `；展示站未更新：${error.message}`;
  }
}

async function publishStaged() {
  if (state.busy || !state.staging.length) return;
  setBusy(true);
  setStatus(globalStatus, `正在发布 ${state.staging.length} 条暂存…`);

  try {
    await publishReviews({
      client: state.client,
      config,
      items: state.staging.map(({ review, company }) => ({ review, company })),
    });

    const failures = [];
    const approved = new Set();
    for (const entry of state.staging) {
      try {
        await state.api.approve(entry.submissionId, { reviewId: entry.review.id, companyId: entry.company.id });
        approved.add(entry.submissionId);
      } catch (error) {
        failures.push(`${entry.review.id}：${describeError(error)}`);
      }
    }

    state.staging = state.staging.filter(entry => !approved.has(entry.submissionId));
    saveStaging();
    const removed = state.pending.filter(item => approved.has(item.id)).length;
    state.pending = state.pending.filter(item => !approved.has(item.id));
    state.pendingTotal = Math.max(0, state.pendingTotal - removed);
    if (!state.staging.length) state.tab = 'pending';

    let deployNote = '';
    if (approved.size) {
      setStatus(globalStatus, '已写入公开仓，正在更新展示站…');
      deployNote = await updateShowcase();
    }

    showEmptyDetail();
    if (failures.length) {
      setStatus(globalStatus, `已发布 ${approved.size} 条，${failures.length} 条状态记录失败（仍保留在暂存）：${failures.join('；')}`, true);
    } else {
      setStatus(globalStatus, `已发布 ${approved.size} 条${deployNote}`);
    }
  } catch (error) {
    if (error.status === 401) {
      signOut('登录已失效，请重新登录。');
      return;
    }
    setStatus(globalStatus, describeError(error), true);
  } finally {
    setBusy(false);
    renderList();
  }
}

async function handleApprove(event) {
  event.preventDefault();
  if (state.busy || !state.selected) return;

  const item = state.selected;
  setBusy(true);
  setStatus(detailStatus, '正在发布…');

  try {
    const { review, company } = collectDraft();
    await publishReview({ client: state.client, config, review, company });
    try {
      await state.api.approve(item.id, { reviewId: review.id, companyId: company.id });
    } catch (error) {
      throw new Error(`已写入公开仓 ${review.id}，但审核状态记录失败，请重试「通过并发布」。${error.message}`);
    }

    let deployNote = '';
    if (localMode) {
      setStatus(detailStatus, '已通过，正在更新展示站…');
      deployNote = await updateShowcase();
    }

    state.pending = state.pending.filter(entry => entry.id !== item.id);
    state.pendingTotal = Math.max(0, state.pendingTotal - 1);
    showEmptyDetail();
    setStatus(globalStatus, `已发布 ${review.id} → ${review.companyId}${deployNote}`);
  } catch (error) {
    if (error.status === 401) {
      signOut('登录已失效，请重新登录。');
      return;
    }
    setStatus(detailStatus, describeError(error), true);
  } finally {
    setBusy(false);
  }
}

async function handleReject() {
  if (state.busy || !state.selected) return;
  const item = state.selected;
  const reason = window.prompt('填写拒绝原因（会写入审计日志）');
  if (reason === null) return;
  if (!reason.trim()) {
    setStatus(detailStatus, '拒绝原因不能为空', true);
    return;
  }

  setBusy(true);
  setStatus(detailStatus, '正在拒绝…');
  try {
    await state.api.reject(item.id, { reason: reason.trim() });
    state.pending = state.pending.filter(entry => entry.id !== item.id);
    state.pendingTotal = Math.max(0, state.pendingTotal - 1);
    showEmptyDetail();
    setStatus(globalStatus, `已拒绝 ${item.raw.submissionId}`);
  } catch (error) {
    if (error.status === 401) {
      signOut('登录已失效，请重新登录。');
      return;
    }
    setStatus(detailStatus, describeError(error), true);
  } finally {
    setBusy(false);
  }
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  signIn(tokenInput.value.trim());
});

async function deploySite() {
  if (state.busy) return;
  deployButton.disabled = true;
  setStatus(globalStatus, '正在更新展示站…');
  try {
    const response = await fetch('/api/local/deploy', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || `HTTP ${response.status}`);
    setStatus(globalStatus, '展示站已更新');
  } catch (error) {
    setStatus(globalStatus, `展示站未更新：${error.message}`, true);
  } finally {
    deployButton.disabled = false;
  }
}

deployButton.hidden = !localMode;
deployButton.addEventListener('click', deploySite);

logoutButton.addEventListener('click', () => signOut());
refreshButton.addEventListener('click', async () => {
  if (!state.client || state.busy) return;
  refreshButton.disabled = true;
  try {
    await loadData();
    setStatus(globalStatus, `已刷新，共 ${state.pendingTotal} 条待审提交`);
  } catch (error) {
    setStatus(globalStatus, describeError(error), true);
  } finally {
    refreshButton.disabled = false;
  }
});

filterInput.addEventListener('input', renderList);
tabPending.addEventListener('click', () => setTab('pending'));
tabStaged.addEventListener('click', () => setTab('staged'));
stageButton.addEventListener('click', handleStage);
publishBatchButton.addEventListener('click', publishStaged);
reviewForm.addEventListener('submit', handleApprove);
rejectButton.addEventListener('click', handleReject);

newCompanyName.addEventListener('input', () => {
  if (matchCompanyByName()) return;
  syncCompanyFields();
});
newCompanySlug.addEventListener('input', () => {
  newCompanySlug.dataset.touched = '1';
  if (newCompanyId.dataset.touched === '1') return;
  newCompanyId.value = newCompanySlug.value ? `c_${newCompanySlug.value}` : 'c_';
});
newCompanyId.addEventListener('input', () => { newCompanyId.dataset.touched = '1'; });
newProjectName.addEventListener('input', () => {
  if (matchProjectByName()) return;
  syncProjectId();
});
newProjectId.addEventListener('input', () => { newProjectId.dataset.touched = '1'; });

const savedToken = sessionStorage.getItem(TOKEN_KEY);
if (savedToken) signIn(savedToken, { silent: true });
