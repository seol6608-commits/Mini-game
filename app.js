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
  r2048:STORE_PREFIX+'2048_best', snake:STORE_PREFIX+'snake_best', brick:STORE_PREFIX+'brick_best', stack:STORE_PREFIX+'stack_best',
  mines:STORE_PREFIX+'mines_best', dodge:STORE_PREFIX+'dodge_best', memory:STORE_PREFIX+'memory_best'
};
const getNum = (k,d=0) => Number(localStorage.getItem(k) ?? d) || d;
const setNum = (k,v) => localStorage.setItem(k,String(v));

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
  {id:'brick', icon:'▰', name:'Brick Breaker', desc:'60초 안에 벽돌을 최대한 깨기', record:()=>`${getNum(KEYS.brick)} pts`, kicker:'ARCADE', help:'손가락을 좌우로 움직여 패들을 조작하세요. 한 판은 최대 60초이며, 벽돌을 모두 깨면 즉시 끝납니다.'},
  {id:'stack', icon:'▥', name:'Stack Tower', desc:'움직이는 블록을 정확히 쌓기', record:()=>`${getNum(KEYS.stack)} 층`, kicker:'TIMING', help:'화면을 탭해 움직이는 블록을 내려놓으세요. 겹치지 않은 부분은 잘려 나갑니다.'},
  {id:'mines', icon:'✦', name:'Minesweeper', desc:'8×8 보드에서 지뢰 10개 찾기', record:()=>{const v=getNum(KEYS.mines);return v?`${v.toFixed(1)} s`:'—';}, kicker:'PUZZLE', help:'터치하면 칸을 열고, 깃발 모드 또는 길게 누르기로 지뢰를 표시하세요.'},
  {id:'dodge', icon:'◇', name:'Dodge', desc:'내려오는 장애물을 오래 피하기', record:()=>`${getNum(KEYS.dodge)} pts`, kicker:'SURVIVAL', help:'손가락을 좌우로 드래그해 플레이어를 움직이세요. 시간이 지날수록 장애물이 빨라집니다.'},
  {id:'memory', icon:'?', name:'Memory', desc:'16장 카드의 같은 짝 맞추기', record:()=>{const v=getNum(KEYS.memory);return v?`${v} moves`:'—';}, kicker:'MEMORY', help:'카드 두 장씩 열어서 같은 기호를 모두 맞추세요. 적은 시도 횟수가 최고 기록입니다.'}
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

