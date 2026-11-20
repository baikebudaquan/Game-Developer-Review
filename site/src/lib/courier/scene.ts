import { duration, ground, height, runnerX, speed, width, type Run } from './game';

const fox = [
  '    nn      nn    ',
  '    non    non    ',
  '    noonnnnoon    ',
  '     nooooounnn   ',
  '    nntttttttttn  ',
  '    nttttttttnn   ',
  '    noooowown     ',
  '    noooowknwwn   ',
  '     nowwwwwkn    ',
  ' nn  nnrrrrnn     ',
  'nwonnttttrrrnn    ',
  ' nwoonttbbbtn     ',
  '  noonttbybtn     ',
  '   nnnnnbbbnn     ',
  '      nnkkkn      ',
];
const inks: Record<string,string> = { n:'#2b263c',o:'#ec975b',u:'#fec581',t:'#56b6ad',w:'#ffdfaa',k:'#392f4b',r:'#fa6d56',b:'#9e5d4b',y:'#ffd57c' };
const stars = [[12,18],[43,38],[67,10],[77,31],[98,19],[112,7],[150,25],[162,12],[184,33],[199,9],[222,17],[247,8],[270,35],[301,16],[329,9],[365,25],[374,14]];

export function drawScene(ctx: CanvasRenderingContext2D, run: Run, idle: boolean, total: number) {
  const rect = (x:number,y:number,w:number,h:number,color:string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const distance = run.time * speed;
  const loop = (offset:number,period:number,draw:(x:number,i:number)=>void) => {
    const first = Math.floor(offset/period);
    for (let i=first-1; i<=first+Math.ceil(width/period); i++) draw(i*period-offset, i);
  };
  const sky=ctx.createLinearGradient(0,0,0,86);
  sky.addColorStop(0,'#534777'); sky.addColorStop(.57,'#a473a2'); sky.addColorStop(1,'#f1b29a');
  ctx.fillStyle=sky; ctx.fillRect(0,0,width,86);
  for (const [x,y] of stars) {
    rect(x,y,1,1,'#ffddc1');
    if (x%3===0) { rect(x-1,y,3,1,'#eed1cb'); rect(x,y-1,1,3,'#eed1cb'); }
  }
  // Stepped edges keep the moon, clouds and skyline on the same pixel grid.
  for (const [y,inset] of [5,3,2,1,1,0,0,0,0,0,1,1,2,3,5].entries())
    rect(278+inset,12+y,16-inset*2,1,y>9?'#ffc59d':'#ffe0af');
  loop(distance*.045,144,(x,i)=>{
    const y=29+Math.abs(i*7)%15;
    rect(x+19,y,25,2,'#e6a6ba'); rect(x+25,y-2,10,2,'#e6a6ba');
    rect(x+9,y+2,48,2,'#cc91b0'); rect(x+52,y+5,13,1,'#e4a7b7');
  });
  loop(distance*.11,23,(x,i)=>{
    const n=Math.abs(i*17+23)%31;
    const top=50+n;
    rect(x,top,22,ground-top,'#78628a'); rect(x+5,top-3,10,4,'#78628a');
    if (n%3===0) rect(x+8,top-11,1,9,'#78628a');
    for(let j=0;j<3;j++) rect(x+3+j*6,top+5,2,2,'#bf91a5');
  });
  loop(distance*.26,42,(x,i)=>{
    const n=Math.abs(i*13+5)%24, top=60+n;
    rect(x+3,top,34,ground-top,'#514667'); rect(x+1,top-2,38,3,'#625272');
    rect(x+9,top-6,9,5,'#514667');
    for(let row=0;row<3;row++) for(let col=0;col<4;col++) {
      rect(x+7+col*7,top+5+row*7,4,3,(col+row+i)%3===0?'#efb686':'#816b89');
    }
  });
  loop(distance*.5,145,(x)=>{
    rect(x+14,53,2,50,'#3d3956'); rect(x+8,57,16,2,'#3d3956');
    for(let k=0;k<29;k++) rect(x+15+k*5,55+Math.round(7*Math.sin(k/29*Math.PI)),5,1,'#544b6c');
  });
  loop(distance*.68,111,(x,i)=>{
    if(Math.abs(i)%2===0) {
      rect(x+18,76,2,26,'#3b354d'); rect(x+18,74,9,2,'#463d53');
      rect(x+24,76,5,2,'#f6c58a'); rect(x+24,78,5,1,'#ce9f86');
    }
  });
  rect(0,ground-6,width,6,'#3c384e');
  loop(distance*.65,20,x=>{ rect(x,ground-9,2,7,'#3a374f'); rect(x,ground-8,21,1,'#544965'); });
  const officeX=idle ? 307 : runnerX+(duration-run.time)*speed;
  if (officeX < width+12) {
    rect(officeX,73,50,31,'#343349'); rect(officeX+3,70,45,4,'#55506b');
    rect(officeX-2,75,54,3,'#e39a77'); rect(officeX+4,79,42,3,'#56a99d');
    for(let i=0;i<6;i++) rect(officeX+4+(i%3)*8,85+Math.floor(i/3)*7,5,5,i<Math.floor(total/5)?'#ffe3a1':'#937d92');
    rect(officeX+32,84,11,20,'#695a71'); rect(officeX+34,86,7,10,'#f3c798');
    rect(officeX+40,98,1,2,'#f4c894'); rect(officeX+4,67,11,3,'#524765');
  }
  rect(0,ground,width,2,'#f1bd96'); rect(0,ground+2,width,3,'#ab8393');
  rect(0,ground+5,width,height-ground-5,'#493d5a');
  loop(distance,26,(x,i)=>{
    rect(x,ground+2,1,3,'#775c78'); rect(x+6,ground+8,11,1,'#6d5670');
    if(i%2===0) rect(x+17,ground+16,5,1,'#68526c');
  });
  for (const item of run.items) {
    if (item.used) continue;
    const x = item.x-distance;
    if (x < -16 || x > width+16) continue;
    if (item.kind === 'barrier') {
      rect(x-6,ground-14,13,8,'#46344e'); rect(x-5,ground-13,11,5,'#f19b64');
      rect(x-4,ground-13,2,4,'#ffe3ad'); rect(x+2,ground-13,2,4,'#ffe3ad');
      rect(x-5,ground-6,2,6,'#49394c'); rect(x+4,ground-6,2,6,'#49394c');
    } else {
      const y=ground-item.y+Math.round(Math.sin(run.time*5+item.x)*1.5);
      rect(x-4,y-3,9,7,'#684d61'); rect(x-3,y-3,7,5,'#fff0c6');
      rect(x-2,y-2,2,1,'#d59679'); rect(x,y-1,2,1,'#d59679'); rect(x+2,y-2,1,1,'#d59679');
    }
  }
  const scale=1.25, px=runnerX-15, py=ground-24-run.lift;
  if (run.shield) {
    ctx.strokeStyle='#abf2db'; ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(runnerX-3,ground-run.lift-11,14,13,0,0,2*Math.PI);ctx.stroke();
  }
  if (!run.flash || Math.floor(run.flash*14)%2===0) {
    const stride=run.lift>0?2:Math.floor(run.time*10)%2*3;
    const body=(x:number,y:number,w:number,h:number,color:string)=>rect(
      px+Math.round(x*scale),py+Math.round(y*scale),
      Math.round((x+w)*scale)-Math.round(x*scale),Math.round((y+h)*scale)-Math.round(y*scale),color);
    fox.forEach((row,y)=>[...row].forEach((pixel,x)=>{ if(inks[pixel]) body(x,y,1,1,inks[pixel]); }));
    body(7-stride,15,4,3,'#332d45');body(6-stride,17,4,2,'#322b44');
    body(12+stride,15,3,3,'#443349');body(12+stride,17,4,2,'#322b44');
  }
  if (run.flash>.12) {
    ctx.font='bold 8px monospace'; ctx.fillStyle=run.blocked?'#b6ffed':'#fff1c8';
    ctx.fillText(run.blocked?'◇':'!',Math.round(px+12),Math.round(py-3));
  }
  if (run.pickup) {
    const y=py-5-(.28-run.pickup)*14;rect(px+10,y,5,1,'#fff1b3');rect(px+12,y-2,1,5,'#fff1b3');
  }
}
