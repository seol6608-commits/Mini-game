'use strict';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const rand = (min,max) => Math.random()*(max-min)+min;
const randInt = (min,max) => Math.floor(rand(min,max+1));
const shuffle = arr => { for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

const STORE_PREFIX = document.body.classList.contains('s24-mode') ? 'ma_s24_' : 'ma_';
const KEYS = {
  played:STORE_PREFIX+'played',
  difficulty:STORE_PREFIX+'difficulty',
  r2048:STORE_PREFIX+'2048_best', snake:STORE_PREFIX+'snake_best', brick:STORE_PREFIX+'brick_best', stack:STORE_PREFIX+'stack_best',
  mines:STORE_PREFIX+'mines_best', dodge:STORE_PREFIX+'dodge_best', memory:STORE_PREFIX+'memory_best'
};
const DIFFICULTIES = {
  easy:{label:'쉬움'},
  normal:{label:'보통'},
  hard:{label:'어려움'}
};
let difficulty = localStorage.getItem(KEYS.difficulty) || 'normal';
if(!DIFFICULTIES[difficulty]) difficulty='normal';
const recordKey = k => k.endsWith('_best') ? `${k}_${difficulty}` : k;
const getNum = (k,d=0) => {
  const scoped=localStorage.getItem(recordKey(k));
  const legacy=difficulty==='normal'&&k.endsWith('_best')?localStorage.getItem(k):null;
  return Number(scoped ?? legacy ?? d) || d;
};
const setNum = (k,v) => localStorage.setItem(recordKey(k),String(v));

const app = $('#app');
const homeScreen = $('#homeScreen');
const gameScreen = $('#gameScreen');
const gameGrid = $('#gameGrid');
const screenTitle = $('#screenTitle');
const gameKicker = $('#gameKicker');
const gameName = $('#gameName');
const gameHelp = $('#gameHelp');
const gameStats = $('#gameStats');
const gameStage = $('#gameStage');
const homeBtn = $('#homeBtn');
const pauseBtn = $('#pauseBtn');
const playedCount = $('#playedCount');
const toast = $('#toast');

let activeGame = null;
let paused = false;
let cleanupActive = () => {};
let toastTimer = null;
let sessionPlayed = getNum(KEYS.played,0);
playedCount.textContent = sessionPlayed;

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove('show'),1400);
}
function stat(label,value,id=''){
  return `<div class="stat"><small>${label}</small><strong ${id?`id="${id}"`:''}>${value}</strong></div>`;
}
function setStats(html){ gameStats.innerHTML=html; }
function addPlayed(){ sessionPlayed++; setNum(KEYS.played,sessionPlayed); playedCount.textContent=sessionPlayed; }
function setRecord(id,text){ const el=document.querySelector(`[data-record="${id}"]`); if(el) el.textContent=text; }
function canvasScale(canvas, cssW, cssH){
  const dpr = Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(cssW*dpr); canvas.height=Math.round(cssH*dpr);
  canvas.style.aspectRatio=`${cssW}/${cssH}`;
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); return ctx;
}

const games = [
  {id:'g2048', icon:'2048', name:'2048 Mini', desc:'스와이프로 같은 숫자를 합치기', record:()=>`${getNum(KEYS.r2048)} pts`, kicker:'PUZZLE', help:'보드를 스와이프해서 같은 숫자를 합치세요. 2048 이후에도 계속 플레이할 수 있습니다.'},
  {id:'snake', icon:'S', name:'Snake', desc:'먹이를 먹고 길어지는 클래식 스네이크', record:()=>`${getNum(KEYS.snake)} pts`, kicker:'ARCADE', help:'화면 스와이프 또는 방향 버튼으로 이동하세요. 자기 몸이나 벽에 닿으면 끝납니다.'},
  {id:'brick', icon:'▰', name:'Brick Breaker', desc:'제한 시간 안에 벽돌을 최대한 깨기', record:()=>`${getNum(KEYS.brick)} pts`, kicker:'ARCADE', help:'손가락을 좌우로 움직여 패들을 조작하세요. 난이도에 따라 시간·목숨·벽돌 수가 달라집니다.'},
  {id:'stack', icon:'▥', name:'Stack Tower', desc:'움직이는 블록을 정확히 쌓기', record:()=>`${getNum(KEYS.stack)} 층`, kicker:'TIMING', help:'화면을 탭해 움직이는 블록을 내려놓으세요. 겹치지 않은 부분은 잘려 나갑니다.'},
  {id:'mines', icon:'✦', name:'Minesweeper', desc:'8×8 보드에서 지뢰 찾기', record:()=>{const v=getNum(KEYS.mines);return v?`${v.toFixed(1)} s`:'—';}, kicker:'PUZZLE', help:'터치하면 칸을 열고, 깃발 모드 또는 길게 누르기로 지뢰를 표시하세요. 난이도에 따라 지뢰 수가 달라집니다.'},
  {id:'dodge', icon:'◇', name:'Dodge', desc:'내려오는 장애물을 오래 피하기', record:()=>`${getNum(KEYS.dodge)} pts`, kicker:'SURVIVAL', help:'손가락을 좌우로 드래그해 플레이어를 움직이세요. 시간이 지날수록 장애물이 빨라집니다.'},
  {id:'memory', icon:'?', name:'Memory', desc:'카드의 같은 짝 맞추기', record:()=>{const v=getNum(KEYS.memory);return v?`${v} moves`:'—';}, kicker:'MEMORY', help:'카드 두 장씩 열어서 같은 기호를 모두 맞추세요. 난이도에 따라 카드 수가 달라집니다.'}
];

function renderHome(){
  gameGrid.innerHTML = games.map(g=>`<button class="game-card" type="button" data-game="${g.id}">
    <span class="card-record" data-record="${g.id}">${g.record()}</span>
    <span class="game-icon">${g.icon}</span>
    <span><h3>${g.name}</h3><p>${g.desc}</p></span>
  </button>`).join('');
  $$('.game-card',gameGrid).forEach(b=>b.addEventListener('click',()=>openGame(b.dataset.game)));
}
renderHome();

