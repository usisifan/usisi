/* Shared calendar: a range remains one record and wraps only at week boundaries. */
(function (root) {
  'use strict';
  const colors = ['blue','green','pink','yellow','orange','purple','red','gray'];
  const weekdays = ['일','월','화','수','목','금','토'];
  function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00');
    return !isNaN(date) && formatDate(date) === value;
  }
  function today() { return formatDate(new Date()); }
  function endDate(event) { return validDate(event.end_date) && event.end_date >= event.date ? event.end_date : event.date; }
  function contains(event, date) { return event.date <= date && endDate(event) >= date; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function layout(year, month, events) {
    const first = new Date(year, month, 1, 12);
    const count = Math.ceil((first.getDay() + new Date(year, month+1, 0).getDate()) / 7) * 7;
    const start = new Date(year, month, 1 - first.getDay(), 12);
    const days = Array.from({length:count}, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      return {date:formatDate(date), number:date.getDate(), other:date.getMonth() !== month};
    });
    const sorted = events.filter(event => validDate(event.date)).slice().sort((a,b) => {
      const ar = endDate(a) > a.date, br = endDate(b) > b.date;
      return Number(br)-Number(ar) || a.date.localeCompare(b.date) || endDate(b).localeCompare(endDate(a)) || String(a.time||'').localeCompare(String(b.time||'')) || String(a.id).localeCompare(String(b.id));
    });
    const weeks = [];
    for (let offset=0; offset<count; offset+=7) {
      const weekDays = days.slice(offset, offset+7), lanes = [], segments = [];
      sorted.forEach(event => {
        const end = endDate(event);
        if (event.date > weekDays[6].date || end < weekDays[0].date) return;
        const from = weekDays.findIndex(day => day.date >= event.date);
        let to = 6;
        while (weekDays[to].date > end) to--;
        let lane = 0;
        while (lanes[lane] && lanes[lane].some((occupied,index) => occupied && index >= from && index <= to)) lane++;
        if (!lanes[lane]) lanes[lane] = Array(7).fill(false);
        for (let col=from; col<=to; col++) lanes[lane][col] = true;
        segments.push({event,from,to,lane,continued:event.date < weekDays[0].date,continues:end > weekDays[6].date,date:weekDays[from].date});
      });
      weeks.push({days:weekDays,segments,lanes:lanes.length});
    }
    return weeks;
  }
  function render(element, options) {
    const events = options.events || [], current = today();
    const weeks = layout(options.year, options.month, events);
    element.classList.add('uc-calendar');
    element.innerHTML = `<div class="uc-weekdays">${weekdays.map(day=>`<div>${day}</div>`).join('')}</div>`;
    weeks.forEach(week => {
      const row = document.createElement('div'); row.className = 'uc-week';
      row.style.setProperty('--uc-lanes', Math.max(2,week.lanes));
      const dates = document.createElement('div'); dates.className = 'uc-days';
      week.days.forEach(day => {
        const has = events.some(event => contains(event,day.date));
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'uc-day' + (day.other?' uc-other':'') + (day.date===current?' uc-today':'') + (day.date===options.selectedDate?' uc-selected':'');
        button.dataset.date = day.date;
        button.setAttribute('aria-label', `${day.date}${options.editable?' 일정 등록':has?' 일정 보기':' 일정 없음'}`);
        if (day.date===current) button.setAttribute('aria-current','date');
        button.innerHTML = `<span class="uc-number">${day.number}</span>${options.editable?'<span class="uc-add" aria-hidden="true">+</span>':''}`;
        if (options.onDateClick) button.addEventListener('click', () => options.onDateClick(day.date));
        dates.append(button);
      });
      row.append(dates);
      const bars = document.createElement('div'); bars.className = 'uc-bars';
      week.segments.forEach(segment => {
        const event = segment.event;
        const color = colors.includes(event.color) ? event.color : event.type==='휴방'?'pink':'blue';
        const button = document.createElement('button'); button.type = 'button';
        button.className = `uc-event uc-${color}${segment.continued?' uc-continued':''}${segment.continues?' uc-continues':''}${event.highlight?' uc-highlight':''}`;
        button.style.gridColumn = `${segment.from+1} / ${segment.to+2}`;
        button.style.gridRow = String(segment.lane+1);
        const label = `${event.highlight?'✦ ':''}${event.time?event.time+' ':''}${event.title || event.type || '방송'}`;
        button.textContent = label;
        button.title = `${event.date}${endDate(event)!==event.date?' ~ '+endDate(event):''} · ${label}${event.title2?' / 2부 '+event.title2:''}`;
        button.setAttribute('aria-label', `${button.title}${options.editable?' 수정':''}`);
        button.dataset.eventId = String(event.id);
        button.addEventListener('click', () => options.onEventClick && options.onEventClick(event,segment.date));
        bars.append(button);
      });
      row.append(bars); element.append(row);
    });
  }
  const api = {render,layout,formatDate,validDate,today,endDate,contains,escapeHtml};
  root.UsisiCalendar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
