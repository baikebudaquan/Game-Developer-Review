function setupFeatured(feature: HTMLElement) {
  const slides = Array.from(feature.querySelectorAll<HTMLElement>('[data-slide]'));
  const dots = Array.from(feature.querySelectorAll<HTMLButtonElement>('[data-dot]'));
  const stage = feature.querySelector<HTMLElement>('.feature-stage')!;
  const resetImages: (()=>void)[] = [];
  let current = 0;
  slides.forEach(slide => {
    const image = slide.querySelector<HTMLImageElement>('[data-cover-image]');
    const previews = Array.from(slide.querySelectorAll<HTMLButtonElement>('[data-preview]'));
    if (!image) { resetImages.push(()=>{}); return; }
    const cover = image.getAttribute('src')!;
    let selected = '';
    function show(src: string) {
      image!.src = src || cover;
      slide.classList.toggle('show-scene', Boolean(src));
      previews.forEach(b=>b.classList.toggle('previewing', Boolean(src) && b.dataset.preview===src));
    }
    function reset() {
      selected = ''; show('');
      previews.forEach(b=>b.setAttribute('aria-pressed','false'));
    }
    resetImages.push(reset);
    previews.forEach(b => {
      const src=b.dataset.preview!;
      b.setAttribute('aria-pressed','false');
      b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch') show(src);});
      b.addEventListener('pointerleave',()=>show(selected));
      b.addEventListener('focus',()=>show(src));
      b.addEventListener('blur',()=>show(selected));
      b.addEventListener('click',()=>{
        selected=selected===src?'':src; show(selected);
        previews.forEach(other=>other.setAttribute('aria-pressed',String(other.dataset.preview===selected)));
      });
      b.addEventListener('keydown',e=>{if(e.key==='Escape') reset();});
    });
  });
  if(slides.length<2) return;
  const rotate = feature.querySelector<HTMLButtonElement>('[data-rotate]')!;
  let automatic = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = 0;
  function schedule() {
    window.clearTimeout(timer);
    rotate.textContent = automatic ? 'Ⅱ' : '▶';
    rotate.title = automatic ? '暂停自动轮播' : '开启自动轮播';
    rotate.setAttribute('aria-label', rotate.title);
    if (!automatic || document.hidden || feature.hidden || feature.matches(':hover') || feature.contains(document.activeElement)) return;
    timer = window.setTimeout(()=>go(current+1),8000);
  }
  function go(next: number) {
    resetImages[current](); current=(next+slides.length)%slides.length;
    slides.forEach((s,i)=>{s.hidden=i!==current;});
    dots.forEach((b,i)=>{if(i===current) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current');});
    schedule();
  }
  rotate.addEventListener('click',()=>{automatic=!automatic; schedule();});
  feature.addEventListener('pointerenter',()=>window.clearTimeout(timer));
  feature.addEventListener('pointerleave',schedule);
  feature.addEventListener('focusin',()=>window.clearTimeout(timer));
  feature.addEventListener('focusout',()=>queueMicrotask(schedule));
  document.addEventListener('visibilitychange',schedule);
  new MutationObserver(schedule).observe(feature,{attributes:true,attributeFilter:['hidden']});
  schedule();
  feature.querySelector('[data-prev]')!.addEventListener('click',()=>go(current-1));
  feature.querySelector('[data-next]')!.addEventListener('click',()=>go(current+1));
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));
  feature.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault(); go(current+(e.key==='ArrowLeft'?-1:1)); dots[current].focus();
  });
  let start: {x:number;y:number}|undefined;
  let suppressClick=false;
  stage.addEventListener('touchstart',e=>{
    const t=e.touches[0]; start=e.touches.length===1?{x:t.clientX,y:t.clientY}:undefined; suppressClick=false;
  },{passive:true});
  stage.addEventListener('touchcancel',()=>{start=undefined;});
  stage.addEventListener('touchend',e=>{
    if(!start) return;
    const t=e.changedTouches[0], dx=t.clientX-start.x, dy=t.clientY-start.y;
    if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4) {
      go(current+(dx<0?1:-1)); suppressClick=true;
      window.setTimeout(()=>{suppressClick=false;},400);
    }
    start=undefined;
  },{passive:true});
  stage.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}},{capture:true});
}

