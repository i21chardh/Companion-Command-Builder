function summarize(cases = []) {
  return {
    cases: cases.length,
    passed: cases.filter((item) => item.status === 'pass').length,
    failed: cases.filter((item) => item.status === 'fail').length,
    pending: cases.filter((item) => item.status === 'pending').length,
    skipped: cases.filter((item) => item.status === 'skipped').length,
  };
}
export async function runAuditEngine(processes, context = {}) {
  const results = [];
  for (const process of processes) {
    try {
      const output = await process.run(context);
      const cases = output?.cases || output?.results || [];
      const totals = output?.totals?.cases != null ? {
        cases: output.totals.cases,
        passed: output.totals.passed || 0,
        failed: output.totals.failed || 0,
        pending: output.totals.pending ?? output.totals.livePending ?? 0,
        skipped: output.totals.skipped || 0,
      } : summarize(cases);
      results.push({ id: process.id, type: process.type, status: totals.failed ? 'fail' : totals.pending ? 'pending' : 'pass', totals, cases, details: output });
    } catch (error) {
      results.push({ id: process.id, type: process.type, status: 'fail', totals: { cases: 1, passed: 0, failed: 1, pending: 0, skipped: 0 }, cases: [{ id: `${process.id}:process`, status: 'fail', reason: error.message || String(error) }] });
    }
  }
  const totals = results.reduce((sum, item) => Object.fromEntries(Object.keys(sum).map((key) => [key, sum[key] + (item.totals[key] || 0)])), { cases: 0, passed: 0, failed: 0, pending: 0, skipped: 0 });
  const gate = totals.failed ? 'FAIL' : totals.pending ? 'PASS-WITH-PENDING' : 'PASS';
  return { format: 'ccb-audit-engine', schemaVersion: 1, generatedAt: new Date().toISOString(), gate, totals, processes: results };
}
