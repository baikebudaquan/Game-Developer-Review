import { duration, jump, newRun, step, type Powers } from './game';
import { drawScene } from './scene';

type Mode = 'idle' | 'running' | 'paused' | 'finished';
interface RecordBook { pages: number; best: number }
const recordKey = 'gdr.night-courier.v1';

export function mountCourier(root: HTMLElement) {
  const el = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const field = el<HTMLButtonElement>('[data-field]');
  const action = el<HTMLButtonElement>('[data-action]');
  const pauseButton = el<HTMLButtonElement>('[data-pause]');
  const guide = el('[data-guide]'), notice = el('[data-notice]');
  const counter = el('[data-pages]'), timer = el('[data-time]');
  const dialog = el<HTMLDialogElement>('dialog');
  const ctx = el<HTMLCanvasElement>('canvas').getContext('2d');
  if (!ctx) {
    guide.textContent = '当前浏览器无法绘制游戏画面。';
    action.disabled = field.disabled = true;
    return;
  }
  const keys = new Set(root.dataset.powers?.split(','));
  const powers: Powers = { magnet: keys.has('magnet'), doubleJump: keys.has('doubleJump'), shield: keys.has('shield') };
  let mode: Mode='idle', run=newRun(powers);
  let frame=0, previous=0;
  let local=true, book:RecordBook = {pages:0,best:0};

  function readBook(): RecordBook {
    try {
      const saved=JSON.parse(localStorage.getItem(recordKey) || 'null');
      if (saved && [saved.pages,saved.best].every(n=>Number.isSafeInteger(n) && n>=0)) return saved;
    } catch { /* Use the current page's record if storage is unavailable. */ }
    return book;
  }
  function showBook() {
    const lit=Math.min(6,Math.floor(book.pages/5));
    el('[data-office]').textContent = `${local?'本机':'本次'}投递 ${book.pages} 页 · 最佳 ${book.best} 页`;
    el('[data-light]').textContent = lit===6 ? '编辑部的六盏灯全亮了' : `再送 ${5-book.pages%5} 页点亮一盏灯`;
    root.querySelectorAll('.office-windows i').forEach((lamp,i)=>lamp.classList.toggle('lit',i<lit));
  }
  function render() {
    drawScene(ctx!,run,mode==='idle',book.pages);
    counter.textContent=String(run.pages).padStart(2,'0');
    timer.textContent=String(Math.ceil(duration-run.time)).padStart(2,'0');
  }
  function syncUI() {
    const playing=mode==='running', paused=mode==='paused', done=mode==='finished';
    action.textContent=playing?'↑ 跳跃':paused?'▶ 继续投递':done?'↻ 再投一趟':'▶ 开始投递';
    pauseButton.hidden=!playing;
    notice.hidden=!paused && !done;
    notice.textContent=paused?'投递暂停':done?`手记已送达 · ${run.pages} 页`:'';
    const instruction=`空格、↑ 或点画面跳跃${powers.doubleJump?'，空中再点可二段跳':''}。撞上路障掉 1 页。`;
    guide.textContent=playing?instruction:paused?'准备好后点「继续投递」。':done?'沿途收起的手记已经送到编辑部。':'点按或按空格跳过路障，把沿途的手记送到编辑部。';
    field.setAttribute('aria-label',playing?'跳跃':action.textContent);
    el('[data-announce]').textContent=done?notice.textContent:guide.textContent;
  }
  function finish() {
    mode='finished';
    const delivered=run.pages;
    const save=()=>{
      const prior=readBook();
      book={pages:prior.pages+delivered,best:Math.max(prior.best,delivered)};
      try { localStorage.setItem(recordKey,JSON.stringify(book)); }
      catch { local=false; }
      showBook();
      render();
    };
    if (navigator.locks) void navigator.locks.request(recordKey,save).catch(save);
    else save();
    syncUI();
  }
  function tick(now: number) {
    if (mode!=='running') return;
    // Limit catch-up after a stalled frame; simulate small steps so collisions stay consistent.
    let dt=Math.min(.08,Math.max(0,(now-previous)/1000));
    previous=now;
    while (dt>0 && run.time<duration) {
      const part=Math.min(dt,1/120);
      step(run,part,powers);
      dt-=part;
    }
    render();
    if (run.time>=duration) finish();
    else frame=requestAnimationFrame(tick);
  }
  function act() {
    if (mode==='running') { jump(run,powers); return; }
    if (mode!=='paused') run=newRun(powers);
    mode='running'; previous=performance.now();
    syncUI(); render();
    field.focus({preventScroll:true});
    frame=requestAnimationFrame(tick);
  }
  function pause() {
    if (mode!=='running') return;
    cancelAnimationFrame(frame); mode='paused'; syncUI();
  }
  field.addEventListener('click',act);
  action.addEventListener('click',act);
  field.addEventListener('keydown',e=>{
    if (['Space','ArrowUp','Enter'].includes(e.code)) {
      e.preventDefault(); if (!e.repeat) act();
    } else if (e.code==='Escape' || e.code==='KeyP') {
      e.preventDefault();
      if (!e.repeat) { if (mode==='paused') act(); else pause(); }
    }
  });
  pauseButton.addEventListener('click',()=>{pause(); action.focus();});
  el('[data-open]').addEventListener('click',()=>{pause(); dialog.showModal();});
  el('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if (e.target===dialog) {
    const box=dialog.getBoundingClientRect();
    if (e.clientX<box.left || e.clientX>box.right || e.clientY<box.top || e.clientY>box.bottom) dialog.close();
  }});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pause();});
  window.addEventListener('blur',pause);
  root.addEventListener('focusout',e=>{if(e.relatedTarget && !root.contains(e.relatedTarget as Node)) pause();});
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry])=>{if(!entry.isIntersecting) pause();}).observe(field);
  }
  window.addEventListener('storage',e=>{if(e.key===recordKey){ book=readBook(); showBook(); }});
  book=readBook(); showBook(); render();
}
