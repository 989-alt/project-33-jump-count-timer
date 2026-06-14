/* Day 33 · Jump Count Timer
   - Vanilla JS, no deps.
   - localStorage: jct.students (string[]), jct.records ({[name]: {[seconds]: {best:number, when:ISO}}}), jct.prefs ({muted, lastPreset})
*/
(function () {
  'use strict';

  // ---------- Storage ----------
  const LS_KEYS = { students: 'jct.students.v1', records: 'jct.records.v1', prefs: 'jct.prefs.v1' };
  const PRESETS = [15, 30, 60, 180];

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch (e) {
      console.warn('loadJSON failed', key, e);
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('saveJSON failed', key, e); toast('저장 실패: 브라우저 저장공간이 가득 찼을 수 있어요.'); }
  }

  let state = {
    students: loadJSON(LS_KEYS.students, []),
    records: loadJSON(LS_KEYS.records, {}),
    prefs: Object.assign({ muted: false, lastPreset: 30, rankTab: 30 }, loadJSON(LS_KEYS.prefs, {})),
    selectedStudent: null,
    selectedSeconds: 30,
    run: null,
    lastResult: null,
  };
  state.selectedSeconds = PRESETS.includes(state.prefs.lastPreset) ? state.prefs.lastPreset : 30;

  function persistAll() {
    saveJSON(LS_KEYS.students, state.students);
    saveJSON(LS_KEYS.records, state.records);
    saveJSON(LS_KEYS.prefs, state.prefs);
  }

  // ---------- DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const screens = {
    main: $('#screen-main'),
    run: $('#screen-run'),
    result: $('#screen-result'),
  };

  // ---------- Sound (Web Audio) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (state.prefs.muted) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }
  function beep(freq, durMs, when = 0, type = 'sine', gainPeak = 0.18) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }
  function beepCountdown() { beep(880, 220, 0, 'sine', 0.2); }
  function beepGo()         { beep(1320, 380, 0, 'sine', 0.22); }
  function beepEnd()        { beep(1500, 220, 0, 'sine', 0.22); beep(1100, 380, 0.18, 'sine', 0.22); }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ---------- Rendering ----------
  function renderStudents() {
    const ul = $('#student-list');
    ul.innerHTML = '';
    state.students.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'student-item' + (state.selectedStudent === name ? ' active' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', state.selectedStudent === name ? 'true' : 'false');

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'pick';
      pick.textContent = name;
      pick.setAttribute('aria-label', `${name} 선택`);
      pick.addEventListener('click', () => selectStudent(name));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', `${name} 삭제`);
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`${name} 학생과 모든 기록을 삭제할까요?`)) return;
        deleteStudent(name);
      });

      li.append(pick, del);
      ul.appendChild(li);
    });
    updateStartState();
  }

  function renderPresets() {
    $$('#preset-row .chip').forEach((c) => {
      const sec = Number(c.dataset.seconds);
      const active = sec === state.selectedSeconds;
      c.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function renderRank() {
    const tabSec = state.prefs.rankTab || 30;
    $$('#rank-tabs .tab').forEach((t) => {
      const isActive = Number(t.dataset.seconds) === tabSec;
      t.classList.toggle('tab-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const list = $('#rank-list');
    list.classList.remove('empty');
    list.innerHTML = '';

    const entries = [];
    for (const [name, perSec] of Object.entries(state.records)) {
      const rec = perSec[tabSec];
      if (rec && typeof rec.best === 'number') {
        entries.push({ name, count: rec.best, when: rec.when });
      }
    }
    entries.sort((a, b) => b.count - a.count || (new Date(a.when) - new Date(b.when)));

    if (entries.length === 0) {
      list.classList.add('empty');
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '아직 기록이 없습니다. 첫 측정을 시작해보세요!';
      list.appendChild(li);
      return;
    }

    entries.slice(0, 5).forEach((e, i) => {
      const li = document.createElement('li');
      const d = new Date(e.when);
      const when = isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
      li.innerHTML = `
        <span class="rk">${i + 1}</span>
        <span class="name"></span>
        <span class="count">${e.count}회</span>
        <span class="when">${when}</span>
      `;
      li.querySelector('.name').textContent = e.name;
      list.appendChild(li);
    });
  }

  function updateStartState() {
    const btn = $('#btn-start');
    const hint = $('#start-hint');
    const ok = !!state.selectedStudent && PRESETS.concat(getCustomSeconds() || 0).includes(state.selectedSeconds) ||
               (!!state.selectedStudent && Number.isFinite(state.selectedSeconds) && state.selectedSeconds >= 5 && state.selectedSeconds <= 600);
    btn.disabled = !ok;
    if (!state.selectedStudent) hint.textContent = '학생을 선택하면 시작할 수 있어요.';
    else if (!ok) hint.textContent = '시간을 5~600초로 선택해주세요.';
    else hint.textContent = `${state.selectedStudent} · ${state.selectedSeconds}초 측정 준비 완료. Space 또는 START.`;
  }

  function getCustomSeconds() {
    const v = Number($('#input-custom').value);
    if (Number.isFinite(v) && v >= 5 && v <= 600) return v;
    return null;
  }

  // ---------- State actions ----------
  function addStudent(name) {
    name = (name || '').trim();
    if (!name) { toast('이름을 입력하세요.'); return false; }
    if (name.length > 20) { toast('이름은 20자 이내로.'); return false; }
    if (state.students.includes(name)) { toast('이미 등록된 학생입니다.'); return false; }
    state.students.push(name);
    saveJSON(LS_KEYS.students, state.students);
    selectStudent(name);
    renderStudents();
    return true;
  }
  function deleteStudent(name) {
    state.students = state.students.filter((n) => n !== name);
    delete state.records[name];
    if (state.selectedStudent === name) state.selectedStudent = null;
    saveJSON(LS_KEYS.students, state.students);
    saveJSON(LS_KEYS.records, state.records);
    renderStudents();
    renderRank();
  }
  function selectStudent(name) {
    state.selectedStudent = name;
    renderStudents();
  }
  function selectSeconds(sec) {
    state.selectedSeconds = sec;
    state.prefs.lastPreset = PRESETS.includes(sec) ? sec : state.prefs.lastPreset;
    saveJSON(LS_KEYS.prefs, state.prefs);
    renderPresets();
    updateStartState();
  }

  function recordResult(name, seconds, count) {
    if (!state.records[name]) state.records[name] = {};
    const prev = state.records[name][seconds];
    const prevBest = prev ? prev.best : null;
    const isNewPR = prevBest === null || count > prevBest;
    if (isNewPR) {
      state.records[name][seconds] = { best: count, when: new Date().toISOString() };
      saveJSON(LS_KEYS.records, state.records);
    }
    return { isNewPR, prevBest };
  }

  // ---------- Screens ----------
  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) {
      const active = k === name;
      el.classList.toggle('hidden', !active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
  }

  // ---------- Run flow ----------
  function startRun() {
    if (!state.selectedStudent) { toast('학생을 먼저 선택하세요.'); return; }
    const sec = state.selectedSeconds;
    if (!Number.isFinite(sec) || sec < 5 || sec > 600) { toast('시간을 5~600초로 설정하세요.'); return; }

    state.run = {
      name: state.selectedStudent,
      seconds: sec,
      count: 0,
      phase: 'prepare',
      prepareLeft: 3,
      endsAt: 0,
      tickHandle: null,
      prepHandle: null,
      lastTapAt: 0,
    };
    ensureAudio();
    showScreen('run');
    $('#run-meta').textContent = `${state.run.name} · ${state.run.seconds}초`;
    $('#count-display').textContent = '0';
    $('#prepare').hidden = false;
    $('#run-active').hidden = true;
    $('#prepare-num').textContent = '3';

    const tap = $('#tap-zone');
    try { tap.focus({ preventScroll: true }); } catch (e) { tap.focus(); }

    beepCountdown();
    state.run.prepHandle = setInterval(() => {
      if (!state.run || state.run.phase !== 'prepare') return;
      state.run.prepareLeft -= 1;
      if (state.run.prepareLeft > 0) {
        $('#prepare-num').textContent = String(state.run.prepareLeft);
        beepCountdown();
      } else {
        clearInterval(state.run.prepHandle);
        state.run.prepHandle = null;
        beginActive();
      }
    }, 1000);
  }

  function beginActive() {
    state.run.phase = 'active';
    state.run.endsAt = Date.now() + state.run.seconds * 1000;
    $('#prepare').hidden = true;
    $('#run-active').hidden = false;
    $('#count-display').textContent = '0';
    updateRemaining();
    beepGo();
    state.run.tickHandle = setInterval(updateRemaining, 100);
  }

  function updateRemaining() {
    if (!state.run || state.run.phase !== 'active') return;
    const msLeft = state.run.endsAt - Date.now();
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    const el = $('#time-remaining');
    el.textContent = `남은 시간 ${secLeft}초`;
    el.classList.toggle('warning', secLeft <= 3 && secLeft > 0);
    if (msLeft <= 0) {
      finishRun();
    }
  }

  function tapCount() {
    if (!state.run || state.run.phase !== 'active') return;
    const now = Date.now();
    if (now - state.run.lastTapAt < 50) return;
    state.run.lastTapAt = now;
    state.run.count += 1;
    const disp = $('#count-display');
    disp.textContent = String(state.run.count);
    disp.classList.remove('pulse');
    void disp.offsetWidth;
    disp.classList.add('pulse');
  }

  function cancelRun() {
    if (!state.run) return;
    if (state.run.prepHandle) clearInterval(state.run.prepHandle);
    if (state.run.tickHandle) clearInterval(state.run.tickHandle);
    state.run = null;
    showScreen('main');
  }

  function finishRun() {
    if (!state.run) return;
    if (state.run.tickHandle) clearInterval(state.run.tickHandle);
    state.run.phase = 'done';
    beepEnd();
    const { name, seconds, count } = state.run;
    const { isNewPR, prevBest } = recordResult(name, seconds, count);
    state.lastResult = { name, seconds, count, isNewPR, prevBest };
    state.run = null;
    showResult();
    renderRank();
  }

  function showResult() {
    const r = state.lastResult;
    if (!r) { showScreen('main'); return; }
    showScreen('result');
    $('#result-meta').textContent = `${r.name} · ${r.seconds}초`;
    $('#result-count').textContent = `${r.count} 회`;
    const pr = $('#result-pr');
    pr.classList.toggle('is-new', r.isNewPR);
    if (r.isNewPR) {
      const prev = r.prevBest === null ? '첫 기록!' : `이전 ${r.prevBest}회 → ${r.count}회`;
      pr.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4zM4 5h3v2H4zM17 5h3v2h-3zM9 14h6v2h1v2H8v-2h1v-2z" fill="currentColor"/></svg>
        <span>신기록! ${prev}</span>
      `;
    } else {
      pr.innerHTML = `<span>이전 PR ${r.prevBest}회 · 갱신 아님</span>`;
    }
  }

  // ---------- Export / Import ----------
  function exportJSON() {
    const data = {
      schema: 'jct.v1',
      exportedAt: new Date().toISOString(),
      students: state.students,
      records: state.records,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jump-count-pr-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.schema !== 'jct.v1') throw new Error('지원하지 않는 파일 형식입니다.');
        if (!Array.isArray(data.students)) throw new Error('학생 목록이 잘못되었습니다.');
        if (typeof data.records !== 'object' || data.records === null) throw new Error('기록 형식이 잘못되었습니다.');

        const incomingStudents = Array.from(new Set([...state.students, ...data.students.filter((s) => typeof s === 'string')]));
        const mergedRecords = JSON.parse(JSON.stringify(state.records));
        for (const [name, perSec] of Object.entries(data.records)) {
          if (typeof name !== 'string' || !perSec || typeof perSec !== 'object') continue;
          if (!mergedRecords[name]) mergedRecords[name] = {};
          for (const [secKey, rec] of Object.entries(perSec)) {
            const sec = Number(secKey);
            if (!Number.isFinite(sec) || !rec) continue;
            const cur = mergedRecords[name][sec];
            if (!cur || (Number.isFinite(rec.best) && rec.best > cur.best)) {
              mergedRecords[name][sec] = { best: Number(rec.best), when: rec.when || new Date().toISOString() };
            }
          }
        }
        state.students = incomingStudents;
        state.records = mergedRecords;
        persistAll();
        renderStudents();
        renderRank();
        toast('가져오기 완료 — 기록이 병합되었습니다.');
      } catch (e) {
        toast('가져오기 실패: ' + e.message);
      }
    };
    reader.onerror = () => toast('파일을 읽을 수 없습니다.');
    reader.readAsText(file);
  }

  // ---------- Wire up ----------
  function init() {
    renderStudents();
    renderPresets();
    renderRank();
    updateStartState();
    syncMuteBtn();

    $('#form-add-student').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#input-new-student');
      if (addStudent(input.value)) input.value = '';
    });

    $('#preset-row').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      selectSeconds(Number(chip.dataset.seconds));
    });

    $('#btn-custom').addEventListener('click', () => {
      const v = getCustomSeconds();
      if (v == null) { toast('5~600초 사이로 입력하세요.'); return; }
      selectSeconds(v);
      $$('#preset-row .chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
    });
    $('#input-custom').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#btn-custom').click(); }
    });

    $('#btn-start').addEventListener('click', startRun);

    $('#rank-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      state.prefs.rankTab = Number(tab.dataset.seconds);
      saveJSON(LS_KEYS.prefs, state.prefs);
      renderRank();
    });

    $('#btn-mute').addEventListener('click', () => {
      state.prefs.muted = !state.prefs.muted;
      saveJSON(LS_KEYS.prefs, state.prefs);
      syncMuteBtn();
      toast(state.prefs.muted ? '소리 꺼짐' : '소리 켜짐');
    });

    $('#btn-export').addEventListener('click', exportJSON);
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJSON(file);
      e.target.value = '';
    });
    $('#btn-reset-all').addEventListener('click', () => {
      if (!confirm('모든 학생과 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
      state.students = [];
      state.records = {};
      state.selectedStudent = null;
      persistAll();
      renderStudents();
      renderRank();
      toast('모두 초기화했습니다.');
    });

    $('#btn-cancel').addEventListener('click', cancelRun);
    $('#tap-zone').addEventListener('click', tapCount);
    $('#tap-zone').addEventListener('touchstart', (e) => {
      e.preventDefault();
      tapCount();
    }, { passive: false });

    $('#btn-next').addEventListener('click', () => {
      state.selectedStudent = null;
      renderStudents();
      showScreen('main');
    });
    $('#btn-again').addEventListener('click', () => {
      showScreen('main');
      setTimeout(startRun, 0);
    });

    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        if (!screens.run.classList.contains('hidden')) {
          e.preventDefault();
          tapCount();
        } else if (!screens.main.classList.contains('hidden')) {
          if (!$('#btn-start').disabled) { e.preventDefault(); startRun(); }
        }
      } else if (e.key === 'Escape') {
        if (!screens.run.classList.contains('hidden')) { e.preventDefault(); cancelRun(); }
        else if (!screens.result.classList.contains('hidden')) { showScreen('main'); }
      } else if (e.key.toLowerCase() === 's') {
        if (!screens.main.classList.contains('hidden') && !$('#btn-start').disabled) startRun();
      } else if (e.key.toLowerCase() === 'r') {
        if (!screens.run.classList.contains('hidden')) cancelRun();
      }
    });
  }

  function syncMuteBtn() {
    const btn = $('#btn-mute');
    btn.setAttribute('aria-pressed', state.prefs.muted ? 'true' : 'false');
    btn.querySelector('.util-label').textContent = state.prefs.muted ? '음소거' : '소리';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