function openGame(id){
  cleanupActive(); cleanupActive=()=>{};
  paused=false; pauseBtn.textContent='Ⅱ';
  activeGame=id;
  const meta=games.find(g=>g.id===id);
  screenTitle.textContent=meta.name;
  gameKicker.textContent=meta.kicker;
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
  let board=Array(16).fill(0), score=0, won=false;
  setStats(stat('SCORE','0','s2048')+stat('BEST',getNum(KEYS.r2048),'b2048Best'));
  gameStage.innerHTML=`<div class="g2048-wrap"><div id="b2048" class="g2048-board" aria-label="2048 보드"></div>
    <div class="swipe-pad" aria-label="방향 조작"><span class="blank"></span><button data-dir="up">▲</button><span class="blank"></span><button data-dir="left">◀</button><button data-dir="down">▼</button><button data-dir="right">▶</button></div>
    <div class="button-row"><button id="reset2048" class="secondary-btn" type="button">새 게임</button></div></div>`;
  const el=$('#b2048');
  const addTile=()=>{const free=board.map((v,i)=>v?null:i).filter(v=>v!==null); if(!free.length)return; board[free[randInt(0,free.length-1)]]=Math.random()<.9?2:4;};
  const render=()=>{el.innerHTML=board.map(v=>`<div class="g2048-cell ${v?`v${Math.min(v,2048)}`:''}">${v||''}</div>`).join(''); $('#s2048').textContent=score; const best=Math.max(getNum(KEYS.r2048),score); setNum(KEYS.r2048,best); $('#b2048Best').textContent=best;};
  const slideLine=line=>{let a=line.filter(Boolean), gained=0; for(let i=0;i<a.length-1;i++){if(a[i]===a[i+1]){a[i]*=2;gained+=a[i];a.splice(i+1,1);}} while(a.length<4)a.push(0); return [a,gained];};
  const move=dir=>{
    if(paused)return; const old=board.slice(); let gained=0;
    for(let i=0;i<4;i++){
      let idx=[];
      if(dir==='left'||dir==='right') idx=[0,1,2,3].map(c=>i*4+c); else idx=[0,1,2,3].map(r=>r*4+i);
      if(dir==='right'||dir==='down') idx.reverse();
      const [vals,g]=slideLine(idx.map(k=>board[k])); gained+=g; idx.forEach((k,j)=>board[k]=vals[j]);
    }
    if(board.some((v,i)=>v!==old[i])){score+=gained;addTile();render(); if(!won&&board.some(v=>v>=2048)){won=true;showToast('2048 달성');} if(!canMove())showToast('게임 오버 · 새 게임을 누르세요');}
  };
  const canMove=()=>{if(board.includes(0))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){const v=board[r*4+c];if(c<3&&v===board[r*4+c+1])return true;if(r<3&&v===board[(r+1)*4+c])return true;}return false;};
  const reset=()=>{board=Array(16).fill(0);score=0;won=false;addTile();addTile();render();};
  $$('[data-dir]',gameStage).forEach(b=>b.addEventListener('click',()=>move(b.dataset.dir))); $('#reset2048').addEventListener('click',reset);
  let sx=0,sy=0; const pd=e=>{sx=e.clientX;sy=e.clientY;}; const pu=e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));}; el.addEventListener('pointerdown',pd);el.addEventListener('pointerup',pu);
  const key=e=>{const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[e.key]){e.preventDefault();move(map[e.key]);}};document.addEventListener('keydown',key);
  reset(); cleanupActive=()=>document.removeEventListener('keydown',key);
}

