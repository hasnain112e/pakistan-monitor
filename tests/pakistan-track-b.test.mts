import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseKse100 } from '../api/pk-kse100.js';

// Trimmed from https://dps.psx.com.pk/indices (2026-10-13). Column order:
// Index, High, Low, Current, Change, % Change.
const KSE100_ROW = '<tr><td><a class="link" href="javascript:;" data-code="KSE100"><b>KSE100</b></a></td>'
  + '<td class="right" data-order="166070.47">166,070.47</td><td class="right" data-order="164773.66">164,773.66</td>'
  + '<td class="right" data-order="164776.44">164,776.44</td>'
  + '<td class="right change__text--neg" data-order="-347.97000000000116"><i class="icon-down-dir"></i> -347.97</td>'
  + '<td class="right change__text--neg" data-order="-0.21073201714997872"><i class="icon-down-dir"></i> -0.21%</td></tr>';
const KSE100PR_ROW = '<tr><td><a class="link" data-code="KSE100PR"><b>KSE100PR</b></a></td>'
  + '<td data-order="49500.1"></td><td data-order="49400"></td><td data-order="49423.3"></td><td data-order="-10"></td><td data-order="-0.02"></td></tr>';
const page = (rows: string) => `<div style="text-align: right;">As of  Oct 13, 2026 3:50 PM</div><table><tbody>${rows}</tbody></table>`;

describe('parseKse100', () => {
  it('reads the KSE-100 row and the as-of stamp', () => {
    assert.deepEqual(parseKse100(page(KSE100PR_ROW + KSE100_ROW)), {
      value: 164776.44,
      change: -347.97000000000116,
      changePct: -0.21073201714997872,
      high: 166070.47,
      low: 164773.66,
      asOf: 'Oct 13, 2026 3:50 PM',
    });
  });

  it('never mistakes KSE100PR for KSE100', () => {
    assert.equal(parseKse100(page(KSE100PR_ROW)), null);
  });

  it('returns null when the markup no longer has five numeric columns', () => {
    assert.equal(parseKse100(page('<tr><td data-code="KSE100">KSE100</td><td data-order="1">1</td></tr>')), null);
    assert.equal(parseKse100('<html>maintenance</html>'), null);
  });
});
