/**
 * ឧបករណ៍ជំនួយសម្រាប់រចនាសម្ព័ន្ធជំពូក-មេរៀន-ចំណុចរង រូបមន្តគណិតវិទ្យា LaTeX (KaTeX)
 * និងរូបភាពធរណីមាត្រស្តង់ដារក្រដាសស-ខ្មៅ (MoEYS Grade 8 Mathematics)
 */
(function () {
  'use strict';

  // ប្រើសញ្ញាសម្គាល់បណ្តោះអាសន្នសម្រាប់ប្រភាគ ដើម្បីបម្លែងរួមគ្នាជាកន្សោម LaTeX ($...$) ពេញលេញ
  function F(num, den) {
    return `\uE010${num}\uE011${den}\uE012`;
  }

  // បញ្ជីជំពូកទាំង ៥ នៃកម្មវិធីសិក្សាគណិតវិទ្យាថ្នាក់ទី៨ (១៨ មេរៀន — ៤៦ ម៉ោងសិក្សា)
  const chapters = [
    {
      id: 'ch1',
      chapterNumber: 1,
      chapterNumberKh: '១',
      chapterTitle: 'ចំនួនសនិទាន ស្វ័យគុណ សមាមាត្រ និងរង្វាស់រង្វាល់',
      lessonRange: [1, 4],
      domain: 'algebra'
    },
    {
      id: 'ch2',
      chapterNumber: 2,
      chapterNumberKh: '២',
      chapterTitle: 'កន្សោមពីជគណិត សមីការ វិសមីការ និងក្រាប',
      lessonRange: [5, 9],
      domain: 'algebra'
    },
    {
      id: 'ch3',
      chapterNumber: 3,
      chapterNumberKh: '៣',
      chapterTitle: 'ស្ថិតិ និងប្រូបាប',
      lessonRange: [10, 11],
      domain: 'stats'
    },
    {
      id: 'ch4',
      chapterNumber: 4,
      chapterNumberKh: '៤',
      chapterTitle: 'ធរណីមាត្រក្នុងប្លង់ (ត្រីកោណ ចតុកោណ ផ្ទៃក្រឡា និងរង្វង់)',
      lessonRange: [12, 16],
      domain: 'geometry'
    },
    {
      id: 'ch5',
      chapterNumber: 5,
      chapterNumberKh: '៥',
      chapterTitle: 'ធរណីមាត្រក្នុងលំហ និងមាត្រដ្ឋាន',
      lessonRange: [17, 18],
      domain: 'geometry'
    }
  ];

  const SUP_MAP = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
    '⁺': '+',
    '⁻': '-',
    'ⁿ': 'n'
  };

  function convertInnerMathToTex(rawExpr, khmerSubSlots) {
    let s = rawExpr;

    // 1. Escape literal set braces { ... } BEFORE introducing any TeX braces
    s = s.replace(/\{/g, '\\{').replace(/\}/g, '\\}');

    // 2. Convert \uE010num\uE011den\uE012 into \dfrac{num}{den}
    for (let pass = 0; pass < 3; pass++) {
      if (!s.includes('\uE010')) break;
      s = s.replace(/\uE010([^\uE010\uE011\uE012]*)\uE011([^\uE010\uE011\uE012]*)\uE012/g, (_m, n, d) => {
        return `\\dfrac{${convertInnerMathToTex(n, khmerSubSlots)}}{${convertInnerMathToTex(d, khmerSubSlots)}}`;
      });
    }

    // 3. Mean bar x̄
    s = s.replace(/x\u0304/g, '\\bar{x}');

    // 4. Square roots √(...) and √123
    s = s.replace(/√\(([^()]+)\)/g, (_m, inner) => `\\sqrt{${inner}}`);
    s = s.replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}');

    // 5. Absolute value bars |...|
    s = s.replace(/\|([^|]+)\|/g, '\\left|$1\\right|');

    // 6. Angles & Geometry symbols
    s = s.replace(/∠([A-Z]{3})\b/g, '\\widehat{$1}');
    s = s.replace(/∠([A-Z0-9])\b/g, '\\widehat{$1}');
    s = s.replace(/△\s*([A-Z]{3})\b/g, '\\triangle $1');
    s = s.replace(/△/g, '\\triangle ');

    // 7. Unicode superscripts (e.g. x², cm³, 10⁻⁴)
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+/g, (supRun) => {
      const mapped = Array.from(supRun)
        .map((ch) => SUP_MAP[ch] || ch)
        .join('');
      return mapped.length === 1 ? `^${mapped}` : `^{${mapped}}`;
    });

    // 8. Degree Celsius & degree symbol
    s = s.replace(/°C\b/g, '^\\circ\\text{C}');
    s = s.replace(/°/g, '^\\circ');

    // 9. Escape % so TeX never treats it as a comment
    s = s.replace(/%/g, '\\%');

    // 10. Operators, relations, arrows, number sets, pi
    s = s
      .replace(/−/g, '-')
      .replace(/×/g, ' \\times ')
      .replace(/÷/g, ' \\div ')
      .replace(/·/g, ' \\cdot ')
      .replace(/±/g, '\\pm ')
      .replace(/≠/g, ' \\neq ')
      .replace(/≤/g, ' \\le ')
      .replace(/≥/g, ' \\ge ')
      .replace(/⇔/g, ' \\iff ')
      .replace(/⇒/g, ' \\Rightarrow ')
      .replace(/→/g, ' \\to ')
      .replace(/≈/g, ' \\approx ')
      .replace(/≅/g, ' \\cong ')
      .replace(/∥/g, ' \\parallel ')
      .replace(/⊥/g, ' \\perp ')
      .replace(/∈/g, ' \\in ')
      .replace(/∉/g, ' \\notin ')
      .replace(/∪/g, ' \\cup ')
      .replace(/∩/g, ' \\cap ')
      .replace(/∅/g, '\\emptyset ')
      .replace(/ℚ/g, '\\mathbb{Q}')
      .replace(/ℤ/g, '\\mathbb{Z}')
      .replace(/ℕ/g, '\\mathbb{N}')
      .replace(/ℝ/g, '\\mathbb{R}')
      .replace(/π(?=[a-zA-Z0-9(\\])/g, '\\pi ')
      .replace(/π/g, '\\pi');

    // 11. Format spaced thousands (e.g. 2 500 000 -> 2\,500\,000) before collapsing spaces
    for (let pass = 0; pass < 3; pass++) {
      s = s.replace(/(\d)\s+(\d{3})(?!\d)/g, '$1\\,$2');
    }

    // 12. Format metric units after numbers upright (e.g. 12 cm -> 12\text{ cm})
    s = s.replace(
      /(\d)\s+(km|hm|dam|dm|cm|mm|kg|hg|dag|dg|cg|mg|mL|L|min)\b/g,
      '$1\\text{ $2}'
    );

    // 13. Restore Khmer subscript placeholders @@KHSUB_i@@ -> _{\text{...}} and @@KHTXT_i@@ -> \text{...}
    s = s.replace(/@@KHSUB_(\d+)@@/g, (_m, idx) => {
      const khLabel = khmerSubSlots[Number(idx)] || '';
      return `_{\\text{${khLabel}}}`;
    });
    s = s.replace(/@@KHTXT_(\d+)@@/g, (_m, idx) => {
      const khTxt = khmerSubSlots[Number(idx)] || '';
      return `\\text{${khTxt}}`;
    });

    // Collapse redundant spaces
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }

  /**
   * បំបែកផ្នែកអត្ថបទត្រង់វង់ក្រចក '(' ឬ ')' ណាដែលគ្មានគូនៅក្នុងផ្នែកតែមួយ (ដូចជា "× d (d ជាអាប៉ូតែម)")
   */
  function splitAtUnmatchedParens(segment) {
    const unmatchedIndices = new Set();
    const openStack = [];
    for (let i = 0; i < segment.length; i++) {
      const ch = segment[i];
      if (ch === '(') {
        openStack.push(i);
      } else if (ch === ')') {
        if (openStack.length > 0) {
          openStack.pop();
        } else {
          // Allow standalone list markers like "1)" at the very start of a segment
          const before = segment.slice(0, i);
          if (!/^\s*[1-9]$/.test(before)) {
            unmatchedIndices.add(i);
          }
        }
      }
    }
    openStack.forEach((idx) => unmatchedIndices.add(idx));

    if (unmatchedIndices.size === 0) return [segment];

    const parts = [];
    let last = 0;
    Array.from(unmatchedIndices)
      .sort((a, b) => a - b)
      .forEach((idx) => {
        if (idx > last) parts.push({ text: segment.slice(last, idx), isParen: false });
        parts.push({ text: segment[idx], isParen: true });
        last = idx + 1;
      });
    if (last < segment.length) {
      parts.push({ text: segment.slice(last), isParen: false });
    }
    return parts;
  }

  function formatSingleMathSubsegment(sub, khmerSubSlots) {
    if (!/[0-9A-Za-z\uE010△∠πℚℤℕℝ√]/.test(sub)) {
      return sub;
    }

    let prefix = '';
    let core = sub;
    let suffix = '';

    const leadMatch = core.match(/^([\s,;:.•]+|-\s+)/);
    if (leadMatch) {
      prefix += leadMatch[0];
      core = core.slice(leadMatch[0].length);
    }

    const trailMatch = core.match(/([\s,;:]+|\.(?=\s|$))$/);
    if (trailMatch) {
      suffix = trailMatch[0] + suffix;
      core = core.slice(0, core.length - trailMatch[0].length);
    }

    if (!core || /^\d+[.)]?$/.test(core) || !/[0-9A-Za-z\uE010△∠πℚℤℕℝ√]/.test(core)) {
      return sub;
    }

    const tex = convertInnerMathToTex(core, khmerSubSlots);
    return `${prefix}$${tex}$${suffix}`;
  }

  /**
   * បម្លែងកន្សោមគណិតវិទ្យាក្នុងអត្ថបទខ្មែរឱ្យទៅជា LaTeX ($...$) ស្តង់ដារ KaTeX ដោយរក្សាអក្សរខ្មែរ និងស្លាក HTML ឱ្យនៅដដែល
   */
  function toLatexString(input) {
    if (typeof input !== 'string' || !input) return input;
    if (input.includes('<svg')) return input;

    const khmerSubSlots = [];
    const protectedTokens = [];

    const protect = (val) => {
      const id = protectedTokens.length;
      protectedTokens.push(val);
      return `\uE000${id}\uE001`;
    };

    let work = input;

    // Convert S<sub>ខាង</sub> and S_ខាង into Khmer subscript slots attached to the math variable
    work = work.replace(
      /([A-Za-z])(?:<sub>([\u1780-\u17FF]+)<\/sub>|_([\u1780-\u17FF]+))/g,
      (_m, sym, sub1, sub2) => {
        const idx = khmerSubSlots.length;
        khmerSubSlots.push(sub1 || sub2);
        return `${sym}@@KHSUB_${idx}@@`;
      }
    );

    // Replace any Khmer text inside F(num, den) (\uE010...\uE011...\uE012) with @@KHTXT_i@@ so word-fractions stay intact
    for (let pass = 0; pass < 3; pass++) {
      if (!work.includes('\uE010')) break;
      const prev = work;
      work = work.replace(
        /\uE010([^\uE010\uE011\uE012]*)\uE011([^\uE010\uE011\uE012]*)\uE012/g,
        (_m, n, d) => {
          const encodeKh = (part) =>
            part.replace(
              /[\u1780-\u17FF\u19E0-\u19FF]+(?:[\s\-][\u1780-\u17FF\u19E0-\u19FF]+)*/g,
              (kh) => {
                const idx = khmerSubSlots.length;
                khmerSubSlots.push(kh);
                return `@@KHTXT_${idx}@@`;
              }
            );
          return `\uE010${encodeKh(n)}\uE011${encodeKh(d)}\uE012`;
        }
      );
      if (work === prev) break;
    }

    // Protect HTML tags (<strong>, </strong>) and non-math labels (5E, 3D, E1-E5)
    work = work.replace(/<\/?[a-zA-Z0-9-]+[^>]*>/g, (tag) => protect(tag));
    work = work.replace(/\b(5E|3D|E[1-5])\b/g, (lbl) => protect(lbl));

    // Match candidate non-Khmer segments between Khmer text / protected tokens
    const nonKhmerRegex = /[^\u1780-\u17FF\u19E0-\u19FF។៕៖ៗ៘«»“”•\uE000\uE001]+/g;

    work = work.replace(nonKhmerRegex, (segment) => {
      if (!/[0-9A-Za-z\uE010△∠πℚℤℕℝ√]/.test(segment)) {
        return segment;
      }
      const pieces = splitAtUnmatchedParens(segment);
      if (typeof pieces[0] === 'string') {
        return formatSingleMathSubsegment(pieces[0], khmerSubSlots);
      }
      return pieces
        .map((p) => (p.isParen ? p.text : formatSingleMathSubsegment(p.text, khmerSubSlots)))
        .join('');
    });

    // Restore protected HTML tags and labels
    work = work.replace(/\uE000(\d+)\uE001/g, (_m, id) => protectedTokens[Number(id)] || '');
    return work;
  }

  function stripToPlainLabel(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/\uE010([^\uE010\uE011\uE012]*)\uE011([^\uE010\uE011\uE012]*)\uE012/g, '($1/$2)');
  }

  const diagrams = {
    numberLineRational: `
      <div class="diagram-box">
        <svg viewBox="0 0 320 62" width="290" height="56" xmlns="http://www.w3.org/2000/svg" aria-label="បន្ទាត់ចំនួនសនិទាន">
          <line x1="14" y1="34" x2="306" y2="34" stroke="#000" stroke-width="1.3"/>
          <polygon points="308,34 300,30 300,38" fill="#000"/>
          <polygon points="12,34 20,30 20,38" fill="#000"/>
          <line x1="40" y1="28" x2="40" y2="40" stroke="#000" stroke-width="1.3"/>
          <text x="40" y="53" font-size="10" text-anchor="middle" fill="#000">-2</text>
          <line x1="100" y1="28" x2="100" y2="40" stroke="#000" stroke-width="1.3"/>
          <text x="100" y="53" font-size="10" text-anchor="middle" fill="#000">-1</text>
          <line x1="160" y1="26" x2="160" y2="42" stroke="#000" stroke-width="1.6"/>
          <text x="160" y="53" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">0</text>
          <line x1="220" y1="28" x2="220" y2="40" stroke="#000" stroke-width="1.3"/>
          <text x="220" y="53" font-size="10" text-anchor="middle" fill="#000">1</text>
          <line x1="280" y1="28" x2="280" y2="40" stroke="#000" stroke-width="1.3"/>
          <text x="280" y="53" font-size="10" text-anchor="middle" fill="#000">2</text>
          <circle cx="70" cy="34" r="3.3" fill="#000"/>
          <text x="70" y="21" font-size="9.5" font-weight="bold" text-anchor="middle" fill="#000">C(-3/2)</text>
          <circle cx="115" cy="34" r="3.3" fill="#000"/>
          <text x="115" y="21" font-size="9.5" font-weight="bold" text-anchor="middle" fill="#000">A(-3/4)</text>
          <circle cx="235" cy="34" r="3.3" fill="#000"/>
          <text x="235" y="21" font-size="9.5" font-weight="bold" text-anchor="middle" fill="#000">N(5/4)</text>
        </svg>
        <div class="diagram-caption">រូបទី១ ៖ ការដៅចំណុចតាងចំនួនសនិទានលើបន្ទាត់ចំនួន</div>
      </div>`,

    areaSquareBinomial: `
      <div class="diagram-box">
        <svg viewBox="0 0 180 148" width="168" height="138" xmlns="http://www.w3.org/2000/svg" aria-label="ផ្ទៃក្រឡាការេទ្វេធា">
          <rect x="28" y="18" width="112" height="112" fill="none" stroke="#000" stroke-width="1.4"/>
          <line x1="98" y1="18" x2="98" y2="130" stroke="#000" stroke-width="1.1" stroke-dasharray="3,2"/>
          <line x1="28" y1="88" x2="140" y2="88" stroke="#000" stroke-width="1.1" stroke-dasharray="3,2"/>
          <text x="63" y="57" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">a²</text>
          <text x="119" y="57" font-size="11" text-anchor="middle" fill="#000">ab</text>
          <text x="63" y="113" font-size="11" text-anchor="middle" fill="#000">ab</text>
          <text x="119" y="113" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">b²</text>
          <text x="63" y="13" font-size="10" text-anchor="middle" fill="#000">a</text>
          <text x="119" y="13" font-size="10" text-anchor="middle" fill="#000">b</text>
          <text x="17" y="56" font-size="10" text-anchor="middle" fill="#000">a</text>
          <text x="17" y="112" font-size="10" text-anchor="middle" fill="#000">b</text>
        </svg>
        <div class="diagram-caption">រូបបកស្រាយធរណីមាត្រ ៖ $(a + b)^2 = a^2 + 2ab + b^2$</div>
      </div>`,

    inequalityRay: `
      <div class="diagram-box">
        <svg viewBox="0 0 300 58" width="275" height="52" xmlns="http://www.w3.org/2000/svg" aria-label="សំណុំចម្លើយវិសមីការលើបន្ទាត់ចំនួន">
          <line x1="16" y1="32" x2="284" y2="32" stroke="#000" stroke-width="1.2"/>
          <polygon points="286,32 278,28 278,36" fill="#000"/>
          <line x1="70" y1="27" x2="70" y2="37" stroke="#000" stroke-width="1.1"/>
          <text x="70" y="49" font-size="9.5" text-anchor="middle" fill="#000">0</text>
          <line x1="140" y1="25" x2="140" y2="39" stroke="#000" stroke-width="1.4"/>
          <text x="140" y="49" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">2</text>
          <line x1="140" y1="32" x2="278" y2="32" stroke="#000" stroke-width="3.2"/>
          <circle cx="140" cy="32" r="4" fill="#000"/>
          <line x1="35" y1="27" x2="29" y2="37" stroke="#555" stroke-width="1"/>
          <line x1="55" y1="27" x2="49" y2="37" stroke="#555" stroke-width="1"/>
          <line x1="95" y1="27" x2="89" y2="37" stroke="#555" stroke-width="1"/>
          <line x1="115" y1="27" x2="109" y2="37" stroke="#555" stroke-width="1"/>
          <text x="205" y="20" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">x ≥ 2</text>
        </svg>
        <div class="diagram-caption">ការបកស្រាយសំណុំចម្លើយ $x \\ge 2$ លើបន្ទាត់ចំនួន</div>
      </div>`,

    coordinateGraph: `
      <div class="diagram-box">
        <svg viewBox="0 0 210 175" width="195" height="162" xmlns="http://www.w3.org/2000/svg" aria-label="ប្លង់កូអរដោនេ និងក្រាបបន្ទាត់">
          <g stroke="#d4d4d8" stroke-width="0.6">
            <line x1="45" y1="15" x2="45" y2="155"/><line x1="75" y1="15" x2="75" y2="155"/>
            <line x1="135" y1="15" x2="135" y2="155"/><line x1="165" y1="15" x2="165" y2="155"/>
            <line x1="25" y1="35" x2="185" y2="35"/><line x1="25" y1="65" x2="185" y2="65"/>
            <line x1="25" y1="125" x2="185" y2="125"/>
          </g>
          <line x1="20" y1="95" x2="192" y2="95" stroke="#000" stroke-width="1.3"/>
          <polygon points="194,95 187,91.5 187,98.5" fill="#000"/>
          <line x1="105" y1="160" x2="105" y2="12" stroke="#000" stroke-width="1.3"/>
          <polygon points="105,10 101.5,17 108.5,17" fill="#000"/>
          <text x="190" y="108" font-size="10" font-weight="bold" fill="#000">x</text>
          <text x="113" y="18" font-size="10" font-weight="bold" fill="#000">y</text>
          <text x="97" y="107" font-size="9.5" fill="#000">O</text>
          <line x1="75" y1="155" x2="160" y2="15" stroke="#000" stroke-width="1.7"/>
          <circle cx="105" cy="125" r="3.2" fill="#000"/>
          <text x="128" y="130" font-size="9" fill="#000">A(0, -1)</text>
          <circle cx="135" cy="65" r="3.2" fill="#000"/>
          <text x="157" y="68" font-size="9" fill="#000">B(1, 1)</text>
        </svg>
        <div class="diagram-caption">ក្រាបនៃបន្ទាត់ $(d) : y = 2x - 1$ កាត់តាម $A(0, -1)$ និង $B(1, 1)$</div>
      </div>`,

    congruentTriangles: `
      <div class="diagram-box">
        <svg viewBox="0 0 290 115" width="270" height="106" xmlns="http://www.w3.org/2000/svg" aria-label="ត្រីកោណប៉ុនគ្នា">
          <polygon points="24,92 122,92 56,24" fill="none" stroke="#000" stroke-width="1.4"/>
          <text x="16" y="98" font-size="10" font-weight="bold" fill="#000">B</text>
          <text x="127" y="98" font-size="10" font-weight="bold" fill="#000">C</text>
          <text x="54" y="18" font-size="10" font-weight="bold" fill="#000">A</text>
          <line x1="36" y1="56" x2="44" y2="60" stroke="#000" stroke-width="1.3"/>
          <line x1="71" y1="88" x2="71" y2="96" stroke="#000" stroke-width="1.3"/>
          <line x1="75" y1="88" x2="75" y2="96" stroke="#000" stroke-width="1.3"/>
          <path d="M 38,92 A 14,14 0 0 0 30,79" fill="none" stroke="#000" stroke-width="1.2"/>
          <text x="146" y="62" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">≅</text>
          <polygon points="168,92 266,92 200,24" fill="none" stroke="#000" stroke-width="1.4"/>
          <text x="160" y="98" font-size="10" font-weight="bold" fill="#000">E</text>
          <text x="271" y="98" font-size="10" font-weight="bold" fill="#000">F</text>
          <text x="198" y="18" font-size="10" font-weight="bold" fill="#000">D</text>
          <line x1="180" y1="56" x2="188" y2="60" stroke="#000" stroke-width="1.3"/>
          <line x1="215" y1="88" x2="215" y2="96" stroke="#000" stroke-width="1.3"/>
          <line x1="219" y1="88" x2="219" y2="96" stroke="#000" stroke-width="1.3"/>
          <path d="M 182,92 A 14,14 0 0 0 174,79" fill="none" stroke="#000" stroke-width="1.2"/>
        </svg>
        <div class="diagram-caption">ត្រីកោណប៉ុនគ្នាតាមករណី ជ.ម.ជ ៖ $\\triangle ABC \\cong \\triangle DEF$</div>
      </div>`,

    parallelogramProps: `
      <div class="diagram-box">
        <svg viewBox="0 0 250 118" width="232" height="108" xmlns="http://www.w3.org/2000/svg" aria-label="ប្រលេឡូក្រាម ABCD">
          <polygon points="58,22 216,22 182,96 24,96" fill="none" stroke="#000" stroke-width="1.4"/>
          <line x1="58" y1="22" x2="182" y2="96" stroke="#000" stroke-width="1" stroke-dasharray="4,2"/>
          <line x1="24" y1="96" x2="216" y2="22" stroke="#000" stroke-width="1" stroke-dasharray="4,2"/>
          <circle cx="120" cy="59" r="2.8" fill="#000"/>
          <text x="50" y="17" font-size="10" font-weight="bold" fill="#000">A</text>
          <text x="220" y="19" font-size="10" font-weight="bold" fill="#000">B</text>
          <text x="187" y="104" font-size="10" font-weight="bold" fill="#000">C</text>
          <text x="13" y="104" font-size="10" font-weight="bold" fill="#000">D</text>
          <text x="120" y="51" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">O</text>
        </svg>
        <div class="diagram-caption">ប្រលេឡូក្រាម $ABCD$ ដែលអង្កត់ទ្រូង $AC$ និង $BD$ កាត់គ្នាត្រង់ចំណុចកណ្តាល $O$</div>
      </div>`,

    circleTangent: `
      <div class="diagram-box">
        <svg viewBox="0 0 240 132" width="222" height="122" xmlns="http://www.w3.org/2000/svg" aria-label="រង្វង់ និងបន្ទាត់ប៉ះ">
          <circle cx="115" cy="58" r="42" fill="none" stroke="#000" stroke-width="1.4"/>
          <circle cx="115" cy="58" r="2.6" fill="#000"/>
          <text x="106" y="54" font-size="10" font-weight="bold" fill="#000">O</text>
          <line x1="115" y1="58" x2="115" y2="100" stroke="#000" stroke-width="1.2"/>
          <rect x="115" y="92" width="8" height="8" fill="none" stroke="#000" stroke-width="1"/>
          <line x1="35" y1="100" x2="205" y2="100" stroke="#000" stroke-width="1.4"/>
          <circle cx="115" cy="100" r="2.6" fill="#000"/>
          <text x="115" y="114" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">T</text>
          <text x="198" y="94" font-size="10" font-style="italic" fill="#000">(d)</text>
          <line x1="80" y1="35" x2="152" y2="38" stroke="#000" stroke-width="1.1"/>
          <text x="72" y="34" font-size="9.5" fill="#000">A</text>
          <text x="157" y="38" font-size="9.5" fill="#000">B</text>
        </svg>
        <div class="diagram-caption">អង្កត់ធ្នូ $AB$ និងបន្ទាត់ប៉ះ $(d) \\perp OT$ ត្រង់ចំណុចប៉ះ $T$</div>
      </div>`,

    triangleCentroid: `
      <div class="diagram-box">
        <svg viewBox="0 0 230 132" width="212" height="122" xmlns="http://www.w3.org/2000/svg" aria-label="ទីប្រជុំទម្ងន់ G នៃត្រីកោណ">
          <polygon points="95,16 26,112 198,112" fill="none" stroke="#000" stroke-width="1.4"/>
          <line x1="95" y1="16" x2="112" y2="112" stroke="#000" stroke-width="1" stroke-dasharray="4,2"/>
          <line x1="26" y1="112" x2="146.5" y2="64" stroke="#000" stroke-width="1" stroke-dasharray="4,2"/>
          <line x1="198" y1="112" x2="60.5" y2="64" stroke="#000" stroke-width="1" stroke-dasharray="4,2"/>
          <circle cx="106.3" cy="80" r="3.2" fill="#000"/>
          <text x="95" y="12" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">A</text>
          <text x="16" y="116" font-size="10" font-weight="bold" fill="#000">B</text>
          <text x="203" y="116" font-size="10" font-weight="bold" fill="#000">C</text>
          <text x="112" y="125" font-size="9.5" text-anchor="middle" fill="#000">M</text>
          <text x="116" y="77" font-size="10" font-weight="bold" fill="#000">G</text>
        </svg>
        <div class="diagram-caption">មេដ្យានទាំងបីជួបគ្នាត្រង់ទីប្រជុំទម្ងន់ $G$ ដែល $AG = \\dfrac{2}{3}AM$</div>
      </div>`,

    cylinderSolid: `
      <div class="diagram-box">
        <svg viewBox="0 0 210 132" width="194" height="122" xmlns="http://www.w3.org/2000/svg" aria-label="ស៊ីឡាំងបង្វិល">
          <ellipse cx="105" cy="26" rx="46" ry="13" fill="none" stroke="#000" stroke-width="1.3"/>
          <path d="M 59,98 A 46,13 0 0 0 151,98" fill="none" stroke="#000" stroke-width="1.3"/>
          <path d="M 59,98 A 46,13 0 0 1 151,98" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="3,2"/>
          <line x1="59" y1="26" x2="59" y2="98" stroke="#000" stroke-width="1.3"/>
          <line x1="151" y1="26" x2="151" y2="98" stroke="#000" stroke-width="1.3"/>
          <line x1="105" y1="26" x2="151" y2="26" stroke="#000" stroke-width="1.1"/>
          <line x1="105" y1="26" x2="105" y2="98" stroke="#000" stroke-width="1" stroke-dasharray="3,2"/>
          <circle cx="105" cy="26" r="2.2" fill="#000"/>
          <circle cx="105" cy="98" r="2.2" fill="#000"/>
          <text x="126" y="22" font-size="10" font-weight="bold" fill="#000">r</text>
          <text x="112" y="66" font-size="10" font-weight="bold" fill="#000">h</text>
        </svg>
        <div class="diagram-caption">ស៊ីឡាំងបង្វិលកាំបាត $r$ និងកម្ពស់ $h$ ($V = \\pi r^2 h$)</div>
      </div>`
  };

  let isFinalized = false;

  function findChapterForLesson(lessonNumber) {
    return (
      chapters.find(
        (ch) => lessonNumber >= ch.lessonRange[0] && lessonNumber <= ch.lessonRange[1]
      ) || chapters[0]
    );
  }

  function mapDeepLatex(node) {
    if (typeof node === 'string') {
      return toLatexString(node);
    }
    if (Array.isArray(node)) {
      return node.map(mapDeepLatex);
    }
    if (node && typeof node === 'object') {
      const out = {};
      Object.keys(node).forEach((k) => {
        if (k === 'diagramHtml') {
          out[k] = node[k];
        } else {
          out[k] = mapDeepLatex(node[k]);
        }
      });
      return out;
    }
    return node;
  }

  // រូបមន្តគោលដាក់ចំកណ្ដាលជួរ ($$...$$ Display LaTeX) សម្រាប់គ្រប់ ៤៦ ម៉ោងសិក្សា (Rule 6)
  const displayFormulas = {
    'g8-l01-h1': '$$\\mathbb{Q} = \\left\\{\\,\\dfrac{a}{b} \\;\\middle|\\; a, b \\in \\mathbb{Z},\\; b \\neq 0\\,\\right\\}, \\qquad \\dfrac{-a}{b} = \\dfrac{a}{-b} = -\\dfrac{a}{b}$$',
    'g8-l01-h2': '$$\\dfrac{a}{b} < \\dfrac{c}{d} \\iff ad < bc \\quad (b > 0,\\; d > 0)$$',
    'g8-l01-h3': '$$\\dfrac{a}{b} \\pm \\dfrac{c}{d} = \\dfrac{ad \\pm bc}{bd} \\quad (b \\neq 0,\\; d \\neq 0)$$',
    'g8-l01-h4': '$$\\dfrac{a}{b} \\times \\dfrac{c}{d} = \\dfrac{ac}{bd}, \\qquad \\dfrac{a}{b} \\div \\dfrac{c}{d} = \\dfrac{a}{b} \\times \\dfrac{d}{c} = \\dfrac{ad}{bc}$$',
    'g8-l02-h1': '$$a^m \\times a^n = a^{m+n}, \\qquad \\dfrac{a^m}{a^n} = a^{m-n} \\quad (a \\neq 0)$$',
    'g8-l02-h2': '$$(a^m)^n = a^{mn}, \\qquad (ab)^n = a^n b^n, \\qquad \\left(\\dfrac{a}{b}\\right)^n = \\dfrac{a^n}{b^n} \\quad (b \\neq 0)$$',
    'g8-l02-h3': '$$a^0 = 1,\\quad a^{-n} = \\dfrac{1}{a^n}\\;(a \\neq 0), \\qquad A = c \\times 10^n\\;(1 \\le c < 10,\\; n \\in \\mathbb{Z})$$',
    'g8-l03-h1': '$$\\dfrac{a}{b} = \\dfrac{c}{d} \\iff a \\times d = b \\times c \\quad (b \\neq 0,\\; d \\neq 0)$$',
    'g8-l03-h2': '$$y = kx \\;\\left(\\dfrac{y}{x} = k\\right), \\qquad y = \\dfrac{k}{x} \\;(x \\times y = k,\\; k \\neq 0)$$',
    'g8-l03-h3': '$$I = \\dfrac{P \\times r \\times t}{100}, \\qquad A = P + I$$',
    'g8-l04-h1': '$$1\\,\\text{km} = 1\\,000\\,\\text{m}, \\qquad 1\\,\\text{t} = 1\\,000\\,\\text{kg}, \\qquad 1\\,\\text{L} = 1\\,000\\,\\text{mL}$$',
    'g8-l04-h2': '$$1\\,\\text{ha} = 10\\,000\\,\\text{m}^2, \\qquad 1\\,\\text{dm}^3 = 1\\,\\text{L}, \\qquad v = \\dfrac{d}{t}$$',
    'g8-l05-h1': '$$ax^n + bx^n = (a + b)x^n, \\qquad A(x) - B(x) = A(x) + [-B(x)]$$',
    'g8-l05-h2': '$$(a + b)(c + d) = ac + ad + bc + bd$$',
    'g8-l05-h3': '$$(a \\pm b)^2 = a^2 \\pm 2ab + b^2, \\qquad (a - b)(a + b) = a^2 - b^2$$',
    'g8-l05-h4': '$$ab + ac = a(b + c), \\qquad a^2 - b^2 = (a - b)(a + b), \\qquad a^2 \\pm 2ab + b^2 = (a \\pm b)^2$$',
    'g8-l06-h1': '$$\\dfrac{A \\cdot K}{B \\cdot K} = \\dfrac{A}{B} \\quad (B \\neq 0,\\; K \\neq 0)$$',
    'g8-l06-h2': '$$\\dfrac{A}{B} \\times \\dfrac{C}{D} = \\dfrac{A \\cdot C}{B \\cdot D}, \\qquad \\dfrac{A}{B} \\div \\dfrac{C}{D} = \\dfrac{A}{B} \\times \\dfrac{D}{C} = \\dfrac{A \\cdot D}{B \\cdot C}$$',
    'g8-l06-h3': '$$\\dfrac{A}{M} \\pm \\dfrac{B}{M} = \\dfrac{A \\pm B}{M}, \\qquad \\dfrac{A}{B} \\pm \\dfrac{C}{D} = \\dfrac{AD \\pm BC}{BD}$$',
    'g8-l07-h1': '$$ax + b = cx + d \\iff (a - c)x = d - b \\implies x = \\dfrac{d - b}{a - c} \\quad (a \\neq c)$$',
    'g8-l07-h2': '$$\\dfrac{A(x)}{m} = \\dfrac{B(x)}{n} \\iff n \\cdot A(x) = m \\cdot B(x) \\quad (m \\neq 0,\\; n \\neq 0)$$',
    'g8-l07-h3': '$$d = v \\times t \\implies t = \\dfrac{d}{v}, \\qquad \\text{សមីការតុល្យភាព ៖ } A(x) = B(x)$$',
    'g8-l08-h1': '$$a < b \\implies \\begin{cases} a + c < b + c \\\\ ac < bc & (c > 0) \\\\ ac > bc & (c < 0) \\end{cases}$$',
    'g8-l08-h2': '$$ax + b > 0 \\implies \\begin{cases} x > -\\dfrac{b}{a} & (a > 0) \\\\[6pt] x < -\\dfrac{b}{a} & (a < 0) \\end{cases}$$',
    'g8-l09-h1': '$$M(x,\\, y) \\;:\\; x \\text{ ជាអាប់ស៊ីស (លើ } Ox\\text{)}, \\quad y \\text{ ជាអរដោនេ (លើ } Oy\\text{)}$$',
    'g8-l09-h2': '$$y = ax + b \\quad \\left(x = 0 \\Rightarrow y = b,\\;\\; y = 0 \\Rightarrow x = -\\dfrac{b}{a}\\right)$$',
    'g8-l10-h1': '$$f_i = \\dfrac{n_i}{N} \\times 100\\%, \\qquad \\alpha_i = \\dfrac{n_i}{N} \\times 360^\\circ, \\qquad N = \\sum n_i$$',
    'g8-l10-h2': '$$\\bar{x} = \\dfrac{x_1 n_1 + x_2 n_2 + \\dots + x_k n_k}{N}$$',
    'g8-l11-h1': '$$\\Omega = \\{\\omega_1, \\omega_2, \\dots, \\omega_n\\}, \\qquad A \\subseteq \\Omega, \\qquad n(A) \\le n(\\Omega)$$',
    'g8-l11-h2': '$$P(A) = \\dfrac{n(A)}{n(\\Omega)}, \\qquad 0 \\le P(A) \\le 1, \\qquad P(\\overline{A}) = 1 - P(A)$$',
    'g8-l12-h1': '$$AB = A\'B\',\\; \\widehat{B} = \\widehat{B\'},\\; BC = B\'C\' \\implies \\triangle ABC \\cong \\triangle A\'B\'C\' \\;\\text{(ជ.ម.ជ)}$$',
    'g8-l12-h2': '$$\\triangle ABC \\cong \\triangle A\'B\'C\' \\quad \\text{តាមករណី (ម.ជ.ម) ឬ (ជ.ជ.ជ)}$$',
    'g8-l12-h3': '$$\\widehat{B} = \\widehat{B\'} = 90^\\circ,\\; AC = A\'C\',\\; AB = A\'B\' \\implies \\triangle ABC \\cong \\triangle A\'B\'C\'$$',
    'g8-l13-h1': '$$\\widehat{A} + \\widehat{B} + \\widehat{C} + \\widehat{D} = 360^\\circ, \\qquad ABCD \\text{ ប្រលេឡូក្រាម} \\iff AB \\parallel DC,\\; AD \\parallel BC$$',
    'g8-l13-h2': '$$AC = BD \\;\\text{(ចតុកោណកែង)}, \\qquad AC \\perp BD \\;\\text{(ចតុកោណស្មើ)}, \\qquad AC = BD \\text{ និង } AC \\perp BD \\;\\text{(ការេ)}$$',
    'g8-l13-h3': '$$MN \\parallel BC,\\; MN = \\dfrac{1}{2}BC, \\qquad EF = \\dfrac{AB + DC}{2}$$',
    'g8-l14-h1': '$$S_{\\text{ចតុកោណកែង}} = a \\times b, \\qquad S_{\\text{ប្រលេឡូក្រាម}} = b \\times h, \\qquad S_{\\triangle} = \\dfrac{1}{2} \\times b \\times h$$',
    'g8-l14-h2': '$$S_{\\text{ចតុកោណព្នាយ}} = \\dfrac{(a + b) \\times h}{2}, \\qquad S_{\\text{ចតុកោណស្មើ}} = \\dfrac{d_1 \\times d_2}{2}$$',
    'g8-l15-h1': '$$OH \\perp AB \\implies HA = HB, \\qquad (d) \\text{ ប៉ះ } \\mathcal{C}(O, R) \\text{ ត្រង់ } T \\iff OT \\perp (d)$$',
    'g8-l15-h2': '$$C = 2\\pi R,\\quad S = \\pi R^2,\\quad l = \\dfrac{n^\\circ}{360^\\circ} \\times 2\\pi R,\\quad S_{\\text{ចម្រៀក}} = \\dfrac{n^\\circ}{360^\\circ} \\times \\pi R^2$$',
    'g8-l16-h1': '$$OA = OB = OC = R \\;\\text{(ផ្ចិតរង្វង់ចារឹកក្រៅ)}, \\qquad ID = IE = IF = r \\;\\text{(ផ្ចិតរង្វង់ចារឹកក្នុង)}$$',
    'g8-l16-h2': '$$AG = \\dfrac{2}{3}AM,\\quad GM = \\dfrac{1}{3}AM,\\quad AG = 2GM$$',
    'g8-l17-h1': '$$S_{\\text{ខាង}} = 2\\pi r h, \\qquad S_{\\text{សរុប}} = 2\\pi r h + 2\\pi r^2, \\qquad V = B \\times h = \\pi r^2 h$$',
    'g8-l17-h2': '$$S_{\\text{ខាងពីរ៉ាមីត}} = \\dfrac{1}{2} P \\cdot d, \\qquad V_{\\text{ពីរ៉ាមីត}} = \\dfrac{1}{3} B \\cdot h, \\qquad V_{\\text{កោន}} = \\dfrac{1}{3} \\pi r^2 h$$',
    'g8-l18-h1': '$$k = \\dfrac{d_{\\text{ប្លង់}}}{d_{\\text{ពិត}}} = \\dfrac{1}{N} \\quad (\\text{គិតជាឯកតាប្រវែងដូចគ្នា})$$',
    'g8-l18-h2': '$$d_{\\text{ប្លង់}} = d_{\\text{ពិត}} \\times k, \\qquad d_{\\text{ពិត}} = \\dfrac{d_{\\text{ប្លង់}}}{k}, \\qquad S_{\\text{ពិត}} = \\dfrac{S_{\\text{ប្លង់}}}{k^2}$$'
  };

  function finalizeCurriculum() {
    if (isFinalized) return window.G8LessonLibrary;
    isFinalized = true;

    const periods = window.G8LessonLibrary.periods;
    periods.forEach((p) => {
      const ch = findChapterForLesson(p.lessonNumber);
      p.chapterId = ch.id;
      p.chapterNumber = ch.chapterNumber;
      p.chapterNumberKh = ch.chapterNumberKh;
      p.chapterTitle = ch.chapterTitle;

      // បម្លែងចំណងជើងរងឱ្យមានលេខមេរៀន.លេខចំណុចរង ស្តង់ដារ ឧ. «១.៤. ...» (Rule 2 & Rule 4)
      const numberedSub = String(p.subTopic || '').replace(
        /^[០-៩]+\.\s*/,
        `${p.lessonNumberKh}.${p.periodNumberKh}. `
      );
      p.subTopic = numberedSub;
      p.subTopicPlain = stripToPlainLabel(numberedSub);
      p.subTopicLatex = toLatexString(numberedSub);
      p.displayFormula = displayFormulas[p.id] || '';

      p.objectives = mapDeepLatex(p.objectives);
      p.step2 = mapDeepLatex(p.step2);
      p.step3 = mapDeepLatex(p.step3);
      p.step4 = mapDeepLatex(p.step4);
      p.step5 = mapDeepLatex(p.step5);
    });

    return window.G8LessonLibrary;
  }

  window.G8LessonLibrary = {
    F,
    chapters,
    diagrams,
    displayFormulas,
    periods: [],
    toLatexString,
    finalizeCurriculum
  };
})();