function renderDifficulty(){
  $$('[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));
}
$$('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{
  difficulty=b.dataset.difficulty;
  localStorage.setItem(KEYS.difficulty,difficulty);
  renderDifficulty();
  games.forEach(g=>setRecord(g.id,g.record()));
  showToast(`난이도 · ${DIFFICULTIES[difficulty].label}`);
}));
renderDifficulty();

function openGame(id){
  cleanupActive(); cleanupActive=()=>{};
  paused=false; pauseBtn.textContent='Ⅱ';
  activeGame=id;
  const meta=games.find(g=>g.id===id);
  screenTitle.textContent=meta.name;
  gameKicker.textContent=`${meta.kicker} · ${DIFFICULTIES[difficulty].label}`;
  gameName.textContent=meta.name;
  gameHelp.textContent=meta.help;
  homeScreen.classList.remove('active'); gameScreen.classList.add('active');
  homeBtn.classList.remove('hidden'); pauseBtn.classList.remove('hidden');
  gameStage.innerHTML=''; setStats('');
  addPlayed();
  ({g2048:init2048,snake:initSnake,brick:initBrick,stack:initStack,mines:initMines,dodge:initDodge,memory:initMemory}[id])();
}
function goHome(){
  cleanupActive(); cleanupActive=()=>{}; activeGame=null; paused=false;
  gameScreen.classList.remove('active'); homeScreen.classList.add('active');
  homeBtn.classList.add('hidden'); pauseBtn.classList.add('hidden'); screenTitle.textContent='MINI ARCADE';
  games.forEach(g=>setRecord(g.id,g.record()));
}
homeBtn.addEventListener('click',goHome);
pauseBtn.addEventListener('click',()=>{
  if(!activeGame) return;
  paused=!paused; pauseBtn.textContent=paused?'▶':'Ⅱ';
  showToast(paused?'일시정지':'계속');
});
document.addEventListener('visibilitychange',()=>{ if(document.hidden && activeGame && !paused){ paused=true; pauseBtn.textContent='▶'; } });

