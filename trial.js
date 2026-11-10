(function(){
'use strict';
// ── 체험수업 신청 페이지 (trial.html) ──
// 시간표(data.json)에서 '예약 가능' 칸을 읽어, 날짜를 고르면 그날 가능한 시간만 보여 줍니다.
// 신청하기를 누르면 신청 문구가 복사되고 카카오톡 1:1 오픈채팅이 열립니다.
// 안내 문구를 바꾸고 싶으면 data.json에 "trial": {"intro": "...", "ahead": 14, "length": 20} 를 넣으면 돼요.
var CONFIG={owner:'daybydaye',repo:'english-timetable',branch:'main',path:'data.json'};
(function(){var m=location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i),seg=location.pathname.split('/').filter(Boolean);
  if(m){CONFIG.owner=m[1];if(seg.length&&!/\.html?$/i.test(seg[0]))CONFIG.repo=seg[0]}})();
var API='https://api.github.com/repos/'+CONFIG.owner+'/'+CONFIG.repo+'/contents/'+CONFIG.path;

var DAYS=['일','월','화','수','목','금','토']; // JS getDay() 순서
var DAYEN={'월':'Mon','화':'Tue','수':'Wed','목':'Thu','금':'Fri','토':'Sat','일':'Sun'};
var LEVELS=[['First time','처음 배워요'],['A little','조금 해 봤어요'],['1–2 years','1~2년 배웠어요'],['3+ years','3년 이상']];
var root=document.getElementById('root');
var state=null,loading=true,failed=false;
var f={name:lget('tr.name')||'',grade:'',level:'',date:'',time:'',other:'',note:''},tried=false;

function lget(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lset(k,v){try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k)}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function B(en,ko){return '<span class="en">'+esc(en)+'</span><span class="ko">'+esc(ko)+'</span>'}
function toMin(s){var p=String(s||'0:0').split(':');return (+p[0])*60+(+p[1]||0)}
function fmt(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function ampm(tm){var h=Math.floor(toMin(tm)/60);return h<12?'오전':h<18?'오후':'저녁'}

function trialCfg(){var t=state&&state.trial||{};return {intro:t.intro||'',ahead:Math.min(42,Math.max(3,+t.ahead||14))}}
function step(){var t=state&&state.trial;return Math.max(5,+(t&&t.length)||20)} // 체험수업 길이(분). data.json의 "trial": {"length": 20} 로 바꿀 수 있어요.
function kakaoURL(){var u=String(state&&state.settings&&state.settings.kakao||'').trim();return /^https:\/\/open\.kakao\.com\/[A-Za-z0-9_\/?=&.-]+$/.test(u)?u:''}

// 한국 시간 기준 날짜 목록 (내일부터 ahead일)
function dates(){
  var now=new Date(Date.now()+9*3600e3),out=[],n=trialCfg().ahead;
  for(var i=1;i<=n;i++){
    var d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+i));
    var iso=d.toISOString().slice(0,10),day=DAYS[d.getUTCDay()];
    out.push({iso:iso,m:d.getUTCMonth()+1,dd:d.getUTCDate(),day:day,slots:slotsFor(day)});
  }
  return out;
}
// 그 요일에 한 명이라도 '예약 가능'인 시간
function slotsFor(day){
  if(!state||state.settings.days.indexOf(day)<0)return [];
  var set={};
  Object.keys(state.cells).forEach(function(k){var p=k.split('|');if(p[1]===day&&state.cells[k]&&state.cells[k].s==='open')set[p[2]]=1});
  return Object.keys(set).sort(function(a,b){return toMin(a)-toMin(b)});
}
function picked(){var ds=dates();for(var i=0;i<ds.length;i++)if(ds[i].iso===f.date)return ds[i];return null}
function dateLabel(d){return d.m+'월 '+d.dd+'일 ('+d.day+')'}

function msg(){
  var d=picked(),lv=LEVELS.filter(function(l){return l[1]===f.level})[0];
  return '[체험수업 신청 / Trial class request]\n'+
    '학생 이름 Name: '+f.name.trim()+'\n'+
    '학년·나이 Grade: '+f.grade.trim()+'\n'+
    '영어 경험 Level: '+(lv?lv[1]:'')+'\n'+
    '희망 날짜 Date: '+(d?dateLabel(d)+' · '+d.iso:'')+'\n'+
    '희망 시간 Time: '+(f.time?f.time+' (한국 시간, '+step()+'분)':'')+'\n'+
    '다른 가능 시간 Other times: '+f.other.trim()+'\n'+
    '하고 싶은 말 Note: '+f.note.trim();
}
function missing(){
  var m=[];
  if(!f.name.trim())m.push('학생 이름');
  if(!(f.date&&f.time)&&!f.other.trim())m.push('희망 날짜·시간');
  return m;
}