/* ---------- Snake ---------- */
function initSnake(){
  setStats(stat('SCORE','0','snakeScore')+stat('BEST',getNum(KEYS.snake),'snakeBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="snakeCanvas" class="game-canvas" width="720" height="720"></canvas><div id="snakeOverlay" class="overlay"><div class="overlay-card"><h3>Snake</h3><p class="subtle">스와이프 또는 방향 버튼</p><button id="snakeStart" class="primary-btn" type="button">시작</button></div></div></div>
  <div class="dpad"><span class="blank"></span><button data-sdir="up">▲</button><span class="blank"></span><button data-sdir="left">◀</button><button data-sdir="down">▼</button><button data-sdir="right">▶</button></div>`;
  const canvas=$('#snakeCanvas'),ctx=canvasScale(canvas,720,720),overlay=$('#snakeOverlay'); const N=18, cell=720/N;
  let snake,food,dir,nextDir,last=0,acc=0,raf=0,running=false,score=0;
  const spawnFood=()=>{do{food={x:randInt(0,N-1),y:randInt(0,N-1)}}while(snake.some(s=>s.x===food.x&&s.y===food.y));};
  const setDir=d=>{const opp={up:'down',down:'up',left:'right',right:'left'};if(d!==opp[dir])nextDir=d;};
  const draw=()=>{ctx.clearRect(0,0,720,720);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,720,720);ctx.fillStyle='#ff6f8e';ctx.beginPath();ctx.arc((food.x+.5)*cell,(food.y+.5)*cell,cell*.28,0,Math.PI*2);ctx.fill();snake.forEach((s,i)=>{ctx.fillStyle=i===0?'#7f8cff':'#5ce0b4';ctx.fillRect(s.x*cell+3,s.y*cell+3,cell-6,cell-6);});};
  const end=()=>{running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.snake),score);setNum(KEYS.snake,best);$('#snakeBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${score}점</h3><p class="subtle">다시 한 판?</p><button id="snakeAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#snakeAgain').addEventListener('click',start);};
  const step=()=>{dir=nextDir;const h={...snake[0]};if(dir==='up')h.y--;if(dir==='down')h.y++;if(dir==='left')h.x--;if(dir==='right')h.x++;if(h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(s=>s.x===h.x&&s.y===h.y)){end();return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;$('#snakeScore').textContent=score;spawnFood();}else snake.pop();};
  const loop=t=>{if(!running)return;if(!paused){const dt=t-last;last=t;acc+=dt;const speed=Math.max(70,140-score*3);if(acc>=speed){acc%=speed;step();draw();}}else last=t;raf=requestAnimationFrame(loop);};
  function start(){snake=[{x:9,y:9},{x:8,y:9},{x:7,y:9}];dir='right';nextDir='right';score=0;$('#snakeScore').textContent='0';spawnFood();draw();overlay.classList.add('hidden');running=true;last=performance.now();acc=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  $('#snakeStart').addEventListener('click',start);$$('[data-sdir]',gameStage).forEach(b=>b.addEventListener('click',()=>setDir(b.dataset.sdir)));
  let sx=0,sy=0;canvas.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});canvas.addEventListener('pointerup',e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;setDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});
  const key=e=>{const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(m[e.key]){e.preventDefault();setDir(m[e.key]);}};document.addEventListener('keydown',key);draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',key);};
}

/* ---------- Brick Breaker ---------- */
function initBrick(){
  setStats(stat('SCORE','0','brickScore')+stat('TIME','60','brickTime')+stat('BEST',getNum(KEYS.brick),'brickBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="brickCanvas" class="game-canvas"></canvas><div id="brickOverlay" class="overlay"><div class="overlay-card"><h3>Brick Breaker</h3><p class="subtle">패들을 손가락으로 좌우 이동</p><button id="brickStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#brickCanvas'),W=760,H=520,ctx=canvasScale(canvas,W,H),overlay=$('#brickOverlay');
  let paddle,ball,bricks,lives,score,timeLeft,raf,last,running=false;
  function makeBricks(){bricks=[];const rows=4,cols=8,gap=8,bw=(W-44-(cols-1)*gap)/cols,bh=27;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:22+c*(bw+gap),y:48+r*(bh+gap),w:bw,h:bh,alive:true,row:r});}
  function resetBall(){ball={x:W/2,y:H-82,r:8,vx:rand(-230,230),vy:-320};if(Math.abs(ball.vx)<110)ball.vx=140;}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);bricks.forEach(b=>{if(!b.alive)return;const colors=['#7f8cff','#7482f2','#6f9edc','#5cc8ca','#5ce0b4','#ffd166'];ctx.fillStyle=colors[b.row];ctx.fillRect(b.x,b.y,b.w,b.h);});ctx.fillStyle='#eef1ff';ctx.fillRect(paddle.x,H-38,paddle.w,12);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#ff6f8e';ctx.fill();}
  function end(win,reason='GAME OVER'){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.brick),score);setNum(KEYS.brick,best);$('#brickBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${win?'CLEAR!':reason}</h3><p class="subtle">${score}점</p><button id="brickAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#brickAgain').addEventListener('click',start);}
  function update(dt){timeLeft=Math.max(0,timeLeft-dt);$('#brickTime').textContent=Math.ceil(timeLeft);if(timeLeft<=0){end(false,'TIME UP');return;}ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
    const py=H-38;if(ball.vy>0&&ball.y+ball.r>=py&&ball.y-ball.r<=py+12&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w){const hit=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);ball.vy=-Math.abs(ball.vy)*1.02;ball.vx+=hit*110;ball.y=py-ball.r-1;}
    for(const b of bricks){if(!b.alive)continue;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.alive=false;score+=10;$('#brickScore').textContent=score;ball.vy*=-1;break;}}
    if(bricks.every(b=>!b.alive)){end(true);return;}if(ball.y-ball.r>H){lives--;if(lives<=0){end(false);return;}resetBall();}}
  function loop(t){if(!running)return;if(!paused){const dt=Math.min(.025,(t-last)/1000);last=t;update(dt);draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){paddle={x:W/2-72,w:144};lives=2;score=0;timeLeft=60;$('#brickScore').textContent='0';$('#brickTime').textContent='60';makeBricks();resetBall();draw();overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  function moveP(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;paddle.x=clamp(x-paddle.w/2,0,W-paddle.w);}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);moveP(e)});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')moveP(e)});$('#brickStart').addEventListener('click',start);makeBricks();paddle={x:W/2-65,w:130};resetBall();draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Stack ---------- */
function initStack(){
  setStats(stat('FLOOR','0','stackFloor')+stat('BEST',getNum(KEYS.stack),'stackBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="stackCanvas" class="game-canvas"></canvas><div id="stackOverlay" class="overlay"><div class="overlay-card"><h3>Stack Tower</h3><p class="subtle">화면 아무 곳이나 탭해서 블록 놓기</p><button id="stackStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#stackCanvas'),W=760,H=600,ctx=canvasScale(canvas,W,H),overlay=$('#stackOverlay');
  let tower,moving,dir,speed,floor,running=false,raf,last=0,dropLock=false;
  function resetMoving(){const prev=tower[tower.length-1];moving={x:dir>0?-prev.w:W,y:H-90-floor*36,w:prev.w,h:30};speed=Math.min(330,150+floor*10);dropLock=false;}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);const baseY=H-58;const offset=Math.max(0,(floor-11)*36);tower.forEach((b,i)=>{const y=baseY-i*36+offset;ctx.fillStyle=i%2?'#5ce0b4':'#7f8cff';ctx.fillRect(b.x,y,b.w,30);});if(running){const y=baseY-(tower.length)*36+offset;ctx.fillStyle='#ffd166';ctx.fillRect(moving.x,y,moving.w,30);}}
  function end(){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.stack),floor);setNum(KEYS.stack,best);$('#stackBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${floor}층</h3><p class="subtle">타워가 무너졌습니다</p><button id="stackAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#stackAgain').addEventListener('click',start);}
  function place(){if(!running||paused||dropLock)return;dropLock=true;const prev=tower[tower.length-1],left=Math.max(prev.x,moving.x),right=Math.min(prev.x+prev.w,moving.x+moving.w),overlap=right-left;if(overlap<=0){end();return;}tower.push({x:left,w:overlap});floor++;$('#stackFloor').textContent=floor;dir*=-1;resetMoving();draw();}
  function loop(t){if(!running)return;if(!paused){const dt=Math.min(.03,(t-last)/1000);last=t;moving.x+=dir*speed*dt;if(dir>0&&moving.x>W) moving.x=-moving.w;if(dir<0&&moving.x+moving.w<0)moving.x=W;draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){tower=[{x:W/2-145,w:290}];floor=0;dir=1;$('#stackFloor').textContent='0';resetMoving();overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  canvas.addEventListener('pointerdown',place);$('#stackStart').addEventListener('click',start);tower=[{x:W/2-145,w:290}];floor=0;dir=1;resetMoving();draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Minesweeper ---------- */
function initMines(){
  let board=[],first=true,flags=0,opened=0,startTime=0,timer=0,mode='open',ended=false;
  setStats(stat('TIME','0.0','mineTime')+stat('FLAGS','0/10','mineFlags')+stat('BEST',getNum(KEYS.mines)?getNum(KEYS.mines).toFixed(1)+'s':'—','mineBest'));
  gameStage.innerHTML=`<div class="mines-toolbar"><div class="mode-toggle"><button id="modeOpen" class="active" type="button">열기</button><button id="modeFlag" type="button">깃발</button></div><button id="mineReset" class="secondary-btn" type="button">새 보드</button></div><div id="minesGrid" class="mines-grid"></div>`;
  const grid=$('#minesGrid'),N=8,M=10;
  const neigh=i=>{const r=Math.floor(i/N),c=i%N,a=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr>=0&&cc>=0&&rr<N&&cc<N)a.push(rr*N+cc);}return a;};
  function build(){clearInterval(timer);board=Array.from({length:N*N},()=>({mine:false,open:false,flag:false,n:0}));first=true;flags=0;opened=0;ended=false;mode='open';$('#modeOpen').classList.add('active');$('#modeFlag').classList.remove('active');$('#mineTime').textContent='0.0';$('#mineFlags').textContent='0/10';render();}
  function placeMines(safe){const forbidden=new Set([safe,...neigh(safe)]);let choices=Array.from({length:N*N},(_,i)=>i).filter(i=>!forbidden.has(i));shuffle(choices);choices.slice(0,M).forEach(i=>board[i].mine=true);board.forEach((c,i)=>c.n=neigh(i).filter(j=>board[j].mine).length);startTime=performance.now();timer=setInterval(()=>{if(!paused&&!ended)$('#mineTime').textContent=((performance.now()-startTime)/1000).toFixed(1)},100);}
  function reveal(i){const c=board[i];if(c.open||c.flag||ended)return;if(first){first=false;placeMines(i);}c.open=true;opened++;if(c.mine){finish(false);return;}if(c.n===0)neigh(i).forEach(reveal);if(opened===N*N-M)finish(true);render();}
  function toggleFlag(i){const c=board[i];if(c.open||ended)return;c.flag=!c.flag;flags+=c.flag?1:-1;$('#mineFlags').textContent=`${flags}/10`;render();}
  function finish(win){ended=true;clearInterval(timer);if(win){const sec=(performance.now()-startTime)/1000;const old=getNum(KEYS.mines);if(!old||sec<old)setNum(KEYS.mines,Number(sec.toFixed(1)));$('#mineBest').textContent=getNum(KEYS.mines).toFixed(1)+'s';showToast(`클리어 ${sec.toFixed(1)}초`);}else{board.forEach(c=>{if(c.mine)c.open=true});showToast('지뢰였습니다');}render();}
  function render(){grid.innerHTML='';board.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='mine-cell'+(c.open?' open':'')+(c.flag?' flag':'');if(c.open)b.textContent=c.mine?'✹':(c.n||'');else if(c.flag)b.textContent='⚑';if(c.open&&c.n)b.classList.add('n'+c.n);let hold=null,long=false;b.addEventListener('pointerdown',()=>{long=false;hold=setTimeout(()=>{long=true;toggleFlag(i)},520)});const cancel=()=>{clearTimeout(hold);hold=null};b.addEventListener('pointerleave',cancel);b.addEventListener('pointercancel',cancel);b.addEventListener('pointerup',()=>{cancel();if(long)return;if(mode==='flag')toggleFlag(i);else reveal(i)});grid.appendChild(b);});}
  $('#modeOpen').addEventListener('click',()=>{mode='open';$('#modeOpen').classList.add('active');$('#modeFlag').classList.remove('active')});$('#modeFlag').addEventListener('click',()=>{mode='flag';$('#modeFlag').classList.add('active');$('#modeOpen').classList.remove('active')});$('#mineReset').addEventListener('click',build);build();cleanupActive=()=>clearInterval(timer);
}

/* ---------- Dodge ---------- */
function initDodge(){
  setStats(stat('SCORE','0','dodgeScore')+stat('BEST',getNum(KEYS.dodge),'dodgeBest'));
  gameStage.innerHTML=`<div class="canvas-wrap"><canvas id="dodgeCanvas" class="game-canvas"></canvas><div id="dodgeOverlay" class="overlay"><div class="overlay-card"><h3>Dodge</h3><p class="subtle">플레이어를 손가락으로 좌우 이동</p><button id="dodgeStart" class="primary-btn" type="button">시작</button></div></div></div>`;
  const canvas=$('#dodgeCanvas'),W=760,H=560,ctx=canvasScale(canvas,W,H),overlay=$('#dodgeOverlay');
  let player,obs=[],score=0,spawn=0,raf=0,last=0,running=false;
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#7f8cff';ctx.beginPath();ctx.moveTo(player.x,player.y-18);ctx.lineTo(player.x-18,player.y+18);ctx.lineTo(player.x+18,player.y+18);ctx.closePath();ctx.fill();obs.forEach(o=>{ctx.fillStyle=o.c;ctx.fillRect(o.x,o.y,o.w,o.h);});}
  function collide(o){const px=player.x-15,py=player.y-15,pw=30,ph=30;return px<o.x+o.w&&px+pw>o.x&&py<o.y+o.h&&py+ph>o.y;}
  function end(){running=false;cancelAnimationFrame(raf);const best=Math.max(getNum(KEYS.dodge),score);setNum(KEYS.dodge,best);$('#dodgeBest').textContent=best;overlay.classList.remove('hidden');overlay.innerHTML=`<div class="overlay-card"><h3>${score}점</h3><p class="subtle">충돌했습니다</p><button id="dodgeAgain" class="primary-btn" type="button">다시 시작</button></div>`;$('#dodgeAgain').addEventListener('click',start);}
  function update(dt){score+=Math.floor(dt*20);$('#dodgeScore').textContent=score;spawn-=dt;if(spawn<=0){const w=rand(34,86);obs.push({x:rand(0,W-w),y:-60,w,h:rand(22,55),v:rand(180,300)+Math.min(260,score*.8),c:Math.random()<.5?'#ff6f8e':'#ffd166'});spawn=Math.max(.16,.55-score/2500);}for(const o of obs)o.y+=o.v*dt;obs=obs.filter(o=>o.y<H+80);if(obs.some(collide))end();}
  function loop(t){if(!running)return;if(!paused){const dt=Math.min(.03,(t-last)/1000);last=t;update(dt);draw();}else last=t;raf=requestAnimationFrame(loop);}
  function start(){player={x:W/2,y:H-50};obs=[];score=0;spawn=.3;$('#dodgeScore').textContent='0';overlay.classList.add('hidden');running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
  function move(e){const r=canvas.getBoundingClientRect();player.x=clamp((e.clientX-r.left)/r.width*W,22,W-22);}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);move(e)});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')move(e)});$('#dodgeStart').addEventListener('click',start);player={x:W/2,y:H-50};draw();cleanupActive=()=>{running=false;cancelAnimationFrame(raf);};
}

/* ---------- Memory ---------- */
function initMemory(){
  let first=null,lock=false,moves=0,matched=0;
  const old=getNum(KEYS.memory);
  setStats(stat('MOVES','0','memoryMoves')+stat('BEST',old||'—','memoryBest'));
  gameStage.innerHTML=`<div id="memoryGrid" class="memory-grid"></div><div class="button-row"><button id="memoryReset" class="secondary-btn" type="button">다시 섞기</button></div>`;
  const grid=$('#memoryGrid'), symbols=['●','▲','■','◆','★','✦','✚','✿'];
  function build(){first=null;lock=false;moves=0;matched=0;$('#memoryMoves').textContent='0';const deck=shuffle([...symbols,...symbols]);grid.innerHTML='';deck.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='memory-card';b.dataset.symbol=s;b.dataset.i=i;b.textContent='';b.addEventListener('click',()=>flip(b));grid.appendChild(b);});}
  function flip(b){if(paused||lock||b.classList.contains('matched')||b===first)return;b.textContent=b.dataset.symbol;b.classList.add('open');if(!first){first=b;return;}moves++;$('#memoryMoves').textContent=moves;if(first.dataset.symbol===b.dataset.symbol){first.classList.add('matched');b.classList.add('matched');first=null;matched+=2;if(matched===16){const old=getNum(KEYS.memory);if(!old||moves<old)setNum(KEYS.memory,moves);$('#memoryBest').textContent=getNum(KEYS.memory);showToast(`완료 · ${moves}회`);}}else{lock=true;const a=first;setTimeout(()=>{a.textContent='';b.textContent='';a.classList.remove('open');b.classList.remove('open');first=null;lock=false;},620);}}
  $('#memoryReset').addEventListener('click',build);build();cleanupActive=()=>{};
}

window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&activeGame)goHome();
  if(e.key===' '&&activeGame){if(['stack'].includes(activeGame)){e.preventDefault();$('#stackCanvas')?.dispatchEvent(new PointerEvent('pointerdown'));}}
});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