/* ---------- 2048 ---------- */
function init2048(){
  let board=Array(16).fill(0),score=0,won=false,history=[],mode='none',autoTimer=null,autoOn=false,autoLast=0,autoBudget=0;
  setStats(stat('SCORE','0','s2048')+stat('BEST',getNum(KEYS.r2048),'b2048Best'));
  gameStage.innerHTML=`<div class="g2048-wrap"><div id="b2048" class="g2048-board" aria-label="2048 보드"></div>
    <div class="swipe-pad" aria-label="방향 조작"><span class="blank"></span><button data-dir="up">▲</button><span class="blank"></span><button data-dir="left">◀</button><button data-dir="down">▼</button><button data-dir="right">▶</button></div>
    <div class="button-row"><button id="reset2048" class="secondary-btn" type="button">새 게임</button><button id="undo2048" class="secondary-btn" type="button">↶ 되돌리기</button><button id="toggleCheats2048" class="secondary-btn" type="button">치트 메뉴</button></div>
    <div id="cheats2048" class="cheats2048" hidden>
      <div class="cheat-row"><label for="tileValue2048">타일 숫자</label><select id="tileValue2048">${Array.from({length:20},(_,i)=>`<option value="${2**(i+1)}" ${i===0?'selected':''}>${2**(i+1)}</option>`).join('')}</select></div>
      <div class="cheat-row"><button data-editmode="spawn" type="button">숫자 생성</button><button data-editmode="delete" type="button">타일 삭제</button><button data-editmode="edit" type="button">숫자 변경</button><button data-editmode="none" type="button">편집 종료</button></div>
      <p id="editHint2048" class="cheat-hint">타일 편집 기능을 선택하세요.</p>
      <div class="cheat-row"><label for="scoreInput2048">점수 변경</label><input id="scoreInput2048" type="number" min="0" step="1" value="0"><button id="applyScore2048" type="button">적용</button></div>
      <div class="cheat-row"><label for="autoSpeed2048">자동 플레이 배속</label><select id="autoSpeed2048"><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option><option value="20">20×</option><option value="50">50×</option><option value="100">100×</option><option value="200">200×</option><option value="500">500×</option></select><button id="autoToggle2048" type="button">자동 시작</button></div>
      <label class="cheat-check"><input id="scaleSpawn2048" type="checkbox" checked> 점수에 따라 낮은 숫자 생성 중단</label><p id="spawnFloor2048" class="cheat-hint"></p><label class="cheat-check"><input id="noGameOver2048" type="checkbox"> 게임 오버 방지 (막히면 공간 확보)</label>
    </div></div>`;
  const el=$('#b2048'),panel=$('#cheats2048'),fourChance={easy:.02,normal:.10,hard:.24}[difficulty];
  const snapshot=()=>{history.push({board:board.slice(),score,won});};
  const minSpawn=()=>{const thresholds=[0,2000,8000,30000,100000,350000,1000000,3000000,10000000,30000000,100000000];let level=0;for(let i=0;i<thresholds.length;i++)if(score>=thresholds[i])level=i;return 2**(level+1);};
  const addTile=()=>{const free=board.map((v,i)=>v?null:i).filter(v=>v!==null);if(free.length)board[free[randInt(0,free.length-1)]]=($('#scaleSpawn2048').checked?minSpawn():2)*(Math.random()<1-fourChance?1:2);};
  const canMove=(b=board)=>{if(b.includes(0))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){const v=b[r*4+c];if(c<3&&v===b[r*4+c+1])return true;if(r<3&&v===b[(r+1)*4+c])return true;}return false;};
  const render=()=>{el.innerHTML=board.map((v,i)=>`<div data-index="${i}" class="g2048-cell ${v?`v${Math.min(v,2048)}`:''} ${mode!=='none'?'cheat-editable':''}">${v||''}</div>`).join('');$('#s2048').textContent=score;const best=Math.max(getNum(KEYS.r2048),score);setNum(KEYS.r2048,best);$('#b2048Best').textContent=best;$('#scoreInput2048').value=score;$('#undo2048').disabled=!history.length;$('#spawnFloor2048').textContent='현재 자동 생성 최소 숫자: '+($('#scaleSpawn2048').checked?minSpawn():2);$$('[data-editmode]',panel).forEach(btn=>btn.classList.toggle('cheat-selected',btn.dataset.editmode===mode));};
  const slideLine=line=>{let a=line.filter(Boolean),gained=0;for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;gained+=a[i];a.splice(i+1,1);}while(a.length<4)a.push(0);return[a,gained];};
  const simulate=(source,dir)=>{const result=source.slice();let gained=0;for(let i=0;i<4;i++){let idx=(dir==='left'||dir==='right')?[0,1,2,3].map(c=>i*4+c):[0,1,2,3].map(r=>r*4+i);if(dir==='right'||dir==='down')idx.reverse();const [vals,g]=slideLine(idx.map(k=>result[k]));gained+=g;idx.forEach((k,j)=>result[k]=vals[j]);}return {result,gained,changed:result.some((v,i)=>v!==source[i])};};
  const preventDeadlock=()=>{if(!canMove()&&$('#noGameOver2048').checked){const smallest=Math.min(...board);const choices=board.map((v,i)=>v===smallest?i:-1).filter(i=>i>=0);board[choices[randInt(0,choices.length-1)]]=0;showToast('게임 오버 방지: 공간 확보');}};
  const move=dir=>{if(paused)return false;const next=simulate(board,dir);if(!next.changed)return false;snapshot();board=next.result;score+=next.gained;addTile();preventDeadlock();render();if(!won&&board.some(v=>v>=2048)){won=true;showToast('2048 달성');}if(!canMove())showToast('게임 오버 · 되돌리기 또는 새 게임');return true;};
  const undo=()=>{if(!history.length)return;const prev=history.pop();board=prev.board;score=prev.score;won=prev.won;render();};
  const stopAuto=()=>{autoOn=false;clearInterval(autoTimer);autoTimer=null;autoBudget=0;$('#autoToggle2048').textContent='자동 시작';};
  // Expectimax: evaluate possible moves and random 2/4 spawns, not just immediate merges.
  const directions=['up','left','right','down'];
  const evaluateBoard=b=>{
    const logs=b.map(v=>v?Math.log2(v):0),empty=b.filter(v=>!v).length;
    const paths=[[0,1,2,3,7,6,5,4,8,9,10,11,15,14,13,12],[3,2,1,0,4,5,6,7,11,10,9,8,12,13,14,15],[12,13,14,15,11,10,9,8,4,5,6,7,3,2,1,0],[15,14,13,12,8,9,10,11,7,6,5,4,0,1,2,3]];
    const weights=[16,15,14,13,9,10,11,12,8,7,6,5,1,2,3,4];
    const snake=Math.max(...paths.map(path=>path.reduce((sum,idx,j)=>sum+logs[idx]*weights[j],0)));
    let smooth=0,merges=0;
    for(let i=0;i<16;i++){
      for(const j of [i%4<3?i+1:-1,i<12?i+4:-1])if(j>=0&&b[i]&&b[j]){
        smooth-=Math.abs(logs[i]-logs[j]);if(b[i]===b[j])merges++;
      }
    }
    const max=Math.max(...b),corners=[0,3,12,15];
    return snake*3.5+empty*125+smooth*7+merges*18+(corners.some(i=>b[i]===max)?Math.log2(max||1)*22:0);
  };
  // Bounded expectimax for every speed, including 500x. High speeds
  // retain chance-node lookahead instead of falling back to greedy moves.
  const expectimax=(b,depth,chance,ctx)=>{
    if(depth<=0)return evaluateBoard(b);
    const key=depth+':'+(chance?'C':'M')+':'+b.join(',');
    if(ctx.cache.has(key))return ctx.cache.get(key);
    let result;
    if(!chance){
      let best=-Infinity;
      for(const dir of directions){
        const m=simulate(b,dir);
        if(m.changed)best=Math.max(best,m.gained*0.8+expectimax(m.result,depth-1,true,ctx));
      }
      result=best===-Infinity?evaluateBoard(b)-1500:best;
    }else{
      const free=[];for(let i=0;i<16;i++)if(!b[i])free.push(i);
      if(!free.length)result=expectimax(b,depth-1,false,ctx);
      else{
        // Sample spatially distributed empty cells for a predictable budget.
        const count=Math.min(free.length,ctx.samples);
        const sample=[];
        for(let k=0;k<count;k++)sample.push(free[Math.floor((k+.5)*free.length/count)]);
        let total=0;
        for(const i of sample){
          b[i]=2;total+=(1-fourChance)*expectimax(b,depth-1,false,ctx);
          b[i]=4;total+=fourChance*expectimax(b,depth-1,false,ctx);b[i]=0;
        }
        result=total/count;
      }
    }
    if(ctx.cache.size<4000)ctx.cache.set(key,result);
    return result;
  };
  const autoStep=()=>{
    if(paused||mode!=='none')return;
    const options=directions.map(dir=>({dir,...simulate(board,dir)})).filter(x=>x.changed);
    if(!options.length){if($('#noGameOver2048').checked){snapshot();preventDeadlock();render();}else stopAuto();return;}
    const speed=Number($('#autoSpeed2048').value);
    // Adaptive search: 500x still forecasts tile spawns and subsequent moves.
    const depth=speed>=200?2:speed>=50?3:4;
    const samples=speed>=500?3:speed>=200?4:speed>=50?5:7;
    const ctx={samples,cache:new Map()};
    let best=null,bestValue=-Infinity;
    for(const option of options){
      const value=option.gained*0.8+expectimax(option.result,depth,true,ctx);
      if(value>bestValue){bestValue=value;best=option;}
    }
    if(best)move(best.dir);
  };
  const startAuto=()=>{
    stopAuto();mode='none';autoOn=true;$('#autoToggle2048').textContent='자동 정지';render();
    autoLast=performance.now();autoBudget=0;
    // Batch fast moves, with a bounded time slice to keep touch/UI responsive.
    autoTimer=setInterval(()=>{
      if(!autoOn)return;
      const now=performance.now(),elapsed=Math.min(now-autoLast,1000);autoLast=now;
      if(paused)return;
      const speed=Number($('#autoSpeed2048').value);
      autoBudget=Math.min(40,autoBudget+elapsed*speed/300);
      const start=performance.now();let steps=0;
      while(autoOn&&autoBudget>=1&&steps<40&&performance.now()-start<12){
        autoStep();autoBudget--;steps++;
      }
    },16);
  };
  const reset=()=>{stopAuto();board=Array(16).fill(0);score=0;won=false;history=[];mode='none';addTile();addTile();render();};
  $$('[data-dir]',gameStage).forEach(btn=>btn.addEventListener('click',()=>move(btn.dataset.dir)));
  $('#reset2048').addEventListener('click',reset);$('#undo2048').addEventListener('click',undo);
  $('#toggleCheats2048').addEventListener('click',()=>{panel.hidden=!panel.hidden;});
  $$('[data-editmode]',panel).forEach(btn=>btn.addEventListener('click',()=>{stopAuto();mode=btn.dataset.editmode;$('#editHint2048').textContent=mode==='none'?'일반 이동 모드':mode==='spawn'?'빈 칸을 터치해 숫자를 생성하세요.':mode==='delete'?'삭제할 타일을 터치하세요.':'변경할 타일을 터치하세요.';render();}));
  $('#applyScore2048').addEventListener('click',()=>{const value=Number($('#scoreInput2048').value);if(!Number.isSafeInteger(value)||value<0){showToast('0 이상의 정수 점수를 입력하세요.');return;}snapshot();score=value;render();});
  $('#autoToggle2048').addEventListener('click',()=>autoOn?stopAuto():startAuto());$('#autoSpeed2048').addEventListener('change',()=>{if(autoOn)startAuto();});
  $('#scaleSpawn2048').addEventListener('change',render);$('#noGameOver2048').addEventListener('change',()=>{if($('#noGameOver2048').checked&&!canMove()){snapshot();preventDeadlock();render();}});
  let sx=0,sy=0,tracking=false;
  const finishSwipe=(x,y)=>{if(!tracking)return;tracking=false;if(mode!=='none')return;const dx=x-sx,dy=y-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));};
  const editCell=i=>{
    if(mode==='none'||paused||i<0||i>15)return;
    const v=Number($('#tileValue2048').value);
    if(mode==='spawn'&&board[i]){showToast('빈 칸을 선택하세요.');return;}
    if(mode==='delete'&&!board[i]){showToast('삭제할 숫자 타일을 선택하세요.');return;}
    if(!['spawn','delete','edit'].includes(mode))return;
    snapshot();board[i]=mode==='delete'?0:v;preventDeadlock();render();
    $('#editHint2048').textContent=`${i+1}번 칸 ${mode==='delete'?'삭제':mode==='spawn'?'생성':'변경'} 완료 · 계속 다른 칸을 선택할 수 있습니다.`;
  };
  let suppressClick=false;
  const pd=e=>{tracking=true;sx=e.clientX;sy=e.clientY;};
  const pu=e=>{
    if(!tracking)return;
    const dx=e.clientX-sx,dy=e.clientY-sy;
    if(mode!=='none'&&Math.hypot(dx,dy)<16){
      const cell=e.target.closest('[data-index]');if(cell)editCell(Number(cell.dataset.index));
      suppressClick=true;
    }else finishSwipe(e.clientX,e.clientY);
    tracking=false;
  };
  el.addEventListener('pointerdown',pd);el.addEventListener('pointerup',pu);el.addEventListener('pointercancel',()=>tracking=false);
  el.addEventListener('click',e=>{if(suppressClick){suppressClick=false;return;}if(mode==='none')return;const cell=e.target.closest('[data-index]');if(cell)editCell(Number(cell.dataset.index));});
  const key=e=>{const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[e.key]&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();move(map[e.key]);}};document.addEventListener('keydown',key);
  reset();cleanupActive=()=>{stopAuto();document.removeEventListener('keydown',key);};
}