function guide(){
  var c=trialCfg(),len=step();
  var h='<section class="panel trial-guide"><h3>'+B('About the trial class','체험수업 안내')+'</h3>';
  if(c.intro)h+='<p class="lead">'+esc(c.intro)+'</p>';
  h+='<ul class="facts">'+
    '<li><b>'+len+'분</b>'+B('1:1 online class','1:1 화상수업')+'</li>'+
    '<li><b>KST</b>'+B('All times are Korea time','모든 시간은 한국 시간')+'</li>'+
    '<li><b>1회</b>'+B('One trial per student','학생 1명당 1회')+'</li></ul>';
  h+='<ol class="steps">'+
    '<li><b>'+B('Pick a date and time','날짜와 시간 고르기')+'</b><span class="help">'+B('Only times with an open teacher are shown.','선생님이 비어 있는 시간만 보여요.')+'</span></li>'+
    '<li><b>'+B('Send the request in open chat','오픈채팅으로 신청 보내기')+'</b><span class="help">'+B('The request is copied. Paste it in the chat and send.','신청 문구가 복사돼요. 채팅창에 붙여넣고 보내 주세요.')+'</span></li>'+
    '<li><b>'+B('Get your confirmation','확정 안내 받기')+'</b><span class="help">'+B('We reply with the teacher and class link.','선생님과 수업 링크를 채팅으로 알려 드려요.')+'</span></li>'+
    '<li><b>'+B('Join the class','수업 참여')+'</b><span class="help">'+B('Join 5 minutes early to check sound and camera.','소리와 카메라 확인을 위해 5분 전에 들어와 주세요.')+'</span></li></ol>';
  h+='<div class="prep"><h4>'+B('Please prepare','준비해 주세요')+'</h4><p class="help">'+
    B('A PC or tablet with camera · earphones with a mic · a quiet place','카메라가 있는 PC나 태블릿 · 마이크 달린 이어폰 · 조용한 공간')+'</p></div>';
  return h+'</section>';
}

function picker(){
  var h='<section class="panel"><h3>'+B('1. Choose a date','1. 날짜 고르기')+'</h3>';
  if(loading)return h+'<p class="help">'+B('Loading open times…','가능한 시간을 불러오는 중…')+'</p></section>';
  if(failed)return h+'<p class="help">'+B('Could not load open times. Write your preferred time below.','가능한 시간을 불러오지 못했어요. 아래에 원하는 시간을 적어 주세요.')+'</p></section>';
  var ds=dates();
  h+='<div class="datebar" role="group" aria-label="Date">';
  ds.forEach(function(d){
    var n=d.slots.length,sel=d.iso===f.date,wk=d.day==='토'||d.day==='일';
    h+='<button type="button" class="dchip'+(wk?' wk':'')+'" data-act="date" data-v="'+d.iso+'" aria-pressed="'+sel+'"'+(n?'':' disabled')+'>'+
      '<span class="dw">'+esc(d.day)+'</span><span class="dn">'+d.m+'/'+d.dd+'</span><span class="dc">'+(n?n+'개':'—')+'</span></button>';
  });
  h+='</div>';
  var p=picked();
  h+='<h3>'+B('2. Choose a time','2. 시간 고르기')+(p?' <span class="pickday">· '+esc(dateLabel(p))+'</span>':'')+'</h3>';
  if(!p)h+='<p class="help">'+B('Pick a date first. The number shows open times that day.','먼저 날짜를 골라 주세요. 날짜 아래 숫자는 그날 가능한 시간 개수예요.')+'</p>';
  else{
    var groups={};p.slots.forEach(function(tm){(groups[ampm(tm)]=groups[ampm(tm)]||[]).push(tm)});
    ['오전','오후','저녁'].forEach(function(g){
      if(!groups[g])return;
      h+='<div class="tgroup"><span class="tg">'+g+'</span><div class="times">';
      groups[g].forEach(function(tm){h+='<button type="button" class="tchip" data-act="time" data-v="'+tm+'" aria-pressed="'+(tm===f.time)+'">'+tm+'</button>'});
      h+='</div></div>';
    });
  }
  h+='<label class="field"><span>'+B('No time that works? Other times you can do','원하는 시간이 없나요? 가능한 다른 시간')+'</span><input data-in="other" value="'+esc(f.other)+'" maxlength="80" placeholder="예: 평일 저녁 7시 이후, 토요일 오전"></label>';
  return h+'</section>';
}

