(function () {
  'use strict';
  const calendar = window.UsisiCalendar;
  const $ = id => document.getElementById(id);
  const esc = calendar.escapeHtml;
  let rows = [], month = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let editingId = null, selectedDate = calendar.today(), busy = false, snapshot = '', rangeReady = false;
  let loadVersion = 0, returnFocus = null, loading = false;
  const fieldIds = ['sch-date','sch-end-date','sch-type','sch-time','sch-title','sch-time2','sch-title2','sch-desc'];
  function state() { return JSON.stringify([...fieldIds.map(id=>$(id).value),$('sch-hl').checked,document.querySelector('input[name="schcolor"]:checked')?.value]); }
  function setBusy(value) { busy=value; $('sch-fields').disabled=value; $('sch-cancel').disabled=value; $('sch-close').disabled=value; $('sch-delete').disabled=value; $('sch-save').disabled=value; $('sch-save').textContent=value?'저장 중…':editingId===null?'일정 등록':'수정 저장'; }
  function render() {
    $('sch-month-title').textContent=`${month.getFullYear()}년 ${month.getMonth()+1}월`;
    $('sch-count').textContent=`전체 ${rows.length}개`;
    calendar.render($('sch-calendar'),{year:month.getFullYear(),month:month.getMonth(),events:rows,selectedDate,editable:true,onDateClick:date=>openEditor(null,date),onEventClick:event=>openEditor(event.id)});
    $('sch-list').innerHTML=rows.length?rows.map(row=>{
      const end=calendar.endDate(row), id=esc(row.id);
      return `<tr><td class="sch-date-range">${esc(row.date)}${end!==row.date?'<br>~ '+esc(end):''}</td><td>${esc([row.time,row.time2].filter(Boolean).join(' / ')||'—')}</td><td><span class="badge ${row.type==='휴방'?'off':'on'}">${row.type==='휴방'?'OFF AIR':'ON AIR'}</span></td><td>${row.highlight?'✦ ':''}${esc(row.title||row.type||'방송')}${row.title2?'<div class="hint">2부 · '+esc(row.title2)+'</div>':''}</td><td><div class="sch-actions"><button type="button" class="sch-action" data-edit="${id}">수정</button><button type="button" class="sch-action danger" data-delete="${id}" aria-label="${esc(row.title||'일정')} 삭제">삭제</button></div></td></tr>`;
    }).join(''):'<tr><td colspan="5" style="text-align:center;padding:25px;color:var(--pf-tx3)">달력에서 날짜를 눌러 첫 일정을 등록해 주세요.</td></tr>';
  }
  async function loadSchedule() {
    const version=++loadVersion;
    loading=true; $('sch-new').disabled=true;
    $('sch-load-error').hidden=true;
    if (!db) { loading=false; $('sch-new').disabled=false; render(); return; }
    try {
      const {data,error}=await db.from('schedule').select('*').order('date',{ascending:false});
      if(error) throw error;
      if(version!==loadVersion) return;
      rows=data||[];
      rangeReady=rows.length>0 && Object.hasOwn(rows[0],'end_date');
      if(!rangeReady) {
        const probe=await db.from('schedule').select('end_date').limit(1);
        if(version!==loadVersion) return;
        if(probe.error && !['42703','PGRST204'].includes(probe.error.code)) throw probe.error;
        rangeReady=!probe.error;
      }
      $('sch-schema-note').hidden=rangeReady;
      render();
    } catch(error) {
      if(version!==loadVersion) return;
      $('sch-load-error').hidden=false;
      $('sch-load-message').textContent='일정을 불러오지 못했어요. 연결 상태와 조회 권한을 확인한 뒤 다시 시도해 주세요.';
      render();
    } finally {
      if(version===loadVersion) { loading=false; $('sch-new').disabled=false; }
    }
  }
  function openEditor(id,date) {
    if(busy) return;
    if(loading) { showToast('일정을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.'); return; }
    const row=id===null?null:rows.find(row=>String(row.id)===String(id));
    if(id!==null && !row) { showToast('일정을 다시 불러와 주세요.'); return; }
    returnFocus=document.activeElement;
    editingId=row?row.id:null;
    selectedDate=row?row.date:date||calendar.today();
    $('sch-form').reset();
    $('sch-date').value=selectedDate;
    $('sch-end-date').value=row?.end_date||'';
    $('sch-end-date').min=selectedDate;
    $('sch-end-date').disabled=!rangeReady;
    $('sch-range-hint').textContent=rangeReady?'하루 일정은 비워두세요. 기간 일정은 마지막 날짜까지 포함해 표시해요.':'기간 일정은 동봉한 종료일 추가 SQL 적용 후 등록할 수 있어요.';
    $('sch-type').querySelectorAll('[data-preserved]').forEach(option=>option.remove());
    if(row?.type && !['방송','휴방'].includes(row.type)) {
      const option=new Option(row.type,row.type); option.dataset.preserved='true'; $('sch-type').add(option);
    }
    $('sch-type').value=row?.type||'방송';
    const mapping={'sch-time':'time','sch-title':'title','sch-time2':'time2','sch-title2':'title2','sch-desc':'description'};
    Object.entries(mapping).forEach(([id,key])=>$(id).value=row?.[key]||'');
    $('sch-hl').checked=Boolean(row?.highlight);
    const color=row?.color||'blue';
    document.querySelectorAll('input[name="schcolor"]').forEach(input=>input.checked=input.value===(['blue','green','pink','yellow','orange','purple','red','gray'].includes(color)?color:'blue'));
    $('sch-editor-title').textContent=row?'일정 수정':'새 일정 등록';
    $('sch-delete').hidden=!row;
    $('sch-form-error').textContent='';
    setBusy(false); snapshot=state(); render();
    $('sch-editor').showModal();
    $('sch-title').focus();
  }
  function closeEditor(force=false) {
    if(busy) return;
    if(!force && state()!==snapshot && !confirm('작성 중인 내용을 닫을까요? 저장하지 않은 변경은 사라져요.')) return;
    $('sch-editor').close(); editingId=null;
    if(returnFocus?.isConnected) returnFocus.focus();
    else $('sch-new').focus();
  }
  async function saveSchedule(event) {
    event?.preventDefault();
    if(busy || needDb()) return;
    const date=$('sch-date').value, end=$('sch-end-date').value;
    $('sch-form-error').textContent='';
    if(!calendar.validDate(date)) { $('sch-form-error').textContent='시작 날짜를 입력해 주세요.'; $('sch-date').focus(); return; }
    if(end && (!calendar.validDate(end)||end<date)) { $('sch-form-error').textContent='종료일은 시작일과 같거나 뒤여야 해요.'; $('sch-end-date').focus(); return; }
    const type=$('sch-type').value;
    const row={date,type,title:$('sch-title').value.trim()||type,color:document.querySelector('input[name="schcolor"]:checked').value,time:$('sch-time').value.trim(),time2:$('sch-time2').value.trim(),title2:$('sch-title2').value.trim(),description:$('sch-desc').value.trim(),highlight:$('sch-hl').checked};
    if(rangeReady) row.end_date=end && end!==date?end:null;
    const id=editingId;
    setBusy(true);
    try {
      const query=id===null?db.from('schedule').insert(row):db.from('schedule').update(row).eq('id',id);
      const {data,error}=await query.select('id').single();
      if(error || !data?.id) throw error||new Error('No affected row');
      selectedDate=date; month=new Date(date+'T12:00:00'); month.setDate(1);
      await loadSchedule();
      setBusy(false); closeEditor(true);
      showToast(id===null?'✅ 일정을 등록했어요.':'✅ 일정을 수정했어요.');
    } catch(error) {
      $('sch-form-error').textContent=['42703','PGRST204'].includes(error?.code)?'종료일 추가 SQL 적용 여부를 확인해 주세요. 입력한 내용은 유지돼요.':'저장하지 못했어요. 연결 상태나 수정 권한을 확인해 주세요. 입력한 내용은 유지돼요.';
    } finally { setBusy(false); }
  }
  async function deleteSchedule(id) {
    if(busy || needDb()) return;
    const row=rows.find(row=>String(row.id)===String(id));
    if(!row || !confirm(`“${row.title||row.type||'일정'}”을 삭제할까요?${calendar.endDate(row)!==row.date?' 기간 전체가 삭제돼요.':''}`)) return;
    setBusy(true);
    try {
      const {data,error}=await db.from('schedule').delete().eq('id',row.id).select('id').single();
      if(error||!data?.id) throw error||new Error('No affected row');
      await loadSchedule();
      setBusy(false);
      if($('sch-editor').open) closeEditor(true);
      showToast('일정을 삭제했어요.');
    } catch(error) {
      if($('sch-editor').open) $('sch-form-error').textContent='삭제하지 못했어요. 연결 상태나 삭제 권한을 확인해 주세요.';
      else showToast('삭제하지 못했어요. 연결 상태나 권한을 확인해 주세요.');
    } finally { setBusy(false); }
  }
  $('sch-prev').addEventListener('click',()=>{month.setMonth(month.getMonth()-1);render();});
  $('sch-next').addEventListener('click',()=>{month.setMonth(month.getMonth()+1);render();});
  $('sch-today').addEventListener('click',()=>{const now=new Date();month=new Date(now.getFullYear(),now.getMonth(),1);selectedDate=calendar.today();render();});
  $('sch-new').addEventListener('click',()=>openEditor(null,selectedDate));
  $('sch-retry').addEventListener('click',loadSchedule);
  $('sch-form').addEventListener('submit',saveSchedule);
  $('sch-date').addEventListener('change',()=>{$('sch-end-date').min=$('sch-date').value;});
  $('sch-close').addEventListener('click',()=>closeEditor());
  $('sch-cancel').addEventListener('click',()=>closeEditor());
  $('sch-editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  $('sch-delete').addEventListener('click',()=>deleteSchedule(editingId));
  $('sch-list').addEventListener('click',event=>{const edit=event.target.closest('[data-edit]'),del=event.target.closest('[data-delete]');if(edit)openEditor(edit.dataset.edit);if(del)deleteSchedule(del.dataset.delete);});
  window.addEventListener('beforeunload',event=>{if($('sch-editor').open && state()!==snapshot){event.preventDefault();event.returnValue='';}});
  window.loadSchedule=loadSchedule;
  render();
})();