/* ---------- Other game cheat controls ---------- */
function gameCheats(rows){
 const box=document.createElement('section');box.className='cheats2048';box.style.marginTop='14px';
 box.innerHTML='<strong>치트 메뉴</strong><div class="cheat-row">'+rows.map(([id,label,kind])=>kind==='toggle'?`<label class="cheat-check"><input id="${id}" type="checkbox"> ${label}</label>`:`<button id="${id}" type="button">${label}</button>`).join('')+'</div>';
 gameStage.appendChild(box);return id=>document.getElementById(id);
}
// Game-specific speed control. Real-time games use bounded simulation steps.
function gameSpeedControl(){
 const box=document.createElement('div');box.className='cheat-row';box.style.marginTop='10px';
 box.innerHTML='<label for="gameSpeed">게임 배속</label><select id="gameSpeed">'+[1,2,5,10,20,50,100,200,500].map(v=>`<option value="${v}">${v}×</option>`).join('')+'</select>';
 gameStage.appendChild(box);
 const select=box.querySelector('select');
 return ()=>Number(select.value)||1;
}
function fastSim(elapsed,speed,step,maxSteps=90){
 // bounded work per frame; do not silently skip collisions or scoring
 const quantum=1/120;
 let count=Math.min(maxSteps,Math.floor(elapsed*speed/quantum));
 while(count-->0){if(paused||activeGame===null)break;step(quantum);}
}
/* ---------- Snake ---------- */
function initSnake(){
  setStats(stat('SCORE','0','snakeScore')+stat('BEST',getNum(KEYS.snake),'snakeBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="snakeCanvas" class="game-canvas" width="720" height="720"></canvas><div id="snakeOverlay" class="overlay"><div class="overlay-card"><h3>Snake</h3><p class="subtle">스와이프 또는 방향 버튼</p><button id="snakeStart" class="primary-btn" type="button">시작</button></div></div></div>
  <div class="dpad"><span class="blank"></span><button data-sdir="up">▲</button><span class="blank"></span><button data-sdir="left">◀</button><button data-sdir="down">▼</button><button data-sdir="right">▶</button></div>`;
  const canvas=$('#snakeCanvas'),ctx=canvasScale(canvas,720,720),overlay=$('#snakeOverlay'); const N=18, cell=720/N;
  let snake,food,dir,nextDir,last=0,acc=0,raf=0,running=false,score=0;const cheat=gameCheats([['snakeGrow','먹이 획득 +1'],['snakeInv','벽/몸 충돌 방지','toggle'],['snakeAuto','자동 조종','toggle']]);
  const spawnFood=()=>{do{food={x:randInt(0,N-1),y:randInt(0,N-1)}}while(snake.some(s=>s.x===food.x&&s.y===food.y));};
  const setDir=d=>{const opp={up:'down',down:'up',left:'right',right:'left'};if(d!==opp[dir])nextDir=d;};
  const draw=()=>{ctx.clearRect(0,0,720,720);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,720,720);ctx.fillStyle='#ff6f8e';ctx.beginPath();ctx.arc((food.x+.5)*cell,(food.y+.5)*cell,cell*.28,0,Math.PI*2);ctx.fill();snake.forEach((s,i)=>{ctx.fillStyle=i===0?'#7f8cff':'#5ce0b4';ctx.fillRect(s.x*cell+3,s.y*cell+3,cell-6,cell-6);});};
  const end=()=>{running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.snake),score);setNum(KEYS.snake,best);$('#snakeBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${score}점</h3><p class="subtle">다시 한 판?</p><button id="snakeAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#snakeAgain').addEventListener('click',start);};
  const step=()=>{if(cheat('snakeAuto').checked){const opts=['up','right','down','left'];const delta={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};const valid=opts.filter(d=>{const [dx,dy]=delta[d],x=snake[0].x+dx,y=snake[0].y+dy;return x>=0&&y>=0&&x<N&&y<N&&!snake.slice(0,-1).some(v=>v.x===x&&v.y===y)});if(valid.length)nextDir=valid.sort((a,b)=>{const da=delta[a],db=delta[b];return (Math.abs(snake[0].x+da[0]-food.x)+Math.abs(snake[0].y+da[1]-food.y))-(Math.abs(snake[0].x+db[0]-food.x)+Math.abs(snake[0].y+db[1]-food.y));})[0];}dir=nextDir;const h={...snake[0]};if(dir==='up')h.y--;if(dir==='down')h.y++;if(dir==='left')h.x--;if(dir==='right')h.x++;if(cheat('snakeInv').checked){h.x=(h.x+N)%N;h.y=(h.y+N)%N;if(snake.some(v=>v.x===h.x&&v.y===h.y)){const free=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!snake.some(v=>v.x===x&&v.y===y))free.push({x,y});if(free.length)Object.assign(h,free[0]);}}else if(h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(s=>s.x===h.x&&s.y===h.y)){end();return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;$('#snakeScore').textContent=score;spawnFood();}else snake.pop();};
  const gameSpeed=gameSpeedControl();
  const speedCfg={easy:{base:175,min:92,step:2},normal:{base:140,min:70,step:3},hard:{base:108,min:56,step:4}}[difficulty];
  const loop=t=>{if(!running)return;if(!paused){const dt=t-last;last=t;acc+=Math.min(dt,100)*gameSpeed();const speed=Math.max(speedCfg.min,speedCfg.base-score*speedCfg.step);let n=0;while(running&&acc>=speed&&n++<90){acc-=speed;step();}draw();}else last=t;raf=requestAnimationFrame(loop);};
  function start(){snake=[{x:9,y:9},{x:8,y:9},{x:7,y:9}];dir='right';nextDir='right';score=0;$('#snakeScore').textContent='0';spawnFood();draw();overlay.classList.add('hidden');running=true;last=performance.now();acc=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  cheat('snakeGrow').addEventListener('click',()=>{if(!running)return;score++;$('#snakeScore').textContent=score;spawnFood();});$('#snakeStart').addEventListener('click',start);$$('[data-sdir]',gameStage).forEach(b=>b.addEventListener('click',()=>setDir(b.dataset.sdir)));
  let sx=0,sy=0;canvas.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});canvas.addEventListener('pointerup',e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;setDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});
  const key=e=>{const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(m[e.key]){e.preventDefault();setDir(m[e.key]);}};document.addEventListener('keydown',key);draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',key);};
}

/* ---------- Brick Breaker ---------- */
function initBrick(){
  const cfg={easy:{time:75,lives:3,rows:3,cols:8,speed:285},normal:{time:60,lives:2,rows:4,cols:8,speed:320},hard:{time:45,lives:1,rows:5,cols:10,speed:370}}[difficulty];
  setStats(stat('SCORE','0','brickScore')+stat('TIME',cfg.time,'brickTime')+stat('BEST',getNum(KEYS.brick),'brickBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="brickCanvas" class="game-canvas"></canvas><div id="brickOverlay" class="overlay"><div class="overlay-card"><h3>Brick Breaker</h3><p class="subtle">패들을 손가락으로 좌우 이동</p><button id="brickStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#brickCanvas'),W=760,H=520,ctx=canvasScale(canvas,W,H),overlay=$('#brickOverlay');
  let paddle,ball,bricks,lives,score,timeLeft,raf,last,running=false;const cheat=gameCheats([['brickClear','벽돌 전체 제거'],['brickTimeAdd','시간 +60초'],['brickAuto','자동 패들','toggle'],['brickImmortal','무한 목숨','toggle']]);
  function makeBricks(){bricks=[];const rows=cfg.rows,cols=cfg.cols,gap=8,bw=(W-44-(cols-1)*gap)/cols,bh=27;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:22+c*(bw+gap),y:48+r*(bh+gap),w:bw,h:bh,alive:true,row:r});}
  function resetBall(){ball={x:W/2,y:H-82,r:8,vx:rand(-cfg.speed*.72,cfg.speed*.72),vy:-cfg.speed};if(Math.abs(ball.vx)<110)ball.vx=140;}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);bricks.forEach(b=>{if(!b.alive)return;const colors=['#7f8cff','#7482f2','#6f9edc','#5cc8ca','#5ce0b4','#ffd166'];ctx.fillStyle=colors[b.row];ctx.fillRect(b.x,b.y,b.w,b.h);});ctx.fillStyle='#eef1ff';ctx.fillRect(paddle.x,H-38,paddle.w,12);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#ff6f8e';ctx.fill();}
  function end(win,reason='GAME OVER'){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.brick),score);setNum(KEYS.brick,best);$('#brickBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${win?'CLEAR!':reason}</h3><p class="subtle">${score}점</p><button id="brickAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#brickAgain').addEventListener('click',start);}
  function update(dt){if(cheat('brickAuto').checked)paddle.x=clamp(ball.x-paddle.w/2,0,W-paddle.w);timeLeft=Math.max(0,timeLeft-dt);$('#brickTime').textContent=Math.ceil(timeLeft);if(timeLeft<=0){end(false,'TIME UP');return;}ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
    const py=H-38;if(ball.vy>0&&ball.y+ball.r>=py&&ball.y-ball.r<=py+12&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w){const hit=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);ball.vy=-Math.abs(ball.vy)*1.02;ball.vx+=hit*110;ball.y=py-ball.r-1;}
    for(const b of bricks){if(!b.alive)continue;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.alive=false;score+=10;$('#brickScore').textContent=score;ball.vy*=-1;break;}}
    if(bricks.every(b=>!b.alive)){end(true);return;}if(ball.y-ball.r>H){if(cheat('brickImmortal').checked){resetBall();return;}lives--;if(lives<=0){end(false);return;}resetBall();}}
  const gameSpeed=gameSpeedControl();let simCarry=0;
  function loop(t){if(!running)return;if(!paused){simCarry+=Math.min(.1,(t-last)/1000)*gameSpeed();last=t;let n=0;while(running&&simCarry>=1/120&&n++<90){update(1/120);simCarry-=1/120;}draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){simCarry=0;const widths={easy:168,normal:144,hard:120};const pw=widths[difficulty];paddle={x:W/2-pw/2,w:pw};lives=cfg.lives;score=0;timeLeft=cfg.time;$('#brickScore').textContent='0';$('#brickTime').textContent=cfg.time;makeBricks();resetBall();draw();overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  function moveP(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;paddle.x=clamp(x-paddle.w/2,0,W-paddle.w);}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);moveP(e)});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')moveP(e)});cheat('brickClear').addEventListener('click',()=>{if(!running)return;bricks.forEach(b=>b.alive=false);score+=bricks.length*10;$('#brickScore').textContent=score;end(true);});cheat('brickTimeAdd').addEventListener('click',()=>{timeLeft+=60;$('#brickTime').textContent=Math.ceil(timeLeft);});$('#brickStart').addEventListener('click',start);makeBricks();paddle={x:W/2-65,w:130};resetBall();draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Stack ---------- */
function initStack(){
  setStats(stat('FLOOR','0','stackFloor')+stat('BEST',getNum(KEYS.stack),'stackBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="stackCanvas" class="game-canvas"></canvas><div id="stackOverlay" class="overlay"><div class="overlay-card"><h3>Stack Tower</h3><p class="subtle">화면 아무 곳이나 탭해서 블록 놓기</p><button id="stackStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#stackCanvas'),W=760,H=600,ctx=canvasScale(canvas,W,H),overlay=$('#stackOverlay');
  let tower,moving,dir,speed,floor,running=false,raf,last=0,dropLock=false;const cheat=gameCheats([['stackPerfect','완벽 정렬'],['stackWide','블록 폭 복구'],['stackAuto','자동 쌓기','toggle']]);
  const stackCfg={easy:{base:115,gain:7,max:255},normal:{base:150,gain:10,max:330},hard:{base:195,gain:14,max:430}}[difficulty];
  function resetMoving(){const prev=tower[tower.length-1];moving={x:dir>0?-prev.w:W,y:H-90-floor*36,w:prev.w,h:30};speed=Math.min(stackCfg.max,stackCfg.base+floor*stackCfg.gain);dropLock=false;}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);const baseY=H-58;const offset=Math.max(0,(floor-11)*36);tower.forEach((b,i)=>{const y=baseY-i*36+offset;ctx.fillStyle=i%2?'#5ce0b4':'#7f8cff';ctx.fillRect(b.x,y,b.w,30);});if(running){const y=baseY-(tower.length)*36+offset;ctx.fillStyle='#ffd166';ctx.fillRect(moving.x,y,moving.w,30);}}
  function end(){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.stack),floor);setNum(KEYS.stack,best);$('#stackBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${floor}층</h3><p class="subtle">타워가 무너졌습니다</p><button id="stackAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#stackAgain').addEventListener('click',start);}
  function place(){if(!running||paused||dropLock)return;dropLock=true;if(cheat('stackAuto').checked||cheat('stackPerfect').dataset.once==='yes'){moving.x=tower[tower.length-1].x;cheat('stackPerfect').dataset.once='no';}const prev=tower[tower.length-1],left=Math.max(prev.x,moving.x),right=Math.min(prev.x+prev.w,moving.x+moving.w),overlap=right-left;if(overlap<=0){end();return;}tower.push({x:left,w:overlap});floor++;$('#stackFloor').textContent=floor;dir*=-1;resetMoving();draw();}
  const gameSpeed=gameSpeedControl();let simCarry=0;
  function stackTick(dt){moving.x+=dir*speed*dt;if(cheat('stackAuto').checked&&Math.abs(moving.x-tower[tower.length-1].x)<Math.max(5,speed*dt))place();if(dir>0&&moving.x>W) moving.x=-moving.w;if(dir<0&&moving.x+moving.w<0)moving.x=W;}
  function loop(t){if(!running)return;if(!paused){simCarry+=Math.min(.1,(t-last)/1000)*gameSpeed();last=t;let n=0;while(running&&simCarry>=1/120&&n++<90){stackTick(1/120);simCarry-=1/120;}draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){simCarry=0;tower=[{x:W/2-145,w:290}];floor=0;dir=1;$('#stackFloor').textContent='0';resetMoving();overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  cheat('stackPerfect').addEventListener('click',()=>{cheat('stackPerfect').dataset.once='yes';place();});cheat('stackWide').addEventListener('click',()=>{tower[tower.length-1].w=290;moving.w=290;draw();});canvas.addEventListener('pointerdown',place);$('#stackStart').addEventListener('click',start);tower=[{x:W/2-145,w:290}];floor=0;dir=1;resetMoving();draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Minesweeper ---------- */
function initMines(){
  let board=[],first=true,flags=0,opened=0,startTime=0,timer=0,mode='open',ended=false;
  const mineCfg={easy:{n:8,m:8},normal:{n:8,m:10},hard:{n:8,m:14}}[difficulty];
  setStats(stat('TIME','0.0','mineTime')+stat('FLAGS',`0/${mineCfg.m}`,'mineFlags')+stat('BEST',getNum(KEYS.mines)?getNum(KEYS.mines).toFixed(1)+'s':'—','mineBest'));
  gameStage.innerHTML=`<div class="mines-toolbar"><div class="mode-toggle"><button id="modeOpen" class="active" type="button">열기</button><button id="modeFlag" type="button">깃발</button></div><button id="mineReset" class="secondary-btn" type="button">새 보드</button></div><div id="minesGrid" class="mines-grid"></div>`;
  const grid=$('#minesGrid'),N=mineCfg.n,M=mineCfg.m;const gameSpeed=gameSpeedControl();let virtualElapsed=0,lastClock=0;const cheat=gameCheats([['mineReveal','지뢰 위치 표시','toggle'],['mineSolve','안전 칸 모두 열기'],['mineFlagAll','지뢰 자동 표시']]);
  const neigh=i=>{const r=Math.floor(i/N),c=i%N,a=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr>=0&&cc>=0&&rr<N&&cc<N)a.push(rr*N+cc);}return a;};
  function build(){clearInterval(timer);board=Array.from({length:N*N},()=>({mine:false,open:false,flag:false,n:0}));first=true;flags=0;opened=0;ended=false;mode='open';$('#modeOpen').classList.add('active');$('#modeFlag').classList.remove('active');$('#mineTime').textContent='0.0';$('#mineFlags').textContent=`0/${M}`;render();}
  function placeMines(safe){const forbidden=new Set([safe,...neigh(safe)]);let choices=Array.from({length:N*N},(_,i)=>i).filter(i=>!forbidden.has(i));shuffle(choices);choices.slice(0,M).forEach(i=>board[i].mine=true);board.forEach((c,i)=>c.n=neigh(i).filter(j=>board[j].mine).length);startTime=performance.now();lastClock=startTime;virtualElapsed=0;timer=setInterval(()=>{const now=performance.now();if(!paused&&!ended)virtualElapsed+=(now-lastClock)/1000*gameSpeed();lastClock=now;if(!ended)$('#mineTime').textContent=virtualElapsed.toFixed(1)},100);}
  function reveal(i){const c=board[i];if(c.open||c.flag||ended)return;if(first){first=false;placeMines(i);}c.open=true;opened++;if(c.mine){finish(false);return;}if(c.n===0)neigh(i).forEach(reveal);if(opened===N*N-M)finish(true);render();}
  function toggleFlag(i){const c=board[i];if(c.open||ended)return;c.flag=!c.flag;flags+=c.flag?1:-1;$('#mineFlags').textContent=`${flags}/${M}`;render();}
  function finish(win){ended=true;clearInterval(timer);if(win){const sec=virtualElapsed;const old=getNum(KEYS.mines);if(!old||sec<old)setNum(KEYS.mines,Number(sec.toFixed(1)));$('#mineBest').textContent=getNum(KEYS.mines).toFixed(1)+'s';showToast(`클리어 ${sec.toFixed(1)}초`);}else{board.forEach(c=>{if(c.mine)c.open=true});showToast('지뢰였습니다');}render();}
  function render(){grid.innerHTML='';board.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='mine-cell'+(c.open?' open':'')+(c.flag?' flag':'');if(c.open)b.textContent=c.mine?'✹':(c.n||'');else if(cheat('mineReveal').checked&&c.mine)b.textContent='✹';else if(c.flag)b.textContent='⚑';if(c.open&&c.n)b.classList.add('n'+c.n);let hold=null,long=false;b.addEventListener('pointerdown',()=>{long=false;hold=setTimeout(()=>{long=true;toggleFlag(i)},520)});const cancel=()=>{clearTimeout(hold);hold=null};b.addEventListener('pointerleave',cancel);b.addEventListener('pointercancel',cancel);b.addEventListener('pointerup',()=>{cancel();if(long)return;if(mode==='flag')toggleFlag(i);else reveal(i)});grid.appendChild(b);});}
  cheat('mineReveal').addEventListener('change',render);cheat('mineSolve').addEventListener('click',()=>{if(first){first=false;placeMines(0);}board.forEach(c=>{if(!c.mine&&!c.open){c.open=true;opened++;}});finish(true);});cheat('mineFlagAll').addEventListener('click',()=>{if(first){first=false;placeMines(0);}board.forEach(c=>{if(c.mine&&!c.open)c.flag=true;});flags=board.filter(c=>c.flag).length;$('#mineFlags').textContent=flags+'/'+M;render();});$('#modeOpen').addEventListener('click',()=>{mode='open';$('#modeOpen').classList.add('active');$('#modeFlag').classList.remove('active')});$('#modeFlag').addEventListener('click',()=>{mode='flag';$('#modeFlag').classList.add('active');$('#modeOpen').classList.remove('active')});$('#mineReset').addEventListener('click',build);build();cleanupActive=()=>clearInterval(timer);
}

/* ---------- Dodge ---------- */
function initDodge(){
  setStats(stat('SCORE','0','dodgeScore')+stat('BEST',getNum(KEYS.dodge),'dodgeBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="dodgeCanvas" class="game-canvas"></canvas><div id="dodgeOverlay" class="overlay"><div class="overlay-card"><h3>Dodge</h3><p class="subtle">플레이어를 손가락으로 좌우 이동</p><button id="dodgeStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#dodgeCanvas'),W=760,H=560,ctx=canvasScale(canvas,W,H),overlay=$('#dodgeOverlay');
  let player,obs=[],score=0,spawn=0,raf=0,last=0,running=false,scoreFraction=0;const cheat=gameCheats([['dodgeClear','장애물 제거'],['dodgeBonus','점수 +1000'],['dodgeInv','무적','toggle'],['dodgeAuto','자동 회피','toggle']]);
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#7f8cff';ctx.beginPath();ctx.moveTo(player.x,player.y-18);ctx.lineTo(player.x-18,player.y+18);ctx.lineTo(player.x+18,player.y+18);ctx.closePath();ctx.fill();obs.forEach(o=>{ctx.fillStyle=o.c;ctx.fillRect(o.x,o.y,o.w,o.h);});}
  function collide(o){const px=player.x-15,py=player.y-15,pw=30,ph=30;return px<o.x+o.w&&px+pw>o.x&&py<o.y+o.h&&py+ph>o.y;}
  function end(){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.dodge),score);setNum(KEYS.dodge,best);$('#dodgeBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${score}점</h3><p class="subtle">충돌했습니다</p><button id="dodgeAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#dodgeAgain').addEventListener('click',start);}
  const dodgeCfg={easy:{v0:145,v1:240,spawn:.72,min:.24,gain:.55},normal:{v0:180,v1:300,spawn:.55,min:.16,gain:.8},hard:{v0:235,v1:365,spawn:.40,min:.12,gain:1.05}}[difficulty];
  function update(dt){scoreFraction+=dt*20;const inc=Math.floor(scoreFraction);scoreFraction-=inc;score+=inc;$('#dodgeScore').textContent=score;spawn-=dt;if(spawn<=0){const w=rand(34,86);obs.push({x:rand(0,W-w),y:-60,w,h:rand(22,55),v:rand(dodgeCfg.v0,dodgeCfg.v1)+Math.min(300,score*dodgeCfg.gain),c:Math.random()<.5?'#ff6f8e':'#ffd166'});spawn=Math.max(dodgeCfg.min,dodgeCfg.spawn-score/2500);}for(const o of obs)o.y+=o.v*dt;obs=obs.filter(o=>o.y<H+80);if(cheat('dodgeAuto').checked){let bestX=player.x,best=-Infinity;for(let x=22;x<=W-22;x+=18){let safety=0;for(const o of obs){const dy=player.y-o.y;if(dy>-30&&dy<190&&x+18>o.x&&x-18<o.x+o.w)safety-=1000/(Math.max(20,dy));}safety-=Math.abs(x-player.x)*.003;if(safety>best){best=safety;bestX=x;}}player.x=bestX;}if(!cheat('dodgeInv').checked&&obs.some(collide))end();}
  const gameSpeed=gameSpeedControl();let simCarry=0;
  function loop(t){if(!running)return;if(!paused){simCarry+=Math.min(.1,(t-last)/1000)*gameSpeed();last=t;let n=0;while(running&&simCarry>=1/120&&n++<90){update(1/120);simCarry-=1/120;}draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){simCarry=0;player={x:W/2,y:H-50};obs=[];score=0;scoreFraction=0;spawn=.3;$('#dodgeScore').textContent='0';overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  function move(e){const r=canvas.getBoundingClientRect();player.x=clamp((e.clientX-r.left)/r.width*W,22,W-22);}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);move(e)});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')move(e)});cheat('dodgeClear').addEventListener('click',()=>{obs=[];draw();});cheat('dodgeBonus').addEventListener('click',()=>{score+=1000;$('#dodgeScore').textContent=score;});$('#dodgeStart').addEventListener('click',start);player={x:W/2,y:H-50};draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Memory ---------- */
function initMemory(){
  let first=null,lock=false,moves=0,matched=0;const cheat=gameCheats([['memoryReveal','전체 카드 보기','toggle'],['memorySolve','자동 완성']]);
  const old=getNum(KEYS.memory);
  setStats(stat('MOVES','0','memoryMoves')+stat('BEST',old||'—','memoryBest'));
  gameStage.innerHTML=`<div id="memoryGrid" class="memory-grid"></div><div class="button-row"><button id="memoryReset" class="secondary-btn" type="button">다시 섞기</button></div>`;
  const gameSpeed=gameSpeedControl();const grid=$('#memoryGrid'), allSymbols=['●','▲','■','◆','★','✦','✚','✿','⬟','♥'], pairCount={easy:6,normal:8,hard:10}[difficulty], symbols=allSymbols.slice(0,pairCount), total=pairCount*2;
  function build(){first=null;lock=false;moves=0;matched=0;$('#memoryMoves').textContent='0';const deck=shuffle([...symbols,...symbols]);grid.innerHTML='';deck.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='memory-card';b.dataset.symbol=s;b.dataset.i=i;b.textContent='';b.addEventListener('click',()=>flip(b));grid.appendChild(b);});}
  function flip(b){if(paused||lock||b.classList.contains('matched')||b===first)return;b.textContent=b.dataset.symbol;b.classList.add('open');if(!first){first=b;return;}moves++;$('#memoryMoves').textContent=moves;if(first.dataset.symbol===b.dataset.symbol){first.classList.add('matched');b.classList.add('matched');first=null;matched+=2;if(matched===total){const old=getNum(KEYS.memory);if(!old||moves<old)setNum(KEYS.memory,moves);$('#memoryBest').textContent=getNum(KEYS.memory);showToast(`완료 · ${moves}회`);}}else{lock=true;const a=first;setTimeout(()=>{a.textContent='';b.textContent='';a.classList.remove('open');b.classList.remove('open');first=null;lock=false;},Math.max(10,620/gameSpeed()));}}
  cheat('memoryReveal').addEventListener('change',()=>{$$('.memory-card',grid).forEach(b=>{if(!b.classList.contains('matched')&&!b.classList.contains('open'))b.textContent=cheat('memoryReveal').checked?b.dataset.symbol:'';});});cheat('memorySolve').addEventListener('click',()=>{lock=false;first=null;$$('.memory-card',grid).forEach(b=>{b.textContent=b.dataset.symbol;b.classList.add('matched');});const remaining=total-matched;moves+=Math.ceil(remaining/2);matched=total;$('#memoryMoves').textContent=moves;const old=getNum(KEYS.memory);if(!old||moves<old)setNum(KEYS.memory,moves);$('#memoryBest').textContent=getNum(KEYS.memory);showToast('자동 완성');});$('#memoryReset').addEventListener('click',build);build();cleanupActive=()=>{};
}

window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&activeGame)goHome();
  if(e.key===' '&&activeGame){if(['stack'].includes(activeGame)){e.preventDefault();$('#stackCanvas')?.dispatchEvent(new PointerEvent('pointerdown'));}}
});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=7').catch(()=>{}));}
