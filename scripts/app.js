/**
 * កម្មវិធី Single Page Application (SPA) កិច្ចតែងការបង្រៀនគណិតវិទ្យាថ្នាក់ទី៨
 * - ជ្រើសរើសបន្តតាមប្រភេទ ៖ ១) ចំណងជើងជំពូក › ២) ចំណងជើងមេរៀន › ៣) ចំណងជើងចំណុចរង
 * - ក្រដាស A4 ផ្ដេកបំបែកសន្លឹកដាច់ៗពីគ្នាដូចពេលបោះពុម្ព (1:1 WYSIWYG Paginator)
 * - រូបមន្តគណិតវិទ្យាស្តង់ដារ LaTeX (KaTeX) + ទាញយកជា Microsoft Word (.doc)
 */

(function () {
  'use strict';

  const STORAGE_PROFILE_KEY = 'moeys_g8_spa_profile_v2';
  const STORAGE_ACTIVE_ID_KEY = 'moeys_g8_spa_active_id_v2';
  const STORAGE_EDITS_PREFIX = 'moeys_g8_spa_custom_v2_';
  const BLANK_ID = 'blank';

  const library = window.G8LessonLibrary;
  if (!library) return;
  library.finalizeCurriculum();

  const chapters = library.chapters || [];
  const allPeriods = library.periods || [];
  const periodMap = new Map(allPeriods.map((p) => [p.id, p]));

  // Group lessons (1..18) with their periods & chapter metadata
  const lessonsMap = new Map();
  allPeriods.forEach((p) => {
    if (!lessonsMap.has(p.lessonNumber)) {
      lessonsMap.set(p.lessonNumber, {
        lessonNumber: p.lessonNumber,
        lessonNumberKh: p.lessonNumberKh,
        lessonTitle: p.lessonTitle,
        chapterId: p.chapterId,
        chapterNumber: p.chapterNumber,
        chapterNumberKh: p.chapterNumberKh,
        chapterTitle: p.chapterTitle,
        totalPeriods: p.totalPeriods,
        periods: []
      });
    }
    lessonsMap.get(p.lessonNumber).periods.push(p);
  });

  // DOM References
  const shellEl = document.getElementById('page-scale-shell');
  const stackEl = document.getElementById('pages-stack');
  const pageCountEl = document.getElementById('page-count-badge');
  const activeDocSubEl = document.getElementById('active-doc-sub');

  const selectChapterEl = document.getElementById('select-chapter');
  const selectLessonEl = document.getElementById('select-lesson');
  const selectSubtopicEl = document.getElementById('select-subtopic');
  const btnPrevPeriod = document.getElementById('btn-prev-period');
  const btnNextPeriod = document.getElementById('btn-next-period');
  const periodIndexPillEl = document.getElementById('period-index-pill');

  const btnToggleSearch = document.getElementById('btn-toggle-search');
  const searchPanelEl = document.getElementById('quick-search-panel');
  const searchInputEl = document.getElementById('quick-search-input');
  const searchResultsEl = document.getElementById('quick-search-results');
  const searchCountLabelEl = document.getElementById('search-count-label');

  const btnToggleProfile = document.getElementById('btn-toggle-profile');
  const profilePanelEl = document.getElementById('teacher-profile-panel');
  const btnClearProfile = document.getElementById('btn-clear-profile');
  const profileInputs = {
    province: document.getElementById('prof-province'),
    district: document.getElementById('prof-district'),
    school: document.getElementById('prof-school'),
    teacher: document.getElementById('prof-teacher'),
    date: document.getElementById('prof-date'),
    students: document.getElementById('prof-students'),
    lunar: document.getElementById('prof-lunar'),
    signdate: document.getElementById('prof-signdate')
  };

  const btnZoom = document.getElementById('btn-toggle-zoom');
  const btnEdit = document.getElementById('btn-toggle-edit');
  const btnResetLesson = document.getElementById('btn-reset-lesson');
  const btnWord = document.getElementById('btn-export-word');
  const btnPrint = document.getElementById('btn-print');

  if (!shellEl || !stackEl) return;

  // Application State
  let activeId = allPeriods.length > 0 ? allPeriods[0].id : BLANK_ID;
  let masterHtml = '';
  let fitToScreen = true;
  let editMode = false;
  let profileRepaginateTimer = null;

  const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

  function toKhmerNum(num) {
    return String(num)
      .split('')
      .map((ch) => (ch >= '0' && ch <= '9' ? KHMER_DIGITS[Number(ch)] : ch))
      .join('');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Safe localStorage helpers
  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_err) {
      return null;
    }
  }

  function storageSet(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (_err) {
      // Ignore storage restrictions
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_err) {
      // Ignore storage restrictions
    }
  }

  // KaTeX Rendering
  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false }
  ];

  function renderLatexMath(targetEl) {
    if (!targetEl || typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(targetEl, {
      delimiters: KATEX_DELIMITERS,
      throwOnError: false,
      strict: false
    });
  }

  // Teacher / School Profile Management
  function loadProfile() {
    const raw = storageGet(STORAGE_PROFILE_KEY);
    let parsed = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) || {};
      } catch (_err) {
        parsed = {};
      }
    }
    Object.keys(profileInputs).forEach((key) => {
      const input = profileInputs[key];
      if (input) {
        input.value = typeof parsed[key] === 'string' ? parsed[key] : '';
      }
    });
    return getProfileValues();
  }

  function getProfileValues() {
    const data = {};
    Object.keys(profileInputs).forEach((key) => {
      const input = profileInputs[key];
      data[key] = input ? input.value.trim() : '';
    });
    return data;
  }

  function saveProfile() {
    const data = getProfileValues();
    storageSet(STORAGE_PROFILE_KEY, JSON.stringify(data));
    return data;
  }

  function getFormattedProfileTexts(profile) {
    const provinceLine = profile.province
      ? /^មន្ទីរ/.test(profile.province)
        ? escapeHtml(profile.province)
        : `មន្ទីរអប់រំ យុវជន និងកីឡា${escapeHtml(profile.province)}`
      : 'មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តកំពង់ធំ';

    const districtLine = profile.district
      ? /^ការិយាល័យ/.test(profile.district)
        ? escapeHtml(profile.district)
        : `ការិយាល័យអប់រំ យុវជន និងកីឡា${escapeHtml(profile.district)}`
      : 'ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុកកំពង់ស្វាយ';

    let schoolRaw = 'អនុវិទ្យាល័យព្រះក្រសាំង';
    if (profile.school) {
      schoolRaw = /^(វិទ្យាល័យ|អនុវិទ្យាល័យ|សាលា)/.test(profile.school)
        ? profile.school
        : `អនុវិទ្យាល័យ${profile.school}`;
    }
    const schoolLine = escapeHtml(schoolRaw);

    const dateText = profile.date
      ? escapeHtml(profile.date)
      : 'ថ្ងៃ.................. ទី...... ខែ.................. ឆ្នាំ២០២......';

    const teacherMeta = profile.teacher
      ? `<strong>${escapeHtml(profile.teacher)}</strong>`
      : '............................................................................';

    const studentsText = profile.students
      ? escapeHtml(profile.students)
      : '......... នាក់ (ស្រី ......... នាក់)';

    const lunarText = profile.lunar
      ? escapeHtml(profile.lunar)
      : 'ថ្ងៃ.................. ខែ............ ឆ្នាំ......... ព.ស. ២៥៦...';

    let signDateText = 'ធ្វើនៅព្រះក្រសាំង ថ្ងៃទី...... ខែ............ ឆ្នាំ២០២...';
    if (profile.signdate) {
      signDateText = /^ធ្វើនៅ/.test(profile.signdate)
        ? escapeHtml(profile.signdate)
        : `ធ្វើនៅ${escapeHtml(profile.signdate)}`;
    }

    const teacherSign = profile.teacher
      ? `ឈ្មោះ ៖ <strong>${escapeHtml(profile.teacher)}</strong>`
      : 'ឈ្មោះ ៖ ..........................................';

    return {
      provinceLine,
      districtLine,
      schoolLine,
      schoolShort: schoolRaw,
      dateText,
      teacherMeta,
      studentsText,
      lunarText,
      signDateText,
      teacherSign
    };
  }

  // Custom Inline Edits Persistence
  function getCustomEditKey(id) {
    return `${STORAGE_EDITS_PREFIX}${id}`;
  }

  function loadCustomEdit(id) {
    return storageGet(getCustomEditKey(id));
  }

  function hasSavedCustomEdit(id) {
    return Boolean(loadCustomEdit(id));
  }

  function saveCustomEdit(id, html) {
    storageSet(getCustomEditKey(id), html);
    updateResetButtonVisibility();
  }

  function clearCustomEdit(id) {
    storageRemove(getCustomEditKey(id));
    updateResetButtonVisibility();
  }

  function updateResetButtonVisibility() {
    if (!btnResetLesson) return;
    btnResetLesson.hidden = !hasSavedCustomEdit(activeId);
  }

  // Official Cambodian MoEYS Document Header + Footer Blocks (អនុវិទ្យាល័យព្រះក្រសាំង — Rule 1)
  function buildDocumentTopHeaderHtml(profile) {
    const t = getFormattedProfileTexts(profile);
    return `
      <div class="kingdom-motto">
        <p class="muol-heading">ព្រះរាជាណាចក្រកម្ពុជា</p>
        <p class="muol-heading">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
        <svg class="tacteing-ornament" width="92" height="13" viewBox="0 0 180 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M8 11H72M108 11H172" stroke="#000000" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M76 11C80 4 86 4 90 11C94 18 100 18 104 11C100 4 94 4 90 11C86 18 80 18 76 11Z" stroke="#000000" stroke-width="1.3"/>
          <circle cx="90" cy="11" r="2" fill="#000000"/>
          <circle cx="72" cy="11" r="1.6" fill="#000000"/>
          <circle cx="108" cy="11" r="1.6" fill="#000000"/>
        </svg>
      </div>

      <div class="school-admin-block editable-region">
        <p>${t.provinceLine}</p>
        <p>${t.districtLine}</p>
        <p>${t.schoolLine}</p>
      </div>

      <div class="doc-title-block editable-region">
        <h1 class="doc-main-title">កិច្ចតែងការបង្រៀន</h1>
      </div>
    `;
  }

  function buildReflectionAndSignatureHtml(profile) {
    const t = getFormattedProfileTexts(profile);
    return `
      <div class="reflection-box editable-region">
        <p class="reflection-title">- ការឆ្លុះបញ្ចាំងក្រោយពេលបង្រៀន (សម្រាប់គ្រូកត់ត្រា) ៖</p>
        <p class="dots-line" style="margin: 0;">
          - ចំណុចជោគជ័យ ៖ ........................................................................................................................................................................<br />
          - បញ្ហាប្រឈម និងដំណោះស្រាយកែលម្អ ៖ .........................................................................................................................................
        </p>
      </div>

      <table class="signature-table editable-region">
        <tbody>
          <tr>
            <td>
              <div>បានឃើញ និងពិនិត្យត្រឹមត្រូវ</div>
              <div>${t.lunarText}</div>
              <div>${t.signDateText}</div>
              <div class="sig-role-muol">ប្រធានក្រុមបច្ចេកទេស / នាយកសាលា</div>
              <div class="sig-space"></div>
            </td>
            <td>
              <div>${t.lunarText}</div>
              <div>${t.signDateText}</div>
              <div class="sig-role-muol">ហត្ថលេខាគ្រូបង្រៀន</div>
              <div class="sig-space"></div>
              <div>${t.teacherSign}</div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  /**
   * ទម្រង់គំរូទទេស្តង់ដារ 5E (គោរពតាមជំនាញ lesson-plan ទាំង ៧ ប្រការ)
   */
  function buildBlankMasterHtml(profile) {
    const t = getFormattedProfileTexts(profile);
    return `
      ${buildDocumentTopHeaderHtml(profile)}

      <section class="meta-section editable-region">
        <table class="meta-table">
          <colgroup>
            <col class="meta-col-label" />
            <col class="meta-col-value" />
          </colgroup>
          <tbody>
            <tr>
              <td class="meta-label-cell">- មុខវិជ្ជា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>គណិតវិទ្យា ថ្នាក់ទី៨</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- ខ្លឹមសារមេរៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>មេរៀនទី...... ...................................................................................................................</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- ចំណងជើងរង</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>...... . ...... . ..................................................................................................................</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- រយៈពេល</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>៥០ នាទី</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- បង្រៀនដោយ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${t.teacherMeta}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- កាលបរិច្ឆេទ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${t.dateText}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- វត្ថុបំណង</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>ក្រោយពីរៀនចប់មេរៀននេះ សិស្សមានសមត្ថភាព ៖</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ វិជ្ជាសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>................................................................................................................................................</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ បំណិនសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>................................................................................................................................................</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ ចរិយាសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>................................................................................................................................................</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- គោលវិធី និងយុទ្ធវិធីបង្រៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span></td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">- គោលវិធី</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>សិស្សមជ្ឈមណ្ឌល</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">- យុទ្ធវិធីបង្រៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>តាមបែបរិះរក (5E)</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- សម្ភារៈឧបទ្ទេស</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span></td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ សម្រាប់គ្រូ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>សៀវភៅសិក្សាគោល សៀវភៅគ្រូ កិច្ចតែងការបង្រៀន បន្ទាត់ ហ្វឺត សន្លឹកកិច្ចការក្រុម ..........................................</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ សម្រាប់សិស្ស</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>សៀវភៅសិក្សាគោល សៀវភៅសរសេរ ក្តារឆ្នួន ប៊ិច បន្ទាត់ សម្ភារៈគណិតវិទ្យា ................................................</td>
            </tr>
          </tbody>
        </table>
      </section>

      <table class="lesson-table">
        <colgroup>
          <col class="col-teacher" />
          <col class="col-content" />
          <col class="col-student" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">សកម្មភាពគ្រូ</th>
            <th scope="col">ខ្លឹមសារមេរៀន</th>
            <th scope="col">សកម្មភាពសិស្ស</th>
          </tr>
        </thead>
        <tbody class="editable-region">
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី១ ៖ រដ្ឋបាលថ្នាក់រៀន <span class="step-duration">(៤ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <ul class="cell-list">
                <li>ស្វាគមន៍សិស្ស និងពិនិត្យមើលអនាម័យ សណ្តាប់ធ្នាប់ សម្លៀកបំពាក់ក្នុងថ្នាក់រៀន។</li>
                <li>សាកសួរប្រធានថ្នាក់អំពីចំនួនវត្តមាន និងអវត្តមានសិស្សប្រចាំថ្ងៃ។</li>
                <li>ប្រមូលអារម្មណ៍សិស្សឱ្យមានលំនឹងត្រៀមចូលរៀន។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">ពិនិត្យវត្តមាន និងលំនឹងថ្នាក់ ៖</p>
              <ul class="cell-list">
                <li>សិស្សសរុប ៖ ${t.studentsText}</li>
                <li>វត្តមាន ៖ ......... នាក់ (ស្រី ......... នាក់)</li>
                <li>អវត្តមាន ៖ ......... នាក់ (ច្បាប់ ...... / ឥតច្បាប់ ......)</li>
              </ul>
            </td>
            <td>
              <ul class="cell-list">
                <li>ក្រោកឈរគោរពស្វាគមន៍គ្រូ និងរៀបចំអនាម័យ សណ្តាប់ធ្នាប់ក្នុងថ្នាក់។</li>
                <li>ប្រធានថ្នាក់ឡើងរាយការណ៍ពីចំនួនវត្តមាន និងអវត្តមានសិស្ស។</li>
                <li>រៀបចំសម្ភារៈសិក្សាដាក់លើតុរៀងៗខ្លួន។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី២ ៖ កិច្ចការផ្ទះ និងរំលឹកមេរៀនចាស់ <span class="step-duration">(៦ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <p class="content-subhead">២.១. កែសម្រួលកិច្ចការផ្ទះ ៖</p>
              <ul class="cell-list">
                <li>ឱ្យសិស្សយកកិច្ចការផ្ទះដាក់លើតុ និងហៅតំណាងសិស្សឡើងកែលើក្តារខៀន។</li>
                <li>សម្របសម្រួល ផ្ទៀងផ្ទាត់ចម្លើយ កែលម្អចំណុចខ្វះខាត និងផ្តល់ការលើកទឹកចិត្ត។</li>
              </ul>
              <p class="content-subhead" style="margin-top: 2mm;">២.២. រំលឹកមេរៀនចាស់ភ្ជាប់មេរៀនថ្មី ៖</p>
              <ul class="cell-list">
                <li>សួរសំណួររំលឹកចំណេះដឹងមូលដ្ឋានដែលទាក់ទងនឹងខ្លឹមសារមេរៀនថ្មី៖</li>
                <li>១. ............................................................?</li>
                <li>២. ............................................................?</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">កំណែកិច្ចការផ្ទះ ៖</p>
              <p class="dots-line content-block">
                ....................................................................................<br />
                ....................................................................................
              </p>
              <p class="content-subhead" style="margin-top: 2mm;">ចំណេះដឹងរំលឹកមេរៀនចាស់ ៖</p>
              <p class="dots-line content-block">
                - ចម្លើយទី១ ៖ ..............................................................<br />
                - ចម្លើយទី២ ៖ ..............................................................
              </p>
            </td>
            <td>
              <ul class="cell-list">
                <li>បង្ហាញសៀវភៅកិច្ចការផ្ទះ និងឡើងបកស្រាយកំណែលើក្តារខៀន។</li>
                <li>ផ្ទៀងផ្ទាត់ចម្លើយ និងកែតម្រូវចូលសៀវភៅរៀងៗខ្លួន។</li>
                <li>គិតពិចារណា និងលើកដៃឆ្លើយសំណួររំលឹកមេរៀនចាស់របស់គ្រូយ៉ាងសកម្ម។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៣ ៖ មេរៀនថ្មី (បញ្ជ្រាបវិធីបង្រៀន 5E ៖ ដំណាក់កាលទី១ ទី២ និងទី៣) <span class="step-duration">(២៦ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <span class="phase-5e-badge">១. ដំណាក់កាលបំផុសចំណាប់អារម្មណ៍ (E1 — ៤ នាទី)</span>
              <ul class="cell-list">
                <li>លើកយកស្ថានភាពបញ្ហាជាក់ស្តែង រូបភាព ឬសំណួរគន្លឹះភ្ជាប់ជីវភាពរស់នៅ៖<br />
                  «...................................................................?»</li>
                <li>ឱ្យសិស្សប៉ាន់ស្មានចម្លើយបឋម រួចភ្ជាប់ចូលចំណងជើងមេរៀនថ្មីលើក្តារខៀន។</li>
              </ul>
            </td>
            <td>
              <p class="content-block">
                <strong>មេរៀនទី...... ...............................................</strong><br />
                <strong>...... . ...... . .............................................</strong>
              </p>
              <p class="content-subhead">ស្ថានភាពបញ្ហា / សំណួរគន្លឹះ ៖</p>
              <p class="dots-line content-block">
                ....................................................................................
              </p>
            </td>
            <td>
              <ul class="cell-list">
                <li>សង្កេត អាន និងគិតពិចារណាលើស្ថានភាពបញ្ហា ឬសំណួរគន្លឹះ។</li>
                <li>ចូលរួមបញ្ចេញមតិ និងទស្សន៍ទាយចម្លើយបឋមដោយសេរី។</li>
                <li>កត់ត្រាចំណងជើងមេរៀនថ្មីចូលក្នុងសៀវភៅ។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td>
              <span class="phase-5e-badge">២. ដំណាក់កាលរុករក និងស្រាវជ្រាវ (E2 — ១០ នាទី)</span>
              <ul class="cell-list">
                <li>រៀបចំសិស្សជាក្រុមតូចៗ (ឬជាដៃគូ) តាមគោលវិធីសិស្សមជ្ឈមណ្ឌល។</li>
                <li>ចែកសន្លឹកកិច្ចការរុករក និងណែនាំលក្ខខណ្ឌ ព្រមទាំងរយៈពេលធ្វើការងារក្រុម។</li>
                <li>ដើរតាមដាន សង្កេត និងជួយបំផុសសំណួរណែនាំដល់ក្រុមដែលជួបការលំបាក (ដោយមិនប្រាប់ចម្លើយផ្ទាល់)។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">សកម្មភាពរុករក / សន្លឹកកិច្ចការក្រុម ៖</p>
              <div class="math-box">
                សកម្មភាពទី១ ៖ ...................................................................<br />
                សកម្មភាពទី២ ៖ ...................................................................
              </div>
            </td>
            <td>
              <ul class="cell-list">
                <li>ចូលតាមក្រុម ចាត់តាំងអ្នកកត់ត្រា និងអ្នកឡើងបកស្រាយ។</li>
                <li>សហការគ្នាគិត គណនា គូសរូប ឬពិសោធន៍រកទំនាក់ទំនងគណិតវិទ្យាលើសន្លឹកកិច្ចការ។</li>
                <li>កត់ត្រាដំណោះស្រាយ និងលទ្ធផលក្រុមលើក្រដាសផ្ទាំងធំ ឬក្តារឆ្នួន។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td>
              <span class="phase-5e-badge">៣. ដំណាក់កាលបកស្រាយ និងសំយោគ (E3 — ១២ នាទី)</span>
              <ul class="cell-list">
                <li>អញ្ជើញតំណាងក្រុមឡើងបង្ហាញ និងបកស្រាយលទ្ធផលនៃការរុករក។</li>
                <li>សម្របសម្រួលឱ្យក្រុមដទៃសួរសំណួរ ផ្ទៀងផ្ទាត់ និងផ្តល់មតិកែលម្អ។</li>
                <li>គ្រូបូកសរុប បំពេញបន្ថែម និងរួមគ្នាជាមួយសិស្សទាញចេញជា <strong>និយមន័យ រូបមន្ត ទ្រឹស្តីបទ ឬវិធាន</strong> ព្រមទាំងឧទាហរណ៍គំរូ។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">និយមន័យ / រូបមន្ត / ទ្រឹស្តីបទ (LaTeX) ៖</p>
              <div class="math-box">
                ........................................................................................<br />
                $$f(x) = \dots$$
                ........................................................................................
              </div>
              <p class="content-subhead" style="margin-top: 2mm;">ឧទាហរណ៍គំរូ ៖</p>
              <p class="dots-line content-block">
                ....................................................................................
              </p>
            </td>
            <td>
              <ul class="cell-list">
                <li>តំណាងក្រុមឡើងបកស្រាយលទ្ធផល និងពន្យល់ពីរបៀបដោះស្រាយ។</li>
                <li>សិស្សក្រុមផ្សេងចូលរួមសង្កេត ផ្ទៀងផ្ទាត់ និងលើកសំណួរពិភាក្សា។</li>
                <li>ចូលរួមទាញសេចក្តីសន្និដ្ឋានជាមួយគ្រូ និងកត់ត្រាខ្លឹមសារមេរៀនចូលក្នុងសៀវភៅ។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៤ ៖ ពង្រឹងពុទ្ធិ (បញ្ជ្រាបវិធីបង្រៀន 5E ៖ ដំណាក់កាលទី៤ និងទី៥) <span class="step-duration">(១០ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <span class="phase-5e-badge">៤. ដំណាក់កាលពង្រីកចំណេះដឹង (E4 — ៦ នាទី)</span>
              <ul class="cell-list">
                <li>ដាក់លំហាត់អនុវត្ត ឬចំណោទក្នុងស្ថានភាពថ្មី ដើម្បីឱ្យសិស្សប្រើប្រាស់ចំណេះដឹងដែលទើបរៀនទៅដោះស្រាយបញ្ហាស៊ីជម្រៅ។</li>
                <li>តាមដានការធ្វើលំហាត់របស់សិស្ស និងជួយណែនាំបន្ថែម។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">លំហាត់អនុវត្តពង្រីកចំណេះដឹង ៖</p>
              <p class="dots-line content-block">....................................................................................</p>
              <p class="content-subhead">ចម្លើយរំពឹងទុក ៖</p>
              <p class="dots-line content-block">....................................................................................</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>គិតគណនា និងអនុវត្តរូបមន្ត/វិធានទៅដោះស្រាយលំហាត់ក្នុងបរិបទថ្មីជាដៃគូ ឬបុគ្គល។</li>
                <li>ឡើងបង្ហាញដំណោះស្រាយលើក្តារខៀន និងផ្ទៀងផ្ទាត់ចម្លើយ។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td>
              <span class="phase-5e-badge">៥. ដំណាក់កាលវាយតម្លៃលទ្ធផលសិក្សា (E5 — ៤ នាទី)</span>
              <ul class="cell-list">
                <li>វាស់ស្ទង់ការយល់ដឹងរបស់សិស្សធៀបនឹងវត្ថុបំណងមេរៀនទាំង ៣ តាមរយៈសំណួរផ្ទាល់មាត់ ក្តារឆ្នួន ឬសន្លឹកកិច្ចការខ្លី។</li>
                <li>ឱ្យសិស្សជួយសង្ខេបចំណុចសំខាន់ៗនៃមេរៀនឡើងវិញ។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">សំណួរ / លំហាត់វាយតម្លៃ ៖</p>
              <p class="dots-line content-block">....................................................................................</p>
              <p class="content-subhead">ចម្លើយ និងលក្ខណៈវិនិច្ឆ័យ ៖</p>
              <p class="dots-line content-block">....................................................................................</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>ឆ្លើយសំណួរ ឬដោះស្រាយលំហាត់វាយតម្លៃដោយខ្លួនឯងលើក្តារឆ្នួន/សៀវភៅ។</li>
                <li>សង្ខេបរូបមន្ត និងគំនិតគន្លឹះនៃមេរៀនឡើងវិញ។</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៥ ៖ កិច្ចការផ្ទះ និងបណ្តាំផ្ញើ <span class="step-duration">(៤ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <p class="content-subhead">៥.១. កិច្ចការផ្ទះ ៖</p>
              <ul class="cell-list">
                <li>កត់ត្រា ឬកំណត់លំហាត់កិច្ចការផ្ទះក្នុងសៀវភៅសិក្សាគោល និងណែនាំពីគន្លឹះអនុវត្ត។</li>
              </ul>
              <p class="content-subhead" style="margin-top: 2mm;">៥.២. បណ្តាំផ្ញើ ៖</p>
              <ul class="cell-list">
                <li>ផ្តាំផ្ញើសិស្សឱ្យខិតខំរៀនសូត្រ ធ្វើកិច្ចការផ្ទះ អានមេរៀនបន្ទាប់ទុកជាមុន និងថែរក្សាសុខភាព។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">កិច្ចការផ្ទះ ៖</p>
              <p class="dots-line content-block">សៀវភៅសិក្សាគោលទំព័រទី......... លំហាត់ទី...................................</p>
              <p class="content-subhead">បណ្តាំផ្ញើ ៖</p>
              <p class="dots-line content-block">មើលមេរៀនបន្ទាប់ ៖ ........................................................</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>កត់ត្រាលំហាត់កិច្ចការផ្ទះចូលក្នុងសៀវភៅយ៉ាងត្រឹមត្រូវ។</li>
                <li>ស្តាប់ការណែនាំ និងបណ្តាំផ្ញើរបស់គ្រូ ព្រមទាំងក្រោកឈរជម្រាបលាគ្រូ។</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>

      ${buildReflectionAndSignatureHtml(profile)}
    `;
  }

  /**
   * បង្កើតកិច្ចតែងការបង្រៀនពេញលេញសម្រាប់ម៉ោងសិក្សានីមួយៗនៃថ្នាក់ទី៨ (គោរពតាមក្បួនទាំង ៧ នៃជំនាញ lesson-plan)
   */
  function buildPeriodMasterHtml(period, profile) {
    const t = getFormattedProfileTexts(profile);

    const reviewQuestionsHtml = period.step2.reviewQuestions
      .map((q, idx) => `<li>${toKhmerNum(idx + 1)}. ${q}</li>`)
      .join('');

    const reviewAnswersHtml = period.step2.reviewAnswers
      .map((ans, idx) => `<div>- ចម្លើយទី${toKhmerNum(idx + 1)} ៖ ${ans}</div>`)
      .join('');

    const homeworkSolutionHtml = period.step2.homeworkSolution.join('<br />');
    const activitiesHtml = period.step3.e2.activities.join('<br /><br />');
    const rulesHtml = period.step3.e3.rules.join('<br />');
    const displayFormulaHtml = period.displayFormula ? `\n${period.displayFormula}` : '';
    const diagramHtml = period.step3.e3.diagramHtml || '';
    const examplesHtml = period.step3.e3.examples
      .map((ex) => `<p class="content-block">${ex}</p>`)
      .join('');

    return `
      ${buildDocumentTopHeaderHtml(profile)}

      <!-- ៣. ព័ត៌មានទូទៅ វត្ថុបំណង គោលវិធី/យុទ្ធវិធី និងសម្ភារៈឧបទ្ទេស (តម្រឹមសញ្ញា «៖» ស្មើជួរគ្នាពីលើដល់ក្រោម — Rule 2) -->
      <section class="meta-section editable-region">
        <table class="meta-table">
          <colgroup>
            <col class="meta-col-label" />
            <col class="meta-col-value" />
          </colgroup>
          <tbody>
            <tr>
              <td class="meta-label-cell">- មុខវិជ្ជា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>គណិតវិទ្យា ថ្នាក់ទី៨</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- ខ្លឹមសារមេរៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>មេរៀនទី${period.lessonNumberKh} ${period.lessonTitle}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- ចំណងជើងរង</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.subTopicLatex}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- រយៈពេល</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>៥០ នាទី</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- បង្រៀនដោយ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${t.teacherMeta}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- កាលបរិច្ឆេទ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${t.dateText}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- វត្ថុបំណង</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>ក្រោយពីរៀនចប់មេរៀននេះ សិស្សមានសមត្ថភាព ៖</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ វិជ្ជាសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.objectives.knowledge}</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ បំណិនសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.objectives.skill}</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ ចរិយាសម្បទា</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.objectives.attitude}</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- គោលវិធី និងយុទ្ធវិធីបង្រៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span></td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">- គោលវិធី</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>សិស្សមជ្ឈមណ្ឌល</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">- យុទ្ធវិធីបង្រៀន</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>តាមបែបរិះរក (5E)</td>
            </tr>
            <tr>
              <td class="meta-label-cell">- សម្ភារៈឧបទ្ទេស</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span></td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ សម្រាប់គ្រូ</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.materialsTeacher}</td>
            </tr>
            <tr class="meta-sub-row">
              <td class="meta-label-cell">+ សម្រាប់សិស្ស</td>
              <td class="meta-value-cell"><span class="meta-colon">៖</span>${period.materialsStudent}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ៤. តារាងស្តង់ដារ ៣ ជួរឈរ និង ៥ ជំហាននៅចំកណ្ដាល (បញ្ជ្រាប 5E — សរុប ៥០ នាទី) -->
      <table class="lesson-table">
        <colgroup>
          <col class="col-teacher" />
          <col class="col-content" />
          <col class="col-student" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">សកម្មភាពគ្រូ</th>
            <th scope="col">ខ្លឹមសារមេរៀន</th>
            <th scope="col">សកម្មភាពសិស្ស</th>
          </tr>
        </thead>
        <tbody class="editable-region">
          <!-- ==================== ជំហានទី១ (៤ នាទី) ==================== -->
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី១ ៖ រដ្ឋបាលថ្នាក់រៀន <span class="step-duration">(៤ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <ul class="cell-list">
                <li>ស្វាគមន៍សិស្ស និងពិនិត្យមើលអនាម័យ សណ្តាប់ធ្នាប់ សម្លៀកបំពាក់ក្នុងថ្នាក់រៀន។</li>
                <li>សាកសួរប្រធានថ្នាក់អំពីចំនួនវត្តមាន និងអវត្តមានសិស្សប្រចាំថ្ងៃ។</li>
                <li>ប្រមូលអារម្មណ៍សិស្សឱ្យមានលំនឹងត្រៀមចូលរៀនគណិតវិទ្យា។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">ពិនិត្យវត្តមាន និងលំនឹងថ្នាក់ ៖</p>
              <ul class="cell-list">
                <li>សិស្សសរុប ៖ ${t.studentsText}</li>
                <li>វត្តមាន ៖ ......... នាក់ (ស្រី ......... នាក់)</li>
                <li>អវត្តមាន ៖ ......... នាក់ (ច្បាប់ ...... / ឥតច្បាប់ ......)</li>
              </ul>
            </td>
            <td>
              <ul class="cell-list">
                <li>ក្រោកឈរគោរពស្វាគមន៍គ្រូ និងរៀបចំអនាម័យ សណ្តាប់ធ្នាប់ក្នុងថ្នាក់។</li>
                <li>ប្រធានថ្នាក់ឡើងរាយការណ៍ពីចំនួនវត្តមាន និងអវត្តមានសិស្ស។</li>
                <li>យកសៀវភៅសិក្សាគោលថ្នាក់ទី៨ សៀវភៅសរសេរ និងក្តារឆ្នួនដាក់លើតុ។</li>
              </ul>
            </td>
          </tr>

          <!-- ==================== ជំហានទី២ (៦ នាទី) ==================== -->
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី២ ៖ កិច្ចការផ្ទះ និងរំលឹកមេរៀនចាស់ <span class="step-duration">(៦ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <p class="content-subhead">២.១. កែសម្រួលកិច្ចការផ្ទះ ៖</p>
              <ul class="cell-list">
                <li>ឱ្យសិស្សយកកិច្ចការផ្ទះដាក់លើតុ និងហៅតំណាងសិស្សឡើងកែលើក្តារខៀន។</li>
                <li>សម្របសម្រួលផ្ទៀងផ្ទាត់ចម្លើយ កែលម្អចំណុចខ្វះខាត និងផ្តល់ការលើកទឹកចិត្ត។</li>
              </ul>
              <p class="content-subhead" style="margin-top: 1.8mm;">២.២. រំលឹកមេរៀនចាស់ភ្ជាប់មេរៀនថ្មី ៖</p>
              <ul class="cell-list">
                ${reviewQuestionsHtml}
              </ul>
            </td>
            <td>
              <p class="content-subhead">${period.step2.homeworkTask}</p>
              <div class="math-box">${homeworkSolutionHtml}</div>
              <p class="content-subhead" style="margin-top: 1.6mm;">ចំណេះដឹងរំលឹកមេរៀនចាស់ ៖</p>
              <div class="content-block">${reviewAnswersHtml}</div>
            </td>
            <td>
              <ul class="cell-list">
                <li>បង្ហាញសៀវភៅកិច្ចការផ្ទះ និងឡើងបកស្រាយកំណែលើក្តារខៀន។</li>
                <li>ផ្ទៀងផ្ទាត់ចម្លើយ និងកែតម្រូវចូលសៀវភៅរៀងៗខ្លួន។</li>
                <li>គិតពិចារណា និងលើកដៃឆ្លើយសំណួររំលឹកមេរៀនចាស់របស់គ្រូយ៉ាងសកម្ម។</li>
              </ul>
            </td>
          </tr>

          <!-- ==================== ជំហានទី៣ (២៦ នាទី ៖ E1, E2, E3) ==================== -->
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៣ ៖ មេរៀនថ្មី (បញ្ជ្រាបវិធីបង្រៀន 5E ៖ ដំណាក់កាលទី១ ទី២ និងទី៣) <span class="step-duration">(២៦ នាទី)</span>
            </td>
          </tr>

          <!-- E1 -->
          <tr>
            <td>
              <span class="phase-5e-badge">១. ដំណាក់កាលបំផុសចំណាប់អារម្មណ៍ (E1 — ៤ នាទី)</span>
              <ul class="cell-list">
                <li>លើកយកស្ថានភាពបញ្ហាភ្ជាប់ជីវភាពរស់នៅ ដើម្បីបំផុសការគិតរបស់សិស្ស ៖<br />
                  «${period.step3.e1.hookQuestion}»</li>
                <li>ឱ្យសិស្សប៉ាន់ស្មានចម្លើយបឋម រួចសរសេរចំណងជើងមេរៀន និងចំណងជើងរងលើក្តារខៀន។</li>
              </ul>
            </td>
            <td>
              <p class="content-block">
                <strong>មេរៀនទី${period.lessonNumberKh} ${period.lessonTitle}</strong><br />
                <strong>${period.subTopicLatex}</strong>
              </p>
              <p class="content-subhead">ស្ថានភាពបញ្ហា / គំនិតគន្លឹះ ៖</p>
              <p class="content-block">${period.step3.e1.problemSummary}</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>សង្កេត អាន និងគិតពិចារណាលើស្ថានភាពបញ្ហាដែលគ្រូបានលើកឡើង។</li>
                <li>ចូលរួមបញ្ចេញមតិ និងទស្សន៍ទាយចម្លើយបឋមដោយសេរី។</li>
                <li>កត់ត្រាចំណងជើងមេរៀន និងចំណងជើងរងចូលក្នុងសៀវភៅសរសេរ។</li>
              </ul>
            </td>
          </tr>

          <!-- E2 -->
          <tr>
            <td>
              <span class="phase-5e-badge">២. ដំណាក់កាលរុករក និងស្រាវជ្រាវ (E2 — ១០ នាទី)</span>
              <ul class="cell-list">
                <li>${period.step3.e2.teacherPrompt}</li>
                <li>ដើរតាមដាន សង្កេត និងជួយបំផុសសំណួរណែនាំដល់ក្រុមដែលជួបការលំបាក (ដោយមិនប្រាប់ចម្លើយផ្ទាល់)។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">សកម្មភាពរុករក / សន្លឹកកិច្ចការក្រុម ៖</p>
              <div class="math-box">${activitiesHtml}</div>
            </td>
            <td>
              <ul class="cell-list">
                <li>ចូលតាមក្រុម ចាត់តាំងអ្នកកត់ត្រា និងអ្នកឡើងបកស្រាយ។</li>
                <li>${period.step3.e2.studentAction}</li>
                <li>កត់ត្រាដំណោះស្រាយ និងលទ្ធផលក្រុមត្រៀមឡើងបង្ហាញ។</li>
              </ul>
            </td>
          </tr>

          <!-- E3 -->
          <tr>
            <td>
              <span class="phase-5e-badge">៣. ដំណាក់កាលបកស្រាយ និងសំយោគ (E3 — ១២ នាទី)</span>
              <ul class="cell-list">
                <li>អញ្ជើញតំណាងក្រុមឡើងបង្ហាញ និងបកស្រាយលទ្ធផលនៃការរុករកលើក្តារខៀន។</li>
                <li>សម្របសម្រួលឱ្យក្រុមដទៃសួរសំណួរ ផ្ទៀងផ្ទាត់ និងផ្តល់មតិកែលម្អ។</li>
                <li>បូកសរុប បំពេញបន្ថែម និងរួមគ្នាជាមួយសិស្សទាញចេញជា <strong>និយមន័យ រូបមន្ត ទ្រឹស្តីបទ ឬវិធាន</strong> ព្រមទាំងឧទាហរណ៍គំរូ។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">និយមន័យ / រូបមន្ត / ទ្រឹស្តីបទ ៖</p>
              <div class="math-box">${rulesHtml}${displayFormulaHtml}</div>
              ${diagramHtml}
              <p class="content-subhead" style="margin-top: 1.6mm;">ឧទាហរណ៍គំរូ ៖</p>
              ${examplesHtml}
            </td>
            <td>
              <ul class="cell-list">
                <li>តំណាងក្រុមឡើងបកស្រាយលទ្ធផល និងពន្យល់ពីរបៀបដោះស្រាយ។</li>
                <li>សិស្សក្រុមផ្សេងចូលរួមសង្កេត ផ្ទៀងផ្ទាត់ និងលើកសំណួរពិភាក្សា។</li>
                <li>ចូលរួមទាញសេចក្តីសន្និដ្ឋានជាមួយគ្រូ និងកត់ត្រាខ្លឹមសារមេរៀនចូលក្នុងសៀវភៅ។</li>
              </ul>
            </td>
          </tr>

          <!-- ==================== ជំហានទី៤ (១០ នាទី ៖ E4, E5) ==================== -->
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៤ ៖ ពង្រឹងពុទ្ធិ (បញ្ជ្រាបវិធីបង្រៀន 5E ៖ ដំណាក់កាលទី៤ និងទី៥) <span class="step-duration">(១០ នាទី)</span>
            </td>
          </tr>

          <!-- E4 -->
          <tr>
            <td>
              <span class="phase-5e-badge">៤. ដំណាក់កាលពង្រីកចំណេះដឹង (E4 — ៦ នាទី)</span>
              <ul class="cell-list">
                <li>ដាក់លំហាត់អនុវត្តពង្រីកចំណេះដឹងឱ្យសិស្សធ្វើជាដៃគូ ឬបុគ្គល ដើម្បីប្រើប្រាស់ចំណេះដឹងដែលទើបរៀនក្នុងបរិបទថ្មី។</li>
                <li>តាមដាន ជួយកែលម្អ និងហៅសិស្សឡើងបង្ហាញដំណោះស្រាយលើក្តារខៀន។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">លំហាត់អនុវត្តពង្រីកចំណេះដឹង ៖</p>
              <p class="content-block">${period.step4.e4.task}</p>
              <p class="content-subhead">ចម្លើយរំពឹងទុក ៖</p>
              <div class="math-box">${period.step4.e4.answer}</div>
            </td>
            <td>
              <ul class="cell-list">
                <li>គិតគណនា និងអនុវត្តរូបមន្ត/វិធានទៅដោះស្រាយលំហាត់ជាដៃគូ ឬបុគ្គល។</li>
                <li>ឡើងបង្ហាញដំណោះស្រាយលើក្តារខៀន និងផ្ទៀងផ្ទាត់ចម្លើយជាមួយគ្រូ។</li>
              </ul>
            </td>
          </tr>

          <!-- E5 -->
          <tr>
            <td>
              <span class="phase-5e-badge">៥. ដំណាក់កាលវាយតម្លៃលទ្ធផលសិក្សា (E5 — ៤ នាទី)</span>
              <ul class="cell-list">
                <li>វាស់ស្ទង់ការយល់ដឹងរបស់សិស្សធៀបនឹងវត្ថុបំណងមេរៀនទាំង ៣ តាមរយៈសំណួរ/លំហាត់ខ្លីលើក្តារឆ្នួន។</li>
                <li>ឱ្យសិស្សជួយសង្ខេបរូបមន្ត និងគំនិតគន្លឹះនៃមេរៀនឡើងវិញ។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">សំណួរ / លំហាត់វាយតម្លៃ ៖</p>
              <p class="content-block">${period.step4.e5.question}</p>
              <p class="content-subhead">ចម្លើយ និងលក្ខណៈវិនិច្ឆ័យ ៖</p>
              <p class="content-block">${period.step4.e5.criteria}</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>ដោះស្រាយលំហាត់វាយតម្លៃដោយខ្លួនឯងលើក្តារឆ្នួន និងលើកបង្ហាញគ្រូ។</li>
                <li>សង្ខេបរូបមន្ត និងគំនិតគន្លឹះសំខាន់ៗនៃមេរៀនឡើងវិញ។</li>
              </ul>
            </td>
          </tr>

          <!-- ==================== ជំហានទី៥ (៤ នាទី) ==================== -->
          <tr>
            <td colspan="3" class="step-banner-cell" align="center">
              ជំហានទី៥ ៖ កិច្ចការផ្ទះ និងបណ្តាំផ្ញើ <span class="step-duration">(៤ នាទី)</span>
            </td>
          </tr>
          <tr>
            <td>
              <p class="content-subhead">៥.១. កិច្ចការផ្ទះ ៖</p>
              <ul class="cell-list">
                <li>កំណត់លំហាត់កិច្ចការផ្ទះក្នុងសៀវភៅសិក្សាគោលថ្នាក់ទី៨ និងណែនាំគន្លឹះអនុវត្ត។</li>
              </ul>
              <p class="content-subhead" style="margin-top: 1.8mm;">៥.២. បណ្តាំផ្ញើ ៖</p>
              <ul class="cell-list">
                <li>ផ្តាំផ្ញើសិស្សឱ្យខិតខំរៀនសូត្រ ធ្វើកិច្ចការផ្ទះ អានមេរៀនបន្ទាប់ទុកជាមុន និងថែរក្សាសុខភាព សុវត្ថិភាពពេលធ្វើដំណើរ។</li>
              </ul>
            </td>
            <td>
              <p class="content-subhead">កិច្ចការផ្ទះ ៖</p>
              <p class="content-block">${period.step5.homework}</p>
              <p class="content-subhead">បណ្តាំផ្ញើ ៖</p>
              <p class="content-block">${period.step5.nextPreview}</p>
            </td>
            <td>
              <ul class="cell-list">
                <li>កត់ត្រាលំហាត់កិច្ចការផ្ទះចូលក្នុងសៀវភៅសរសេរយ៉ាងត្រឹមត្រូវ។</li>
                <li>ស្តាប់ការណែនាំ និងបណ្តាំផ្ញើរបស់គ្រូ ព្រមទាំងក្រោកឈរជម្រាបលាគ្រូ។</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>

      ${buildReflectionAndSignatureHtml(profile)}
    `;
  }

  // =========================================================================
  // 1:1 WYSIWYG A4 Landscape Sheet Paginator (បំបែកសន្លឹកក្រដាសផ្ដេកដាច់ៗពីគ្នា)
  // =========================================================================
  function updatePageScale() {
    shellEl.style.transform = 'none';
    shellEl.style.height = 'auto';

    if (!fitToScreen) return;

    const firstSheet = stackEl.querySelector('.a4-page');
    if (!firstSheet) return;

    const availableWidth = Math.max(280, document.documentElement.clientWidth - 20);
    const naturalWidth = firstSheet.offsetWidth;
    const naturalStackHeight = stackEl.offsetHeight;

    if (naturalWidth > 0 && availableWidth < naturalWidth) {
      const scale = availableWidth / naturalWidth;
      shellEl.style.transform = `scale(${scale.toFixed(4)})`;
      shellEl.style.height = `${Math.ceil(naturalStackHeight * scale)}px`;
    }
  }

  function getFooterLabelText() {
    const t = getFormattedProfileTexts(getProfileValues());
    return `កិច្ចតែងការបង្រៀន — ${t.schoolShort}`;
  }

  function createBlankSheet() {
    const sheet = document.createElement('article');
    sheet.className = 'a4-page';
    sheet.setAttribute('aria-label', 'កិច្ចតែងការបង្រៀន');

    const body = document.createElement('div');
    body.className = 'a4-page-body';
    sheet.appendChild(body);

    const footer = document.createElement('footer');
    footer.className = 'page-footer';
    footer.innerHTML =
      `<span class="page-footer-label">${escapeHtml(getFooterLabelText())}</span>` +
      '<span class="page-footer-num"></span>';
    sheet.appendChild(footer);

    stackEl.appendChild(sheet);

    const cs = window.getComputedStyle(sheet);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const maxBodyHeight = Math.floor(sheet.clientHeight - padTop - padBottom - 1);

    return { sheet, body, maxBodyHeight };
  }

  function createEmptyTableFromMaster(masterTable) {
    const table = document.createElement('table');
    table.className = masterTable.className || 'lesson-table';

    const colgroup = masterTable.querySelector('colgroup');
    if (colgroup) table.appendChild(colgroup.cloneNode(true));

    const thead = masterTable.querySelector('thead');
    if (thead) table.appendChild(thead.cloneNode(true));

    const tbody = document.createElement('tbody');
    tbody.className = 'editable-region';
    table.appendChild(tbody);

    return { table, tbody };
  }

  function splitOversizedRow(row, currentTbody, currentBody, maxBodyHeight) {
    const part1Row = document.createElement('tr');
    const part2Row = document.createElement('tr');

    const srcCells = Array.from(row.children);
    srcCells.forEach((cell) => {
      part1Row.appendChild(cell.cloneNode(false));
      part2Row.appendChild(cell.cloneNode(false));
    });

    currentTbody.appendChild(part1Row);
    let placedAnything = false;

    srcCells.forEach((srcCell, colIdx) => {
      const dst1 = part1Row.children[colIdx];
      const dst2 = part2Row.children[colIdx];
      const children = Array.from(srcCell.childNodes).filter(
        (n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim())
      );

      let overflowedCol = false;

      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (overflowedCol) {
          dst2.appendChild(node.cloneNode(true));
          continue;
        }

        const candidate = node.cloneNode(true);
        dst1.appendChild(candidate);

        if (currentBody.offsetHeight <= maxBodyHeight) {
          placedAnything = true;
        } else {
          dst1.removeChild(candidate);

          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.tagName === 'UL' || node.tagName === 'OL')
          ) {
            const list1 = node.cloneNode(false);
            const list2 = node.cloneNode(false);
            dst1.appendChild(list1);

            const items = Array.from(node.children);
            let listOverflowed = false;
            items.forEach((li) => {
              if (listOverflowed) {
                list2.appendChild(li.cloneNode(true));
                return;
              }
              const liClone = li.cloneNode(true);
              list1.appendChild(liClone);
              if (currentBody.offsetHeight <= maxBodyHeight) {
                placedAnything = true;
              } else {
                list1.removeChild(liClone);
                listOverflowed = true;
                list2.appendChild(li.cloneNode(true));
              }
            });

            if (list1.children.length === 0) dst1.removeChild(list1);
            if (list2.children.length > 0) dst2.appendChild(list2);
          } else if (!placedAnything && colIdx === 0 && i === 0) {
            dst1.appendChild(candidate);
            placedAnything = true;
          } else {
            dst2.appendChild(node.cloneNode(true));
          }

          overflowedCol = true;
        }
      }
    });

    const hasRemaining = Array.from(part2Row.children).some(
      (td) => td.childNodes.length > 0 && td.textContent.trim().length > 0
    );

    return hasRemaining ? part2Row : null;
  }

  function paginateDocument() {
    if (editMode) return;

    shellEl.style.transform = 'none';
    shellEl.style.height = 'auto';

    const masterContainer = document.createElement('div');
    masterContainer.innerHTML = masterHtml;
    renderLatexMath(masterContainer);

    stackEl.innerHTML = '';
    let pageCtx = createBlankSheet();

    const topElements = Array.from(masterContainer.children);

    for (let idx = 0; idx < topElements.length; idx++) {
      const el = topElements[idx];

      // 1. Metadata section (.meta-section with table.meta-table)
      if (el.classList.contains('meta-section')) {
        const wholeClone = el.cloneNode(true);
        pageCtx.body.appendChild(wholeClone);

        if (pageCtx.body.offsetHeight <= pageCtx.maxBodyHeight) {
          continue;
        }

        pageCtx.body.removeChild(wholeClone);
        const srcMetaTable = el.querySelector('table.meta-table');
        if (!srcMetaTable) {
          pageCtx = createBlankSheet();
          pageCtx.body.appendChild(wholeClone);
          continue;
        }

        const buildEmptyMetaSection = () => {
          const sec = document.createElement('section');
          sec.className = el.className;
          const tbl = document.createElement('table');
          tbl.className = srcMetaTable.className;
          const cg = srcMetaTable.querySelector('colgroup');
          if (cg) tbl.appendChild(cg.cloneNode(true));
          const tb = document.createElement('tbody');
          tbl.appendChild(tb);
          sec.appendChild(tbl);
          return { sec, tb };
        };

        let metaCtx = buildEmptyMetaSection();
        pageCtx.body.appendChild(metaCtx.sec);

        const metaRows = Array.from(srcMetaTable.querySelectorAll('tbody > tr'));
        metaRows.forEach((tr) => {
          const trClone = tr.cloneNode(true);
          metaCtx.tb.appendChild(trClone);
          if (pageCtx.body.offsetHeight > pageCtx.maxBodyHeight && metaCtx.tb.children.length > 1) {
            metaCtx.tb.removeChild(trClone);
            pageCtx = createBlankSheet();
            metaCtx = buildEmptyMetaSection();
            pageCtx.body.appendChild(metaCtx.sec);
            metaCtx.tb.appendChild(trClone);
          }
        });
        continue;
      }

      // 2. Main 3-Column × 5-Step Lesson Table — start cleanly on Sheet 2 after Page 1 metadata
      if (el.tagName === 'TABLE' && el.classList.contains('lesson-table')) {
        const srcTbody = el.querySelector('tbody');
        if (!srcTbody) continue;

        if (pageCtx.body.querySelector('.meta-section')) {
          pageCtx = createBlankSheet();
        }

        const rowQueue = Array.from(srcTbody.children).map((r) => r.cloneNode(true));
        let tblCtx = null;

        const ensureTable = () => {
          if (!tblCtx) {
            tblCtx = createEmptyTableFromMaster(el);
            pageCtx.body.appendChild(tblCtx.table);
          }
          return tblCtx;
        };

        const discardEmptyTable = () => {
          if (tblCtx && tblCtx.tbody.children.length === 0) {
            if (tblCtx.table.parentNode === pageCtx.body) {
              pageCtx.body.removeChild(tblCtx.table);
            }
            tblCtx = null;
          }
        };

        while (rowQueue.length > 0) {
          const row = rowQueue.shift();
          const isStepBanner = Boolean(row.querySelector('.step-banner-cell'));

          // Never leave an orphan Step Banner at the bottom of a sheet
          if (isStepBanner && rowQueue.length > 0 && !rowQueue[0].querySelector('.step-banner-cell')) {
            const firstContentRow = rowQueue.shift();
            const activeTbl = ensureTable();

            activeTbl.tbody.appendChild(row);
            activeTbl.tbody.appendChild(firstContentRow);

            if (pageCtx.body.offsetHeight <= pageCtx.maxBodyHeight) {
              continue;
            }

            activeTbl.tbody.removeChild(firstContentRow);
            activeTbl.tbody.removeChild(row);
            discardEmptyTable();

            if (pageCtx.body.children.length > 0) {
              pageCtx = createBlankSheet();
              tblCtx = null;
            }

            const freshTbl = ensureTable();
            freshTbl.tbody.appendChild(row);
            freshTbl.tbody.appendChild(firstContentRow);

            if (pageCtx.body.offsetHeight <= pageCtx.maxBodyHeight) {
              continue;
            }

            freshTbl.tbody.removeChild(firstContentRow);
            const leftover = splitOversizedRow(
              firstContentRow,
              freshTbl.tbody,
              pageCtx.body,
              pageCtx.maxBodyHeight
            );
            if (leftover) rowQueue.unshift(leftover);
            pageCtx = createBlankSheet();
            tblCtx = null;
            continue;
          }

          const activeTbl = ensureTable();
          activeTbl.tbody.appendChild(row);

          if (pageCtx.body.offsetHeight <= pageCtx.maxBodyHeight) {
            continue;
          }

          activeTbl.tbody.removeChild(row);
          discardEmptyTable();

          if (pageCtx.body.children.length > 0) {
            pageCtx = createBlankSheet();
            tblCtx = null;
          }

          const freshTbl = ensureTable();
          freshTbl.tbody.appendChild(row);

          if (pageCtx.body.offsetHeight <= pageCtx.maxBodyHeight) {
            continue;
          }

          freshTbl.tbody.removeChild(row);
          const leftover = splitOversizedRow(
            row,
            freshTbl.tbody,
            pageCtx.body,
            pageCtx.maxBodyHeight
          );
          if (leftover) {
            rowQueue.unshift(leftover);
            pageCtx = createBlankSheet();
            tblCtx = null;
          }
        }

        discardEmptyTable();
        continue;
      }

      // 3. Generic top-level blocks (Header, Reflection box, Signature table)
      const blockClone = el.cloneNode(true);
      pageCtx.body.appendChild(blockClone);

      if (pageCtx.body.offsetHeight > pageCtx.maxBodyHeight && pageCtx.body.children.length > 1) {
        pageCtx.body.removeChild(blockClone);
        pageCtx = createBlankSheet();
        pageCtx.body.appendChild(blockClone);
      }
    }

    const allSheets = Array.from(stackEl.querySelectorAll('.a4-page'));
    if (allSheets.length > 1) {
      const last = allSheets[allSheets.length - 1];
      const lastBody = last.querySelector('.a4-page-body');
      if (lastBody && lastBody.children.length === 0) {
        stackEl.removeChild(last);
        allSheets.pop();
      }
    }

    const totalPages = allSheets.length;
    allSheets.forEach((sheet, idx) => {
      const numEl = sheet.querySelector('.page-footer-num');
      if (numEl) {
        numEl.textContent = `ទំព័រទី ${toKhmerNum(idx + 1)} / ${toKhmerNum(totalPages)}`;
      }
    });

    if (pageCountEl) {
      pageCountEl.textContent = `📄 ${toKhmerNum(totalPages)} ទំព័រ (ក្រដាសផ្ដេក A4)`;
    }

    updatePageScale();
  }

  // =========================================================================
  // 3-Level Cascading Selector Logic (ជំពូក › មេរៀន › ចំណុចរង)
  // =========================================================================
  function populateChapterSelect() {
    if (!selectChapterEl) return;
    let html = '';
    chapters.forEach((ch) => {
      const r0 = toKhmerNum(ch.lessonRange[0]);
      const r1 = toKhmerNum(ch.lessonRange[1]);
      html += `<option value="${ch.id}">ជំពូកទី${ch.chapterNumberKh} ៖ ${escapeHtml(ch.chapterTitle)} (មេរៀនទី${r0}–${r1})</option>`;
    });
    html += `<option value="${BLANK_ID}">📄 ទម្រង់គំរូទទេស្តង់ដារ 5E (Blank Template)</option>`;
    selectChapterEl.innerHTML = html;
  }

  function populateLessonSelectForChapter(chapterId) {
    if (!selectLessonEl) return;
    if (chapterId === BLANK_ID) {
      selectLessonEl.innerHTML = '<option value="blank">— ទម្រង់គំរូទទេស្តង់ដារ 5E —</option>';
      selectLessonEl.disabled = true;
      return;
    }

    selectLessonEl.disabled = false;
    const chapterLessons = Array.from(lessonsMap.values()).filter((l) => l.chapterId === chapterId);
    selectLessonEl.innerHTML = chapterLessons
      .map((l) => {
        const firstPage = l.periods[0].pages.split('–')[0];
        const lastPage = l.periods[l.periods.length - 1].pages.split('–').pop();
        return `<option value="${l.lessonNumber}">មេរៀនទី${l.lessonNumberKh} ៖ ${escapeHtml(l.lessonTitle)} (${toKhmerNum(l.totalPeriods)} ចំណុចរង • ទំព័រ ${firstPage}–${lastPage})</option>`;
      })
      .join('');
  }

  function populateSubtopicSelectForLesson(lessonNumber) {
    if (!selectSubtopicEl) return;
    if (lessonNumber === BLANK_ID || !lessonsMap.has(Number(lessonNumber))) {
      selectSubtopicEl.innerHTML = '<option value="blank">— សម្រាប់បោះពុម្ពសរសេរដៃ ឬវាយបញ្ចូលផ្ទាល់ —</option>';
      selectSubtopicEl.disabled = true;
      return;
    }

    selectSubtopicEl.disabled = false;
    const lesson = lessonsMap.get(Number(lessonNumber));
    selectSubtopicEl.innerHTML = lesson.periods
      .map((p) => {
        const editedMark = hasSavedCustomEdit(p.id) ? ' ✎កែរួច' : '';
        return `<option value="${p.id}">${escapeHtml(p.subTopicPlain)} (៥០ នាទី)${editedMark}</option>`;
      })
      .join('');
  }

  function syncCascadeControls() {
    if (activeId === BLANK_ID) {
      if (selectChapterEl) selectChapterEl.value = BLANK_ID;
      populateLessonSelectForChapter(BLANK_ID);
      populateSubtopicSelectForLesson(BLANK_ID);
      if (activeDocSubEl) {
        activeDocSubEl.textContent = 'អនុវិទ្យាល័យព្រះក្រសាំង — ទម្រង់ទទេស្តង់ដារ 5E (ក្រដាស A4 ផ្ដេក)';
      }
      if (periodIndexPillEl) periodIndexPillEl.textContent = 'គំរូទទេ 5E';
      if (btnPrevPeriod) btnPrevPeriod.disabled = true;
      if (btnNextPeriod) btnNextPeriod.disabled = allPeriods.length === 0;
      return;
    }

    const idx = allPeriods.findIndex((p) => p.id === activeId);
    const period = idx >= 0 ? allPeriods[idx] : allPeriods[0];
    if (!period) return;

    if (selectChapterEl) selectChapterEl.value = period.chapterId;
    populateLessonSelectForChapter(period.chapterId);
    if (selectLessonEl) selectLessonEl.value = String(period.lessonNumber);
    populateSubtopicSelectForLesson(period.lessonNumber);
    if (selectSubtopicEl) selectSubtopicEl.value = period.id;

    if (activeDocSubEl) {
      activeDocSubEl.textContent = `អនុវិទ្យាល័យព្រះក្រសាំង — ជំពូកទី${period.chapterNumberKh} › មេរៀនទី${period.lessonNumberKh} ${period.lessonTitle} › ${period.subTopicPlain}`;
    }
    if (periodIndexPillEl) {
      periodIndexPillEl.textContent = `ម៉ោងទី ${toKhmerNum(idx + 1)} / ${toKhmerNum(allPeriods.length)}`;
    }
    if (btnPrevPeriod) btnPrevPeriod.disabled = idx <= 0;
    if (btnNextPeriod) btnNextPeriod.disabled = idx < 0 || idx >= allPeriods.length - 1;
  }

  function renderQuickSearchResults() {
    if (!searchResultsEl) return;
    const q = (searchInputEl ? searchInputEl.value : '').trim().toLowerCase();

    const matches = allPeriods.filter((p) => {
      if (!q) return true;
      const haystack = [
        `ជំពូកទី${p.chapterNumberKh}`,
        `ជំពូកទី${p.chapterNumber}`,
        p.chapterTitle,
        `មេរៀនទី${p.lessonNumberKh}`,
        `មេរៀនទី${p.lessonNumber}`,
        p.lessonTitle,
        p.subTopicPlain,
        p.pages
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    if (searchCountLabelEl) {
      searchCountLabelEl.textContent = `${toKhmerNum(matches.length)} ចំណុចរង`;
    }

    if (matches.length === 0) {
      searchResultsEl.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:16px;color:#64748b;">មិនឃើញចំណុចរងដែលត្រូវនឹងពាក្យស្វែងរកឡើយ។</div>';
      return;
    }

    searchResultsEl.innerHTML = matches
      .map((p) => {
        const isCurrent = p.id === activeId;
        return `
          <button type="button" class="search-result-card ${isCurrent ? 'is-active' : ''}" data-pick-id="${p.id}">
            <span class="search-card-top">ជំពូកទី${p.chapterNumberKh} • មេរៀនទី${p.lessonNumberKh} ៖ ${escapeHtml(p.lessonTitle)} (ទំព័រ ${p.pages})</span>
            <span class="search-card-sub">ម៉ោងទី${p.periodNumberKh} — ${escapeHtml(p.subTopicPlain)}</span>
          </button>
        `;
      })
      .join('');
  }

  function buildCurrentMasterHtml() {
    const saved = loadCustomEdit(activeId);
    if (saved) return saved;

    const profile = getProfileValues();
    if (activeId === BLANK_ID) {
      return buildBlankMasterHtml(profile);
    }
    const period = periodMap.get(activeId) || allPeriods[0];
    return period ? buildPeriodMasterHtml(period, profile) : buildBlankMasterHtml(profile);
  }

  function loadAndRenderPeriod(targetId, options) {
    const opts = options || {};
    if (editMode) {
      setEditable(false, { skipSave: false });
    }

    activeId =
      targetId === BLANK_ID || periodMap.has(targetId)
        ? targetId
        : allPeriods[0]
        ? allPeriods[0].id
        : BLANK_ID;

    storageSet(STORAGE_ACTIVE_ID_KEY, activeId);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#${activeId}`);
    }

    syncCascadeControls();
    updateResetButtonVisibility();
    renderQuickSearchResults();

    masterHtml = buildCurrentMasterHtml();
    paginateDocument();

    if (opts.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // =========================================================================
  // Inline Edit Mode (កែសម្រួលអត្ថបទ និងកូដ LaTeX ផ្ទាល់ រួចរៀបសន្លឹកក្រដាសឡើងវិញ)
  // =========================================================================
  function setEditable(enabled, options) {
    const opts = options || {};
    editMode = enabled;
    if (btnEdit) {
      btnEdit.classList.toggle('is-active', enabled);
      btnEdit.textContent = enabled
        ? '✓ រក្សាទុក & បំបែកសន្លឹកក្រដាស'
        : '✏️ កែសម្រួលលើទម្រង់';
    }

    if (enabled) {
      shellEl.style.transform = 'none';
      shellEl.style.height = 'auto';
      stackEl.innerHTML = '';

      const editSheet = document.createElement('article');
      editSheet.className = 'a4-page a4-page-edit-mode show-edit-guides';
      editSheet.setAttribute('aria-label', 'កែសម្រួលកិច្ចតែងការបង្រៀនគណិតវិទ្យាថ្នាក់ទី៨');

      const banner = document.createElement('div');
      banner.className = 'edit-mode-banner no-print';
      banner.textContent =
        'របៀបកែសម្រួល៖ កែអត្ថបទ ឬរូបមន្ត LaTeX ($...$) រួចចុចប៊ូតុង «✓ រក្សាទុក & បំបែកសន្លឹកក្រដាស» ដើម្បីរក្សាទុក និងរៀបជាសន្លឹកក្រដាស A4 ផ្ដេកដាច់ៗពីគ្នាឡើងវិញ។';
      editSheet.appendChild(banner);

      const editBody = document.createElement('div');
      editBody.id = 'editable-master-body';
      editBody.innerHTML = masterHtml;
      renderLatexMath(editBody);

      editBody.querySelectorAll('.editable-region').forEach((el) => {
        el.setAttribute('contenteditable', 'true');
      });

      editSheet.appendChild(editBody);
      stackEl.appendChild(editSheet);
      updatePageScale();
    } else {
      const editBody = document.getElementById('editable-master-body');
      if (editBody && !opts.skipSave) {
        editBody.querySelectorAll('[contenteditable]').forEach((el) => {
          el.removeAttribute('contenteditable');
        });
        editBody.querySelectorAll('.katex-display').forEach((dispEl) => {
          const ann = dispEl.querySelector('annotation[encoding="application/x-tex"]');
          if (ann) {
            dispEl.replaceWith(document.createTextNode(`$$${ann.textContent}$$`));
          }
        });
        editBody.querySelectorAll('.katex').forEach((kEl) => {
          const ann = kEl.querySelector('annotation[encoding="application/x-tex"]');
          if (ann) {
            kEl.replaceWith(document.createTextNode(`$${ann.textContent}$`));
          }
        });
        masterHtml = editBody.innerHTML;
        saveCustomEdit(activeId, masterHtml);
        syncCascadeControls();
      }
      paginateDocument();
    }
  }

  // =========================================================================
  // Microsoft Word (.doc) Exporter (A4 Landscape + KaTeX-to-Cambria + SVG-to-PNG)
  // =========================================================================
  function texToWordHtml(rawTex, isDisplay) {
    let s = rawTex.trim();

    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Handle \begin{cases} ... \end{cases} cleanly for Word export
    s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_m, inner) => {
      const rows = inner
        .split(/\\\\(?:\[\d+pt\])?/)
        .map((r) => r.replace(/&amp;/g, ' ').trim())
        .filter(Boolean);
      return '{ ' + rows.join(' ; ') + ' }';
    });

    // Preserve escaped braces & percent before stripping TeX commands
    s = s.replace(/\\\{/g, '&#123;').replace(/\\\}/g, '&#125;').replace(/\\%/g, '%');

    s = s.replace(/\\text\{([^{}]*)\}/g, '<span class="word-mtext">$1</span>');
    s = s.replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>');
    s = s.replace(/\\mathbf\{([^{}]*)\}/g, '<b>$1</b>');
    s = s.replace(/\\mathcal\{([^{}]*)\}/g, '<i>$1</i>');
    s = s.replace(/\\overline\{([^{}]*)\}/g, '<span style="text-decoration:overline;">$1</span>');
    s = s.replace(/\\bar\{([^{}]*)\}/g, '$1&#772;');
    s = s.replace(/\\widehat\{([^{}]*)\}/g, '∠$1');

    for (let i = 0; i < 3; i++) {
      s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    }

    s = s.replace(/\\sqrt\[([^{}\]]*)\]\{([^{}]*)\}/g, '<sup>$1</sup>√($2)');
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
    s = s.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>');
    s = s.replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
    s = s.replace(/\^(\\circ|[0-9a-zA-Z])/g, '<sup>$1</sup>');
    s = s.replace(/_([0-9a-zA-Z])/g, '<sub>$1</sub>');

    const symbolMap = [
      [/\\qquad/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'],
      [/\\quad/g, '&nbsp;&nbsp;&nbsp;&nbsp;'],
      [/\\,/g, '&thinsp;'],
      [/\\;/g, '&nbsp;'],
      [/\\:/g, '&nbsp;'],
      [/\\!/g, ''],
      [/\\dots|\\ldots/g, '…'],
      [/\\sum/g, '∑'],
      [/\\Omega/g, 'Ω'],
      [/\\alpha/g, 'α'],
      [/\\beta/g, 'β'],
      [/\\gamma/g, 'γ'],
      [/\\theta/g, 'θ'],
      [/\\Delta/g, 'Δ'],
      [/\\times/g, ' × '],
      [/\\div/g, ' ÷ '],
      [/\\cdot/g, ' · '],
      [/\\pm/g, ' ± '],
      [/\\mp/g, ' ∓ '],
      [/\\le|\\leq/g, ' ≤ '],
      [/\\ge|\\geq/g, ' ≥ '],
      [/\\neq|\\ne/g, ' ≠ '],
      [/\\approx/g, ' ≈ '],
      [/\\equiv/g, ' ≡ '],
      [/\\implies|\\Rightarrow/g, ' ⇒ '],
      [/\\iff|\\Longleftrightarrow|\\Leftrightarrow/g, ' ⇔ '],
      [/\\rightarrow|\\to/g, ' → '],
      [/\\cong/g, ' ≅ '],
      [/\\parallel/g, ' ∥ '],
      [/\\perp/g, ' ⊥ '],
      [/\\in/g, ' ∈ '],
      [/\\notin/g, ' ∉ '],
      [/\\subset/g, ' ⊂ '],
      [/\\subseteq/g, ' ⊆ '],
      [/\\cup/g, ' ∪ '],
      [/\\cap/g, ' ∩ '],
      [/\\emptyset/g, '∅'],
      [/\\infty/g, '∞'],
      [/\\pi/g, 'π'],
      [/\\triangle/g, '△'],
      [/\\angle/g, '∠'],
      [/\\circ/g, '°'],
      [/\\mathbb\{N\}/g, 'ℕ'],
      [/\\mathbb\{Z\}/g, 'ℤ'],
      [/\\mathbb\{Q\}/g, 'ℚ'],
      [/\\mathbb\{R\}/g, 'ℝ'],
      [/\\middle\|/g, ' | '],
      [/\\left\|/g, '|'],
      [/\\right\|/g, '|'],
      [/\\left/g, ''],
      [/\\right/g, '']
    ];

    symbolMap.forEach(([regex, replacement]) => {
      s = s.replace(regex, replacement);
    });

    if (isDisplay) {
      return `<div class="word-math-display">${s}</div>`;
    }
    return `<span class="word-math-inline">${s}</span>`;
  }

  function convertKatexForWord(rootClone) {
    rootClone.querySelectorAll('.katex-display').forEach((dispEl) => {
      const ann = dispEl.querySelector('annotation[encoding="application/x-tex"]');
      if (ann) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = texToWordHtml(ann.textContent || '', true);
        dispEl.replaceWith(wrapper.firstElementChild);
      }
    });

    rootClone.querySelectorAll('.katex').forEach((katexEl) => {
      const ann = katexEl.querySelector('annotation[encoding="application/x-tex"]');
      if (ann) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = texToWordHtml(ann.textContent || '', false);
        katexEl.replaceWith(wrapper.firstElementChild);
      }
    });
  }

  function svgElementToPngDataUrl(svgEl) {
    return new Promise((resolve) => {
      try {
        const widthAttr = parseFloat(svgEl.getAttribute('width')) || 220;
        const heightAttr = parseFloat(svgEl.getAttribute('height')) || 110;
        const dpr = 2.5;

        const clonedSvg = svgEl.cloneNode(true);
        if (!clonedSvg.getAttribute('xmlns')) {
          clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        clonedSvg.setAttribute('width', String(widthAttr * dpr));
        clonedSvg.setAttribute('height', String(heightAttr * dpr));

        const xml = new XMLSerializer().serializeToString(clonedSvg);
        const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(widthAttr * dpr);
            canvas.height = Math.round(heightAttr * dpr);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({
              dataUrl: canvas.toDataURL('image/png'),
              width: Math.round(widthAttr),
              height: Math.round(heightAttr)
            });
          } catch (_err) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = svgDataUrl;
      } catch (_err) {
        resolve(null);
      }
    });
  }

  function getWordFilename() {
    if (activeId === BLANK_ID) {
      return 'ទម្រង់ស្តង់ដារ_កិច្ចតែងការបង្រៀន_ផ្តេក.doc';
    }
    const p = periodMap.get(activeId);
    if (!p) return 'កិច្ចតែងការបង្រៀន_គណិតវិទ្យាថ្នាក់ទី៨_5E.doc';
    const cleanTitle = p.lessonTitle.replace(/\s+/g, '_');
    return `កិច្ចតែងការបង្រៀន_G8_មេរៀនទី${p.lessonNumberKh}_${cleanTitle}_${p.lessonNumberKh}.${p.periodNumberKh}.doc`;
  }

  async function exportToWordDoc() {
    if (editMode) {
      setEditable(false);
    }

    const exportRoot = document.createElement('div');
    exportRoot.innerHTML = masterHtml;
    renderLatexMath(exportRoot);
    convertKatexForWord(exportRoot);

    const svgs = Array.from(exportRoot.querySelectorAll('svg'));
    for (const svgEl of svgs) {
      const raster = await svgElementToPngDataUrl(svgEl);
      if (raster && raster.dataUrl) {
        const imgEl = document.createElement('img');
        imgEl.src = raster.dataUrl;
        imgEl.width = raster.width;
        imgEl.height = raster.height;
        imgEl.alt = svgEl.getAttribute('aria-label') || '';
        imgEl.style.display = 'block';
        imgEl.style.margin = '2pt auto';
        svgEl.replaceWith(imgEl);
      }
    }

    const wordStyles = `
      @page WordSection1 {
        size: 841.9pt 595.3pt;
        mso-page-orientation: landscape;
        margin: 36.8pt 39.7pt 39.7pt 51.0pt;
        mso-header-margin: 35.4pt;
        mso-footer-margin: 35.4pt;
      }
      div.WordSection1 { page: WordSection1; }
      body {
        font-family: "Khmer OS Siemreap", "Hanuman", serif;
        font-size: 10.5pt;
        color: #000000;
        line-height: 1.55;
      }
      .kingdom-motto, .doc-title-block { text-align: center; }
      .muol-heading, .doc-main-title, .sig-role-muol {
        font-family: "Khmer OS Muol Light", "Moul", serif;
        font-weight: normal;
      }
      .doc-main-title { font-size: 12pt; margin: 0; }
      .school-admin-block p { margin: 0; font-size: 10pt; }
      .meta-section { margin-left: 22.7pt; margin-bottom: 10pt; }
      table.meta-table { width: 100%; border-collapse: collapse; border: none; table-layout: fixed; }
      table.meta-table td { border: none; padding: 1.5pt 0; vertical-align: top; font-family: "Khmer OS Siemreap", "Hanuman", serif; font-size: 10.2pt; }
      table.meta-table td.meta-label-cell { width: 147.4pt; font-weight: bold; white-space: nowrap; padding-right: 6pt; }
      table.meta-table tr.meta-sub-row td.meta-label-cell { padding-left: 17pt; }
      .meta-colon { font-weight: bold; margin-right: 3pt; }
      .content-subhead { font-weight: bold; margin: 0 0 2pt 0; }
      .content-block { margin: 0 0 4pt 0; }
      table.lesson-table {
        width: 100%;
        border-collapse: collapse;
        border: 1pt solid #000000;
        mso-border-alt: solid windowtext .75pt;
        mso-yfti-tbllook: 1184;
      }
      table.lesson-table thead { display: table-header-group; }
      table.lesson-table tr { page-break-inside: avoid; }
      table.lesson-table th, table.lesson-table td {
        border: 1pt solid #000000;
        padding: 5pt 6pt;
        vertical-align: top;
        font-family: "Khmer OS Siemreap", "Hanuman", serif;
        font-size: 10.2pt;
      }
      table.lesson-table thead th {
        font-family: "Khmer OS Muol Light", "Moul", serif;
        font-weight: normal;
        text-align: center;
        background: #F2F2F2;
      }
      .step-banner-cell {
        font-family: "Khmer OS Muol Light", "Moul", serif;
        font-weight: normal;
        text-align: center;
        background: #F9F9F9;
      }
      .step-duration {
        font-family: "Khmer OS Siemreap", "Hanuman", serif;
        font-weight: bold;
      }
      .phase-5e-badge { font-weight: bold; text-decoration: underline; display: block; margin-bottom: 2pt; }
      .math-box { border: 0.75pt solid #222222; padding: 5pt 7pt; margin: 4pt 0; background: #FCFCFC; }
      .diagram-box { border: 0.6pt solid #444444; padding: 4pt; margin: 4pt 0; text-align: center; }
      .diagram-caption { font-size: 9pt; font-style: italic; margin-top: 2pt; }
      .word-math-inline { font-family: "Cambria Math", "Times New Roman", serif; font-size: 10.8pt; }
      .word-math-display { font-family: "Cambria Math", "Times New Roman", serif; font-size: 11.2pt; text-align: center; margin: 5pt 0; font-weight: normal; }
      .word-mtext { font-family: "Khmer OS Siemreap", "Hanuman", serif; }
      table.layout-pair-table { width: 100%; border-collapse: collapse; border: none; margin: 3pt 0; }
      table.layout-pair-table > tbody > tr > td { border: none; padding: 2pt 4pt; vertical-align: top; width: 50%; }
      table.potence-table { border-collapse: collapse; border: none; margin: 4pt 0; }
      table.potence-table td { border: none; padding: 1.5pt 5pt; font-family: "Cambria Math", "Times New Roman", serif; }
      table.potence-table td.pot-left { text-align: right; border-right: 1pt solid #000000; }
      table.potence-table td.pot-divisor { text-align: left; border-bottom: 1pt solid #000000; font-weight: bold; }
      table.potence-table td.pot-quotient { text-align: left; font-weight: bold; }
      .potence-sub { border-bottom: 0.75pt solid #000000; }
      .reflection-box { border: 1pt solid #000000; padding: 6pt 8pt; margin-top: 10pt; }
      .reflection-title { font-weight: bold; margin: 0 0 3pt 0; }
      .signature-table { width: 100%; border: none; margin-top: 14pt; text-align: center; }
      .signature-table td { border: none; width: 50%; text-align: center; vertical-align: top; }
      .sig-space { height: 40pt; }
    `;

    const docHtml =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>កិច្ចតែងការបង្រៀន</title>' +
      `<style>${wordStyles}</style></head>` +
      `<body><div class="WordSection1">${exportRoot.innerHTML}</div></body></html>`;

    const blob = new Blob(['\ufeff', docHtml], {
      type: 'application/msword;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getWordFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================
  function bindEvents() {
    // Step 1: Chapter selection -> cascades to Lesson -> cascades to Sub-topic
    if (selectChapterEl) {
      selectChapterEl.addEventListener('change', () => {
        const chId = selectChapterEl.value;
        if (chId === BLANK_ID) {
          loadAndRenderPeriod(BLANK_ID, { scrollTop: false });
          return;
        }
        const firstPeriodInChapter = allPeriods.find((p) => p.chapterId === chId);
        if (firstPeriodInChapter) {
          loadAndRenderPeriod(firstPeriodInChapter.id, { scrollTop: false });
        }
      });
    }

    // Step 2: Lesson selection -> cascades to Sub-topic
    if (selectLessonEl) {
      selectLessonEl.addEventListener('change', () => {
        const lessonNum = Number(selectLessonEl.value);
        const lesson = lessonsMap.get(lessonNum);
        if (lesson && lesson.periods.length > 0) {
          loadAndRenderPeriod(lesson.periods[0].id, { scrollTop: false });
        }
      });
    }

    // Step 3: Sub-topic selection -> renders specific 50-minute lesson plan
    if (selectSubtopicEl) {
      selectSubtopicEl.addEventListener('change', () => {
        const id = selectSubtopicEl.value;
        if (id) {
          loadAndRenderPeriod(id, { scrollTop: false });
        }
      });
    }

    // Quick Prev / Next Sub-topic stepper
    if (btnPrevPeriod) {
      btnPrevPeriod.addEventListener('click', () => {
        const idx = allPeriods.findIndex((p) => p.id === activeId);
        if (idx > 0) {
          loadAndRenderPeriod(allPeriods[idx - 1].id, { scrollTop: true });
        }
      });
    }

    if (btnNextPeriod) {
      btnNextPeriod.addEventListener('click', () => {
        if (activeId === BLANK_ID && allPeriods.length > 0) {
          loadAndRenderPeriod(allPeriods[0].id, { scrollTop: true });
          return;
        }
        const idx = allPeriods.findIndex((p) => p.id === activeId);
        if (idx >= 0 && idx < allPeriods.length - 1) {
          loadAndRenderPeriod(allPeriods[idx + 1].id, { scrollTop: true });
        }
      });
    }

    // Quick Search Drawer
    if (btnToggleSearch && searchPanelEl) {
      btnToggleSearch.addEventListener('click', () => {
        const nextHidden = !searchPanelEl.hidden;
        searchPanelEl.hidden = nextHidden;
        btnToggleSearch.classList.toggle('is-active', !nextHidden);
        if (!nextHidden && profilePanelEl && !profilePanelEl.hidden) {
          profilePanelEl.hidden = true;
          if (btnToggleProfile) btnToggleProfile.classList.remove('is-active');
        }
        if (!nextHidden && searchInputEl) {
          searchInputEl.focus();
        }
      });
    }

    if (searchInputEl) {
      searchInputEl.addEventListener('input', renderQuickSearchResults);
    }

    if (searchResultsEl) {
      searchResultsEl.addEventListener('click', (ev) => {
        const card = ev.target.closest('[data-pick-id]');
        if (!card) return;
        const pickedId = card.getAttribute('data-pick-id');
        if (pickedId) {
          if (searchPanelEl) searchPanelEl.hidden = true;
          if (btnToggleSearch) btnToggleSearch.classList.remove('is-active');
          loadAndRenderPeriod(pickedId, { scrollTop: true });
        }
      });
    }

    // Teacher / School Profile Drawer
    if (btnToggleProfile && profilePanelEl) {
      btnToggleProfile.addEventListener('click', () => {
        const nextHidden = !profilePanelEl.hidden;
        profilePanelEl.hidden = nextHidden;
        btnToggleProfile.classList.toggle('is-active', !nextHidden);
        if (!nextHidden && searchPanelEl && !searchPanelEl.hidden) {
          searchPanelEl.hidden = true;
          if (btnToggleSearch) btnToggleSearch.classList.remove('is-active');
        }
      });
    }

    Object.keys(profileInputs).forEach((key) => {
      const input = profileInputs[key];
      if (!input) return;
      input.addEventListener('input', () => {
        saveProfile();
        if (hasSavedCustomEdit(activeId)) return;
        if (profileRepaginateTimer) clearTimeout(profileRepaginateTimer);
        profileRepaginateTimer = setTimeout(() => {
          masterHtml = buildCurrentMasterHtml();
          paginateDocument();
        }, 220);
      });
    });

    if (btnClearProfile) {
      btnClearProfile.addEventListener('click', () => {
        Object.keys(profileInputs).forEach((key) => {
          if (profileInputs[key]) profileInputs[key].value = '';
        });
        saveProfile();
        if (!hasSavedCustomEdit(activeId)) {
          masterHtml = buildCurrentMasterHtml();
          paginateDocument();
        }
      });
    }

    // Zoom, Edit, Reset, Word, Print
    if (btnZoom) {
      btnZoom.addEventListener('click', () => {
        fitToScreen = !fitToScreen;
        btnZoom.textContent = fitToScreen ? '🔍 ទំហំដើម 100%' : '📱 បង្រួមសមអេក្រង់';
        updatePageScale();
      });
    }

    if (btnEdit) {
      btnEdit.addEventListener('click', () => setEditable(!editMode));
    }

    if (btnResetLesson) {
      btnResetLesson.addEventListener('click', () => {
        if (editMode) setEditable(false, { skipSave: true });
        clearCustomEdit(activeId);
        syncCascadeControls();
        masterHtml = buildCurrentMasterHtml();
        paginateDocument();
      });
    }

    if (btnWord) {
      btnWord.addEventListener('click', () => {
        exportToWordDoc();
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        if (editMode) setEditable(false);
        shellEl.style.transform = 'none';
        shellEl.style.height = 'auto';
        window.print();
        setTimeout(updatePageScale, 300);
      });
    }

    window.addEventListener('hashchange', () => {
      const hashId = window.location.hash.replace(/^#/, '').trim();
      if (hashId && hashId !== activeId && (hashId === BLANK_ID || periodMap.has(hashId))) {
        loadAndRenderPeriod(hashId, { scrollTop: true });
      }
    });

    window.addEventListener('resize', updatePageScale);
    window.addEventListener('beforeprint', () => {
      if (editMode) setEditable(false);
      shellEl.style.transform = 'none';
      shellEl.style.height = 'auto';
    });
    window.addEventListener('afterprint', updatePageScale);
  }

  function init() {
    loadProfile();
    populateChapterSelect();
    bindEvents();

    const hashId = window.location.hash.replace(/^#/, '').trim();
    const storedId = storageGet(STORAGE_ACTIVE_ID_KEY);
    let initialId = allPeriods.length > 0 ? allPeriods[0].id : BLANK_ID;

    if (hashId && (hashId === BLANK_ID || periodMap.has(hashId))) {
      initialId = hashId;
    } else if (storedId && (storedId === BLANK_ID || periodMap.has(storedId))) {
      initialId = storedId;
    }

    loadAndRenderPeriod(initialId, { scrollTop: false });

    const repaginateSafe = () => {
      if (!editMode) paginateDocument();
    };

    window.addEventListener('load', () => {
      repaginateSafe();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(repaginateSafe);
      }
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(repaginateSafe);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