export function setupDiscovery() {
  const home=document.querySelector<HTMLElement>('.discover-home')!;
  if(location.hash==='#arcade-title'){location.replace(home.dataset.arcadeUrl!);return;}
  const feature=home.querySelector<HTMLElement>('[data-featured]');
  if(feature) setupFeatured(feature);
  const box=home.querySelector<HTMLElement>('[data-project-search]')!;
  const input=box.querySelector<HTMLInputElement>('input')!;
  const clear=box.querySelector<HTMLButtonElement>('[data-clear]')!;
  const menu=box.querySelector<HTMLElement>('.search-menu')!;
  const links=Array.from(menu.querySelectorAll<HTMLAnchorElement>('[data-search]'));
  const tiles=Array.from(home.querySelectorAll<HTMLAnchorElement>('[data-project]'));
  const status=home.querySelector<HTMLElement>('[data-search-status]')!;
  function update(open: boolean) {
    const query=input.value.trim().normalize('NFKC').toLocaleLowerCase();
    let count=0;
    for(const tile of tiles){tile.hidden=!tile.dataset.project!.includes(query); if(!tile.hidden) count++;}
    clear.hidden=!query;
    if(feature) feature.hidden=Boolean(query);
    home.querySelector<HTMLElement>('[data-library-title]')!.textContent=query?'项目搜索结果':'全部项目';
    home.querySelector<HTMLElement>('[data-result-count]')!.textContent=String(count);
    home.querySelector<HTMLElement>('[data-empty]')!.hidden=count!==0;
    const matches=links.filter(link=>link.dataset.search!.includes(query));
    // Prefer direct company or project name matches over a project matched via its parent company.
    const rank=(link:HTMLAnchorElement)=>{
      const name=link.dataset.name!.toLocaleLowerCase();
      if(name===query) return 0;
      if(name.startsWith(query)) return 1;
      if(name.includes(query)) return 2;
      return link.dataset.kind==='公司'?3:4;
    };
    matches.sort((a,b)=>rank(a)-rank(b));
    links.forEach(l=>{l.hidden=true;});
    matches.forEach(l=>{l.hidden=false;menu.append(l);});
    menu.querySelector<HTMLElement>('[data-no-suggestions]')!.hidden=matches.length!==0;
    menu.hidden=!query || !open;
    status.textContent=query?`匹配到 ${count} 个项目`:'';
  }
  const visibleLinks=()=>Array.from(menu.querySelectorAll<HTMLAnchorElement>('a:not([hidden])'));
  function reset(){input.value=''; update(false); input.focus();}
  clear.addEventListener('click',reset);
  home.querySelector('[data-reset]')!.addEventListener('click',reset);
  input.addEventListener('input',()=>update(true));
  input.addEventListener('focus',()=>update(true));
  box.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();input.focus();menu.hidden=true;return;}
    if(e.key==='Enter' && e.target===input && input.value.trim()){
      const first=visibleLinks()[0];if(first){e.preventDefault();first.click();}return;
    }
    if(!input.value.trim() || !['ArrowDown','ArrowUp'].includes(e.key))return;
    e.preventDefault();menu.hidden=false;
    const options=visibleLinks();if(!options.length)return;
    const i=options.indexOf(document.activeElement as HTMLAnchorElement);
    const next=e.key==='ArrowDown'?(i+1)%options.length:(i<=0?options.length-1:i-1);
    options[next].focus();
  });
  box.addEventListener('focusout',e=>{if(!box.contains(e.relatedTarget as Node|null))menu.hidden=true;});
  document.addEventListener('pointerdown',e=>{if(!box.contains(e.target as Node))menu.hidden=true;});
  update(false);
}
