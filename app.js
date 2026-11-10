(function(){
'use strict';
// ── Where the timetable data lives (data.json in this GitHub repository) ──
var CONFIG={owner:'daybydaye',repo:'english-timetable',branch:'main',path:'data.json'};
(function(){var m=location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i),seg=location.pathname.split('/').filter(Boolean);
  if(m){CONFIG.owner=m[1];if(seg.length&&!/\.html?$/i.test(seg[0]))CONFIG.repo=seg[0]}})();
var API='https://api.github.com/repos/'+CONFIG.owner+'/'+CONFIG.repo+'/contents/'+CONFIG.path;

var ADMIN=document.body.getAttribute('data-mode')==='teacher';
var DAYS=['월','화','수','목','금','토','일'];
var DAYEN={'월':'Mon','화':'Tue','수':'Wed','목':'Thu','금':'Fri','토':'Sat','일':'Sun'};
var root=document.getElementById('root');
var state=null,savedJSON='',sha=null,painting=false;

function lget(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lset(k,v){try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k)}catch(e){}}
function sget(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function sset(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function B(en,ko){return '<span class="en">'+esc(en)+'</span><span class="ko">'+esc(ko)+'</span>'}
function b64e(s){return btoa(unescape(encodeURIComponent(s)))}
function b64d(s){return decodeURIComponent(escape(atob(String(s).replace(/\s/g,''))))}

var MSG={
  saved:['Saved. Students will see it within 1–2 minutes.','저장했어요. 1~2분 안에 학생 화면에 반영됩니다.'],
  conflict:['Another teacher saved first. The latest timetable is loaded, so please redo your last changes.','다른 선생님이 먼저 저장했어요. 최신 시간표를 불러왔으니 방금 바꾼 내용을 다시 칠해 주세요.'],
  auth:['This teacher key does not work. Check the key and enter it again.','선생님 키가 맞지 않아요. 키를 확인하고 다시 입력해 주세요.'],
  noedit:['This key can view but not save. Ask the director for a key with edit access.','이 키로는 저장할 수 없어요. 원장님께 수정 권한이 있는 키를 받아 주세요.'],
  fail:['Could not save. Check the internet connection and try again.','저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'],
  loadfail:['Could not load the timetable. Please refresh in a moment.','시간표를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'],
  range:['End time must be later than start time.','끝 시간은 시작 시간보다 늦어야 해요.']
};
var view={teacher:sget('tt.teacher'),brush:'open',pick:null,req:false,sname:lget('tt.sname')||'',scur:'',
  saving:false,loading:true,msg:'',confirmDel:false,token:ADMIN?(lget('tt.key')||''):'',checking:false};

function toMin(s){var p=String(s||'0:0').split(':');return (+p[0])*60+(+p[1]||0)}
function fmt(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function times(){var st=state.settings,a=toMin(st.start),b=toMin(st.end),step=Math.max(10,+st.step||30),out=[];for(var t=a;t<b&&out.length<100;t+=step)out.push(fmt(t));return out}
function key(t,d,tm){return t+'|'+d+'|'+tm}
function cell(t,d,tm){return state.cells[key(t,d,tm)]||null}
function teacher(){var ts=state.teachers;for(var i=0;i<ts.length;i++)if(ts[i].id===view.teacher)return ts[i];return ts[0]||null}
function openCount(t){var n=0,tl=times();state.settings.days.forEach(function(d){tl.forEach(function(tm){var c=cell(t.id,d,tm);if(c&&c.s==='open')n++})});return n}
function dirty(){return !!state&&JSON.stringify(state)!==savedJSON}
function stamp(){if(!state||!state.updated)return '';var d=new Date(state.updated);if(isNaN(d))return '';return ' · Updated 업데이트 '+(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function clock(m){if(m>=1440)return '24:00 (midnight · 밤 12시)';var h=Math.floor(m/60),mm=String(m%60).padStart(2,'0'),h12=h%12===0?12:h%12;return fmt(m)+' ('+h12+':'+mm+(h<12?' AM · 오전':' PM · 오후')+')'}
function timeOpts(cur,a,b){var c=toMin(cur);if(c%5)c=c-c%5+5;for(var m=a,o='';m<=b;m+=5)o+='<option value="'+fmt(m)+'"'+(m===c?' selected':'')+'>'+clock(m)+'</option>';return o}
function msgHTML(k){var m=MSG[k];return m?B(m[0],m[1]):''}
function kakaoURL(){var u=String(state&&state.settings.kakao||'').trim();return /^https:\/\/open\.kakao\.com\/[A-Za-z0-9_\/?=&.-]+$/.test(u)?u:''}
function normalize(s){
  s=s&&typeof s==='object'?s:{};
  s.settings=s.settings||{};var st=s.settings;
  if(!Array.isArray(st.days))st.days=DAYS.slice(0,5);
  st.start=st.start||'15:00';st.end=st.end||'21:00';st.step=+st.step||30;st.contact=st.contact||'';st.kakao=st.kakao||'';
  if(!Array.isArray(s.teachers))s.teachers=[];
  if(!s.cells||typeof s.cells!=='object')s.cells={};
  return s;
}

// ── Loading & saving through the GitHub API ──
function authHeaders(){return {Authorization:'Bearer '+view.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}
function loadPublic(){
  return fetch(API+'?ref='+CONFIG.branch+'&t='+Date.now(),{headers:{Accept:'application/vnd.github.raw+json'},cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('api '+r.status);return r.json()})
    .catch(function(){return fetch('data.json?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('file '+r.status);return r.json()})});
}
function loadAuthed(){
  return fetch(API+'?ref='+CONFIG.branch+'&t='+Date.now(),{headers:authHeaders(),cache:'no-store'}).then(function(r){
    if(r.status===401||r.status===403||r.status===404)throw {code:'auth'};
    if(!r.ok)throw {code:'loadfail'};
    return r.json();
  }).then(function(j){sha=j.sha;return JSON.parse(b64d(j.content))});
}
function setState(s){state=normalize(s);savedJSON=JSON.stringify(state);view.loading=false}
function save(){
  if(!state||view.saving)return;
  var next=JSON.parse(JSON.stringify(state));next.updated=new Date().toISOString();
  var T=teacher();
  view.saving=true;view.msg='';render();
  fetch(API,{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),
    body:JSON.stringify({message:'시간표 수정'+(T?' ('+T.name+')':''),content:b64e(JSON.stringify(next)+'\n'),sha:sha,branch:CONFIG.branch})})
  .then(function(r){
    if(r.ok)return r.json().then(function(j){sha=j.content&&j.content.sha||sha;setState(next);view.saving=false;view.msg='saved';render()});
    if(r.status===409||r.status===422)return loadAuthed().then(function(s){setState(s);view.saving=false;view.msg='conflict';render()});
    if(r.status===401){view.saving=false;view.msg='auth';render();return}
    if(r.status===403||r.status===404){view.saving=false;view.msg='noedit';render();return}
    throw new Error('save '+r.status);
  }).catch(function(){view.saving=false;view.msg='fail';render()});
}

// ── Rendering ──
function cellInner(c,picked){
  var s=c?c.s:'off';
  if(ADMIN){if(s==='open')return B('Open','가능');if(s==='booked')return B('Booked','예약');return ''}
  if(s==='open')return picked?B('Selected','선택됨'):B('Open','예약 가능');
  if(s==='booked')return B('Full','마감');
  return '';
}
function cellHTML(t,d,tm){
  var c=cell(t.id,d,tm),s=c?c.s:'off';
  var picked=view.pick&&view.pick.d===d&&view.pick.tm===tm&&view.pick.t===t.id;
  var label=DAYEN[d]+' '+tm+' '+(s==='open'?'open':s==='booked'?'booked':'no class');
  var dis=(!ADMIN&&s!=='open')?' tabindex="-1" aria-disabled="true"':'';
  return '<button type="button" class="c '+s+(picked?' pick':'')+'" data-cell="'+esc(key(t.id,d,tm))+'" aria-label="'+esc(label)+'"'+dis+'>'+cellInner(c,picked)+'</button>';
}
function reqMsg(T){
  var p=view.pick&&T&&view.pick.t===T.id?view.pick:null;
  return '[시간 변경 신청 / Time change request]\n'+
    '학생 이름 Name: '+view.sname.trim()+'\n'+
    '현재 수업 Current class: '+view.scur.trim()+'\n'+
    '희망 시간 New time: '+(p?T.name+' · '+p.d+'요일 ('+DAYEN[p.d]+') '+p.tm:'');
}
function copyText(txt,ta){
  var ok=function(){var s=document.getElementById('copiedNote');if(s)s.hidden=false};
  var fb=function(){if(ta){ta.focus();ta.select();try{if(document.execCommand('copy'))ok()}catch(e){}}};
  try{navigator.clipboard.writeText(txt).then(ok,fb)}catch(e){fb()}
}

function header(){
  var h='<header class="top"><div><h1>'+B('Online English Timetable','화상영어 시간표')+'</h1><div class="sub">'+
    (ADMIN?'Teacher page · 선생님 페이지 · ':'')+'Korea time (KST) · repeats every week · 한국 시간 기준, 매주 반복'+esc(stamp())+'</div></div>';
  if(!ADMIN)h+='<div class="req-top"><button type="button" class="btn kakao big" data-act="req">'+B('Request a change','시간 변경 신청')+'</button><small>1:1 오픈채팅으로 바로 연결돼요</small></div>';
  else if(view.token)h+='<div class="row"><a class="btn" href="./" target="_blank" rel="noopener">'+B('Student view','학생 화면')+'</a><button type="button" class="btn" data-act="logout">'+B('Sign out','키 지우기')+'</button></div>';
  return h+'</header>';
}
function loginPanel(){
  return '<form class="panel login" id="loginForm"><h3>'+B('Teacher key','선생님 키')+'</h3>'+
    '<p class="help">'+B('Paste the teacher key from the director. It is kept only on this device.','원장님께 받은 선생님 키를 붙여넣어 주세요. 이 기기에만 저장됩니다.')+'</p>'+
    '<input class="field" type="password" id="keyIn" autocomplete="off" spellcheck="false" placeholder="github_pat_…" style="border:1px solid var(--line);border-radius:8px;padding:9px 10px;background:var(--bg)">'+
    '<div class="row"><button type="submit" class="btn primary"'+(view.checking?' disabled':'')+'>'+(view.checking?B('Checking…','확인 중…'):B('Start editing','편집 시작'))+'</button></div></form>';
}

function render(){
  var h='<div class="wrap '+(ADMIN?'admin':'student')+'">'+header();
  if(view.msg)h+='<div class="msg" role="status">'+msgHTML(view.msg)+'</div>';
  if(ADMIN&&!view.token){h+=loginPanel()+'<p class="foot"><a href="./">'+B('← Student timetable','학생 시간표로')+'</a></p></div>';root.innerHTML=h;return}
  if(!state){h+='<div class="panel empty">'+(view.loading?B('Loading the timetable…','시간표를 불러오는 중…'):B('No timetable to show.','표시할 시간표가 없어요.'))+'</div></div>';root.innerHTML=h;return}
  var T=teacher();if(T)view.teacher=T.id;
  h+='<div class="tabs" role="tablist">';
  state.teachers.forEach(function(t){h+='<button type="button" class="tab" role="tab" data-act="tab" data-id="'+esc(t.id)+'" aria-selected="'+(T&&t.id===T.id)+'"><b>'+esc(t.name)+'</b><small>'+B('Open slots','빈 시간')+'<span class="n">'+openCount(t)+'</span></small></button>'});
  if(ADMIN)h+='<button type="button" class="tab add" data-act="addT">'+B('+ Add teacher','선생님 추가')+'</button>';
  h+='</div>';
  if(!T){h+='<div class="panel empty">'+B('No teachers yet.','아직 등록된 선생님이 없습니다.')+'</div></div>';root.innerHTML=h+savebar();return}
  h+='<div class="teacher-head"><h2>'+esc(T.name)+'</h2>'+(T.note?'<span class="note">'+esc(T.note)+'</span>':'')+'</div>';
  if(ADMIN){
    h+='<div class="panel"><div class="row" style="justify-content:space-between"><h3>'+B('Paint tool','칠하기 도구')+'</h3><p class="help">'+B('Tap or drag over cells to paint them, then Save.','칸을 누르거나 드래그해서 칠한 뒤 저장을 누르세요.')+'</p></div>';
    h+='<div class="brush" role="group" aria-label="Paint">'+
      '<button type="button" data-act="brush" data-v="open" aria-pressed="'+(view.brush==='open')+'"><span class="sw open"></span>'+B('Open','예약 가능')+'</button>'+
      '<button type="button" data-act="brush" data-v="booked" aria-pressed="'+(view.brush==='booked')+'"><span class="sw booked"></span>'+B('Booked','예약됨')+'</button>'+
      '<button type="button" data-act="brush" data-v="off" aria-pressed="'+(view.brush==='off')+'"><span class="sw off"></span>'+B('No class','수업 없음')+'</button></div></div>';
  }else{
    h+='<div class="legend"><span><span class="sw open"></span>'+B('Open','예약 가능')+'</span><span><span class="sw booked"></span>'+B('Full','마감')+'</span><span><span class="sw off"></span>'+B('No class','수업 없음')+'</span></div>';
  }
  var tl=times(),days=state.settings.days;
  h+='<div class="gridbox"><table class="grid"><thead><tr><th scope="col"></th>';
  days.forEach(function(d){h+='<th scope="col">'+B(DAYEN[d],d)+'</th>'});
  h+='</tr></thead><tbody>';
  tl.forEach(function(tm){h+='<tr><th scope="row">'+tm+'</th>';days.forEach(function(d){h+='<td>'+cellHTML(T,d,tm)+'</td>'});h+='</tr>'});
  h+='</tbody></table></div>';
  if(!ADMIN){
    var p=view.pick&&view.pick.t===T.id?view.pick:null;
    if(p||view.req){
      var ku=kakaoURL();
      h+='<div class="panel" id="reqPanel"><h3>'+B('Time change request','시간 변경 신청')+'</h3>';
      h+=p?'<div class="pickline">'+B('New time','희망 시간')+' · <strong>'+esc(T.name)+'</strong> · '+esc(DAYEN[p.d])+' '+esc(p.d)+'요일 · '+esc(p.tm)+'</div>'
          :'<p class="help">'+B('Tap a green “Open” slot above to choose the new time, or write it in the chat.','위 시간표에서 초록색 ‘예약 가능’ 칸을 누르면 희망 시간이 들어가요. 채팅에 직접 적어도 돼요.')+'</p>';
      h+='<div class="fields"><label class="field"><span>'+B('Student name','학생 이름')+'</span><input id="sName" data-in="sname" value="'+esc(view.sname)+'" maxlength="20" placeholder="e.g. 김민준"></label>'+
        '<label class="field"><span>'+B('Current class','지금 수업 시간')+'</span><input id="sCur" data-in="scur" value="'+esc(view.scur)+'" maxlength="40" placeholder="e.g. 월·수 19:05 Kimmy"></label></div>';
      h+='<textarea class="copy" id="copyText" rows="4" readonly>'+esc(reqMsg(T))+'</textarea>';
      h+='<div class="row">'+(ku?'<a class="btn kakao big" href="'+esc(ku)+'" target="_blank" rel="noopener" data-act="kakao">'+B('Copy & open chat','복사하고 오픈채팅 열기')+'</a>':'<button type="button" class="btn primary" data-act="copy">'+B('Copy request','신청 문구 복사')+'</button>')+
        '<button type="button" class="btn" data-act="unpick">'+B('Close','닫기')+'</button><span class="copied" id="copiedNote" hidden>'+B('Copied! Paste it in the chat.','복사했어요! 채팅창에 붙여넣어 보내 주세요.')+'</span></div>';
      h+='<p class="help">'+esc(state.settings.contact)+'</p></div>';
    }else{
      h+='<p class="help">'+B('Tap a green “Open” slot or “Request a change” to send a request.','초록색 ‘예약 가능’ 칸이나 ‘시간 변경 신청’ 버튼을 누르면 신청할 수 있어요.')+'<span class="ko">'+esc(state.settings.contact)+'</span></p>';
    }
    h+='<p class="foot"><a href="trial.html">'+B('Book a trial class','체험수업 신청')+'</a> · <a href="teacher.html">'+B('Teachers','선생님 페이지')+'</a></p>';
  }else{
    h+='<div class="panel"><h3>'+B('Teacher info','선생님 정보')+'</h3><div class="fields">'+
      '<label class="field"><span>'+B('Name','이름')+'</span><input id="tName" data-in="tName" value="'+esc(T.name)+'" maxlength="30"></label>'+
      '<label class="field"><span>'+B('One-line intro','소개 한 줄')+'</span><input id="tNote" data-in="tNote" value="'+esc(T.note||'')+'" maxlength="60" placeholder="e.g. Phonics · Reading"></label></div>'+
      '<div class="row">'+(view.confirmDel?'<span class="help">'+B('Delete '+T.name+' and all of their slots?',T.name+' 선생님과 시간표를 모두 지울까요?')+'</span><button type="button" class="btn danger" data-act="delT">'+B('Yes, delete','네, 삭제')+'</button><button type="button" class="btn" data-act="noDel">'+B('Cancel','취소')+'</button>':'<button type="button" class="btn danger" data-act="askDel">'+B('Delete teacher','선생님 삭제')+'</button><button type="button" class="btn" data-act="clearT">'+B('Clear all slots','시간 모두 비우기')+'</button>')+'</div></div>';
    var st=state.settings;
    h+='<details class="panel"'+(sget('tt.set')==='1'?' open':'')+' id="setBox"><summary>'+B('Shared settings (days · hours · notice · open chat)','공통 설정 (요일 · 시간 · 안내 문구 · 오픈채팅)')+'</summary>';
    h+='<div class="field"><span>'+B('Class days','수업 요일')+'</span><div class="days">'+DAYS.map(function(d){return '<button type="button" data-act="day" data-v="'+d+'" aria-pressed="'+(st.days.indexOf(d)>=0)+'">'+B(DAYEN[d],d)+'</button>'}).join('')+'</div></div>';
    h+='<div class="fields"><label class="field"><span>'+B('Start (KST)','시작')+'</span><select data-in="start">'+timeOpts(st.start,0,1435)+'</select></label>'+
      '<label class="field"><span>'+B('End (KST)','끝')+'</span><select data-in="end">'+timeOpts(st.end,5,1440)+'</select></label>'+
      '<label class="field"><span>'+B('Slot length','한 칸 길이')+'</span><select data-in="step">'+[20,25,30,40,50,60].map(function(n){return '<option value="'+n+'"'+(+st.step===n?' selected':'')+'>'+n+' min / '+n+'분</option>'}).join('')+'</select></label></div>';
    h+='<label class="field"><span>'+B('Request notice for students','학생에게 보이는 신청 안내')+'</span><input data-in="contact" value="'+esc(st.contact)+'" maxlength="200"></label>';
    h+='<label class="field"><span>'+B('KakaoTalk 1:1 open chat link','카카오톡 1:1 오픈채팅 링크')+'</span><input data-in="kakao" value="'+esc(st.kakao||'')+'" maxlength="120" placeholder="https://open.kakao.com/o/..."></label>';
    if(st.kakao&&!kakaoURL())h+='<p class="help" style="color:var(--danger)">'+B('Link must start with https://open.kakao.com/','링크는 https://open.kakao.com/ 으로 시작해야 해요.')+'</p>';
    h+='</details>';
    h+='<p class="help">'+B('This timetable is a public website. Do not write student names here.','이 시간표는 누구나 볼 수 있는 공개 사이트예요. 학생 이름은 적지 마세요.')+'</p>';
  }
  h+='</div>';
  root.innerHTML=h+savebar();
}
function savebar(){
  if(!ADMIN||!state||!view.token)return '';
  var d=dirty();
  var st=view.saving?B('Saving…','저장 중…'):d?B('Unsaved changes. Save to update the student page.','저장 안 된 변경이 있어요. 저장하면 학생 화면에 반영됩니다.'):B('All changes saved.','모든 변경이 저장되어 있어요.');
  return '<div class="savebar"><div class="in"><span class="st'+(d?' dirty':'')+'">'+st+'</span><div class="row"><button type="button" class="btn" data-act="revert"'+(d&&!view.saving?'':' disabled')+'>'+B('Undo','되돌리기')+'</button><button type="button" class="btn primary" data-act="save"'+(d&&!view.saving?'':' disabled')+'>'+B('Save','저장')+'</button></div></div></div>';
}
function refreshBar(){var b=root.querySelector('.savebar');if(b){var t=document.createElement('div');t.innerHTML=savebar();b.replaceWith(t.firstChild)}}

// ── Editing ──
function paint(el){
  var k=el.getAttribute('data-cell'),cur=state.cells[k];
  if(view.brush==='off'){if(!cur)return;delete state.cells[k]}
  else{if(cur&&cur.s===view.brush)return;state.cells[k]={s:view.brush}}
  var c=state.cells[k];
  el.className='c '+(c?c.s:'off');el.innerHTML=cellInner(c,false);
  refreshBar();
}
root.addEventListener('pointerdown',function(e){
  if(!ADMIN||!state)return;var c=e.target.closest('[data-cell]');if(!c)return;
  if(e.pointerType==='touch'){paint(c);return}
  e.preventDefault();painting=true;paint(c);
});
document.addEventListener('pointermove',function(e){
  if(!painting)return;var el=document.elementFromPoint(e.clientX,e.clientY);var c=el&&el.closest&&el.closest('[data-cell]');if(c)paint(c);
});
document.addEventListener('pointerup',function(){if(painting){painting=false;render()}});
root.addEventListener('keydown',function(e){
  if(ADMIN&&(e.key==='Enter'||e.key===' ')){var c=e.target.closest&&e.target.closest('[data-cell]');if(c){e.preventDefault();paint(c)}}
});
root.addEventListener('toggle',function(e){if(e.target.id==='setBox')sset('tt.set',e.target.open?'1':'0')},true);
root.addEventListener('submit',function(e){
  if(e.target.id!=='loginForm')return;e.preventDefault();
  var v=(document.getElementById('keyIn').value||'').trim();if(!v)return;
  view.token=v;view.checking=true;view.msg='';
  loadAuthed().then(function(s){lset('tt.key',v);setState(s);view.checking=false;render()},function(err){
    view.token='';view.checking=false;view.msg=err&&err.code==='auth'?'auth':'loadfail';render();
  });
  render();
});
root.addEventListener('click',function(e){
  var c=e.target.closest('[data-cell]');
  if(c&&!ADMIN){
    var p=c.getAttribute('data-cell').split('|'),cc=state.cells[c.getAttribute('data-cell')];
    if(cc&&cc.s==='open'){view.pick={t:p[0],d:p[1],tm:p[2]};view.req=true;render();var pl=document.getElementById('reqPanel');if(pl)pl.scrollIntoView({block:'nearest',behavior:'smooth'})}
    return;
  }
  var b=e.target.closest('[data-act]');if(!b)return;
  var a=b.getAttribute('data-act'),v=b.getAttribute('data-v');
  if(a==='kakao'){copyText(reqMsg(teacher()),document.getElementById('copyText'));return}
  if(a==='copy'){copyText(reqMsg(teacher()),document.getElementById('copyText'));return}
  if(a==='req'){if(!state)return;view.req=true;render();var rp=document.getElementById('reqPanel');if(rp){rp.scrollIntoView({block:'center',behavior:'smooth'});var sn=document.getElementById('sName');if(sn&&!view.sname)sn.focus({preventScroll:true})}return}
  if(a==='logout'){if(dirty()&&!confirm('저장 안 된 변경이 있어요. 그래도 키를 지울까요?'))return;view.token='';lset('tt.key','');state=null;savedJSON='';sha=null;view.msg=''}
  else if(a==='tab'){view.teacher=b.getAttribute('data-id');sset('tt.teacher',view.teacher);view.pick=null;view.confirmDel=false}
  else if(a==='addT'){var id='t'+Date.now().toString(36);state.teachers.push({id:id,name:'New Teacher',note:''});view.teacher=id;sset('tt.teacher',id);render();var n=document.getElementById('tName');if(n){n.focus();n.select()}return}
  else if(a==='brush'){view.brush=v}
  else if(a==='askDel'){view.confirmDel=true}
  else if(a==='noDel'){view.confirmDel=false}
  else if(a==='delT'){var T=teacher();state.teachers=state.teachers.filter(function(t){return t!==T});Object.keys(state.cells).forEach(function(k){if(k.split('|')[0]===T.id)delete state.cells[k]});view.confirmDel=false;view.teacher=state.teachers[0]?state.teachers[0].id:null}
  else if(a==='clearT'){var T2=teacher();Object.keys(state.cells).forEach(function(k){if(k.split('|')[0]===T2.id)delete state.cells[k]})}
  else if(a==='day'){var ds=state.settings.days,i=ds.indexOf(v);if(i>=0)ds.splice(i,1);else{ds.push(v);ds.sort(function(x,y){return DAYS.indexOf(x)-DAYS.indexOf(y)})}}
  else if(a==='unpick'){view.pick=null;view.req=false}
  else if(a==='revert'){state=JSON.parse(savedJSON);view.confirmDel=false}
  else if(a==='save'){save();return}
  render();
});
root.addEventListener('input',function(e){
  var f=e.target.getAttribute&&e.target.getAttribute('data-in');if(!f||!state)return;var v=e.target.value,T=teacher();
  if(f==='sname'||f==='scur'){view[f]=v;if(f==='sname')lset('tt.sname',v);var ct=document.getElementById('copyText');if(ct)ct.value=reqMsg(T);var cn=document.getElementById('copiedNote');if(cn)cn.hidden=true;return}
  if(f==='tName'&&T){T.name=v;var tb=root.querySelector('.tab[aria-selected="true"] b');if(tb)tb.textContent=v;var h2=root.querySelector('.teacher-head h2');if(h2)h2.textContent=v}
  else if(f==='tNote'&&T){T.note=v}
  else if(f==='contact'){state.settings.contact=v}
  else if(f==='kakao'){state.settings.kakao=v.trim()}
  else return;
  refreshBar();
});
root.addEventListener('change',function(e){
  var f=e.target.getAttribute&&e.target.getAttribute('data-in');if(!f||!state)return;var v=e.target.value;
  if(f==='start'||f==='end'){if(/^\d\d:\d\d$/.test(v)){state.settings[f]=v;if(toMin(state.settings.end)<=toMin(state.settings.start))view.msg='range';else if(view.msg==='range')view.msg=''}}
  else if(f==='step'){state.settings.step=+v}
  else if(f==='kakao'){render();return}
  else return;
  render();
});
window.addEventListener('beforeunload',function(e){if(ADMIN&&dirty()){e.preventDefault();e.returnValue=''}});

// ── Start ──
render();
if(ADMIN){
  if(view.token)loadAuthed().then(function(s){setState(s);render()},function(err){
    if(err&&err.code==='auth'){view.token='';lset('tt.key','');view.msg='auth'}else view.msg='loadfail';view.loading=false;render();
  });
}else{
  loadPublic().then(function(s){setState(s);render()},function(){view.loading=false;view.msg='loadfail';render()});
}
})();
