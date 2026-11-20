import { createClient } from './lib/github.js';
import { createApi } from './lib/api.js';
import { config } from './config.js';
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
  slugify,
} from './lib/review.js';
import { publishReview } from './lib/publish.js';

const TOKEN_KEY = 'gdr.admin.token';

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
const detailEmpty = $('#detail-empty');
const reviewForm = $('#review-form');
const summaryEl = $('#submission-summary');
const companySelect = $('#company-select');
const projectSelect = $('#project-select');
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
  pending: [],
  pendingTotal: 0,
  selected: null,
  selectedId: null,
  reviewId: null,
  busy: false,
};

function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') element.className = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value);
  });
  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    element.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return element;
}

function setStatus(element, message, isError = false) {
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(isError));
}

function describeError(error) {
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

function renderList() {
  const query = filterInput.value.trim().toLowerCase();
  const items = state.pending.filter(item => {
    if (!query) return true;
    return `${item.view.company} ${item.view.project}`.toLowerCase().includes(query);
  });

  pendingList.replaceChildren();
  if (!items.length) {
    pendingList.append(h('p', { class: 'empty' }, query ? '没有匹配项' : '暂无待审提交'));
  }
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

  pendingCount.textContent = state.pendingTotal > state.pending.length
    ? `显示 ${state.pending.length} / 共 ${state.pendingTotal} 条`
    : `共 ${state.pending.length} 条`;
}

function toggleNewCompany() {
  newCompanyBox.hidden = companySelect.value !== '__new';
}

function toggleNewProject() {
  newProjectBox.hidden = projectSelect.value !== '__new';
}

function renderProjectOptions(company, projectName) {
  projectSelect.replaceChildren(h('option', { value: '__none' }, '不关联项目'));
  (company?.projects || []).forEach(project => {
    projectSelect.append(h('option', { value: project.id }, `${project.name}（${project.id}）`));
  });
  projectSelect.append(h('option', { value: '__new' }, '＋ 新建项目'));

  const matched = company?.projects.find(project => project.name === projectName);
  projectSelect.value = matched ? matched.id : (projectName ? '__new' : '__none');

  newProjectName.value = projectSelect.value === '__new' ? projectName : '';
  newProjectId.value = '';
  newProjectStatus.value = 'unknown';
  toggleNewProject();
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

  const companies = [...state.companies.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  companySelect.replaceChildren(
    ...companies.map(company => h('option', { value: company.id }, `${company.name}（${company.id}）`)),
    h('option', { value: '__new' }, '＋ 新建公司'),
  );

  const hinted = view.companyId ? state.companies.get(view.companyId) : null;
  const matched = hinted || findCompany(view.company);
  companySelect.value = matched ? matched.id : '__new';
  toggleNewCompany();

  newCompanyName.value = view.company || '';
  newCompanySlug.value = slugify(view.company);
  newCompanyId.dataset.touched = '';
  newCompanyId.value = newCompanySlug.value ? `c_${newCompanySlug.value}` : 'c_';

  renderProjectOptions(matched, view.project);
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
  rejectButton.disabled = busy;
  approveButton.textContent = busy ? '处理中…' : '通过并发布';
}

async function loadData() {
  const { client, api } = state;
  setStatus(globalStatus, '正在加载数据…');

  const [taxonomyFile, companyTree, pendingResult] = await Promise.all([
    client.getFile(config.owner, config.publicRepo, config.taxonomyPath, config.publicBranch),
    client.getTree(config.owner, config.publicRepo, config.publicBranch),
    api.listPending(config.maxPending),
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

async function handleApprove(event) {
  event.preventDefault();
  if (state.busy || !state.selected) return;

  const item = state.selected;
  setBusy(true);
  setStatus(detailStatus, '正在发布…');

  try {
    const projectChoice = projectSelect.value;
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
    if (companySelect.value === '__new') {
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
      const base = state.companies.get(companySelect.value);
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

    const review = buildReview(draft);
    await publishReview({ client: state.client, config, review, company });
    try {
      await state.api.approve(item.id, { reviewId: review.id, companyId: company.id });
    } catch (error) {
      throw new Error(`已写入公开仓 ${review.id}，但审核状态记录失败，请重试「通过并发布」。${error.message}`);
    }

    let deployNote = '';
    if (localMode) {
      setStatus(detailStatus, '已通过，正在更新展示站…');
      try {
        const response = await fetch('/api/local/deploy', { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        deployNote = data.ok ? '；展示站已更新' : `；展示站未更新：${data.message || `HTTP ${response.status}`}`;
      } catch (error) {
        deployNote = `；展示站未更新：${error.message}`;
      }
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
companySelect.addEventListener('change', () => {
  toggleNewCompany();
  renderProjectOptions(state.companies.get(companySelect.value) || null, '');
});
projectSelect.addEventListener('change', toggleNewProject);
reviewForm.addEventListener('submit', handleApprove);
rejectButton.addEventListener('click', handleReject);

newCompanySlug.addEventListener('input', () => {
  if (newCompanyId.dataset.touched === '1') return;
  newCompanyId.value = newCompanySlug.value ? `c_${newCompanySlug.value}` : 'c_';
});
newCompanyId.addEventListener('input', () => { newCompanyId.dataset.touched = '1'; });

const savedToken = sessionStorage.getItem(TOKEN_KEY);
if (savedToken) signIn(savedToken, { silent: true });