function form(){
  var miss=tried?missing():[],ku=kakaoURL(),ok=!missing().length;
  var h='<section class="panel" id="sendBox"><h3>'+B('3. Student info','3. 학생 정보')+'</h3>';
  h+='<div class="fields">'+
    '<label class="field"><span>'+B('Student name','학생 이름')+' *</span><input data-in="name" value="'+esc(f.name)+'" maxlength="20" placeholder="예: 김민준"'+(miss.indexOf('학생 이름')>=0?' aria-invalid="true"':'')+'></label>'+
    '<label class="field"><span>'+B('Grade / age','학년·나이')+'</span><input data-in="grade" value="'+esc(f.grade)+'" maxlength="20" placeholder="예: 초등 3학년"></label></div>';
  h+='<div class="field"><span>'+B('English experience','영어 경험')+'</span><div class="levels">';
  LEVELS.forEach(function(l){h+='<button type="button" data-act="level" data-v="'+esc(l[1])+'" aria-pressed="'+(f.level===l[1])+'">'+B(l[0],l[1])+'</button>'});
  h+='</div></div>';
  h+='<label class="field"><span>'+B('Anything we should know?','하고 싶은 말')+'</span><input data-in="note" value="'+esc(f.note)+'" maxlength="120" placeholder="예: 파닉스부터 하고 싶어요, 말하기 위주로 원해요"></label>';
  h+='<textarea class="copy" id="copyText" rows="8" readonly aria-label="신청 문구">'+esc(msg())+'</textarea>';
  if(miss.length)h+='<p class="warn" role="alert">'+esc(miss.join(', '))+'을(를) 입력해 주세요.</p>';
  h+='<div class="row">'+(ku
      ?'<a class="btn kakao big'+(ok?'':' off')+'" href="'+esc(ku)+'" target="_blank" rel="noopener" data-act="send">'+B('Copy & send in open chat','복사하고 오픈채팅으로 신청')+'</a>'
      :'<button type="button" class="btn primary big" data-act="send">'+B('Copy request','신청 문구 복사')+'</button>')+
    '<span class="copied" id="copiedNote" hidden>'+B('Copied! Paste it in the chat and send.','복사했어요! 채팅창에 붙여넣고 보내 주세요.')+'</span></div>';
  h+='<p class="help">'+B('The chat opens in KakaoTalk. Long-press the message box and choose Paste.','카카오톡 오픈채팅이 열리면 입력창을 길게 눌러 ‘붙여넣기’ 후 보내 주세요. 확인 후 확정 메시지를 드립니다.')+'</p>';
  return h+'</section>';
}

function render(){
  var h='<div class="wrap trial"><header class="top"><div><h1>'+B('Trial Class','체험수업 신청')+'</h1>'+
    '<div class="sub">1:1 화상영어 · 한국 시간 기준 · Korea time (KST)</div></div>'+
    '<a class="btn" href="./">'+B('Timetable','시간표 보기')+'</a></header>';
  h+='<div class="trial-cols"><div class="col-a">'+guide()+'</div><div class="col-b">'+picker()+form()+'</div></div>';
  h+='<p class="foot"><a href="./">'+B('← Timetable','시간표로')+'</a></p></div>';
  var ae=document.activeElement,keep=ae&&ae.getAttribute&&ae.getAttribute('data-in');
  root.innerHTML=h;
  if(keep){var el=root.querySelector('[data-in="'+keep+'"]');if(el){el.focus();var v=el.value;try{el.setSelectionRange(v.length,v.length)}catch(e){}}}
}
function refreshMsg(){
  var t=document.getElementById('copyText');if(t)t.value=msg();
  var c=document.getElementById('copiedNote');if(c)c.hidden=true;
  var s=root.querySelector('[data-act="send"]');if(s)s.classList.toggle('off',!!missing().length);
  if(tried&&!missing().length){var w=root.querySelector('.warn');if(w)w.remove();root.querySelectorAll('[aria-invalid]').forEach(function(x){x.removeAttribute('aria-invalid')})}
}
function copyText(txt){
  var ok=function(){var s=document.getElementById('copiedNote');if(s)s.hidden=false};
  var fb=function(){var ta=document.getElementById('copyText');if(ta){ta.focus();ta.select();try{if(document.execCommand('copy'))ok()}catch(e){}}};
  try{navigator.clipboard.writeText(txt).then(ok,fb)}catch(e){fb()}
}

root.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var a=b.getAttribute('data-act'),v=b.getAttribute('data-v');
  if(a==='send'){
    if(missing().length){e.preventDefault();tried=true;render();var sb=document.getElementById('sendBox');if(sb)sb.scrollIntoView({block:'start',behavior:'smooth'});return}
    lset('tr.name',f.name.trim());copyText(msg());return;
  }
  if(a==='date'){if(f.date!==v){f.date=v;f.time=''}}
  else if(a==='time'){f.time=f.time===v?'':v}
  else if(a==='level'){f.level=f.level===v?'':v}
  else return;
  render();
  if(a==='date'){var tg=root.querySelector('.tgroup');if(tg)tg.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
root.addEventListener('input',function(e){
  var k=e.target.getAttribute&&e.target.getAttribute('data-in');if(!k)return;
  f[k]=e.target.value;refreshMsg();
});

function load(){
  return fetch(API+'?ref='+CONFIG.branch+'&t='+Date.now(),{headers:{Accept:'application/vnd.github.raw+json'},cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('api '+r.status);return r.json()})
    .catch(function(){return fetch('data.json?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('file '+r.status);return r.json()})});
}
render();
load().then(function(s){
  s=s||{};s.settings=s.settings||{};if(!Array.isArray(s.settings.days))s.settings.days=['월','화','수','목','금'];s.cells=s.cells||{};
  state=s;loading=false;render();
},function(){loading=false;failed=true;render()});
})();
